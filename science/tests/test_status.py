"""Synthetic acceptance cases. Run with python -B -m unittest discover -s tests -v."""
import copy
import json
from pathlib import Path
import unittest

from science.status import evaluate, information_status

SAMPLES = json.loads((Path(__file__).parent / "fixtures/status_cases.json").read_text(encoding="utf-8"))
SIM = {"subject": {"subject_profile_id": "sim:1", "subject_mode": "mission_simulation"}}
RESEARCH = {
    "subject": {"subject_profile_id": "research:1", "subject_mode": "real_research",
                "source_participant_id": "SYNTHETIC"},
    "source_link_verified": True,
}
LIVE = {
    "subject": {"subject_profile_id": "player:1", "subject_mode": "live_player"},
    "events_verified": True,
}
CLOCK_VERIFIED = dict(LIVE, clock_adjustment_verified=True)
COMPATIBLE = dict.fromkeys((
    "same_subject_partition", "same_metric_unit", "same_resolution", "same_device_method",
    "compatible_protocol", "compatible_conditions", "reference_sufficient",
), True)
BASE = SAMPLES["measurement"]
SLEEP = SAMPLES["sleep"]
DECODE = SAMPLES["decode"]
HOURLY = SAMPLES["research"]
# ID, kind, full input (including fixture overrides), context, status, reasons, optional flags.
M, S, D = "measurement", "sleep_record", "decode_session"
V, N, I, X = "valid", "no_reading", "incomplete", "not_comparable"
CASES = [
    ("T01", M, BASE, SIM, V, [], {"reference_eligible": None, "method_consistent": None}),
    ("T02", M, None, SIM, N, ["missing_record"]),
    ("T03", M, dict(BASE, value=None), SIM, N, ["missing_value"]),
    ("T04", M, dict(BASE, value=None, capture_method=None), SIM, N, ["missing_value", "unknown_source"]),
    ("T05", M, dict(BASE, metric_code="steps_daily", unit="count", value=0), SIM, V, []),
    ("T06", M, dict(BASE, unit="unknown"), SIM, I, ["unknown_unit"]),
    ("T07", M, {k: v for k, v in BASE.items() if k != "unit"}, SIM, I, ["unknown_unit"]),
    ("T08", M, dict(BASE, capture_method=""), SIM, I, ["unknown_source"]),
    ("T09", M, dict(BASE, observed_at_utc="2026-12-32T00:00:00Z"), SIM, I, ["unknown_measurement_time"]),
    ("T10", M, HOURLY, RESEARCH, V, [], {"measurement_time_known": True}),
    ("T11", M, dict(HOURLY, observation_date=None), RESEARCH, I, ["unknown_measurement_time"]),
    ("T12", M, dict(HOURLY, observed_at_utc=BASE["created_at_utc"]), RESEARCH, I, ["unknown_measurement_time"]),
    ("T13", M, HOURLY, dict(RESEARCH, subject=dict(RESEARCH["subject"], subject_mode="mission_simulation")),
     I, ["subject_source_mismatch"]),
    ("T14", M, HOURLY, dict(RESEARCH, source_link_verified=False), I, ["subject_source_mismatch"]),
    ("T15", M, dict(HOURLY, is_simulated=True), RESEARCH, I, ["invalid_provenance"]),
    ("T16", M, dict(HOURLY, source_field="resting_hr"), RESEARCH, I, ["source_metric_mismatch", "unknown_unit"]),
    ("T17", M, HOURLY, dict(RESEARCH, duplicate_state="exact"), V, ["duplicate_observation"],
     {"reference_eligible": False}),
    ("T18", M, HOURLY, dict(RESEARCH, duplicate_state="conflict"), I, ["conflicting_duplicate"]),
    ("T19", M, [], SIM, I, ["invalid_record_type"]),
    ("T20", M, dict(BASE, value=False), SIM, I, ["invalid_value"]),
    ("T21", M, dict(BASE, metric_code="steps_daily", unit="count", value=-1), SIM, I, ["invalid_value"]),
    ("T22", M, dict(BASE, metric_code="temperature", unit="C"), SIM, I, ["unknown_metric", "unknown_unit"]),
    ("T23", M, BASE, dict(SIM, require_measurement_context=True), I, ["missing_measurement_context"]),
    ("T24", M, BASE, dict(SIM, conditions_compatible=False), X, ["wrong_conditions"]),
    ("T25", M, dict(BASE, unit=None), dict(SIM, conditions_compatible=False), I, ["unknown_unit", "wrong_conditions"]),
    ("T26", M, HOURLY, dict(RESEARCH, comparison=dict(COMPATIBLE, same_resolution=False)),
     X, ["temporal_resolution_mismatch"]),
    ("T27", M, BASE, dict(SIM, comparison=dict(COMPATIBLE, same_device_method=False)),
     X, ["device_method_mismatch"], {"method_consistent": False}),
    ("T28", M, BASE, dict(SIM, comparison={}), X, ["missing_comparison_context"]),
    ("T29", M, BASE, dict(SIM, comparison=dict(COMPATIBLE, reference_sufficient=False)), X, ["insufficient_reference"]),
    ("T30", M, BASE, dict(SIM, comparison=COMPATIBLE), V, [], {"reference_eligible": True, "method_consistent": True}),
    ("T31", S, SLEEP, SIM, V, []),
    ("T32", S, dict(SLEEP, recorded_interval_ms=None, minutes_asleep=None, recorded_interval_hours=8),
     SIM, N, ["missing_value"]),
    ("T33", D, DECODE, LIVE, V, []),
    ("T34", D, dict(DECODE, session_state="interrupted", end_at_utc=None), LIVE, X, ["session_interrupted"]),
    ("T35", D, DECODE, dict(LIVE, events_verified=False), I, ["unverified_decode_events"]),
    ("T36", D, DECODE, dict(LIVE, comparison=dict(COMPATIBLE, compatible_protocol=False)), X, ["protocol_mismatch"]),
    ("T37", D, dict(DECODE, is_practice=True), LIVE, V, [], {"reference_eligible": False}),
    ("T38", D, dict(DECODE, end_at_utc=None), LIVE, I, ["unknown_measurement_time"]),
    ("T39", M, dict(BASE, value=float("nan")), SIM, I, ["invalid_value"]),
    ("T40", M, dict(BASE, value=float("inf")), SIM, I, ["invalid_value"]),
    ("T41", S, dict(SLEEP, minutes_asleep=None, sleep_metric_method="simulator"),
     dict(SIM, comparison=dict(COMPATIBLE, sleep_field="minutes_asleep")),
     N, ["missing_sleep_target_value"], {"unit_verified": False, "reference_eligible": False}),
    ("T42", S, dict(SLEEP, minutes_asleep=None, sleep_metric_method="simulator"),
     dict(SIM, comparison=dict(COMPATIBLE, sleep_field="recorded_interval_ms")),
     V, [], {"unit_verified": True, "reference_eligible": True}),
    ("T43", S, dict(SLEEP, sleep_metric_method="simulator"),
     dict(SIM, comparison=dict(COMPATIBLE, sleep_field="minutes_asleep")),
     V, [], {"unit_verified": True, "reference_eligible": True}),
    ("T44", S, SLEEP, dict(SIM, comparison=COMPATIBLE),
     X, ["missing_sleep_comparison_target"], {"reference_eligible": False}),
    ("T45", S, SLEEP, dict(SIM, comparison=dict(COMPATIBLE, sleep_field="recorded_interval_hours")),
     X, ["missing_sleep_comparison_target"]),
    ("T46", S, SLEEP, dict(SIM, comparison=dict(COMPATIBLE, sleep_field="minutes_asleep")),
     X, ["unknown_sleep_method"]),
    ("T47", S, dict(SLEEP, minutes_asleep=False), SIM, I, ["invalid_value"], {"unit_verified": False}),
    ("T48", S, dict(SLEEP, minutes_asleep=-1, sleep_metric_method="simulator"),
     dict(SIM, comparison=dict(COMPATIBLE, sleep_field="minutes_asleep")),
     I, ["invalid_value"], {"unit_verified": False, "reference_eligible": False}),
    ("T49", S, dict(SLEEP, sleep_metric_method="simulator"),
     dict(SIM, comparison=dict(COMPATIBLE, sleep_field="minutes_asleep", same_metric_unit=False)),
     X, ["comparison_metric_mismatch"], {"reference_eligible": False}),
    ("T50", D, dict(DECODE, elapsed_monotonic_ms=9000000), LIVE, X, ["protocol_duration_mismatch"]),
    ("T51", D, dict(DECODE, elapsed_monotonic_ms=90001), LIVE, X, ["protocol_duration_mismatch"]),
    ("T52", D, dict(DECODE, elapsed_monotonic_ms=89999), LIVE, X, ["protocol_duration_mismatch"]),
    ("T53", D, dict(DECODE, planned_duration_ms=120000, elapsed_monotonic_ms=120000), LIVE,
     X, ["protocol_duration_mismatch"]),
    ("T54", D, dict(DECODE, accepted_responses=2, correct_count=1), LIVE,
     I, ["incomplete_decode_summary"], {"unit_verified": False}),
    ("T55", D, dict(DECODE, accepted_responses=2, correct_count=1, accuracy_percent=70, median_correct_rt_ms=810),
     LIVE, I, ["invalid_decode_summary"], {"unit_verified": False}),
    ("T56", D, dict(DECODE, accepted_responses=0, correct_count=0, accuracy_percent=None, median_correct_rt_ms=None),
     LIVE, V, [], {"unit_verified": True}),
    ("T57", D, dict(DECODE, accepted_responses=0, correct_count=0, accuracy_percent=0), LIVE,
     I, ["invalid_decode_summary"]),
    ("T58", D, dict(DECODE, accepted_responses=2, correct_count=1, accuracy_percent=50, median_correct_rt_ms=810),
     dict(LIVE, events_verified=None), I, ["unverified_decode_events"], {"unit_verified": False}),
    ("T59", D, dict(DECODE, interruption_reasons=["focus_loss"]), LIVE, X, ["session_interrupted"]),
    ("T60", D, dict(DECODE, interruption_reasons="focus_loss"), LIVE, I, ["invalid_interruption_reasons"]),
    ("T61", M, dict(BASE, metric_code="nightly_skin_temperature", unit="°C"), SIM,
     I, ["unsupported_metric", "unknown_unit"], {"unit_verified": False}),
    ("T62", M, dict(BASE, metric_code="activity_minutes", unit="minutes"), SIM,
     I, ["unsupported_metric", "unknown_unit"], {"unit_verified": False}),
    ("T63", M, dict(BASE, metric_code="skin_temperature_variation", unit="UNVERIFIED"), SIM,
     I, ["unsupported_metric", "unknown_unit"], {"unit_verified": False}),
    ("T64", M, dict(BASE, metric_code="sleep_minutes_asleep", unit="minutes"), SIM,
     I, ["unknown_metric", "unknown_unit"], {"unit_verified": False}),
    ("T65", M, dict(BASE, subject_id="player:1", data_origin="live_decode", is_simulated=False),
     LIVE, I, ["invalid_provenance", "unknown_source"]),
    ("T66", M, dict(BASE, source_metric_granularity="event", observation_date=None,
                    observed_at_utc=BASE["created_at_utc"]), SIM,
     I, ["unknown_measurement_time", "temporal_resolution_mismatch"]),
    ("T67", S, dict(SLEEP, recorded_interval_ms=3600000, minutes_asleep=500,
                    sleep_metric_method="simulator"),
     dict(SIM, comparison=dict(COMPATIBLE, sleep_field="minutes_asleep")),
     I, ["sleep_asleep_exceeds_interval"], {"reference_eligible": False}),
    ("T68", S, dict(SLEEP, recorded_interval_ms=60000, minutes_asleep=60,
                    sleep_metric_method="simulator"),
     dict(SIM, comparison=dict(COMPATIBLE, sleep_field="recorded_interval_ms")),
     I, ["sleep_asleep_exceeds_interval"], {"reference_eligible": False}),
    ("T69", S, dict(SLEEP, recorded_interval_ms=6000, minutes_asleep=0.1), SIM, V, []),
    ("T70", S, dict(SLEEP, recorded_interval_ms=5999, minutes_asleep=0.1), SIM,
     I, ["sleep_asleep_exceeds_interval"]),
    ("T71", S, dict(SLEEP, recorded_interval_ms=None, minutes_asleep=10,
                    sleep_metric_method="simulator"),
     dict(SIM, comparison=dict(COMPATIBLE, sleep_field="minutes_asleep")),
     V, [], {"reference_eligible": True}),
    ("T72", S, dict(SLEEP, recorded_interval_ms=False, sleep_metric_method="simulator"),
     dict(SIM, comparison=dict(COMPATIBLE, sleep_field="minutes_asleep")),
     I, ["invalid_value"], {"reference_eligible": False}),
    ("T73", S, dict(SLEEP, recorded_interval_ms=0, minutes_asleep=0), SIM, V, []),
    ("T74", D, dict(DECODE, end_at_utc="2026-11-14T14:00:00Z"), LIVE,
     I, ["unverified_decode_clock_disagreement"], {"reference_eligible": False}),
    ("T75", D, dict(DECODE, end_at_utc="2026-11-14T14:00:00Z"), CLOCK_VERIFIED, V, []),
    ("T76", D, dict(DECODE, end_at_utc="2026-11-14T08:59:00Z"), LIVE,
     I, ["unknown_measurement_time", "unverified_decode_clock_disagreement"],
     {"measurement_time_known": False}),
    ("T77", D, dict(DECODE, end_at_utc="2026-11-14T08:59:00Z"), CLOCK_VERIFIED, V, [],
     {"measurement_time_known": True}),
    ("T78", D, dict(DECODE, end_at_utc="2026-11-14T14:00:00Z"),
     dict(CLOCK_VERIFIED, events_verified=False),
     I, ["unverified_decode_events", "unverified_decode_clock_disagreement"]),
    ("T79", D, dict(DECODE, end_at_utc="2026-11-14T14:00:00Z", interruption_reasons=["focus_loss"]),
     CLOCK_VERIFIED, X, ["session_interrupted"]),
    ("T80", D, dict(DECODE, session_state="interrupted", interruption_reasons=["device_suspension"],
                    end_at_utc="2026-11-14T14:00:00Z"), LIVE, X, ["session_interrupted"]),
    ("T81", D, dict(DECODE, end_at_utc="2026-11-14T14:00:00Z", elapsed_monotonic_ms=90001),
     CLOCK_VERIFIED, X, ["protocol_duration_mismatch"]),
    ("T82", D, dict(DECODE, end_at_utc="2026-11-14T09:01:30.001Z"), LIVE,
     I, ["unverified_decode_clock_disagreement"]),
    ("T83", D, dict(DECODE, end_at_utc="2026-11-14T14:00:00Z", interruption_reasons=["pause"]),
     CLOCK_VERIFIED, X, ["session_interrupted"]),
]

ENVELOPE = {"information_status_id": "q:1", "schema_version": "0.9",
            "created_at_utc": "2026-11-14T10:00:00Z"}


class StatusTests(unittest.TestCase):
    def test_P01_persistence_contract(self):
        result = information_status(M, BASE, context=SIM, **ENVELOPE)
        self.assertEqual(result.keys(), {
            "information_status_id", "schema_version", "subject_id", "data_origin",
            "is_simulated", "created_at_utc", "record_ref", "status", "reason_codes",
            "source_known", "unit_verified", "measurement_time_known", "method_consistent",
            "reference_eligible", "ruleset_version",
        })
        self.assertEqual(result["status"], "valid")
        self.assertEqual(result["reason_codes"], [])
        self.assertEqual(result["data_origin"], "application_generated")
        self.assertIs(result["is_simulated"], True)
        self.assertEqual(result["record_ref"], "m1")
        self.assertEqual(result["subject_id"], "sim:1")

    def test_P02_no_record_has_no_persistable_link(self):
        with self.assertRaises(ValueError):
            information_status(M, None, context=SIM, **ENVELOPE)

    def test_P03_wrong_partition_cannot_be_persisted(self):
        with self.assertRaises(ValueError):
            information_status(M, HOURLY, context=SIM, **ENVELOPE)

    def test_P04_existing_measurement_with_null_value_can_be_persisted(self):
        record = dict(BASE, value=None)
        result = information_status(M, record, context=SIM, **ENVELOPE)
        self.assertEqual(result["status"], "no_reading")
        self.assertEqual(result["reason_codes"], ["missing_value"])
        self.assertEqual(result["record_ref"], record["measurement_id"])
        self.assertIsNone(record["value"])

    def test_P05_bare_planned_id_cannot_be_persisted_as_a_measurement(self):
        stub = {"measurement_id": "plan:slot", "subject_id": BASE["subject_id"],
                "data_origin": BASE["data_origin"], "is_simulated": True}
        with self.assertRaisesRegex(ValueError, "existing contract record"):
            information_status(M, stub, context=SIM, **ENVELOPE)


def case_test(kind, record, context, status, reasons, flags=None):
    def test(self):
        payload = copy.deepcopy(record)
        actual = evaluate(kind, payload, context=context)
        expected = {"status": status, "reason_codes": reasons, **(flags or {})}
        self.assertEqual({key: actual[key] for key in expected}, expected)
        if not (isinstance(record, dict) and str(record.get("value")) == "nan"):
            self.assertEqual(payload, record)
        self.assertEqual(evaluate(kind, payload, context=context), actual)
    return test


for test_id, *args in CASES:
    setattr(StatusTests, "test_" + test_id, case_test(*args))

