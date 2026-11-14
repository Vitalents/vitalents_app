"""Task 9 arithmetic, protocol and fail-closed ledger verification."""
from copy import deepcopy
import json
from pathlib import Path
import unittest

from science import decode, reference, rules, status

VECTORS = json.loads(Path(__file__).with_name("fixtures").joinpath("decode_ledger.json").read_text(
    encoding="utf-8-sig"
))
KEY = VECTORS["key"]
SUBJECT = {"subject_profile_id": "qa:player", "subject_mode": "live_player", "timezone_basis": "UTC"}
SESSION = {
    "decode_session_id": "qa:round", "subject_id": "qa:player", "is_simulated": False,
    "schema_version": "0.9", "data_origin": "live_decode", "protocol_version": "qa:90s",
    "key_version": "qa:key", "start_at_utc": "2026-11-20T09:00:00Z",
    "end_at_utc": "2026-11-20T09:01:30Z", "created_at_utc": "2026-11-20T09:01:30Z",
    "planned_duration_ms": 90_000, "elapsed_monotonic_ms": 90_000, "is_practice": False,
    "session_state": "completed", "interruption_reasons": [], "input_method": "keyboard",
    "app_version": "qa:synthetic", "technical_context": "Synthetic fixed client",
}
EXPECTED_SUMMARY = {
    "accepted_responses": 4, "correct_count": 3, "accuracy_percent": 75.0,
    "median_correct_rt_ms": 401, "incorrect_count": 1,
}


def event(row):
    return {
        **{field: SESSION[field] for field in (
            "decode_session_id", "subject_id", "data_origin", "is_simulated",
            "schema_version", "created_at_utc", "input_method",
        )},
        "decode_response_event_id": row["id"], "trial_index": row["trial"],
        "symbol_id": row["symbol"], "correct_digit": KEY[row["symbol"]],
        "response_digit": row["answer"], "stimulus_monotonic_ms": row["shown"],
        "response_monotonic_ms": row["pressed"], "response_time_ms": row["rt"],
        "response_state": row["state"], "is_accepted": row["accepted"],
        "focus_state": "foreground",
    }


def events():
    return [event(row) for row in VECTORS["events"]]


def verified(rows, session=None, **overrides):
    return decode.verify(
        session if session is not None else SESSION, rows, **{
            "subject": SUBJECT, "key_registry": {"qa:key": KEY},
            "expected_event_ids": [row["decode_response_event_id"] for row in rows],
            **overrides,
        },
    )


class DecodeTests(unittest.TestCase):
    def test_recomputes_odd_median_and_errors_with_slow_late_and_duplicate(self):
        rows = events()
        original = deepcopy((rows, SESSION))
        result = verified(rows)
        self.assertEqual(result["summary"], EXPECTED_SUMMARY)
        self.assertEqual(result["event_counts"], {
            "correct": 3, "incorrect": 1, "missed": 1, "late": 1,
            "duplicate": 1, "interrupted": 0,
        })
        self.assertTrue(result["events_verified"])
        self.assertEqual(result["score_status"], "scored")
        self.assertEqual(result["information_status"]["status"], "valid")
        self.assertEqual((rows, SESSION), original)

    def test_even_median_uses_only_correct_responses(self):
        result = verified(events()[:6])
        self.assertEqual(result["summary"]["median_correct_rt_ms"], 401)
        result = verified(events()[:5])
        self.assertEqual(result["summary"]["median_correct_rt_ms"], 43550.5)
        self.assertEqual(result["summary"]["accuracy_percent"], 100 * 2 / 3)

    def test_sealed_capture_order_survives_transport_reordering(self):
        rows = events()
        seal = [row["decode_response_event_id"] for row in rows]
        self.assertEqual(verified(rows[::-1], expected_event_ids=seal), verified(rows))

    def test_boundary_inclusive_at_start_and_exclusive_at_90000(self):
        start = events()[0]
        start.update(response_monotonic_ms=0, response_time_ms=0)
        self.assertEqual(verified([start])["summary"]["median_correct_rt_ms"], 0)
        edge, late = events()[-2:]
        self.assertEqual(verified([{**edge, "trial_index": 0}])["summary"]["correct_count"], 1)
        self.assertEqual(verified([{**late, "trial_index": 0}])["event_counts"]["late"], 1)
        late.update(trial_index=0, is_accepted=True, response_state="correct")
        self.assertFalse(verified([late])["events_verified"])

    def test_terminal_miss_can_have_an_audited_late_press(self):
        edge, late = events()[-2:]
        missed = {**edge, "trial_index": 0, "response_digit": None, "response_monotonic_ms": None,
                  "response_time_ms": None, "response_state": "missed", "is_accepted": False}
        result = verified([missed, {**late, "trial_index": 0}])
        self.assertEqual(result["event_counts"]["missed"], 1)
        self.assertEqual(result["event_counts"]["late"], 1)
        self.assertEqual(result["summary"]["accepted_responses"], 0)

    def test_verified_empty_and_all_wrong_are_distinct_from_unknown(self):
        empty = verified([])["summary"]
        self.assertEqual(empty, dict(accepted_responses=0, correct_count=0, accuracy_percent=None,
                                     median_correct_rt_ms=None, incorrect_count=0))
        wrong = {**events()[2], "trial_index": 0}
        self.assertEqual(verified([wrong])["summary"], {
            "accepted_responses": 1, "correct_count": 0, "accuracy_percent": 0.0,
            "median_correct_rt_ms": None, "incorrect_count": 1,
        })
        self.assertIsNone(verified([], expected_event_ids=None)["summary"])

    def test_missing_row_and_extra_row_fail_even_without_persisted_summary(self):
        rows = events()
        ids = [row["decode_response_event_id"] for row in rows]
        for sample, seal in ((rows[:-1], ids), (rows, ids[:-1]), ([], ids), (rows, None)):
            with self.subTest(rows=len(sample), seal=seal):
                result = verified(sample, expected_event_ids=seal)
                self.assertFalse(result["events_verified"])
                self.assertIsNone(result["summary"])

    def test_exact_and_conflicting_event_id_replays_fail_closed(self):
        row = events()[0]
        for second in (row, {**row, "response_digit": 9}):
            with self.subTest(second=second):
                result = verified([row, second], expected_event_ids=["a0"])
                self.assertIn("duplicate_event_identity", {item["code"] for item in result["issues"]})
                self.assertIsNone(result["summary"])

    def test_duplicate_seal_and_duplicate_accepted_trial_fail(self):
        rows = events()
        self.assertEqual(verified(rows, expected_event_ids=["a0", "a0"])["issues"],
                         [{"code": "invalid_ledger_seal"}])
        rows[1].update(response_state="correct", is_accepted=True)
        self.assertFalse(verified(rows)["events_verified"])

    def test_malformed_events_cannot_publish_a_score(self):
        for fields in (
            {"decode_session_id": "qa:other"}, {"subject_id": "qa:other"},
            {"data_origin": "simulated_mission"}, {"is_simulated": True},
            {"trial_index": True}, {"trial_index": 5}, {"correct_digit": 2},
            {"symbol_id": "unknown"}, {"response_digit": None}, {"response_digit": 0},
            {"response_digit": True}, {"focus_state": "background"}, {"input_method": None}, {"input_method": "touch"},
            {"response_monotonic_ms": float("nan")}, {"response_monotonic_ms": -1},
            {"stimulus_monotonic_ms": 90000}, {"stimulus_monotonic_ms": True},
            {"response_time_ms": 400}, {"response_time_ms": True},
            {"is_accepted": 1}, {"response_state": "incorrect"},
        ):
            with self.subTest(fields=fields):
                result = verified([{**events()[0], **fields}])
                self.assertFalse(result["events_verified"])
                self.assertIsNone(result["summary"])

    def test_rejects_response_before_stimulus_and_overlapping_trials(self):
        rows = events()
        rows[2].update(stimulus_monotonic_ms=350, response_time_ms=750)
        self.assertEqual(verified(rows[:3])["issues"][0]["code"], "overlapping_trials")
        rows[2]["stimulus_monotonic_ms"] = 1200
        self.assertEqual(verified(rows[:3])["issues"][0]["code"], "invalid_response_payload")

    def test_rejects_capture_order_inconsistent_with_response_timing(self):
        rows = events()
        rows[1].update(response_monotonic_ms=2000, response_time_ms=2000)
        self.assertIn("response_order_mismatch", {item["code"] for item in verified(rows)["issues"]})

    def test_planned_and_monotonic_duration_must_match_protocol(self):
        for changes in (
            {"planned_duration_ms": 89_999}, {"planned_duration_ms": 90_000.0},
            {"elapsed_monotonic_ms": 89_999}, {"elapsed_monotonic_ms": 90_001},
            {"elapsed_monotonic_ms": None}, {"elapsed_monotonic_ms": float("inf")},
        ):
            with self.subTest(changes=changes):
                result = verified([], {**SESSION, **changes})
                self.assertEqual(result["issues"], [{"code": "invalid_measurement_window"}])
                self.assertIsNone(result["summary"])

    def test_wall_clock_disagreement_needs_independent_attestation(self):
        session = {**SESSION, "end_at_utc": "2026-11-20T09:02:00Z"}
        result = verified(events(), session)
        self.assertIn("unverified_decode_clock_disagreement", result["information_status"]["reason_codes"])
        self.assertIsNone(result["summary"])
        self.assertEqual(verified(events(), session, clock_adjustment_verified=True)["summary"],
                         EXPECTED_SUMMARY)

    def test_key_version_and_bijection_must_match(self):
        for registry in ({}, {"qa:key": {**KEY, "b": 1}}, {"qa:key": {**KEY, "b": True}}):
            with self.subTest(registry=registry):
                self.assertEqual(verified([], key_registry=registry)["issues"],
                                 [{"code": "unknown_or_invalid_key"}])
        remapped = {**KEY, "a": 2, "b": 1}
        self.assertFalse(verified(events(), key_registry={"qa:key": remapped})["events_verified"])

    def test_stored_claims_must_match_or_be_entirely_absent(self):
        session = {**SESSION, **{key: EXPECTED_SUMMARY[key] for key in decode.SCORE_FIELDS}}
        self.assertEqual(verified(events(), session)["summary"], EXPECTED_SUMMARY)
        for fields in ({"accuracy_percent": 76}, {"correct_count": True},
                       {"accepted_responses": None}, {"median_correct_rt_ms": 402}):
            with self.subTest(fields=fields):
                result = verified(events(), {**session, **fields})
                self.assertFalse(result["events_verified"])
                self.assertEqual(result["score_status"], "unavailable")
                self.assertEqual(result["issues"][0]["code"], "stored_summary_mismatch")
                self.assertEqual(result["information_status"]["status"], "incomplete")

    def test_partial_ledgers_remain_auditable_without_score(self):
        first, partial = events()[0], events()[2]
        partial.update(response_digit=None, response_monotonic_ms=None, response_time_ms=None,
                       response_state="interrupted", is_accepted=False, focus_state="background")
        for state in ("aborted", "interrupted", "started"):
            with self.subTest(state=state):
                session = {**SESSION, "session_state": state, "elapsed_monotonic_ms": 1500,
                           "end_at_utc": None}
                result = verified([first, partial], session)
                self.assertTrue(result["events_verified"])
                self.assertEqual(result["event_counts"]["interrupted"], 1)
                self.assertIsNone(result["summary"])
                self.assertFalse(result["information_status"]["reference_eligible"])
                self.assertFalse(verified([first, partial], {**session, "correct_count": 1})["events_verified"])

    def test_partial_capture_rejects_post_stop_attempt_and_unknown_elapsed(self):
        session = {**SESSION, "session_state": "interrupted", "elapsed_monotonic_ms": 401,
                   "end_at_utc": "2026-11-20T09:00:00.401Z"}
        result = verified(events()[:1], session)
        self.assertEqual(result["issues"][0]["code"], "response_outside_partial_capture")
        self.assertFalse(verified(events()[:1], {**session, "elapsed_monotonic_ms": None})["events_verified"])

    def test_completed_flag_cannot_override_reported_interruption(self):
        result = verified(events(), {**SESSION, "interruption_reasons": ["focus_loss"]})
        self.assertIsNone(result["summary"])
        self.assertIn("session_interrupted", result["information_status"]["reason_codes"])

    def test_practice_is_scored_separately_and_excluded_from_reference(self):
        practice = {**SESSION, "is_practice": True}
        result = verified(events(), practice)
        self.assertEqual((result["score_status"], result["summary"]), ("practice_only", EXPECTED_SUMMARY))
        self.assertFalse(result["information_status"]["reference_eligible"])
        context = {"subject": SUBJECT, "events_verified": result["events_verified"],
                   "conditions_compatible": True, "decode_familiarization_verified": True,
                   "decode_exposure_band": "qa"}
        observation = reference.Observation(
            {**practice, **{field: result["summary"][field] for field in decode.SCORE_FIELDS}}, context,
        )
        policy = reference.Policy("decode_session", "correct_count", "qa-v1", 14, 1)
        self.assertEqual(reference.build_reference(observation, [], policy).reason, "practice_session")

    def test_partition_gate_and_unverified_event_gate_reach_rules(self):
        rows = events()
        self.assertFalse(verified(rows, subject={**SUBJECT, "source_participant_id": "research:id"})["events_verified"])
        self.assertFalse(verified(rows, {**SESSION, "data_origin": "real_research"})["events_verified"])
        result = verified(rows[:-1], expected_event_ids=[row["decode_response_event_id"] for row in rows])
        reading = rules.Reading("decode", "decode_session", reference.Observation(
            SESSION, {"subject": SUBJECT, "events_verified": result["events_verified"]},
        ))
        review = rules.evaluate([reading], subject_id=SESSION["subject_id"], subject_mode="live_player",
                                as_of_utc="2026-11-20T12:00:00Z")
        self.assertEqual(review["main_next_step"]["step_category"], "complete_measurement")
        self.assertEqual(review["readings"][0]["raw_information_status"]["status"], "incomplete")
