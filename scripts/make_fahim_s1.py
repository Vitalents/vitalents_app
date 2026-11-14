#!/usr/bin/env python3
"""Generate Fahim's S1 app fixture from synthetic inputs and the existing engines.

Run from the repo root: python -m scripts.make_fahim_s1 [--check]
The app's installed npm dependencies are needed to run its attention-order evaluator.
"""
import argparse
import json
import subprocess
import sys
import tempfile

from science import contract_logic, decode, schedule, status
from scripts.make_fixtures import Builder, OUT, ROOT, V, date

SUBJECT = "sim:crew:fahim"
SEED = 42
METRIC = "decode_correct_count"
REFERENCE_PARAMS = {"lookback_days": 14, "min_valid": 5, "exclude_first_sessions": 2}
SLEEP_HOURS = (7.1, 6.9, 7.2, 7.0, 6.8, 7.3, 7.0, 6.6, 7.1, 6.9, 7.0, 6.8, 5.4, 5.1, 5.2)
PULSE_BPM = (61, 62, 60, 61, 63, 62, 61, 64, 62, 61, 62, 63, 63, 64)
CORRECT_TRIALS = (35, 38, 41, 43, 42, 44, 43, 42, 44, 43, 30, 42, 37, 36)
WRIST_QUALITY = "weak_sensor_contact"
DAY27_REVIEW_AT = f"{date(27)}T08:00:00Z"


class FahimBuilder(Builder):
    def rid(self, entity, key):
        return f"sim:{entity}:{key}"

    def info(self, *args, **kwargs):
        # All S1 statuses are generated together after verifying the event ledgers.
        pass


def verify_round(session, events, subject, day):
    key = {f"g{i}": (i * 7 + day) % 9 + 1 for i in range(1, 10)}
    # App fixtures use 1-based trials. The science verifier expects 0-based trials.
    audit = decode.verify(
        session, [e | {"trial_index": e["trial_index"] - 1} for e in events],
        subject=subject, key_registry={session["key_version"]: key},
        expected_event_ids=[e["decode_response_event_id"] for e in events],
    )
    if not audit["events_verified"] or audit["issues"]:
        raise ValueError(f"{session['decode_session_id']}: {audit['issues']}")
    return audit


def capture_inputs(b):
    b.profile("Fahim (fictional crew member)")
    b.b["subject_profile"][0]["created_at_utc"] = f"{date(13)}T00:00:00Z"
    for day, hours in enumerate(SLEEP_HOURS, 13):
        b.sleep(day, hours)
        b.b["sleep_record"][-1]["created_at_utc"] = f"{date(day)}T06:00:00Z"
        if day < 27:
            b.pulse(day, PULSE_BPM[day - 13])
            b.b["measurement"][-1]["created_at_utc"] = f"{date(day)}T06:10:00Z"
        b.alertness(day, 7 if day < 25 else 8)
        report = b.b["self_report"][-1]
        report["created_at_utc"] = report["submitted_at_utc"]

    wrist_id = b.rid("measurement", "hr-d27")
    b.add("measurement", b.base("measurement", wrist_id) | {
        "created_at_utc": f"{date(27)}T06:10:00Z",
        "metric_code": "hr_resting_bpm", "value": None, "unit": "bpm",
        "observation_date": date(27), "observed_at_utc": f"{date(27)}T06:10:00Z",
        "capture_method": "simulated wrist PPG", "source_metric_granularity": "daily",
        "quality_record_id": b.rid("information_status", "hr-d27"),
    })
    b.add("self_report", b.base("self_report", b.rid("self_report", "pain-d20"), "application_generated") | {
        "created_at_utc": f"{date(20)}T19:00:00Z", "submitted_at_utc": f"{date(20)}T19:00:00Z",
        "report_date": date(20), "report_kind": "symptom", "symptom_text": "Lower back pain after exercise, mild",
    })

    # Use the scenario builder for synthetic trial timings and digit choices. The
    # stored session summaries come from the ledger verifier below.
    verified = {}
    subject = b.b["subject_profile"][0]
    for day, count in enumerate(CORRECT_TRIALS, 13):
        first = len(b.b.get("decode_response_event", ()))
        sid = b.decode(day, count, interrupted_at_ms=41_000 if day == 23 else None)
        session = b.b["decode_session"][-1]
        session.update(
            created_at_utc=session["end_at_utc"], key_version=f"seed-{day}",
            technical_context=json.dumps({"device_class": "tablet"}, separators=(",", ":")),
        )
        events = b.b["decode_response_event"][first:]
        for event in events:
            event["created_at_utc"] = session["end_at_utc"]
            event["symbol_id"] = event["symbol_id"].replace("sym_", "g", 1)
        session.update(dict.fromkeys(decode.SCORE_FIELDS))
        audit = verify_round(session, events, subject, day)
        session.update({field: (audit["summary"] or {}).get(field) for field in decode.SCORE_FIELDS})
        verified[sid] = audit["events_verified"]
    return verified


def build_statuses(b, verified):
    subject = b.b["subject_profile"][0]
    for kind, prefix in (("sleep_record", "sl"), ("measurement", "hr"), ("decode_session", "dec")):
        for record in b.b[kind]:
            rid = record[f"{kind}_id"]
            day_key = rid[-3:]
            info = status.information_status(
                kind, record, information_status_id=b.rid("information_status", f"{prefix}-{day_key}"),
                created_at_utc=record["created_at_utc"], schema_version=V,
                context={"subject": subject, "events_verified": verified.get(rid)},
            )
            if rid == b.rid("measurement", "hr-d27"):
                # D-3 preserves the absent value. D-6's limited state requires
                # a usable reading, so keep the engine's no_reading state and
                # retain the observed capture problem as its specific reason.
                info.update(reason_codes=[WRIST_QUALITY], reference_eligible=False)
            elif kind == "decode_session" and record["session_state"] == "interrupted":
                # Persist the specific P0 reason available in the capture.
                info["reason_codes"] = ["interrupted_page_hidden"]
            b.add("information_status", info)


def decode_history(bundle):
    statuses = {info["record_ref"]: info["status"] for info in bundle["information_status"]}
    return [
        {"record_id": s["decode_session_id"], "date": s["start_at_utc"][:10], "value": s["correct_count"],
         "info_status": statuses[s["decode_session_id"]], "is_practice": s["is_practice"], "session_index": i}
        for i, s in enumerate(bundle["decode_session"], 1)
    ]


def schedule_comparison(bundle):
    window, *tasks = bundle["mission_schedule"]
    options = contract_logic.rest_opportunity(
        {"start": window["start_at"], "end": window["end_at"]},
        [{**task, "item_id": task["mission_schedule_id"], "start": task["start_at"], "end": task["end_at"]}
         for task in tasks],
    )
    moves = tuple(schedule.Move(change["item_id"], schedule.Interval(change["new_start"], change["new_end"], "UTC"))
                  for change in options["changes"])
    return schedule.compare(
        tasks, subject_id=SUBJECT, clock_reference="UTC", clock_basis="UTC", resource_availability={},
        rest_window=schedule.Interval(window["start_at"], window["end_at"], "UTC"),
        horizon=schedule.Interval(min(t["start_at"] for t in tasks), window["end_at"], "UTC"),
        alternatives=[schedule.Alternative("S1-rest-d27", moves)],
    )


def app_steps(bundle, day):
    """Run the same draft rule ordering the app uses on the generated records."""
    # The Node bridge reads fd 0 synchronously. A large pipe can transiently return
    # EAGAIN before Python finishes writing, so give it a complete regular file.
    with tempfile.TemporaryFile(mode="w+", encoding="utf-8") as payload:
        json.dump(bundle, payload)
        payload.seek(0)
        result = subprocess.run(
            ["node", str(ROOT / "app/scripts/fahim_s1_rules.mjs"), date(day)],
            stdin=payload, encoding="utf-8", stdout=subprocess.PIPE, check=True, cwd=ROOT / "app",
        )
    return json.loads(result.stdout)


def add_rule_step(b, step, day, key, support, created, state, *, due, action_key=None):
    finding = b.finding(key, step["finding_kind"], support, step["explanation"], step["limitations"],
                        owner=step["owner_role"], rule=f"rule:{step['rule_id']}")
    b.b["finding"][-1].update(review_id=b.rid("daily_review", f"d{day}"),
                             created_at_utc=created, rule_version=step["rule_version"])
    action = b.action(action_key or key, finding, step["step_category"], step["explanation"], step["title"],
                      step["source_id"], step["owner_role"], state, due)
    b.b["action"][-1]["created_at_utc"] = created
    return finding, action


def add_review(b, day, created, findings, action, explanation, *, decode_day):
    b.add("daily_review", b.base("daily_review", b.rid("daily_review", f"d{day}"), "application_generated") | {
        "created_at_utc": created, "review_date": date(day),
        "reading_ids": [b.rid("measurement", f"hr-d{day}")],
        "sleep_record_id": b.rid("sleep_record", f"d{day}"),
        "decode_session_id": b.rid("decode_session", f"d{decode_day}"),
        "self_report_ids": [b.rid("self_report", f"alert-d{day}")] +
                           ([b.rid("self_report", "pain-d20")] if day == 20 else []),
        "finding_ids": findings, "selected_action_id": action, "review_explanation": explanation,
    })


def generate():
    b = FahimBuilder(SUBJECT, "fahim", SEED)
    verified = capture_inputs(b)
    build_statuses(b, verified)

    day20 = f"{date(20)}T19:05:00Z"
    day25 = f"{date(25)}T08:00:00Z"
    pain_due, watch_due = f"{date(28)}T12:00:00Z", f"{date(28)}T07:00:00Z"
    # No follow-ups or reference existed before the symptom review.
    b.b.update(personal_reference=[], action=[], follow_up=[])
    _, pain_steps = app_steps(b.b, 20)
    pain_step = pain_steps[0]
    pain_finding, pain_action = add_rule_step(
        b, pain_step, 20, "pain-d20", [b.rid("self_report", "pain-d20")], day20, "accepted", due=pain_due,
    )
    b.follow_up("pain-d20", pain_action, "under_specialist_review", day20, "medical", pain_due)
    b.b["follow_up"][-1]["created_at_utc"] = day20

    history = decode_history(b.b)
    initial = contract_logic.build_reference(METRIC, date(25), history, REFERENCE_PARAMS, False, None)
    history_by_day = {h["date"]: h for h in history}
    day25_decode = history_by_day[date(25)]
    compared = contract_logic.compare_to_reference(day25_decode["value"], initial)
    if compared["position"] != "below_range":
        raise ValueError("Day 25 must be below Fahim's personal range to open the follow-up.")
    ref_id = b.rid("personal_reference", "decode-d25")
    low, high = initial["range_low"], initial["range_high"]
    watch_explanation = f"Decode correct answers were below your personal range ({day25_decode['value']} vs {low}-{high})."
    watch_finding = b.finding(
        "dec-d25", "descriptive_change", [day25_decode["record_id"], ref_id], watch_explanation,
        "One session describes performance on the Decode task.", rule="rule:R-OBS-01",
    )
    b.b["finding"][-1].update(review_id=b.rid("daily_review", "d25"), created_at_utc=day25)
    watch_action = b.action("dec-d25", watch_finding, "observe", watch_explanation,
                            "Keep the daily check and watch the next sessions", "lib:cognition-battery",
                            "astronaut", "in_progress", watch_due)
    b.b["action"][-1]["created_at_utc"] = day25
    b.follow_up("dec-d25", watch_action, "watching", day25, "astronaut", watch_due)
    b.b["follow_up"][-1]["created_at_utc"] = day25
    frozen = contract_logic.build_reference(
        METRIC, date(27), history, REFERENCE_PARAMS, b.b["follow_up"][-1]["followup_status"] == "watching", initial,
    )
    b.add("personal_reference", b.base("personal_reference", ref_id, "application_generated") | frozen | {
        "created_at_utc": day25, "metric_code": METRIC, "reference_version": "ref-1.0", "unit": "count",
        "comparison_target_date": date(25), "method": "Median of valid past sessions in a 14-day window, excluding the first two sessions",
        "eligibility_notes": "Demonstration heuristic using 5 valid sessions in 14 days.",
        "freeze_reason": "Frozen while the cognition follow-up opened on mission day 25 is open.",
    })

    b.schedule("rest-d27", "Rest window", f"{date(27)}T23:00:00Z", f"{date(28)}T06:00:00Z", True, "rest_window")
    constraints = {"prep_minutes": 0, "travel_minutes": 0, "resource_constraints": []}
    b.schedule("meeting-d27", "Planning meeting", f"{date(27)}T23:00:00Z", f"{date(28)}T00:00:00Z", False, "task",
               constraints | {"movable_earliest_start": f"{date(27)}T21:00:00Z", "movable_latest_end": f"{date(28)}T00:00:00Z"})
    b.schedule("eva-prep-d27", "EVA procedure review", f"{date(27)}T19:00:00Z", f"{date(27)}T21:00:00Z",
               True, "task", constraints)
    rest = schedule_comparison(b.b)
    alternative, = rest["alternatives"]
    current = rest["baseline"]["longest_rest_opportunity_minutes"]
    proposed = alternative["longest_rest_opportunity_minutes"]
    approver, = alternative["pending_approval_roles"]
    facts, steps = app_steps(b.b, 27)
    chosen = steps[0]
    support = [history_by_day[date(d)]["record_id"] for d in range(27 - facts["decode.below_reference_consecutive"], 27)]
    support += [ref_id] + [b.rid("sleep_record", f"d{d}") for d in range(25, 28)]
    rest_finding, rest_action = add_rule_step(
        b, chosen, 27, "dec-d27", support, DAY27_REVIEW_AT, "proposed", due=f"{date(27 + chosen['followup_days'])}T07:00:00Z", action_key="rest-d27",
    )
    # Keep the scenario's current review first for fixture consumers.
    add_review(b, 27, DAY27_REVIEW_AT, [rest_finding], rest_action,
               "Today's entries include sleep and alertness. The wrist check produced no pulse reading because of weak sensor contact. Today's Decode is missing.",
               decode_day=26)
    add_review(b, 20, day20, [pain_finding], pain_action, pain_step["explanation"], decode_day=20)
    add_review(b, 25, day25, [watch_finding], watch_action, watch_explanation, decode_day=25)

    scenario = b.scenario("S1", SEED, [
        "Recent Decode scores are below the frozen personal range; self-rated alertness is shown separately.",
        "The recent short nights appear as separate observations.",
        "The day-27 wrist check has weak sensor contact and the pulse value is absent.",
        f"Moving the meeting offers {current} to {proposed} minutes of rest opportunity; approval belongs to the {approver}.",
        "The pain follow-up remains open with the medical team.",
    ], [b.rid("daily_review", "d27")])
    scenario.update(created_at_utc=DAY27_REVIEW_AT, scenario_version="1.0-fahim")
    return b.bundle(scenario, "Generated by scripts/make_fahim_s1.py. All observations are synthetic.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Compare with the checked-in S1 fixture.")
    args = parser.parse_args()
    path = OUT / "S1.json"
    rendered = json.dumps(generate(), indent=2) + "\n"
    if args.check:
        if path.read_text(encoding="utf-8") != rendered:
            sys.exit("S1 fixture differs from deterministic generation")
        print("S1 fixture matches deterministic generation.")
    else:
        path.write_text(rendered, encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
