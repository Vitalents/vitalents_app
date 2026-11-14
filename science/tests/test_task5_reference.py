"""Additional synthetic reference series and end-to-end Python API cases."""

from copy import deepcopy
from dataclasses import replace
import itertools
import json
import unittest

from science import reference as ref, status
from test_reference import (
    DECODE, HR, INTERVAL, SLEEP, UTC, attest, decision, decode, hr, modify, publish,
    resting_history, sleep,
)
from test_status import COMPATIBLE, ENVELOPE


class ReferenceEdgeTests(unittest.TestCase):
    def test_policy_rejects_boolean_and_impossible_day_counts(self):
        for lookback, minimum in ((14, True), (True, 1), (0, 1), (14, 0), (3, 4), (14, 2.0)):
            with self.subTest(lookback=lookback, minimum=minimum), self.assertRaises(ValueError):
                replace(HR, lookback_days=lookback, minimum_days=minimum)

    def test_invalid_and_missing_current_targets_do_not_build_from_valid_history(self):
        cases = (ref.Observation(None, {}), hr(6, None), hr(6, unit="Hz"),
                 hr(6, measurement_context=""), hr(6, 90, observation_date="2026-11-31"))
        for target in cases:
            with self.subTest(target=target.record):
                result = ref.build_reference(target, resting_history(), HR)
                self.assertEqual(result.reference_status, "not_built")
                self.assertIsNone(result.reference_value)
                self.assertEqual(result.sources, ())

    def test_reference_ignores_a_forged_caller_comparison(self):
        current = attest(hr(6), comparison=dict(COMPATIBLE))
        rows = [attest(hr(i), comparison=dict(COMPATIBLE), conditions_compatible=False) for i in range(1, 6)]
        candidate = ref.build_reference(current, rows, HR)
        self.assertEqual(candidate.reason, "no_eligible_history")
        assessment = ref.compare(current, HR, ref.ReferenceSeries(), as_of_utc=UTC)
        self.assertIsNone(assessment.raw_information["reference_eligible"])
        self.assertIs(assessment.information_status["reference_eligible"], False)

    def test_incompatible_time_basis_is_excluded(self):
        row = hr(1)
        row.context["subject"]["timezone_basis"] = "UTC"
        candidate = ref.build_reference(hr(2), [row], replace(HR, minimum_days=1))
        self.assertEqual(candidate.exclusions[0].reasons, ("unverified_time_basis",))

    def test_insufficient_provenance_for_source_locator(self):
        candidate = ref.build_reference(hr(2), [hr(1, source_row_number=True)], replace(HR, minimum_days=1))
        self.assertEqual(candidate.exclusions[0].reasons, ("invalid_source_row_number",))

    def test_lookback_and_preceding_dates_cross_year_boundary(self):
        target = hr(1, observation_date="2027-01-01")
        dates = ("2026-12-29", "2026-12-30", "2026-12-31", "2027-01-02")
        history = [hr(i, i, observation_date=day) for i, day in enumerate(dates, start=2)]
        result = ref.build_reference(target, history, replace(HR, lookback_days=2, minimum_days=2))
        self.assertEqual([s.day.isoformat() for s in result.sources], list(dates[1:3]))
        self.assertEqual(result.reference_value, 3.5)

    def test_decimals_and_largest_finite_input_remain_json_serializable(self):
        for value in (0.1, float.fromhex("0x1.fffffffffffffp+1023")):
            with self.subTest(value=value):
                series = publish(hr(3, value), [hr(1, value), hr(2, value)], replace(HR, minimum_days=2))
                self.assertEqual(series.active.candidate.reference_value, value)
                json.dumps(ref.audit_event(series.active), allow_nan=False)

    def test_candidate_is_permutation_invariant_with_clones_and_conflicts(self):
        same = hr(1)
        rows = [same, modify(same, measurement_id="synthetic:clone"), hr(2),
                hr(2, 70, measurement_id="synthetic:conflict"), hr(3)]
        policy = replace(HR, minimum_days=2)
        target = hr(4)
        before = deepcopy((target, rows))
        baseline = ref.build_reference(target, rows, policy)
        for order in itertools.permutations(rows):
            self.assertEqual(ref.build_reference(target, order, policy), baseline)
        self.assertEqual((target, rows), before)

    def test_equivalent_decode_utc_representations_are_exact_duplicates(self):
        original = decode(1)
        alternate = modify(original, decode_session_id="synthetic:equivalent",
                           start_at_utc="2026-11-01T10:00:00+00:00",
                           end_at_utc="2026-11-01T10:01:30.000Z")
        result = ref.build_reference(decode(2), [original, alternate], replace(DECODE, minimum_days=1))
        self.assertEqual(len(result.sources), 1)
        self.assertEqual(result.exclusions[0].reasons, ("duplicate_observation",))
        self.assertEqual(result.sources[0].start_at_utc, original.record["start_at_utc"])

    def test_equivalent_measurement_utc_representations_are_exact_duplicates(self):
        original = hr(1, observed_at_utc="2026-11-01T10:00:00Z")
        alternate = modify(original, measurement_id="synthetic:equivalent",
                           observed_at_utc="2026-11-01T10:00:00+00:00")
        result = ref.build_reference(hr(2), [original, alternate], replace(HR, minimum_days=1))
        self.assertEqual(len(result.sources), 1)
        self.assertEqual(result.exclusions[0].reasons, ("duplicate_observation",))

    def test_decision_and_comparison_require_the_same_utc_format_as_task3(self):
        for timestamp in ("20261120T120000Z", "2026-11-20T12:00Z", "2026-11-20T12:00:00+02:00",
                          "2026-02-30T12:00:00Z"):
            with self.subTest(timestamp=timestamp):
                with self.assertRaises(ValueError):
                    decision(at=timestamp)
                with self.assertRaises(ValueError):
                    ref.compare(hr(7), HR, ref.ReferenceSeries(), as_of_utc=timestamp)
        decision(at="2026-11-20T12:00:00.500+00:00")

    def test_as_of_replay_selects_version_and_reviews_at_their_boundaries(self):
        t1, t2, t3, t4 = (f"2026-11-{day}T12:00:00Z" for day in (10, 11, 12, 13))
        series = publish(hr(6), resting_history(), HR, at=t1)
        series = series.decide("request_review", reference_id=series.active.reference_id, decision=decision(2, at=t2))
        series = series.decide("resolve_review", reference_id=series.active.reference_id, decision=decision(3, at=t3))
        newer = ref.build_reference(hr(7), [hr(i, 70) for i in range(1, 7)], HR)
        series = series.activate(newer, reference_id="synthetic:ref-2", decision=decision(4, at=t4),
                                 expected_reference_id=series.active.reference_id)
        snapshots = json.loads(json.dumps([ref.audit_event(event) for event in series.events]))
        restored = ref.restore_series(snapshots)
        for time, state, baseline in (
            (t1, "usable_for_question", 63), (t2, "needs_review", None),
            (t3, "usable_for_question", 63), (t4, "usable_for_question", 70),
        ):
            with self.subTest(time=time):
                result = ref.compare(hr(8), HR, restored, as_of_utc=time)
                self.assertEqual(result.reference_status, state)
                self.assertEqual(result.reference_value, baseline)

    def test_versioning_rejects_reused_decision_id_and_retroactive_events(self):
        series = publish(hr(6), resting_history(), HR)
        for invalid_decision in (decision(1, reason="Different payload"),
                                 decision(2, at="2026-11-19T12:00:00Z")):
            with self.subTest(decision=invalid_decision), self.assertRaises(ValueError):
                series.decide("freeze", reference_id=series.active.reference_id, decision=invalid_decision)
        self.assertEqual(len(series.events), 1)


    def test_restore_keeps_the_ruleset_that_produced_a_prior_version(self):
        series = publish(hr(6), resting_history(), HR)
        legacy = ref.audit_event(series.active)
        legacy["candidate"]["engine_version"] = "reference-1.0.0"
        legacy["candidate"]["status_ruleset_version"] = "status-0.3.0"
        restored = ref.restore_series([legacy])
        self.assertEqual(ref.audit_event(restored.active), legacy)
        current = ref.compare(hr(7), HR, restored, as_of_utc=UTC)
        self.assertEqual(current.reference_value, 63)
        self.assertEqual(current.information_status["ruleset_version"], status.RULESET_VERSION)


class CrossEngineTests(unittest.TestCase):
    def test_task3_rejected_decode_latency_cannot_enter_reference_history(self):
        invalid = decode(1, 90_001)
        candidate = ref.build_reference(decode(3), [invalid, decode(2)], replace(DECODE, minimum_days=1))
        self.assertEqual(candidate.reference_value, 620)
        self.assertEqual(candidate.exclusions[0].reasons, ("invalid_decode_summary",))

    def test_sleep_selected_field_can_be_persisted_when_other_field_is_absent(self):
        series = publish(sleep(4), [sleep(i) for i in (1, 2, 3)], INTERVAL)
        target = sleep(5, None)
        result = ref.compare(target, INTERVAL, series, as_of_utc=UTC)
        self.assertEqual(result.reference_value, 28_800_000)
        self.assertEqual(result.difference, 0)
        self.assertTrue(result.information_status["reference_eligible"])
        stored = status.information_status("sleep_record", target.record, context=result.assessment_context,
                                          **ENVELOPE)
        self.assertEqual(stored["record_ref"], target.record["sleep_record_id"])
        self.assertEqual(stored["status"], "valid")
        self.assertEqual(result.assessment_context["comparison"]["sleep_field"], "recorded_interval_ms")

    def test_wrong_sleep_metric_never_reuses_another_fields_baseline(self):
        series = publish(sleep(4), [sleep(i) for i in (1, 2, 3)], INTERVAL)
        result = ref.compare(sleep(5), SLEEP, series, as_of_utc=UTC)
        self.assertEqual(result.raw_information["status"], "valid")
        self.assertEqual(result.information_status["status"], "not_comparable")
        self.assertIn("comparison_metric_mismatch", result.information_status["reason_codes"])
        self.assertIsNone(result.reference_value)

    def test_live_decode_and_simulation_stay_separate_even_with_matching_subject_id(self):
        source = [decode(i) for i in range(1, 4)]
        series = publish(decode(4), source, DECODE)
        target = decode(5, origin="live_decode")
        result = ref.compare(target, DECODE, series, as_of_utc=UTC)
        self.assertIn("comparison_subject_mismatch", result.information_status["reason_codes"])
        self.assertIsNone(result.reference_id)
        self.assertIsNone(result.reference_value)
        candidate = ref.build_reference(target, source, DECODE)
        self.assertTrue(all(row.record_id is None for row in candidate.exclusions))

    def test_absent_sleep_slot_is_display_only_even_with_existing_reference(self):
        series = publish(sleep(4), [sleep(i) for i in (1, 2, 3)], SLEEP)
        result = ref.compare(ref.Observation(None, {}), SLEEP, series, as_of_utc=UTC)
        self.assertEqual(result.information_status["status"], "no_reading")
        self.assertEqual(result.information_status["reason_codes"], ["missing_record"])
        self.assertIsNone(result.difference)
        with self.assertRaises(ValueError):
            status.information_status("sleep_record", None, context=result.assessment_context, **ENVELOPE)

    def test_raw_quality_and_followup_are_independent_when_no_reference_is_active(self):
        current = hr(6)
        candidate = ref.build_reference(current, [hr(1)], HR)
        comparison = ref.compare(current, HR, ref.ReferenceSeries(), as_of_utc=UTC)
        self.assertEqual(candidate.reference_status, "provisional")
        self.assertEqual(comparison.raw_information["status"], "valid")
        self.assertIn("insufficient_reference", comparison.information_status["reason_codes"])
        self.assertNotIn("followup_status", comparison.information_status)
        self.assertNotIn("followup_status", ref.task2_record(
            publish(hr(6), resting_history(), HR).active, schema_version="0.9"))

