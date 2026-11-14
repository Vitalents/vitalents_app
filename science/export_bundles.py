#!/usr/bin/env python3
"""Export Shaimaa's S1-S4 mission replay (science/simulator.py) as app scenario bundles (FR-SIM-02).

Usage (repo root or science/):
  python3 science/export_bundles.py                       # runs science.simulator.run_all() in-process
  python3 science/export_bundles.py --replay mission_replay.json

Writes science/out/scenarios/S1..S5.json in the bundle shape of app/public/data/fixtures/S1.json
({"bundle_version": "1.0", "notes": ..., "<entity>": [records]}), valid under scripts/validate_data.py,
and science/out/export_manifest.json (date shift, ID map, dropped fields, comparison with the
hand-made fixtures). It never writes app/public/data/fixtures/.

The replay is the source of every value. The export only adapts it to contract v1.0
(docs/CONTRACT_P0.md); each adaptation is listed here and in the manifest:

  1. Calendar. The replay's review day (2026-11-20) becomes mission day 27 = 2026-11-14 (D-2), the
     app's "today". Every date and UTC timestamp moves by the same whole number of days, so times of
     day, intervals and ordering are unchanged.
  2. IDs. Replay IDs `sim:crew:01:<entity>:<label>` become D-1 IDs `sim:<entity>:c01-<label>`;
     date labels become mission days (`d27`), event labels `d27-t000`, `reference` becomes
     `personal_reference`. Subject IDs (`sim:crew:01`) are unchanged.
  3. schema_version "0.9" becomes the contract's "1.0"; fields the v1.0 schema does not have are
     dropped (listed in the manifest).
  4. Fields v1.0 requires that the replay leaves out: mission_schedule.item_kind = "task"; built-in
     rules.py findings without rule metadata get rule_id `rule:builtin-<finding_kind>`, rule_version
     = the rules engine version, owner_role "astronaut" (provisional mapping; the handoff asks for
     this mapping before import); a review_request finding without `limitations` gets the team's
     existing wording from the S1 fixture.
  5. Added from the replay's own outputs: the rest window (schedule result) as a mission_schedule
     record with item_kind "rest_window"; `frozen`/`freeze_reason` on a reference whose series has a
     freeze decision; information_status rows from science/status.py with the replay's DECODE ledger
     attestation (science/decode.py `events_verified`).
  6. simulator_scenario.crew_subject_ids lists only the bundle's own crew member.
  7. Not exported: the S1 plan's rule_definition and evidence_source (files, not bundle records, in
     CONTRACT_P0 section 2; the replay's license_status is not a contract enum value) and the S4
     specialist preview (a share_package needs a confirmed sharing permission, which the replay does
     not have; the app creates it when the astronaut confirms the preview).

S5 is not in the replay; science/out/scenarios/S5.json is a byte copy of app/public/data/fixtures/S5.json.
"""
import argparse
import copy
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from science import simulator, status  # noqa: E402

EXPORT_VERSION = "export-1.0"
SCHEMA_VERSION = "1.0"
ANCHOR_DATE, ANCHOR_DAY = date(2026, 11, 14), 27          # contract D-2
OUT_DIR = HERE / "out"
FIXTURES = ROOT / "app/public/data/fixtures"
CONTRACTS = ROOT / "contracts"
ENTITY_ORDER = (
    "simulator_scenario", "subject_profile", "sleep_record", "measurement", "information_status",
    "self_report", "decode_session", "decode_response_event", "personal_reference", "finding", "action",
    "follow_up", "mission_schedule", "daily_review",
)
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
UTC_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$")
REPLAY_ID_RE = re.compile(r"^sim:crew:([A-Za-z0-9]+):([a-z_]+):(.+)$")
ENTITY_ALIAS = {"reference": "personal_reference"}
# Existing team wording (S1 fixture, pain finding) for a review request the replay leaves without limitations.
REVIEW_LIMITATION = "A self-report; the medical team decides what it means."
INFO_PREFIX = {"sleep_record": "sl-", "measurement": "", "decode_session": "dec-"}


def schema_props():
    """Field names per entity, in contract schema order (the export writes fields in this order)."""
    return {p.name.replace(".schema.json", ""): list(json.loads(p.read_text())["properties"])
            for p in CONTRACTS.glob("*.schema.json")}


class Converter:
    """Calendar shift and ID remap for one replay (pure functions of the replay)."""

    def __init__(self, review_date):
        self.review_date = review_date
        self.shift = (ANCHOR_DATE - date.fromisoformat(review_date)).days
        self.id_map = {}

    def mission_day(self, iso):
        return ANCHOR_DAY + (date.fromisoformat(iso[:10]) - ANCHOR_DATE).days

    def shift_date(self, s):
        return (date.fromisoformat(s) + timedelta(days=self.shift)).isoformat()

    def shift_utc(self, s):
        t = datetime.fromisoformat(s.replace("Z", "+00:00")) + timedelta(days=self.shift)
        return t.isoformat().replace("+00:00", "Z")

    def label(self, raw):
        parts = raw.split(":")
        if DATE_RE.match(parts[0]):
            day = self.mission_day(self.shift_date(parts[0]))
            rest = "".join(f"-t{int(p):03d}" if p.isdigit() else f"-{p}" for p in parts[1:])
            return f"d{day:02d}{rest}"
        return "-".join(parts)

    def remap_id(self, s):
        m = REPLAY_ID_RE.match(s)
        if not m:
            return s
        crew, entity, raw = m.groups()
        new = f"sim:{ENTITY_ALIAS.get(entity, entity)}:c{crew}-{self.label(raw)}"
        self.id_map[s] = new
        return new

    def value(self, v):
        if isinstance(v, str):
            if REPLAY_ID_RE.match(v):
                return self.remap_id(v)
            if DATE_RE.match(v):
                return self.shift_date(v)
            if UTC_RE.match(v):
                return self.shift_utc(v)
            return v
        if isinstance(v, list):
            return [self.value(x) for x in v]
        if isinstance(v, dict):
            return {k: self.value(x) for k, x in v.items()}
        return v


def key_of(rid):
    return rid.split(":", 2)[2]


def info_id(kind, rid):
    crew, rest = key_of(rid).split("-", 1)
    return f"sim:information_status:{crew}-{INFO_PREFIX[kind]}{rest}"


def info_row(kind, record, profile, events_verified):
    """science/status.py information_status() with the adapter context: subject partition and,
    for DECODE, the replay's ledger attestation from science/decode.verify."""
    ctx = {"subject": {"subject_profile_id": profile["subject_profile_id"], "subject_mode": profile["subject_mode"]}}
    if kind == "decode_session":
        ctx["events_verified"] = events_verified
    row = status.information_status(kind, record, information_status_id=info_id(kind, record[f"{kind}_id"]),
                                    created_at_utc=record["created_at_utc"], schema_version=SCHEMA_VERSION, context=ctx)
    order = ("information_status_id", "schema_version", "data_origin", "created_at_utc", "subject_id", "is_simulated",
             "record_ref", "status", "reason_codes", "source_known", "unit_verified", "measurement_time_known",
             "method_consistent", "reference_eligible", "ruleset_version")
    return {k: row[k] for k in order}


def scenario_records(s):
    """The replay's records for one scenario, by contract entity (before conversion)."""
    refs = s["references"]
    recs = {
        "simulator_scenario": [s["scenario"]], "subject_profile": [s["crew_profile"]],
        "sleep_record": s["sleep_records"], "measurement": s["measurements"], "self_report": s["self_reports"],
        "decode_session": [g["session"] for g in s["decode"]],
        "decode_response_event": [e for g in s["decode"] for e in g["events"]],
        "personal_reference": [refs[k]["record"] for k in sorted(refs) if refs[k]["record"] is not None],
        "finding": s["findings"], "action": [s["action"]], "follow_up": [s["follow_up"]],
        "mission_schedule": s["schedule"]["records"], "daily_review": [s["daily_review"]],
    }
    # The S1 synthetic plan's rule_definition and evidence_source are not exported: the contract keeps
    # these as files, not bundle records (CONTRACT_P0 section 2), and the replay's evidence license_status
    # ("Internal fictional fixture") is not a contract enum value. The finding still names the rule ID.
    return recs


def convert_scenario(s, conv, props, dropped):
    code = s["scenario"]["scenario_code"]
    subject = s["crew_profile"]["subject_profile_id"]
    out = defaultdict(list)
    for entity, rows in scenario_records(s).items():
        for raw in rows:
            r = conv.value(copy.deepcopy(raw))
            if "schema_version" in r:
                r["schema_version"] = SCHEMA_VERSION
            if entity == "mission_schedule":
                r.setdefault("item_kind", "task")
            if entity == "finding":
                if not r.get("rule_id"):
                    r["rule_id"] = f"rule:builtin-{r['finding_kind']}"
                    r["rule_version"] = s["review"]["engine_version"]
                r.setdefault("owner_role", "astronaut")
                if not r.get("limitations") and r["finding_kind"] == "review_request":
                    r["limitations"] = REVIEW_LIMITATION
            if entity == "personal_reference":
                slot = "sleep" if r["metric_code"] in status.SLEEP_UNITS else "decode"
                freeze = [d for d in refs_decisions(s, slot) if d["decision_id"].endswith(":freeze")]
                r["frozen"] = bool(freeze)
                if freeze:
                    r["freeze_reason"] = freeze[-1]["reason"]
            if entity == "simulator_scenario":
                r["crew_subject_ids"] = [subject]
                r["scenario_version"] = f"{r['scenario_version']}+{EXPORT_VERSION}"
                r["scenario_clock_basis"] = (f"{r['scenario_clock_basis']}; dates moved {conv.shift:+d} days so the review day is "
                                             f"mission day {ANCHOR_DAY} = {ANCHOR_DATE.isoformat()} (contract D-2)")
            for k in [k for k in r if k not in props[entity]]:
                dropped[(entity, k)] += 1
                del r[k]
            out[entity].append({k: r[k] for k in props[entity] if k in r})

    # The rest window from the replay's schedule comparison, as its own record (D-8 item_kind).
    w = conv.value(copy.deepcopy(s["schedule"]["rest_window"]))
    first = out["mission_schedule"][0]
    out["mission_schedule"].insert(0, {
        "mission_schedule_id": f"sim:mission_schedule:{key_of(first['mission_schedule_id']).split('-', 1)[0]}-rest-d{ANCHOR_DAY}",
        "schema_version": SCHEMA_VERSION, "data_origin": first["data_origin"], "created_at_utc": first["created_at_utc"],
        "subject_id": subject, "is_simulated": True, "mission_day": first["mission_day"],
        "clock_reference": w["clock_reference"], "activity_label": "Rest window", "start_at": w["start_at"],
        "end_at": w["end_at"], "is_fixed": True, "approval_role": "planner", "item_kind": "rest_window"})

    # Information status for every measured record, from status.py.
    profile = out["subject_profile"][0]
    verified = {conv.remap_id(g["session"]["decode_session_id"]): g["verification"]["events_verified"] for g in s["decode"]}
    rows = []
    for kind in ("sleep_record", "measurement", "decode_session"):
        for r in out[kind]:
            rows.append(info_row(kind, r, profile, verified.get(r.get("decode_session_id"))))
    day = lambda row: row["created_at_utc"]  # noqa: E731
    out["information_status"] = sorted(rows, key=day)

    bundle = {"bundle_version": "1.0",
              "notes": (f"Exported by science/export_bundles.py ({EXPORT_VERSION}) from Shaimaa's mission replay "
                        f"(science/simulator.py, seed {s['scenario']['seed']}). Scenario {code}; dates moved {conv.shift:+d} days "
                        "to the mission calendar. All values are simulated.")}
    for e in ENTITY_ORDER:
        if out.get(e):
            bundle[e] = out[e]
    return bundle


def refs_decisions(s, slot):
    return s["references"][slot].get("decisions") or []


# ----------------------------------------------------------------- comparison with the hand-made fixtures

def summarize(bundle):
    """A few comparable facts of a bundle's review day, every one read from its records."""
    def last(entity, key):
        rows = sorted(bundle.get(entity, []), key=lambda r: r[key])
        return rows[-1] if rows else None
    sl = last("sleep_record", "observation_date")
    dec = [s for s in bundle.get("decode_session", []) if s["start_at_utc"][:10] == ANCHOR_DATE.isoformat()]
    days = sorted({r["observation_date"] for r in bundle.get("sleep_record", [])} | {r["start_at_utc"][:10] for r in bundle.get("decode_session", [])})
    return {
        "subject": [(p["subject_profile_id"], p.get("crew_label")) for p in bundle.get("subject_profile", [])],
        "record_counts": {k: len(v) for k, v in bundle.items() if isinstance(v, list)},
        "first_and_last_day": [days[0], days[-1]] if days else None,
        "last_sleep": None if sl is None else {"date": sl["observation_date"], "minutes_asleep": sl["minutes_asleep"],
                                               "recorded_interval_ms": sl["recorded_interval_ms"]},
        "decode_today": [{"state": s["session_state"], "correct_count": s["correct_count"], "accepted_responses": s["accepted_responses"],
                          "median_correct_rt_ms": s["median_correct_rt_ms"], "protocol_version": s["protocol_version"]} for s in dec],
        "references": [{"metric_code": r["metric_code"], "reference_value": r["reference_value"], "status": r["reference_status"],
                        "range": [r.get("range_low"), r.get("range_high")], "frozen": r.get("frozen")} for r in bundle.get("personal_reference", [])],
        "follow_ups": [f["followup_status"] for f in bundle.get("follow_up", [])],
        "information_status": dict(Counter(s["status"] for s in bundle.get("information_status", []))),
        "schedule": [(m["activity_label"], m["item_kind"], m["is_fixed"], m["start_at"], m["end_at"]) for m in bundle.get("mission_schedule", [])],
    }


# ----------------------------------------------------------------- run

def export(replay=None):
    """{file name: object} for the four exported bundles, plus the manifest. S5 is copied separately."""
    replay = replay if replay is not None else simulator.run_all()
    review_dates = {s["daily_review"]["review_date"] for s in replay["scenarios"]}
    if len(review_dates) != 1:
        raise ValueError(f"expected one review date in the replay, got {sorted(review_dates)}")
    conv = Converter(review_dates.pop())
    props, dropped = schema_props(), Counter()
    out = {}
    for s in replay["scenarios"]:
        out[f"scenarios/{s['scenario']['scenario_code']}.json"] = convert_scenario(s, conv, props, dropped)
    comparison = {}
    for name, bundle in out.items():
        fixture = FIXTURES / Path(name).name
        comparison[Path(name).stem] = {"export": summarize(bundle),
                                       "hand_made_fixture": summarize(json.loads(fixture.read_text())) if fixture.exists() else None}
    out["export_manifest.json"] = {
        "export_version": EXPORT_VERSION, "source": "science/simulator.py run_all()",
        "replay_review_date": conv.review_date,
        "date_shift_days": conv.shift, "anchor": {"date": ANCHOR_DATE.isoformat(), "mission_day": ANCHOR_DAY},
        "dropped_fields": {f"{e}.{k}": n for (e, k), n in sorted(dropped.items())},
        "s5": "byte copy of app/public/data/fixtures/S5.json (the replay covers S1-S4 only)",
        "id_map": dict(sorted(conv.id_map.items())),
        "comparison_with_hand_made_fixtures": comparison,
    }
    return out


def dumps(obj):
    return json.dumps(obj, indent=1, ensure_ascii=False) + "\n"


def write(outputs, out_dir=OUT_DIR):
    out_dir = Path(out_dir)
    for name, obj in outputs.items():
        p = out_dir / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(dumps(obj), encoding="utf-8")
    s5 = FIXTURES / "S5.json"
    (out_dir / "scenarios/S5.json").write_bytes(s5.read_bytes())
    return out_dir


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--replay", type=Path, help="a file written by `python -B -m science.simulator --out ...` (default: run it in-process)")
    ap.add_argument("--out", type=Path, default=OUT_DIR)
    a = ap.parse_args(argv)
    replay = json.loads(a.replay.read_text(encoding="utf-8")) if a.replay else None
    out_dir = write(export(replay), a.out)
    print(f"wrote S1-S5 bundles and export_manifest.json to {out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
