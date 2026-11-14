"""Additional synthetic unit and boundary cases for the Task 3 API."""

from copy import deepcopy
import unittest

from science import status
from test_reference import decode, hr, modify, sleep
from test_status import COMPATIBLE, ENVELOPE


class StatusEdgeTests(unittest.TestCase):
    def test_comparison_requires_literal_booleans_for_each_check(self):
        row = hr(6)
        for field in COMPATIBLE:
            with self.subTest(field=field):
                context = dict(row.context, comparison=dict(COMPATIBLE, **{field: 1}))
                result = status.evaluate("measurement", row.record, context=context)
                self.assertEqual(result["status"], "not_comparable")
                self.assertIn("missing_comparison_context", result["reason_codes"])
                self.assertIs(result["reference_eligible"], False)

    def test_comparison_method_is_false_for_known_mismatch_even_if_other_check_unknown(self):
        row = hr(6)
        context = dict(row.context, comparison=dict(
            COMPATIBLE, compatible_protocol=None, same_device_method=False,
        ))
        result = status.evaluate("measurement", row.record, context=context)
        self.assertIs(result["method_consistent"], False)
        self.assertEqual(result["reason_codes"], ["device_method_mismatch", "missing_comparison_context"])

    def test_unknown_duplicate_flag_fails_closed(self):
        row = hr(6)
        for malformed in ("resolved", None, True):
            with self.subTest(malformed=malformed):
                context = dict(row.context, duplicate_state=malformed, comparison=COMPATIBLE)
                result = status.evaluate("measurement", row.record, context=context)
                self.assertEqual(result["status"], "incomplete")
                self.assertIn("unknown_duplicate_state", result["reason_codes"])

    def test_leap_calendar_and_hour_bounds(self):
        row = hr(6, metric_code="hr_hourly_bpm", source_metric_granularity="hourly")
        cases = [
            ("2024-02-29", 0, True), ("2024-02-29", 23, True), ("2026-02-29", 0, False),
            ("2024-02-29", 24, False), ("2024-02-29", -1, False),
            ("2024-02-29", True, False), ("20240229", 8, False),
        ]
        for day, hour, expected in cases:
            with self.subTest(day=day, hour=hour):
                record = dict(row.record, observation_date=day, hour_local=hour)
                result = status.evaluate("measurement", record, context=row.context)
                self.assertIs(result["measurement_time_known"], expected)
                self.assertEqual(result["status"], "valid" if expected else "incomplete")

    def test_missing_measurement_cannot_mask_invalid_provenance_for_persistence(self):
        row = hr(6, None, is_simulated=False)
        result = status.evaluate("measurement", row.record, context=row.context)
        self.assertEqual(result["status"], "no_reading")
        self.assertIn("invalid_provenance", result["reason_codes"])
        with self.assertRaises(ValueError):
            status.information_status("measurement", row.record, context=row.context, **ENVELOPE)

    def test_persistence_validates_output_timestamp_and_ids(self):
        row = hr(6)
        for overrides in (
            {"information_status_id": " "}, {"schema_version": None},
            {"created_at_utc": "2026-11-14T10:00:00+01:00"},
            {"created_at_utc": "20261114T100000Z"},
        ):
            with self.subTest(overrides=overrides), self.assertRaises(ValueError):
                status.information_status("measurement", row.record, context=row.context,
                                          **{**ENVELOPE, **overrides})

    def test_quality_does_not_mutate_nested_input_or_context(self):
        row = decode(6)
        row.context["comparison"] = dict(COMPATIBLE)
        before_record, before_context = deepcopy(row.record), deepcopy(row.context)
        status.evaluate("decode_session", row.record, context=row.context)
        status.information_status("decode_session", row.record, context=row.context, **ENVELOPE)
        self.assertEqual(row.record, before_record)
        self.assertEqual(row.context, before_context)

    def test_sleep_selected_optional_fields_preserve_zero(self):
        for field in ("minutes_awake", "minutes_to_fall_asleep", "minutes_after_wakeup"):
            with self.subTest(field=field):
                row = sleep(6, **{field: 0})
                ctx = dict(row.context, comparison=dict(COMPATIBLE, sleep_field=field))
                result = status.evaluate("sleep_record", row.record, context=ctx)
                self.assertEqual(result["status"], "valid")
                self.assertIs(result["reference_eligible"], True)

    def test_sleep_malformed_comparator_does_not_fall_back_to_eligibility(self):
        row = sleep(6)
        for comparison in ([], "minutes_asleep", dict(COMPATIBLE, sleep_field=["minutes_asleep"])):
            with self.subTest(comparison=comparison):
                result = status.evaluate("sleep_record", row.record,
                                         context=dict(row.context, comparison=comparison))
                self.assertEqual(result["status"], "not_comparable")
                self.assertIn("missing_sleep_comparison_target", result["reason_codes"])
                self.assertIs(result["reference_eligible"], False)

    def test_decode_started_aborted_and_completed_without_summaries(self):
        row = decode(6)
        for session_state, expected, reason in (
            ("started", "incomplete", "session_unfinished"),
            ("aborted", "not_comparable", "session_interrupted"),
        ):
            with self.subTest(session_state=session_state):
                record = dict(row.record, session_state=session_state, end_at_utc=None)
                result = status.evaluate("decode_session", record, context=row.context)
                self.assertEqual(result["status"], expected)
                self.assertIn(reason, result["reason_codes"])
        empty = dict(row.record, accepted_responses=None, correct_count=None,
                     accuracy_percent=None, median_correct_rt_ms=None)
        result = status.evaluate("decode_session", empty, context=row.context)
        self.assertEqual(result["status"], "valid")
        self.assertIsNone(result["reference_eligible"])

    def test_decode_zero_correct_requires_undefined_latency(self):
        row = decode(6, None, correct_count=0, accuracy_percent=0)
        result = status.evaluate("decode_session", row.record, context=row.context)
        self.assertEqual(result["status"], "valid")
        invalid = modify(row, median_correct_rt_ms=0)
        result = status.evaluate("decode_session", invalid.record, context=invalid.context)
        self.assertEqual(result["status"], "incomplete")
        self.assertIn("invalid_decode_summary", result["reason_codes"])

    def test_decode_median_latency_cannot_exceed_the_verified_acceptance_window(self):
        for latency, expected in ((0, "valid"), (90_000, "valid"), (90_000.001, "incomplete")):
            with self.subTest(latency=latency):
                row = decode(6, latency)
                result = status.evaluate("decode_session", row.record, context=row.context)
                self.assertEqual(result["status"], expected)
                self.assertEqual("invalid_decode_summary" in result["reason_codes"], expected == "incomplete")

    def test_verified_event_attestation_requires_literal_true(self):
        row = decode(6)
        result = status.evaluate("decode_session", row.record,
                                 context=dict(row.context, events_verified=1))
        self.assertEqual(result["status"], "incomplete")
        self.assertIn("unverified_decode_events", result["reason_codes"])

