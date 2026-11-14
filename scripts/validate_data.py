#!/usr/bin/env python3
"""Validate Vitalents data files against contracts/*.schema.json (contract v1.0).

Usage:
  python3 scripts/validate_data.py                     # every JSON under app/public/data and contracts/examples
  python3 scripts/validate_data.py path/to/file.json   # specific files

A data file is a bundle: {"bundle_version": "1.0", "<entity>": [records...], ...}.
Keys that are not entity names (bundle_version, expected, notes) are ignored.

Besides the JSON Schemas, this enforces the rules JSON Schema cannot express (docs/CONTRACT_P0.md):
  R1 IDs are unique across the bundle.
  R2 A record's realm (prefix before ':') equals its subject's realm.
  R3 A record only references IDs in its own realm, or lib:/rule: IDs.
  R4 Realm and provenance agree: sim -> is_simulated true (except a live round played into a simulation),
     research -> is_simulated false, live -> is_simulated false.
  R5 subject_profile.subject_mode matches its realm.
Full app fixtures additionally check resolved links, Decode ledgers, D-10 reference
provenance and share chronology. Science replay exports keep their separate alias policy.
Exit code 1 on any error.
"""
import json, sys, pathlib, re, math, statistics
from datetime import date, datetime, timedelta
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTRACTS = ROOT / "contracts"
try:
    from jsonschema import Draft202012Validator
except ImportError:
    sys.exit("pip install jsonschema")

SCHEMAS = {p.name.replace(".schema.json", ""): Draft202012Validator(json.loads(p.read_text()))
           for p in CONTRACTS.glob("*.schema.json")}
ID_RE = re.compile(r"^(sim|live|research|lib|rule):[A-Za-z0-9_.:-]+$")
MODE_FOR_REALM = {"sim": "mission_simulation", "research": "real_research", "live": "live_player"}
SHARED_REALMS = {"lib", "rule"}


def realm(i):
    return i.split(":", 1)[0] if isinstance(i, str) and ID_RE.match(i) else None


def iter_ids(value):
    if isinstance(value, str) and ID_RE.match(value):
        yield value
    elif isinstance(value, list):
        for v in value:
            yield from iter_ids(v)


def check_app_semantics(data, label="app fixture"):
    """Checks that shape-valid app data can actually support its displayed story.

    These invariants apply to the complete S1-S5 app bundles. They deliberately do
    not interpret standalone contract examples or the separate science export aliases.
    """
    errors = []
    records = {r[f"{kind}_id"]: (kind, r) for kind, rows in data.items() if kind in SCHEMAS and isinstance(rows, list)
               for r in rows if isinstance(r, dict) and f"{kind}_id" in r}
    rules = {f"rule:{r['id']}": r for r in json.loads((ROOT / "content/rules.json").read_text())["rules"]}
    sources = {r["id"] for r in json.loads((ROOT / "content/library.json").read_text())["sources"]}
    link_fields = {"subject_id", "record_ref", "quality_record_id", "review_id", "finding_id", "action_id", "rule_id",
                   "decode_session_id", "sleep_record_id", "selected_action_id", "source_reference_id", "permission_record_id",
                   "resource_id", "share_package_id", "target_record_id", "approval_record_id", "source_record_ids",
                   "supporting_record_ids", "reading_ids", "self_report_ids", "finding_ids", "previewed_record_ids",
                   "crew_subject_ids", "fixture_record_ids"}
    def fail(rid, message):
        errors.append(f"{label}:{rid}: {message}")
    def at(value):
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    def close(a, b):
        return a is None and b is None or isinstance(a, (int, float)) and isinstance(b, (int, float)) and math.isclose(a, b, abs_tol=1e-8)
    for rid, (kind, row) in records.items():
        for field in link_fields.intersection(row):
            if field == f"{kind}_id":
                continue
            for ref in iter_ids(row[field]):
                resolved = ref in records or ref in rules or ref in sources
                if not resolved:
                    fail(rid, f"{field} references missing record/source/rule {ref}")
                elif ref in records and row.get("subject_id") and records[ref][1].get("subject_id") not in (None, row["subject_id"]):
                    fail(rid, f"{field} references another subject: {ref}")
        if kind == "finding" and row.get("rule_id") in rules and row.get("rule_version") != rules[row["rule_id"]]["version"]:
            fail(rid, "rule_version does not match its declared rule")
        if kind == "action" and row.get("step_category") == "approved_plan_step":
            finding = records.get(row.get("finding_id"), (None, {}))[1]
            rule = rules.get(finding.get("rule_id"), {})
            if rule and rule.get("approval_state") != "approved":
                fail(rid, "a draft rule cannot produce an approved plan step")
        captured = row.get("end_at_utc") if kind == "decode_session" else row.get("submitted_at_utc") if kind == "self_report" else row.get("observed_at_utc") if kind == "measurement" else None
        if captured and at(row["created_at_utc"]) < at(captured):
            fail(rid, "final record was persisted before its observation finished")

    statuses = {}
    for row in data.get("information_status", []):
        old = statuses.get(row["record_ref"])
        if not old or row["created_at_utc"] >= old["created_at_utc"]:
            statuses[row["record_ref"]] = row
        if row["status"] != "valid" and row.get("reference_eligible"):
            fail(row["information_status_id"], "non-valid information cannot be reference eligible")
    for kind in ("sleep_record", "measurement", "decode_session"):
        for row in data.get(kind, []):
            rid = row[f"{kind}_id"]
            if rid not in statuses:
                fail(rid, "missing information_status")
            elif kind == "measurement" and row.get("value") is None and statuses[rid]["status"] in ("valid", "limited", "stale"):
                fail(rid, "an absent measurement cannot be a usable or stale reading")

    ledgers = defaultdict(list)
    for event in data.get("decode_response_event", []):
        ledgers[event["decode_session_id"]].append(event)
    for session in data.get("decode_session", []):
        rid = session["decode_session_id"]
        events = ledgers[rid]
        if not events:
            fail(rid, "missing Decode response ledger")
            continue
        if sorted(e["trial_index"] for e in events) != list(range(1, len(events) + 1)):
            fail(rid, "Decode trial indices must preserve every trial exactly once")
        for e in events:
            erid = e["decode_response_event_id"]
            accepted = e["response_state"] in ("correct", "incorrect")
            if e["is_accepted"] != accepted:
                fail(erid, "accepted flag disagrees with response state")
            if e["response_state"] == "correct" and e["response_digit"] != e["correct_digit"]:
                fail(erid, "correct answer does not match key")
            if e["response_state"] == "incorrect" and e["response_digit"] in (None, e["correct_digit"]):
                fail(erid, "incorrect answer contradicts key")
            rt = None if e["response_monotonic_ms"] is None else e["response_monotonic_ms"] - e["stimulus_monotonic_ms"]
            if not close(e["response_time_ms"], rt):
                fail(erid, "response_time_ms differs from response minus stimulus")
            if accepted and not (0 <= e["stimulus_monotonic_ms"] <= e["response_monotonic_ms"] <= session["elapsed_monotonic_ms"]):
                fail(erid, "accepted answer lies outside the captured session interval")
            if at(e["created_at_utc"]) < at(session["end_at_utc"]):
                fail(erid, "final event ledger was persisted before session ended")
        duration = (at(session["end_at_utc"]) - at(session["start_at_utc"])).total_seconds() * 1000
        if not close(duration, session["elapsed_monotonic_ms"]):
            fail(rid, "UTC and monotonic durations disagree")
        accepted = [e for e in events if e["is_accepted"]]
        correct = [e for e in accepted if e["response_state"] == "correct"]
        actual = {"accepted_responses": len(accepted), "correct_count": len(correct),
                  "accuracy_percent": 100 * len(correct) / len(accepted) if accepted else None,
                  "median_correct_rt_ms": statistics.median(e["response_time_ms"] for e in correct) if correct else None}
        # D-9 permits a retained partial ledger with unpublished (null) summaries.
        unpublished = session["session_state"] != "completed" and all(session.get(k) is None for k in actual)
        if not unpublished:
            for field, value in actual.items():
                if not close(session.get(field), value):
                    fail(rid, f"{field} does not rescore from the response ledger")

    for ref in data.get("personal_reference", []):
        if ref["metric_code"] != "decode_correct_count":
            continue
        rid = ref["personal_reference_id"]
        target = ref.get("comparison_target_date")
        if not target:
            fail(rid, "Decode reference needs its comparison target date")
            continue
        first = date.fromisoformat(target) - timedelta(days=14)
        history = sorted((s for s in data.get("decode_session", []) if s["subject_id"] == ref["subject_id"]), key=lambda s: s["start_at_utc"])
        eligible = [s for i, s in enumerate(history, 1) if i > 2 and not s["is_practice"]
                    and first.isoformat() <= s["start_at_utc"][:10] < target
                    and statuses.get(s["decode_session_id"], {}).get("status") == "valid"
                    and s["correct_count"] is not None]
        if ref["source_record_ids"] != [s["decode_session_id"] for s in eligible]:
            fail(rid, "source_record_ids do not match D-10 eligible historical records")
        vals = [s["correct_count"] for s in eligible]
        if ref["valid_record_count"] != len(vals):
            fail(rid, "valid_record_count differs from its source records")
        expected_status = "not_built" if not vals else "provisional" if len(vals) < 5 else "usable_for_question"
        if ref["reference_status"] != expected_status:
            fail(rid, "reference_status disagrees with D-10 sufficiency")
        for field, value in (("reference_value", statistics.median(vals) if vals else None),
                             ("range_low", min(vals) if vals else None), ("range_high", max(vals) if vals else None)):
            if not close(ref.get(field), value):
                fail(rid, f"{field} does not match its eligible sources")

    for pkg in data.get("share_package", []):
        rid = pkg["share_package_id"]
        for ref in pkg["previewed_record_ids"]:
            if ref not in records:
                continue
            kind, source = records[ref]
            times = [source["created_at_utc"]]
            for field in ("end_at_utc", "observed_at_utc", "submitted_at_utc", "opened_at_utc"):
                if source.get(field):
                    times.append(source[field])
            if max(map(at, times)) > at(pkg["prepared_at_utc"]):
                fail(rid, f"preview contains future/unavailable record {ref}")
        permission = records.get(pkg.get("permission_record_id"), (None, {}))[1]
        if permission.get("resource_id") != rid or permission.get("actor_role") != "astronaut" or not permission.get("allowed"):
            fail(rid, "share permission must belong to the previewed package and astronaut")
        if permission.get("permission_time_utc") and at(permission["permission_time_utc"]) < at(pkg["prepared_at_utc"]):
            fail(rid, "share permission precedes the package preview")
    # A planted next step must be supported by its declared numeric demo rule.
    for review in data.get("daily_review", []):
        action = records.get(review.get("selected_action_id"), (None, {}))[1]
        finding = records.get(action.get("finding_id"), (None, {}))[1]
        if finding.get("rule_id") != "rule:R-PLAN-01":
            continue
        subject, target = review["subject_id"], review["review_date"]
        refs = sorted((r for r in data.get("personal_reference", []) if r["subject_id"] == subject
                       and r["metric_code"] == "decode_correct_count" and r["created_at_utc"][:10] <= target),
                      key=lambda r: r["created_at_utc"])
        ref = refs[-1] if refs else None
        below = 0
        if ref and ref["reference_status"] == "usable_for_question":
            sessions = sorted((s for s in data.get("decode_session", []) if s["subject_id"] == subject
                               and not s["is_practice"] and s["start_at_utc"][:10] <= target), key=lambda s: s["start_at_utc"], reverse=True)
            for session in sessions:
                if statuses.get(session["decode_session_id"], {}).get("status") != "valid":
                    continue
                if session["correct_count"] is not None and session["correct_count"] < ref["range_low"]:
                    below += 1
                else:
                    break
        nights = {s["observation_date"] for s in data.get("sleep_record", []) if s["subject_id"] == subject
                  and (date.fromisoformat(target) - timedelta(days=2)).isoformat() <= s["observation_date"] <= target
                  and statuses.get(s["sleep_record_id"], {}).get("status") == "valid"
                  and s.get("recorded_interval_ms") is not None and s["recorded_interval_ms"] < 6 * 3_600_000}
        if below < 2 or len(nights) < 2:
            fail(review["daily_review_id"], f"R-PLAN-01 needs two consecutive below-range sessions and two short nights; got {below}/{len(nights)}")
    return errors


def check_scenario_family(directory):
    """S5 adds communication records to exactly the same Fahim history as S1."""
    s1_path, s5_path = directory / "S1.json", directory / "S5.json"
    if not s1_path.exists() or not s5_path.exists():
        return []
    s1, s5 = json.loads(s1_path.read_text()), json.loads(s5_path.read_text())
    errors = []
    for kind, rows in s1.items():
        if kind not in SCHEMAS or kind == "simulator_scenario":
            continue
        actual = {r[f"{kind}_id"]: r for r in s5.get(kind, [])}
        for row in rows:
            rid = row[f"{kind}_id"]
            if actual.get(rid) != row:
                errors.append(f"S5.json:{rid}: shared Fahim history differs from S1 or is missing")
    return errors


def check_bundle(path):
    errors = []
    data = json.loads(path.read_text())
    if not isinstance(data, dict):
        return [f"{path}: top level must be an object (bundle)"]
    seen = {}
    records = []
    for ent, recs in data.items():
        if ent not in SCHEMAS:
            continue
        if not isinstance(recs, list):
            errors.append(f"{path}: '{ent}' must be a list"); continue
        for n, rec in enumerate(recs):
            where = f"{path.name}:{ent}[{n}]"
            for e in sorted(SCHEMAS[ent].iter_errors(rec), key=lambda e: list(e.path)):
                loc = "/".join(str(p) for p in e.path) or "(record)"
                errors.append(f"{where} {loc}: {e.message}")
            pk = rec.get(f"{ent}_id")
            if pk:
                if pk in seen:
                    errors.append(f"{where}: duplicate id {pk} (also {seen[pk]})")  # R1
                seen[pk] = where
            records.append((ent, where, rec))
    live_sessions = {rec.get("decode_session_id") for ent, _, rec in records
                     if ent == "decode_session" and rec.get("played_live_into_simulation")}
    for ent, where, rec in records:
        pk = rec.get(f"{ent}_id")
        own = realm(pk)
        subj = rec.get("subject_id")
        if subj and own and realm(subj) != own:  # R2
            errors.append(f"{where}: id realm '{own}' differs from subject realm '{realm(subj)}'")
        for field, value in rec.items():  # R3
            if field == f"{ent}_id":
                continue
            for ref in iter_ids(value):
                r = realm(ref)
                if own and r not in (own, *SHARED_REALMS):
                    errors.append(f"{where} {field}: cross-realm reference {ref}")
        sim = rec.get("is_simulated")  # R4
        live_ok = rec.get("data_origin") == "live_decode" and (
            rec.get("played_live_into_simulation") or rec.get("decode_session_id") in live_sessions)
        if own == "sim" and sim is False and not live_ok:
            errors.append(f"{where}: sim realm record must have is_simulated true")
        if own in ("research", "live") and sim is True:
            errors.append(f"{where}: {own} realm record cannot be simulated")
        if own == "research" and rec.get("data_origin") == "simulated_mission":
            errors.append(f"{where}: research realm cannot carry simulated_mission data")
        if ent == "subject_profile" and own in MODE_FOR_REALM and rec.get("subject_mode") != MODE_FOR_REALM[own]:  # R5
            errors.append(f"{where}: subject_mode must be {MODE_FOR_REALM[own]} for realm {own}")
    if not errors and path.resolve().parent == (ROOT / "app/public/data/fixtures").resolve() and re.fullmatch(r"S[1-5]\.json", path.name):
        errors.extend(check_app_semantics(data, path.name))
    return errors


def main(argv):
    if argv:
        files = [pathlib.Path(a) for a in argv]
    else:
        files = sorted((ROOT / "app/public/data").rglob("*.json")) + sorted((CONTRACTS / "examples").glob("*.json"))
        files = [f for f in files if f.name not in ("cached_answers.json",)]
    total = 0
    for f in files:
        errs = check_bundle(f)
        total += len(errs)
        print(("OK   " if not errs else "FAIL ") + str(f.relative_to(ROOT) if f.is_relative_to(ROOT) else f))
        for e in errs[:50]:
            print("     " + e)
    if not argv:
        family_errors = check_scenario_family(ROOT / "app/public/data/fixtures")
        total += len(family_errors)
        for error in family_errors[:50]:
            print("FAIL " + error)
    print(f"\n{len(files)} file(s), {total} error(s)")
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
