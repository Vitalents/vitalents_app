"""Acceptance checks for the generated Fahim fixture (FR-SIM-02, FR-REF-04, FR-SCH-02)."""
import json
from collections import Counter, defaultdict

from science import contract_logic, decode, rules, status
from scripts.make_fahim_s1 import (
    DAY27_REVIEW_AT, METRIC, OUT, REFERENCE_PARAMS, SUBJECT, date, decode_history,
    schedule_comparison, verify_round,
)
from scripts.validate_data import check_bundle, iter_ids

PATH = OUT / "S1.json"


def read_bundle():
    return json.loads(PATH.read_text(encoding="utf-8"))


def test_s1_schema_counts_and_simulation_links():
    bundle = read_bundle()
    assert check_bundle(PATH) == []
    expected = dict(subject_profile=1, sleep_record=15, measurement=15, self_report=16,
                    decode_session=14, mission_schedule=3, information_status=44)
    assert {kind: len(bundle[kind]) for kind in expected} == expected
    profile, = bundle["subject_profile"]
    assert (profile["subject_profile_id"], profile["subject_mode"], profile["timezone_basis"]) == (
        SUBJECT, "mission_simulation", "mission_defined",
    )
    assert [s["start_at_utc"][:10] for s in bundle["decode_session"]] == [date(d) for d in range(13, 27)]
    ids = {r[f"{kind}_id"] for kind, rows in bundle.items() if isinstance(rows, list) for r in rows}
    for kind, rows in bundle.items():
        if not isinstance(rows, list):
            continue
        for row in rows:
            primary_id = row[f"{kind}_id"]
            assert primary_id.startswith(f"sim:{kind}:") or primary_id in (SUBJECT, "sim:scenario:S1")
            if kind not in ("subject_profile", "simulator_scenario"):
                assert row["subject_id"] == SUBJECT and row["is_simulated"] is True
            for value in row.values():
                assert all(ref in ids for ref in iter_ids(value) if ref.startswith("sim:"))


def test_s1_ledgers_and_frozen_reference():
    bundle = read_bundle()
    profile, = bundle["subject_profile"]
    events = defaultdict(list)
    for event in bundle["decode_response_event"]:
        events[event["decode_session_id"]].append(event)
    assert set(events) == {s["decode_session_id"] for s in bundle["decode_session"]}
    for day, session in enumerate(bundle["decode_session"], 13):
        ledger = events[session["decode_session_id"]]
        assert [e["trial_index"] for e in ledger] == list(range(1, len(ledger) + 1))
        audit = verify_round(session, ledger, profile, day)
        if day == 23:
            assert audit["information_status"]["status"] == "not_comparable"
            assert audit["event_counts"]["interrupted"] == 1
            assert all(session[k] is None for k in decode.SCORE_FIELDS)
            assert ledger[-1]["response_time_ms"] is None
        else:
            assert audit["score_status"] == "scored"
            assert audit["event_counts"]["missed"] == 1
            assert all(session[k] == audit["summary"][k] for k in decode.SCORE_FIELDS)

    ref, = bundle["personal_reference"]
    history = decode_history(bundle)
    initial = contract_logic.build_reference(METRIC, date(25), history, REFERENCE_PARAMS, False, None)
    unprotected = contract_logic.build_reference(METRIC, date(27), history, REFERENCE_PARAMS, False, initial)
    frozen = contract_logic.build_reference(METRIC, date(27), history, REFERENCE_PARAMS, True, initial)
    assert (initial["reference_value"], initial["range_low"], initial["range_high"], initial["valid_record_count"]) == (43, 41, 44, 9)
    assert unprotected["range_low"] == 36
    assert frozen == initial | {"frozen": True}
    assert {key: ref[key] for key in frozen} == frozen
    assert [contract_logic.compare_to_reference(row["value"], frozen)["position"] for row in history[-2:]] == [
        "below_range", "below_range",
    ]


def test_s1_day27_status_and_schedule():
    bundle = read_bundle()
    by_ref = {r["record_ref"]: r for r in bundle["information_status"]}
    assert Counter(r["status"] for r in by_ref.values()) == {"valid": 42, "no_reading": 1, "not_comparable": 1}
    pulse = bundle["measurement"][-1]
    wrist = by_ref[pulse["measurement_id"]]
    assert pulse["value"] is None
    assert wrist["status"] == "no_reading" and wrist["reason_codes"] == ["weak_sensor_contact"]
    assert wrist["reference_eligible"] is False
    profile, = bundle["subject_profile"]
    assert status.evaluate("measurement", pulse, context={"subject": profile})["status"] == "no_reading"

    review = next(r for r in bundle["daily_review"] if r["review_date"] == date(27))
    alert, = (r for r in bundle["self_report"] if r["self_report_id"] in review["self_report_ids"])
    assert alert["alertness_rating"] == 8 and alert["report_kind"] == "daily_check_alertness"
    assert review["sleep_record_id"] == "sim:sleep_record:d27"
    assert review["decode_session_id"] == "sim:decode_session:d26"
    assert review["selected_action_id"] == "sim:action:rest-d27"
    pain = next(f for f in bundle["follow_up"] if f["follow_up_id"] == "sim:follow_up:pain-d20")
    assert pain["followup_status"] == "under_specialist_review" and pain["assigned_role"] == "medical"
    assert pain["next_review_due_utc"] > DAY27_REVIEW_AT
    python_review = rules.evaluate([], subject_id=SUBJECT, subject_mode=profile["subject_mode"],
                                   as_of_utc=DAY27_REVIEW_AT, follow_ups=bundle["follow_up"])
    assert python_review["main_next_step"]["step_category"] == "request_review"
    assert pain["follow_up_id"] in python_review["main_next_step"]["supporting_record_ids"]

    result = schedule_comparison(bundle)
    alternative, = result["alternatives"]
    assert result["baseline"]["longest_rest_opportunity_minutes"] == 360
    assert alternative["longest_rest_opportunity_minutes"] == 420
    assert alternative["alternative_status"] == "pending_approval"
    assert alternative["pending_approval_roles"] == ["planner"]
