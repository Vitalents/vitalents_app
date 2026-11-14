#!/usr/bin/env python3
"""Validation summary for the Proof screen and the evidence slide (FR-SIM-04, SRS 14.3).

Usage (repo root or science/):
  python3 science/validate.py                 # writes science/out/validation.json
  python3 science/validate.py --out FILE --now 2026-11-14T09:00:00Z

Output shape: docs/proof/validation_schema.md (read by scripts/publish_proof.py). Every number is
computed here from these inputs, none is typed in:

  * Shaimaa's mission replay, science/simulator.py run_all() (seed 42, S1-S4), with her engines:
    science/decode.py (ledger verifier), status.py, reference.py, rules.py (through the replay).
  * The app bundles built from that replay by science/export_bundles.py, plus the S5 fixture.
  * contracts/vectors/*, run through science/contract_logic.py.

Detection without leakage: personal references come from each member's earlier days only (the
replay's reference engine); one fixed band for everyone is set from the training member's earlier
days; scoring uses the held-out members on the later (review) day only. With four replayed members
the counts are small; every rate carries its numerator and denominator.
Everything here describes software behaviour on simulated data and needs independent validation
before any claim about people.
"""
import argparse
import importlib.util
import json
import statistics
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from science import decode, export_bundles, simulator, status  # noqa: E402
from science.contract_logic import FUNCTIONS  # noqa: E402

OUT = HERE / "out" / "validation.json"
VECTORS = ROOT / "contracts" / "vectors"
S5_FIXTURE = ROOT / "app/public/data/fixtures/S5.json"

# Validation design choices (listed under illustrative_parameters).
TRAINING_CREW = ("sim:crew:04",)       # sets the fixed band; every other replayed member is held out
DETECTION_METRIC = "median_correct_rt_ms"
ALERT_KINDS = ("descriptive_change", "review_request", "missing_data", "context_conflict", "approved_plan_step")
MONTH_DAYS = 30


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


validate_data = _load("validate_data", ROOT / "scripts/validate_data.py")


def check(id, label, value, *, unit=None, numerator=None, denominator=None, passed=None, method=None, scenario=None):
    return {"id": id, "label": label, "method": method, "value": value, "unit": unit, "numerator": numerator,
            "denominator": denominator, "passed": passed, "scenario": scenario}


def rate(id, label, num, den, *, method=None, all_pass=True, scenario=None):
    return check(id, label, (num / den) if den else None, unit="rate", numerator=num, denominator=den,
                 passed=(num == den) if (all_pass and den) else None, method=method, scenario=scenario)


def utc_now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse(t):
    return status.parse_utc(t)


# ----------------------------------------------------------------- inputs

def inputs():
    replay = simulator.run_all()
    exported = export_bundles.export(replay)
    bundles = {Path(k).stem: v for k, v in exported.items() if k.startswith("scenarios/")}
    bundles["S5"] = json.loads(S5_FIXTURE.read_text(encoding="utf-8"))
    fixture = json.loads(simulator.FIXTURE.read_text(encoding="utf-8-sig"))
    return replay, dict(sorted(bundles.items())), fixture


def records(bundles):
    for code, b in bundles.items():
        for entity, rows in b.items():
            if entity in validate_data.SCHEMAS and isinstance(rows, list):
                for r in rows:
                    yield code, entity, r


# ----------------------------------------------------------------- execution integrity

def ordered_pairs(entity, r):
    """(earlier, later, strict) pairs a record must keep in order; empty if it has none."""
    if entity == "decode_session" and r.get("end_at_utc"):
        return [(r["start_at_utc"], r["end_at_utc"], False)]
    if entity == "decode_response_event" and r.get("response_monotonic_ms") is not None:
        return [(r["stimulus_monotonic_ms"], r["response_monotonic_ms"], False)]
    if entity == "mission_schedule":
        return [(r["start_at"], r["end_at"], True)]
    if entity == "follow_up" and r.get("next_review_due_utc"):
        return [(r["opened_at_utc"], r["next_review_due_utc"], False)]
    if entity == "personal_reference" and r.get("comparison_target_date"):
        return [(r["start_date"], r["end_date"], False), (r["end_date"], r["comparison_target_date"], True)]
    return []


def in_order(a, b, strict):
    if isinstance(a, str) and "T" in a:
        a, b = parse(a), parse(b)
    return a < b if strict else a <= b


def decode_clock_ok(r):
    if r.get("end_at_utc") is None:
        return True
    return (parse(r["end_at_utc"]) - parse(r["start_at_utc"])).total_seconds() * 1000 == r["elapsed_monotonic_ms"]


VERSION_FIELDS = {
    "information_status": ("ruleset_version",), "personal_reference": ("reference_version",),
    "finding": ("rule_version",), "decode_session": ("protocol_version", "key_version", "app_version"),
    "simulator_scenario": ("scenario_version",),
}


def execution_integrity(replay, bundles):
    recs = list(records(bundles))
    where = "the five app scenario bundles (S1-S4 exported from the replay, S5 fixture)"
    meas = [r for _, e, r in recs if e == "measurement"]
    with_unit = [r for r in meas if isinstance(r.get("unit"), str) and r["unit"].strip() and r["unit"] != "UNVERIFIED"]

    timed = [(e, r) for _, e, r in recs if ordered_pairs(e, r)]
    ok = [1 for e, r in timed if all(in_order(a, b, s) for a, b, s in ordered_pairs(e, r))
          and (e != "decode_session" or decode_clock_ok(r))]

    need = [(e, r) for _, e, r in recs if e in VERSION_FIELDS]
    versioned = [1 for e, r in need if all(isinstance(r.get(f), str) and r[f].strip() for f in VERSION_FIELDS[e])]

    schema_ok = [1 for _, e, r in recs if not any(True for _ in validate_data.SCHEMAS[e].iter_errors(r))]

    rule_ok = 0
    with tempfile.TemporaryDirectory() as d:
        for code, b in bundles.items():
            p = Path(d) / f"{code}.json"
            p.write_text(json.dumps(b), encoding="utf-8")
            rule_ok += not validate_data.check_bundle(p)

    ledgers = [(s, g) for s in replay["scenarios"] for g in s["decode"]]
    verified = 0
    for s, g in ledgers:
        audit = decode.verify(g["session"], g["events"], subject=s["crew_profile"],
                              key_registry=replay["decode_key_registry"], expected_event_ids=g["expected_event_ids"])
        sm = audit["summary"] or {}
        verified += bool(audit["events_verified"] and not audit["issues"]
                         and all(g["session"].get(k) == sm.get(k) for k in decode.SCORE_FIELDS))

    rows = [(code, r) for code, e, r in recs if e == "information_status"]
    by_id = {(code, r[f"{e}_id"]): (e, r) for code, e, r in recs}
    profiles = {code: b["subject_profile"][0] for code, b in bundles.items()}
    events = {}
    for code, e, r in recs:
        if e == "decode_response_event":
            events.setdefault((code, r["decode_session_id"]), []).append(r)
    reproduced = {"export": [0, 0], "S5": [0, 0]}
    for code, row in rows:
        kind, rec = by_id[(code, row["record_ref"])]
        ctx = {"subject": {"subject_profile_id": profiles[code]["subject_profile_id"], "subject_mode": profiles[code]["subject_mode"]}}
        if kind == "decode_session":
            ev = events.get((code, rec["decode_session_id"]), [])
            ctx["events_verified"] = bool(ev) and decode_ledger_ok(rec, ev)
        engine = status.evaluate(kind, rec, context=ctx)["status"]
        # Contract D-6 'limited' (weak sensor contact) is not in status-0.3.1; an engine 'valid' with that reason agrees.
        same = engine == row["status"] or (row["status"] == "limited" and engine == "valid"
                                           and "weak_sensor_contact" in (row["reason_codes"] or []))
        tally = reproduced["S5" if code == "S5" else "export"]
        tally[0] += same
        tally[1] += 1

    vectors = sorted(VECTORS.glob("*/*.json"))
    vec_ok = sum(vector_reproduced(p) for p in vectors)

    return [
        rate("units_present", "Every measurement has a unit", len(with_unit), len(meas), method=f"Measurements in {where}; 'UNVERIFIED' counts as no unit"),
        rate("timestamps_ordered", "Timestamps are in order", len(ok), len(timed),
             method="Decode start before end and end minus start equal to the monotonic elapsed time; stimulus before response; schedule start before end; follow-up opened before its review date; reference period before its target date"),
        rate("versions_recorded", "Rule, reference, protocol and scenario versions are recorded", len(versioned), len(need),
             method="Status ruleset, reference version, finding rule version, Decode protocol, key and app version, scenario version"),
        rate("schema_valid", "Records match the data contract", len(schema_ok), len(recs), method=f"Each record in {where} against contracts/*.schema.json"),
        rate("id_realm_rules", "ID and realm rules hold in every bundle", rule_ok, len(bundles),
             method="scripts/validate_data.py rules: unique IDs, one realm per subject, no cross-realm links, provenance matches realm"),
        rate("decode_ledgers_verified", "Decode scores recomputed from their response ledgers", verified, len(ledgers),
             method="science/decode.py verify() on every replayed session with the capture seal; stored summary equals the recomputed one"),
        rate("information_status_reproduced", "Stored information statuses reproduced by the status engine", *reproduced["export"],
             method="science/status.py evaluate() on each record of the exported S1-S4 bundles with its subject and ledger context"),
        rate("s5_fixture_status_reproduced", "Hand-made S5 fixture statuses reproduced by the status engine", *reproduced["S5"], scenario="S5",
             method="Same check on the hand-made S5 fixture; its Decode sessions carry no response events, so the engine cannot verify them "
                    "(listed in science/tests/test_fixtures_status.py)"),
        check("permission_tests", "Role permission tests", None, unit="rate",
              method="Run by the app test suite (app/src/store/permissions.test.ts, npm test); this script does not run TypeScript tests"),
        check("sync_dedupe_test", "Resending a summary creates no duplicate", None, unit="rate",
              method="Run by the app test suite (app/src/sync, npm test); this script does not run TypeScript tests"),
        rate("golden_vectors_python", "Shared test vectors reproduced in Python", vec_ok, len(vectors),
             method="science/contract_logic.py on every file in contracts/vectors/ (score_decode, build_reference, compare_to_reference, rest_opportunity), tolerance from each file"),
    ]


def decode_ledger_ok(session, events):
    """Contract D-9 rescoring for a bundle session (the S5 fixture has no capture seal)."""
    from science.contract_logic import score_decode
    evs = sorted(events, key=lambda e: (e["trial_index"], e["stimulus_monotonic_ms"]))
    cut = session["elapsed_monotonic_ms"] if session["session_state"] == "interrupted" else None
    sc = score_decode(session["planned_duration_ms"], session["session_state"], evs, interrupted_at_ms=cut)
    return all(session.get(k) == sc[k] for k in decode.SCORE_FIELDS)


def close(a, e, tol):
    if isinstance(e, bool) or e is None or isinstance(e, str):
        return a == e
    if isinstance(e, (int, float)):
        return isinstance(a, (int, float)) and not isinstance(a, bool) and abs(a - e) <= tol
    if isinstance(e, list):
        return isinstance(a, list) and len(a) == len(e) and all(close(x, y, tol) for x, y in zip(a, e))
    if isinstance(e, dict):
        return isinstance(a, dict) and all(k in a and close(a[k], v, tol) for k, v in e.items())
    return False


def vector_reproduced(path):
    v = json.loads(path.read_text(encoding="utf-8"))
    fn = FUNCTIONS.get(v["function"])
    return bool(fn) and close(fn(**v["input"]), v["expected"], v.get("tolerance", 0.001))


# ----------------------------------------------------------------- measurement and analysis

def session_day(g):
    return g["session"]["start_at_utc"][:10]


def measurement_analysis(replay, fixture):
    review_day = replay["scenarios"][0]["daily_review"]["review_date"]
    specs = {c["subject_id"]: c for c in fixture["crew"]}
    by_subject = {s["crew_profile"]["subject_profile_id"]: s for s in replay["scenarios"]}
    train = [sid for sid in by_subject if sid in TRAINING_CREW]
    held = [sid for sid in by_subject if sid not in TRAINING_CREW]

    # Training: valid sessions of the training member(s) before the review day.
    train_rows = [(sid, session_day(g), g["session"][DETECTION_METRIC]) for sid in train for g in by_subject[sid]["decode"]
                  if session_day(g) < review_day and g["verification"]["information_status"]["status"] == "valid"]
    # Scoring: held-out members on the review day only.
    score_rows = [(sid, session_day(g), g) for sid in held for g in by_subject[sid]["decode"] if session_day(g) >= review_day]
    overlap = len(set(train) & set(held)) + len({d for _, d, _ in train_rows} & {d for _, d, _ in score_rows})
    band = (min(v for *_, v in train_rows), max(v for *_, v in train_rows)) if train_rows else None

    def truth(sid):
        spec = specs[sid]
        return "decode_history" in spec and spec["decode_today"]["median_rt_ms"] != spec["decode_history"]["median_rt_ms"]

    def personal_flag(sid):
        obs = by_subject[sid]["review"]["observations"]
        return any(o.get("slot_id") == "decode" and o["finding_kind"] == "descriptive_change" for o in obs)

    scorable = [(sid, d, g) for sid, d, g in score_rows if g["verification"]["information_status"]["status"] == "valid"]
    changes = [r for r in scorable if truth(r[0])]
    quiet = [r for r in scorable if not truth(r[0])]
    p_hits = [r for r in changes if personal_flag(r[0])]
    p_fa = [r for r in quiet if personal_flag(r[0])]
    fixed = lambda g: band is not None and not (band[0] <= g["session"][DETECTION_METRIC] <= band[1])  # noqa: E731
    f_hits = [r for r in changes if fixed(r[2])]
    f_fa = [r for r in quiet if fixed(r[2])]
    # Lead: days from the personal flag to the fixed-band flag, over hits flagged by both.
    # Lead: fixed-band flag day minus personal flag day, over hits flagged by both. Each method flags on
    # the day of the scored session, so both days are that session's day.
    flag_day = {id(r[2]): r[1] for r in p_hits + f_hits}
    leads = [(datetime.fromisoformat(flag_day[id(r[2])]) - datetime.fromisoformat(r[1])).days for r in p_hits if r in f_hits]

    # Reference leakage: every source of every reference candidate precedes its target day.
    refs, ref_ok = 0, 0
    for s in replay["scenarios"]:
        dates = {r["sleep_record_id"]: r["observation_date"] for r in s["sleep_records"]}
        dates |= {g["session"]["decode_session_id"]: session_day(g) for g in s["decode"]}
        for slot, ref in s["references"].items():
            if ref["source_ids"]:
                refs += 1
                ref_ok += all(dates[i] < review_day for i in ref["source_ids"])

    s1 = next(s for s in replay["scenarios"] if s["scenario"]["scenario_code"] == "S1")
    today_ids = {g["session"]["decode_session_id"] for g in s1["decode"] if session_day(g) == review_day}
    dref = s1["references"]["decode"]
    frozen = any(d["decision_id"].endswith(":freeze") for d in dref["decisions"])
    follow_open = s1["follow_up"]["followup_status"] not in ("closed", "no_open_follow_up")
    no_absorb = frozen and follow_open and not (today_ids & set(dref["source_ids"])) and dref["record"] is not None

    split = (f"Training member {', '.join(train)} on days before {review_day}; held-out members {', '.join(held)} "
             f"on {review_day} only")
    return [
        check("holdout_no_overlap", "Training and held-out sets share no member and no day", overlap, unit="count",
              passed=overlap == 0, method=split),
        rate("reference_from_earlier_days", "Personal references use earlier days only", ref_ok, refs,
             method="Every source record of every replayed reference candidate (science/reference.py) is dated before the target day"),
        check("reference_no_absorb_s1", "The reference does not absorb the S1 decline", None, passed=no_absorb, scenario="S1",
              method="S1 Decode reference has a freeze decision, the follow-up is open, and today's session is not among its sources"),
        check("detection_hits", "Simulated changes found by the personal reference on held-out members", len(p_hits), unit="count",
              numerator=len(p_hits), denominator=len(changes),
              method=f"{split}; a simulated change is a replay member whose fixture sets today's {DETECTION_METRIC} apart from its history; "
                     "found = the rules engine reports a descriptive change against the personal reference"),
        check("detection_false_alarms", "Flags on held-out member-days without a simulated change", len(p_fa), unit="count",
              numerator=len(p_fa), denominator=len(quiet), method=f"{split}; personal reference"),
        check("fixed_threshold_hits", "Simulated changes found by one fixed band for everyone", len(f_hits), unit="count",
              numerator=len(f_hits), denominator=len(changes), method=f"{split}; flagged when outside the fixed band"),
        check("fixed_threshold_false_alarms", "Fixed-band flags without a simulated change", len(f_fa), unit="count",
              numerator=len(f_fa), denominator=len(quiet), method=f"{split}; flagged when outside the fixed band"),
        check("detection_lead_days_median", "Days the personal reference flags before the fixed band, median",
              statistics.median(leads) if leads else None, unit="days", denominator=len(leads),
              method="Over hits flagged by both methods; the replay scores one later day per member, so the lead can only be 0"),
        check("detection_not_scorable", "Held-out member-days that could not be scored", len(score_rows) - len(scorable), unit="count",
              denominator=len(score_rows), method="A session whose information status is not valid (for example interrupted) is never scored"),
        check("detection_threshold", f"Fixed band for everyone, upper edge ({DETECTION_METRIC})", band[1] if band else None, unit="ms",
              method=(f"One fixed band for everyone: min-max of the training member's {len(train_rows)} valid session medians "
                      f"before {review_day} = {band[0]:g}-{band[1]:g} ms" if band else "No training sessions")),
    ]


# ----------------------------------------------------------------- use

def use(replay):
    sessions = [g["session"] for s in replay["scenarios"] for g in s["decode"] if g["session"]["session_state"] == "completed"]
    rounds = [(parse(x["end_at_utc"]) - parse(x["start_at_utc"])).total_seconds() for x in sessions]
    alerts = sum(1 for s in replay["scenarios"] for f in s["findings"] if f["finding_kind"] in ALERT_KINDS)
    crew_days = 0
    for s in replay["scenarios"]:
        days = {r["observation_date"] for r in s["sleep_records"]} | {session_day(g) for g in s["decode"]}
        days |= {r["report_date"] for r in s["self_reports"]} | {r["observation_date"] for r in s["measurements"]}
        crew_days += len(days)
    fus = [s["follow_up"] for s in replay["scenarios"]]
    closed = sum(1 for f in fus if f["followup_status"] == "closed")
    checks = [r for s in replay["scenarios"] for r in s["self_reports"] if r["report_kind"] == "daily_check_alertness"]
    return [
        check("daily_check_seconds_median", "Daily check time, median", None, unit="s", denominator=0,
              method=f"Not computable: the replay stores one submission time for each of its {len(checks)} daily checks and no start time; "
                     "the 3-minute target (NFR-02) needs the timed hallway test"),
        check("decode_round_seconds_median", "Decode round length from its timestamps, median", statistics.median(rounds) if rounds else None,
              unit="s", denominator=len(rounds), method="End minus start UTC of every completed replayed session"),
        check("alerts_per_member_month", "Findings per member-month in the replay", alerts * MONTH_DAYS / crew_days if crew_days else None,
              unit="per member-month", numerator=alerts,
              method=f"{alerts} findings over {crew_days} simulated member-days ({MONTH_DAYS} days = one month); every finding kind counts"),
        rate("follow_up_completion", "Follow-ups completed in the scenarios", closed, len(fus), all_pass=False,
             method="Replay follow-ups S1-S4 with status closed; the scenarios end while follow-ups are open"),
    ]


def illustrative():
    out = [f"science/simulator.py DEMO_POLICIES['{k}']: {p.version}, {p.minimum_days} valid days within {p.lookback_days} (demo policy)"
           for k, p in simulator.DEMO_POLICIES.items()]
    out.append(f"{simulator.FIXTURE.relative_to(ROOT).as_posix()}: every crew value is a fictional fixture input")
    out.append(f"science/validate.py TRAINING_CREW = {', '.join(TRAINING_CREW)} (sets the fixed band)")
    out.append(f"science/validate.py detection metric = {DETECTION_METRIC}; fixed band = training min-max")
    return out


def build(now=None):
    replay, bundles, fixture = inputs()
    return {
        "schema_version": "1.0",
        "generated_at_utc": now or utc_now(),
        "generated_by": "science/validate.py",
        "seed": fixture["seed"],
        "areas": {
            "execution_integrity": {"checks": execution_integrity(replay, bundles)},
            "measurement_analysis": {"checks": measurement_analysis(replay, fixture)},
            "knowledge_assistant": None,
            "use": {"checks": use(replay)},
        },
        "illustrative_parameters": illustrative(),
    }


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", type=Path, default=OUT)
    ap.add_argument("--now", help="generated_at_utc override (UTC ending in Z)")
    a = ap.parse_args(argv)
    v = build(a.now)
    a.out.parent.mkdir(parents=True, exist_ok=True)
    a.out.write_text(json.dumps(v, indent=2) + "\n", encoding="utf-8")
    for area, body in v["areas"].items():
        for c in (body or {}).get("checks", []):
            print(f"{area:22} {c['id']:32} value={c['value']!r} {c['numerator']}/{c['denominator']} passed={c['passed']}")
    print(f"wrote {a.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
