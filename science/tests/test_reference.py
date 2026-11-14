"""Synthetic unit and integration tests for Task 4 and the final Task 3 API."""

import json
import unittest
from dataclasses import replace
from pathlib import Path

from science import reference as ref
from science import status

CASES = json.loads(Path(__file__).with_name("fixtures").joinpath("reference_cases.json").read_text())
UTC = "2026-11-20T12:00:00Z"
HR = ref.DEMO_RESTING_HR
SLEEP = ref.Policy("sleep_record", "minutes_asleep", "synthetic-sleep-v1", 10, 3)
INTERVAL = replace(SLEEP, metric="recorded_interval_ms", version="synthetic-interval-v1")
DECODE = ref.Policy("decode_session", "median_correct_rt_ms", "synthetic-decode-v1", 10, 3)


def observation(kind, day, *, origin="simulated_mission", context=None, **fields):
    subject_id = fields.pop("subject_id", "synthetic:subject-1")
    record = {
        kind + "_id": f"synthetic:{kind}:{day}",
        "subject_id": subject_id, "schema_version": "0.9",
        "created_at_utc": UTC, "data_origin": origin,
        "is_simulated": origin == "simulated_mission",
        **fields,
    }
    trusted = {
        "subject": {
            "subject_profile_id": subject_id,
            "subject_mode": status.MODES[origin],
            "timezone_basis": ref.TIME_BASES[origin],
        },
        "conditions_compatible": True,
        **(context or {}),
    }
    if origin == "real_research":
        trusted["subject"].update(
            source_participant_id="synthetic:research-participant",
            research_dataset_version="LifeSnaps v4",
        )
        trusted["source_link_verified"] = True
    return ref.Observation(record, trusted)


def hr(day, value=63, **overrides):
    fields = {
        "observation_date": f"2026-11-{day:02}",
        "metric_code": "hr_resting_bpm", "value": value, "unit": "bpm",
        "capture_method": "simulator", "source_metric_granularity": "daily",
        "measurement_context": "synthetic: seated, morning",
        **overrides,
    }
    return observation("measurement", day, **fields)


def sleep(day, value=420, **overrides):
    fields = {
        "observation_date": f"2026-11-{day:02}", "minutes_asleep": value,
        "recorded_interval_ms": 28_800_000,
        "sleep_metric_method": "synthetic: simulated nightly record",
        **overrides,
    }
    return observation("sleep_record", day, **fields)


def decode(day, value=620, **overrides):
    fields = {
        "protocol_version": "synthetic:protocol-1", "key_version": "synthetic:key-1",
        "start_at_utc": f"2026-11-{day:02}T10:00:00Z",
        "end_at_utc": f"2026-11-{day:02}T10:01:30Z",
        "planned_duration_ms": 90_000, "elapsed_monotonic_ms": 90_000,
        "is_practice": False, "session_state": "completed", "input_method": "keyboard",
        "app_version": "synthetic:app-1", "technical_context": "synthetic: same client and setup",
        "accepted_responses": 10, "correct_count": 8, "accuracy_percent": 80,
        "median_correct_rt_ms": value,
        "context": {
            "events_verified": True, "decode_familiarization_verified": True,
            "decode_exposure_band": "synthetic: same exposure band",
        },
        **overrides,
    }
    return observation("decode_session", day, **fields)


def modify(row, **changes):
    return replace(row, record={**row.record, **changes})


def attest(row, **changes):
    return replace(row, context={**row.context, **changes})


def resting_history():
    return [hr(*pair) for pair in CASES["resting_hr"]["observations"]]


def decision(number=1, reason="Synthetic review recorded", at=UTC):
    return ref.Decision(f"synthetic:decision-{number}", "synthetic:reviewer", "medical", at, reason)


def publish(target, history, policy, *, at=UTC):
    candidate = ref.build_reference(target, history, policy)
    return ref.ReferenceSeries().activate(
        candidate, reference_id="synthetic:ref-1", decision=decision(at=at),
        expected_reference_id=None,
    )


class ReferenceTests(unittest.TestCase):
    def test_valid_history_fixture(self):
        case = CASES["resting_hr"]
        self.assertTrue(CASES["examples_are_synthetic"])
        result = ref.build_reference(hr(*case["target"]), resting_history(), HR)
        self.assertEqual(result.reference_status, "usable_for_question")
        self.assertEqual(result.reference_value, case["median"])
        self.assertEqual([row.record_id for row in result.sources],
                         [f"synthetic:measurement:{i}" for i in range(1, 6)])

    def test_insufficient_and_empty_history(self):
        for history, expected in [([hr(1)], "provisional"), ([], "not_built")]:
            with self.subTest(expected=expected):
                result = ref.build_reference(hr(6), history, HR)
                self.assertEqual(result.reference_status, expected)
                self.assertIsNone(result.reference_value)

    def test_distinct_days_and_daily_weighting_for_decode(self):
        many = [decode(1, v, decode_session_id=f"synthetic:attempt:{v}",
                       start_at_utc=f"2026-11-01T10:{i:02}:00Z",
                       end_at_utc=f"2026-11-01T10:{i + 1:02}:30Z")
                for i, v in enumerate((300, 340, 360, 400))]
        result = ref.build_reference(decode(4), many, DECODE)
        self.assertEqual(len(result.daily_values), 1)
        self.assertEqual(result.reference_status, "provisional")
        result = ref.build_reference(decode(4), many + [decode(2, 600), decode(3, 700)], DECODE)
        self.assertEqual(result.reference_value, 600)
        self.assertEqual(result.daily_values[0][1], 350)

    def test_null_omitted_zero_and_nonfinite(self):
        null = hr(1, None)
        omitted = hr(2)
        del omitted.record["value"]
        history = [null, omitted, hr(3, 0), hr(4, float("inf")), hr(5, True), hr(6, -1)]
        result = ref.build_reference(hr(7), history, replace(HR, minimum_days=1))
        self.assertEqual(result.reference_value, 0)
        self.assertEqual(len(result.sources), 1)
        self.assertEqual(sum(row.reasons == ("missing_value",) for row in result.exclusions), 2)
        self.assertEqual(sum(row.reasons == ("invalid_value",) for row in result.exclusions), 3)

    def test_method_units_context_granularity_and_other_metric(self):
        history = [hr(1, unit="Hz"), hr(2, capture_method="manual"),
                   hr(3, measurement_context="synthetic: after exercise"),
                   hr(4, source_metric_granularity="hourly", hour_local=8),
                   hr(5, metric_code="hr_daily_bpm"), hr(6)]
        result = ref.build_reference(hr(7), history, replace(HR, minimum_days=1))
        self.assertEqual(len(result.sources), 1)
        self.assertEqual({r.reasons[0] for r in result.exclusions}, {
            "unknown_unit", "device_method_mismatch", "wrong_conditions",
            "temporal_resolution_mismatch", "comparison_metric_mismatch",
        })

    def test_different_subject_and_origin_redacted_even_when_ids_match(self):
        history = [hr(1, subject_id="synthetic:other"), hr(2, origin="real_research",
                   source_file="synthetic.csv", source_field="resting_hr"), hr(3)]
        result = ref.build_reference(hr(6), history, replace(HR, minimum_days=1))
        self.assertEqual(len(result.sources), 1)
        self.assertEqual(len(result.exclusions), 2)
        self.assertTrue(all(item.record_id is None for item in result.exclusions))

    def test_research_participant_dataset_and_source_attestation(self):
        def research(day, **overrides):
            return hr(day, origin="real_research", source_file="synthetic.csv",
                      source_field="resting_hr", **overrides)

        target = research(6)
        peer = research(2)
        peer.context["subject"]["source_participant_id"] = "synthetic:research-peer"
        revision = research(3)
        revision.context["subject"]["research_dataset_version"] = "synthetic:v-other"
        result = ref.build_reference(target, [research(1), peer, revision,
                                     attest(research(4), source_link_verified=False)],
                                     replace(HR, minimum_days=1))
        self.assertEqual(len(result.sources), 1)
        self.assertEqual(sum(row.record_id is None for row in result.exclusions), 2)
        self.assertIn(("subject_source_mismatch",), [item.reasons for item in result.exclusions])

    def test_out_of_order_window_boundaries_current_id_and_same_day(self):
        target = hr(16)
        entries = [hr(1), hr(2), hr(15), hr(17), hr(16, measurement_id="synthetic:same-day"),
                   hr(14, measurement_id=target.record["measurement_id"])]
        policy = replace(HR, minimum_days=2)
        result = ref.build_reference(target, entries, policy)
        self.assertEqual(result, ref.build_reference(target, list(reversed(entries)), policy))
        self.assertEqual([r.day.day for r in result.sources], [2, 15])
        self.assertEqual([reason for e in result.exclusions for reason in e.reasons].count(
            "current_or_future_day"), 2)
        self.assertIn(("current_record",), [e.reasons for e in result.exclusions])
        self.assertIn(("outside_lookback",), [e.reasons for e in result.exclusions])

    def test_duplicates_are_deterministic_and_conflicts_are_excluded(self):
        same = hr(1)
        exact = modify(same, measurement_id="synthetic:canonical", source_row_number=2)
        conflict = [hr(2), hr(2, 66, measurement_id="synthetic:conflict")]
        rows = [same, exact, *conflict]
        result = ref.build_reference(hr(6), rows, replace(HR, minimum_days=1))
        self.assertEqual(result, ref.build_reference(hr(6), rows[::-1], replace(HR, minimum_days=1)))
        self.assertEqual([row.record_id for row in result.sources], ["synthetic:canonical"])
        self.assertEqual(sum(e.reasons == ("conflicting_duplicate",) for e in result.exclusions), 2)
        self.assertIn(("duplicate_observation",), [e.reasons for e in result.exclusions])

    def test_duplicate_id_spanning_natural_keys_is_excluded(self):
        result = ref.build_reference(hr(6), [hr(1), hr(2, measurement_id="synthetic:measurement:1")], HR)
        self.assertEqual(result.sources, ())
        self.assertTrue(all(e.reasons == ("conflicting_duplicate",) for e in result.exclusions))

    def test_research_hourly_matches_same_local_hour_and_excludes_export_conflict(self):
        def hourly(day, **overrides):
            fields = {"source_file": "synthetic-hourly.csv", "source_field": "bpm", "hour_local": 9,
                      **overrides}
            return hr(day, origin="real_research", metric_code="hr_hourly_bpm",
                      source_metric_granularity="hourly", **fields)

        policy = ref.Policy("measurement", "hr_hourly_bpm", "synthetic-hourly", 10, 1)
        result = ref.build_reference(hourly(4), [
            hourly(1), hourly(2, hour_local=8), hourly(3),
            hourly(3, capture_method="other", measurement_id="synthetic:conflicting"),
        ], policy)
        self.assertEqual(len(result.sources), 1)
        self.assertEqual(result.sources[0].hour_local, 9)
        self.assertEqual(sum(e.reasons == ("conflicting_duplicate",) for e in result.exclusions), 2)

    def test_adapter_duplicate_flags_are_honored(self):
        rows = [attest(hr(1), duplicate_state="conflict"), attest(hr(2), duplicate_state="exact"), hr(3)]
        result = ref.build_reference(hr(6), rows, replace(HR, minimum_days=1))
        self.assertEqual(len(result.sources), 1)
        self.assertEqual({e.reasons for e in result.exclusions},
                         {("conflicting_duplicate",), ("duplicate_observation",)})

    def test_unsupported_metric_is_explicit(self):
        policy = replace(HR, metric="nightly_skin_temperature")
        result = ref.build_reference(hr(6, metric_code=policy.metric, unit="UNVERIFIED"), [], policy)
        self.assertEqual(result.reason, "unsupported_reference_metric")
        self.assertIsNone(result.reference_value)

    def test_verified_steps_and_daily_hr_have_separate_policy(self):
        for metric, unit in [("steps_daily", "count"), ("hr_daily_bpm", "bpm")]:
            with self.subTest(metric=metric):
                policy = ref.Policy("measurement", metric, f"synthetic-{metric}", 7, 1)
                rows = [hr(1, 42, metric_code=metric, unit=unit)]
                result = ref.build_reference(hr(2, metric_code=metric, unit=unit), rows, policy)
                self.assertEqual(result.reference_value, 42)

    def test_sleep_fields_are_independent_and_zero_is_observed(self):
        rows = [sleep(1, 0), sleep(2, None), sleep(3, recorded_interval_ms=None)]
        asleep = ref.build_reference(sleep(4), rows, replace(SLEEP, minimum_days=2))
        interval = ref.build_reference(sleep(4), rows, replace(INTERVAL, minimum_days=2))
        self.assertEqual(asleep.reference_value, 210)
        self.assertEqual(interval.reference_value, 28_800_000)
        self.assertEqual(asleep.key.unit, "minutes")
        self.assertEqual(interval.key.unit, "ms")
        self.assertEqual(asleep.exclusions[0].reasons, ("missing_sleep_target_value",))
        self.assertEqual(interval.exclusions[0].reasons, ("missing_sleep_target_value",))

    def test_sleep_contradiction_and_unknown_method(self):
        rows = [sleep(1, 600), sleep(2, sleep_metric_method=None), sleep(3)]
        result = ref.build_reference(sleep(5), rows, replace(SLEEP, minimum_days=1))
        self.assertEqual(len(result.sources), 1)
        self.assertIn(("sleep_asleep_exceeds_interval",), [e.reasons for e in result.exclusions])
        self.assertIn(("unknown_sleep_method",), [e.reasons for e in result.exclusions])

    def test_decode_practice_interrupted_unverified_and_inconsistent(self):
        rows = [decode(1, is_practice=True), decode(2, session_state="interrupted"),
                attest(decode(3), events_verified=False), decode(4, correct_count=9), decode(5)]
        result = ref.build_reference(decode(6), rows, replace(DECODE, minimum_days=1))
        self.assertEqual(len(result.sources), 1)
        self.assertEqual({e.reasons[0] for e in result.exclusions}, {
            "practice_session", "session_interrupted", "unverified_decode_events",
            "invalid_decode_summary",
        })

    def test_decode_protocol_device_exposure_and_familiarization(self):
        rows = [decode(1, key_version="synthetic:key-2"), decode(2, input_method="touch"),
                attest(decode(3), decode_exposure_band="synthetic: another band"),
                attest(decode(4), decode_familiarization_verified=False), decode(5)]
        result = ref.build_reference(decode(6), rows, replace(DECODE, minimum_days=1))
        self.assertEqual(len(result.sources), 1)
        self.assertEqual({e.reasons[0] for e in result.exclusions}, {
            "protocol_mismatch", "device_method_mismatch", "wrong_conditions",
            "unverified_decode_familiarization",
        })
        self.assertIn(ref.DECODE_LIMIT, result.limitations)

    def test_decode_previous_day_session_must_also_end_before_target_day(self):
        past = decode(3, start_at_utc="2026-11-03T23:59:30Z", end_at_utc="2026-11-04T00:01:00Z")
        result = ref.build_reference(decode(4), [past, decode(4), decode(5)], DECODE)
        self.assertEqual(result.sources, ())
        self.assertIn(("session_not_finished_before_target_day",), [e.reasons for e in result.exclusions])

    def test_decode_cannot_claim_a_research_subject(self):
        target = decode(5, origin="live_decode")
        target.context["subject"]["source_participant_id"] = "synthetic:research-person"
        result = ref.build_reference(target, [], DECODE)
        self.assertEqual(result.reason, "decode_research_subject_link")

    def test_unverified_target_stays_raw_valid_without_reference(self):
        target = attest(hr(6), conditions_compatible=None)
        series = publish(hr(6), resting_history(), HR)
        result = ref.compare(target, HR, series, as_of_utc=UTC)
        self.assertEqual(result.raw_information["status"], "valid")
        self.assertIsNone(result.raw_information["reference_eligible"])
        self.assertEqual(result.information_status["status"], "not_comparable")
        self.assertEqual(result.reason, "unverified_measurement_conditions")


    def test_conflict_attestation_excludes_unflagged_identical_copies(self):
        original = hr(1)
        flagged = attest(modify(original, measurement_id="synthetic:copy"), duplicate_state="conflict")
        result = ref.build_reference(hr(2), [original, flagged], replace(HR, minimum_days=1))
        self.assertEqual(result.sources, ())
        self.assertTrue(all(row.reasons == ("conflicting_duplicate",) for row in result.exclusions))

    def test_observed_utc_must_also_precede_target_when_available(self):
        target = hr(4, observed_at_utc="2026-11-04T10:00:00Z")
        late = hr(2, observed_at_utc="2026-11-04T11:00:00Z")
        eligible = hr(3, observed_at_utc="2026-11-03T10:00:00Z")
        result = ref.build_reference(target, [late, eligible], replace(HR, minimum_days=1))
        self.assertEqual([r.day.day for r in result.sources], [3])
        self.assertEqual(result.exclusions[0].reasons, ("measurement_utc_not_prior",))

    def test_decode_zero_accuracy_and_missing_median_are_independent(self):
        row = decode(1, None, correct_count=0, accuracy_percent=0)
        target = decode(4)
        policy = replace(DECODE, metric="accuracy_percent", minimum_days=1)
        self.assertEqual(ref.build_reference(target, [row], policy).reference_value, 0)
        self.assertEqual(ref.build_reference(target, [row], DECODE).reason, "no_eligible_history")

    def test_session_clock_adjustment_does_not_establish_reference_order(self):
        row = decode(1, end_at_utc="2026-11-01T09:59:00Z")
        row = attest(row, clock_adjustment_verified=True)
        self.assertEqual(status.evaluate("decode_session", row.record, context=row.context)["status"], "valid")
        result = ref.build_reference(decode(4), [row], DECODE)
        self.assertEqual(result.exclusions[0].reasons, ("decode_ordering_unverified",))


class LifecycleTests(unittest.TestCase):
    def test_versioning_retains_history_and_retries_are_idempotent(self):
        series = publish(hr(6), resting_history(), HR)
        candidate = ref.build_reference(hr(7), resting_history() + [hr(6, 70)], HR)
        params = dict(reference_id="synthetic:ref-2", decision=decision(2),
                      expected_reference_id="synthetic:ref-1")
        updated = series.activate(candidate, **params)
        self.assertEqual(updated.events[0], series.active)
        self.assertEqual(updated.active.reference_id, params["reference_id"])
        self.assertIs(updated.activate(candidate, **params), updated)
        for change in [{"reference_id": "synthetic:ref-1"}, {"expected_reference_id": None}]:
            with self.subTest(change=change), self.assertRaises(ValueError):
                series.activate(candidate, **{**params, **change})

    def test_invalid_activation_and_series_partition_are_rejected(self):
        series = publish(hr(6), resting_history(), HR)
        for candidate in [
            ref.build_reference(hr(7), [hr(6)], HR),
            ref.build_reference(sleep(7), [sleep(i) for i in (1, 2, 3)], SLEEP),
        ]:
            with self.subTest(candidate=candidate.reference_status), self.assertRaises(ValueError):
                series.activate(candidate, reference_id="synthetic:ref-2", decision=decision(2),
                                expected_reference_id=series.active.reference_id)

    def test_freeze_retains_baseline_and_requires_explicit_resolution(self):
        series = publish(hr(6), resting_history(), HR)
        frozen = series.decide("freeze", reference_id=series.active.reference_id, decision=decision(2))
        self.assertEqual(ref.compare(hr(7), HR, frozen, as_of_utc=UTC).reason, "frozen_reference")
        candidate = ref.build_reference(hr(7), resting_history() + [hr(6, 55)], HR)
        with self.assertRaises(ValueError):
            frozen.activate(candidate, reference_id="synthetic:ref-2", decision=decision(3),
                            expected_reference_id=series.active.reference_id)
        cleared = frozen.decide("resolve_review", reference_id=series.active.reference_id,
                                decision=decision(3))
        activated = cleared.activate(candidate, reference_id="synthetic:ref-2", decision=decision(4),
                                     expected_reference_id=series.active.reference_id)
        self.assertEqual([e.action for e in activated.events],
                         ["activate", "freeze", "resolve_review", "activate"])

    def test_review_requires_review_and_passes_insufficiency_to_task3(self):
        series = publish(hr(6), resting_history(), HR)
        review = series.decide("request_review", reference_id=series.active.reference_id,
                               decision=decision(2))
        result = ref.compare(hr(7), HR, review, as_of_utc=UTC)
        self.assertEqual(result.reference_status, "needs_review")
        self.assertIsNone(result.difference)
        self.assertIn("insufficient_reference", result.information_status["reason_codes"])
        with self.assertRaises(ValueError):
            review.decide("freeze", reference_id=series.active.reference_id, decision=decision(3))

    def test_no_future_version_or_future_source_leakage(self):
        series = publish(hr(6), resting_history(), HR)
        before = ref.compare(hr(7), HR, series, as_of_utc="2026-11-19T12:00:00Z")
        self.assertIsNone(before.reference_id)
        earlier_target = ref.compare(hr(5), HR, series, as_of_utc=UTC)
        self.assertEqual(earlier_target.reason, "reference_postdates_target")
        self.assertIsNone(earlier_target.reference_value)

    def test_comparison_cannot_reuse_a_source_id_as_the_current_reading(self):
        series = publish(hr(6), resting_history(), HR)
        target = hr(7, measurement_id="synthetic:measurement:3")
        result = ref.compare(target, HR, series, as_of_utc=UTC)
        self.assertIsNone(result.reference_value)
        self.assertIsNone(result.reference_id)
        self.assertEqual(result.reason, "reference_postdates_target")

    def test_policy_revision_requests_review(self):
        series = publish(hr(6), resting_history(), HR)
        assessment = ref.compare(hr(7), replace(HR, lookback_days=12), series, as_of_utc=UTC)
        self.assertEqual(assessment.reference_status, "needs_review")
        self.assertEqual(assessment.reason, "reference_policy_changed")

    def test_audit_preserves_inputs_exclusions_and_decision(self):
        series = publish(hr(6), resting_history() + [hr(7)], HR)
        audit = json.loads(json.dumps(ref.audit_event(series.active), allow_nan=False))
        candidate = audit["candidate"]
        self.assertEqual(candidate["sources"][0]["value"], 62)
        self.assertEqual(candidate["exclusions"][0]["reasons"], ["current_or_future_day"])
        self.assertEqual(candidate["status_ruleset_version"], status.RULESET_VERSION)
        self.assertEqual(audit["decision"]["actor_id"], "synthetic:reviewer")


    def test_restart_replays_durable_audit_log_and_retains_freeze(self):
        series = publish(hr(6), resting_history(), HR)
        frozen = series.decide("freeze", reference_id=series.active.reference_id, decision=decision(2))
        snapshots = json.loads(json.dumps([ref.audit_event(event) for event in frozen.events]))
        restored = ref.restore_series(snapshots)
        self.assertEqual(restored, frozen)
        self.assertEqual(ref.compare(hr(7), HR, restored, as_of_utc=UTC).reason, "frozen_reference")

    def test_comparing_to_another_partition_exposes_no_reference_details(self):
        series = publish(hr(6), resting_history(), HR)
        result = ref.compare(hr(7, subject_id="synthetic:peer"), HR, series, as_of_utc=UTC)
        self.assertIsNone(result.reference_id)
        self.assertIsNone(result.reference_value)
        self.assertEqual(result.assessment_context["comparison"], {
            "same_subject_partition": False, "reference_sufficient": False,
        })


class Task3IntegrationTests(unittest.TestCase):
    def test_real_task3_comparison_and_persistence_api(self):
        target = hr(7, 67)
        series = publish(hr(6), resting_history(), HR)
        result = ref.compare(target, HR, series, as_of_utc=UTC)
        self.assertEqual(result.raw_information, status.evaluate("measurement", target.record,
                                                                 context=target.context))
        self.assertIsNone(result.raw_information["reference_eligible"])
        self.assertIs(result.information_status["reference_eligible"], True)
        self.assertEqual(result.difference, 4)
        stored = status.information_status(
            "measurement", target.record, context=result.assessment_context,
            information_status_id="synthetic:assessment", created_at_utc=UTC, schema_version="0.9",
        )
        self.assertEqual(stored["status"], "valid")
        self.assertNotIn("followup_status", stored)

    def test_sleep_task3_gate_uses_the_selected_field(self):
        series = publish(sleep(4), [sleep(i) for i in (1, 2, 3)], SLEEP)
        target = sleep(5, None)
        result = ref.compare(target, SLEEP, series, as_of_utc=UTC)
        self.assertEqual(result.raw_information["status"], "valid")
        self.assertEqual(result.information_status["status"], "no_reading")
        self.assertIn("missing_sleep_target_value", result.information_status["reason_codes"])

    def test_task2_personal_reference_projection_has_contract_fields(self):
        # Checked against the attached core fields CSV in the separate release validation.
        series = publish(hr(6), resting_history(), HR)
        row = ref.task2_record(series.active, schema_version="0.9")
        required = {
            "personal_reference_id", "schema_version", "subject_id", "data_origin",
            "is_simulated", "created_at_utc", "metric_code", "reference_version",
            "reference_status", "method", "start_date", "end_date", "source_record_ids",
            "valid_record_count", "unit",
        }
        self.assertTrue(required <= row.keys())
        self.assertEqual(row["start_date"], "2026-11-01")
        self.assertEqual(row["end_date"], "2026-11-05")
        self.assertEqual(row["valid_record_count"], len(row["source_record_ids"]))
        self.assertTrue(row["is_simulated"])
        self.assertEqual(row["data_origin"], "application_generated")
        self.assertEqual(row["reference_status"], "usable_for_question")

    def test_s1_performance_change_does_not_replace_frozen_references(self):
        case = CASES["S1"]
        t, sleep_value, rt = case["baseline_target"]
        s = publish(sleep(t, sleep_value), [sleep(*row) for row in case["baseline_sleep"]], SLEEP)
        d = publish(decode(t, rt), [decode(*row) for row in case["baseline_decode_rt"]], DECODE)
        s = s.decide("freeze", reference_id=s.active.reference_id, decision=decision(2))
        d = d.decide("freeze", reference_id=d.active.reference_id, decision=decision(2))
        independent_followup = {"followup_status": case["external_followup_status"]}
        for day, minutes, latency in case["sustained_change"]:
            sleep_result = ref.compare(sleep(day, minutes), SLEEP, s, as_of_utc=UTC)
            decode_result = ref.compare(decode(day, latency), DECODE, d, as_of_utc=UTC)
            self.assertEqual(sleep_result.reference_value, case["expected_sleep_reference"])
            self.assertEqual(decode_result.reference_value, case["expected_decode_reference"])
            self.assertLess(sleep_result.difference, 0)
            self.assertGreater(decode_result.difference, 0)
            self.assertEqual(decode_result.information_status["status"], "valid")
            self.assertNotIn("followup_status", decode_result.information_status)
        self.assertEqual((len(s.events), len(d.events)), (2, 2))
        self.assertEqual(independent_followup["followup_status"], "watching")

    def test_s2_missing_and_interrupted_do_not_create_values_or_close_followup(self):
        case = CASES["S2"]
        s = publish(sleep(4), [sleep(i) for i in (1, 2, 3)], SLEEP)
        d = publish(decode(4), [decode(i) for i in (1, 2, 3)], DECODE)
        independent_followup = {"followup_status": case["external_followup_status"]}
        for target, policy, series, expected in [
            (sleep(case["day"], case["sleep_value"]), SLEEP, s, "no_reading"),
            (ref.Observation(None, {}), SLEEP, s, "no_reading"),
            (decode(case["day"], session_state=case["decode_state"]), DECODE, d, "not_comparable"),
        ]:
            with self.subTest(expected=expected):
                result = ref.compare(target, policy, series, as_of_utc=UTC)
                self.assertEqual(result.information_status["status"], expected)
                self.assertIsNone(result.observed_value)
                self.assertIsNone(result.difference)
                self.assertNotIn("followup_status", result.information_status)
        self.assertEqual(independent_followup["followup_status"], "action_open")


if __name__ == "__main__":
    unittest.main()

