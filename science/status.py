"""Standalone information quality checks for the proposed Task 2 records."""

import math
import re
from collections.abc import Mapping
from datetime import date, datetime, timedelta
from fractions import Fraction

RULESET_VERSION = "status-0.3.0"
DECODE_WINDOW_MS = 90_000
KINDS = ("measurement", "sleep_record", "decode_session")
MODES = {
    "real_research": "real_research",
    "simulated_mission": "mission_simulation",
    "live_decode": "live_player",
    "application_generated": "live_player",
}
# Unit, temporal resolution, and raw LifeSnaps column.
METRICS = {
    "hr_daily_bpm": ("bpm", "daily", "bpm"),
    "hr_hourly_bpm": ("bpm", "hourly", "bpm"),
    "hr_resting_bpm": ("bpm", "daily", "resting_hr"),
    "steps_daily": ("count", "daily", "steps"),
    "steps_hourly": ("count", "hourly", "steps"),
}
UNSUPPORTED_METRICS = ("activity_minutes", "nightly_skin_temperature", "skin_temperature_variation")
SLEEP_UNITS = {
    "recorded_interval_ms": "ms",
    "minutes_asleep": "minutes",
    "minutes_awake": "minutes",
    "minutes_to_fall_asleep": "minutes",
    "minutes_after_wakeup": "minutes",
    "sleep_efficiency_source": "Fitbit score",
}


def _text(value):
    return isinstance(value, str) and bool(value.strip())


def _number(value):
    return type(value) is int or (type(value) is float and math.isfinite(value))


def _utc(value):
    if not isinstance(value, str) or not re.fullmatch(
        r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}"
        r"(?:\.[0-9]+)?(?:Z|\+00:00)", value
    ):
        return None
    try:
        instant = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return instant if instant.utcoffset() == timedelta(0) else None
    except ValueError:
        return None


def _date(value):
    if isinstance(value, str) and re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value):
        try:
            return date.fromisoformat(value)
        except ValueError:
            pass
    return None


def _decode_clock_adjustment_verified(record, context):
    return (
        record.get("session_state") == "completed"
        and context.get("events_verified") is True
        and context.get("clock_adjustment_verified") is True
    )


def _observed_time(record, kind, context):
    if kind == "decode_session":
        start = _utc(record.get("start_at_utc"))
        end = _utc(record.get("end_at_utc"))
        if record.get("session_state") == "completed" or record.get("end_at_utc") is not None:
            return start is not None and end is not None and (
                start <= end or _decode_clock_adjustment_verified(record, context)
            )
        return start is not None

    if kind == "sleep_record":
        return _date(record.get("observation_date")) is not None

    resolution = record.get("source_metric_granularity")
    instant = record.get("observed_at_utc")
    research = record.get("data_origin") == "real_research"
    if instant is not None and (research or _utc(instant) is None):
        return False
    if not _date(record.get("observation_date")):
        return False
    if resolution == "event":
        return instant is not None
    if resolution not in ("daily", "hourly"):
        return False
    if resolution == "hourly":
        hour = record.get("hour_local")
        return type(hour) is int and 0 <= hour <= 23
    return True


def _source_known(record, kind):
    origin = record.get("data_origin")
    if kind == "decode_session":
        return origin in ("live_decode", "simulated_mission") and _text(record.get("app_version"))
    if origin == "real_research":
        if kind == "sleep_record":
            return _text(record.get("source_file"))
        return all(_text(record.get(key)) for key in ("source_file", "source_field", "capture_method"))
    if kind == "sleep_record":
        return origin == "simulated_mission" or (
            origin == "application_generated" and _text(record.get("sleep_metric_method"))
        )
    return origin in ("simulated_mission", "application_generated") and _text(record.get("capture_method"))


def _measurement(record, issues, mismatch):
    metric = record.get("metric_code")
    spec = METRICS.get(metric) if isinstance(metric, str) else None
    if spec is None:
        issues.append("unsupported_metric" if metric in UNSUPPORTED_METRICS else "unknown_metric")
        return False
    unit, resolution, raw_column = spec
    research = record.get("data_origin") == "real_research"
    actual_resolution = record.get("source_metric_granularity")
    if actual_resolution in ("daily", "hourly", "event"):
        if actual_resolution != resolution:
            mismatch.append("temporal_resolution_mismatch")
    else:
        issues.append("unknown_granularity")
    source_field = record.get("source_field")
    if research and _text(source_field) and source_field != raw_column:
        issues.append("source_metric_mismatch")
        return False
    return record.get("unit") == unit


def _decode(record, context, issues, mismatch):
    state = record.get("session_state")
    interruptions = record.get("interruption_reasons")
    if interruptions is not None and (
        not isinstance(interruptions, list) or any(not _text(reason) for reason in interruptions)
    ):
        issues.append("invalid_interruption_reasons")
    elif state in ("interrupted", "aborted") or interruptions:
        mismatch.append("session_interrupted")
    elif state != "completed":
        issues.append("session_unfinished")
    if (any(not _text(record.get(key)) for key in ("protocol_version", "key_version", "app_version"))
            or record.get("input_method") not in ("keyboard", "touch", "other")
            or type(record.get("is_practice")) is not bool
            or type(record.get("planned_duration_ms")) is not int):
        issues.append("missing_decode_metadata")
    elif record["planned_duration_ms"] != DECODE_WINDOW_MS:
        mismatch.append("protocol_duration_mismatch")

    elapsed = record.get("elapsed_monotonic_ms")
    if state == "completed" and elapsed is None:
        issues.append("missing_decode_timing")
    elif elapsed is not None and (not _number(elapsed) or elapsed < 0):
        issues.append("invalid_value")
    elif state == "completed" and elapsed != DECODE_WINDOW_MS:
        mismatch.append("protocol_duration_mismatch")
    if state == "completed":
        if context.get("events_verified") is not True:
            issues.append("unverified_decode_events")
        start = _utc(record.get("start_at_utc"))
        end = _utc(record.get("end_at_utc"))
        if (
            start is not None and end is not None and elapsed == DECODE_WINDOW_MS
            and end - start != timedelta(milliseconds=DECODE_WINDOW_MS)
            and not _decode_clock_adjustment_verified(record, context)
        ):
            issues.append("unverified_decode_clock_disagreement")
        _decode_summaries(record, issues)


def _sleep_consistency(record, issues):
    interval = record.get("recorded_interval_ms")
    asleep = record.get("minutes_asleep")
    pair = (interval, asleep)
    if any(value is not None and (not _number(value) or value < 0) for value in pair):
        if "invalid_value" not in issues:
            issues.append("invalid_value")
    elif all(value is not None for value in pair):
        # Use the recorded decimal values without a rounding allowance.
        interval, asleep = (Fraction(str(value)) if type(value) is float else value for value in pair)
        if asleep * 60_000 > interval:
            issues.append("sleep_asleep_exceeds_interval")


def _decode_summaries(record, issues):
    accepted = record.get("accepted_responses")
    correct = record.get("correct_count")
    accuracy = record.get("accuracy_percent")
    median = record.get("median_correct_rt_ms")
    if all(value is None for value in (accepted, correct, accuracy, median)):
        return  # Task 2 permits a session without stored summaries.
    if any(value is not None and (type(value) is not int or value < 0)
           for value in (accepted, correct)):
        issues.append("invalid_decode_summary")
        return
    if accepted is None or correct is None or (accepted > 0 and accuracy is None) or (
        correct > 0 and median is None
    ):
        issues.append("incomplete_decode_summary")
        return
    if (
        correct > accepted
        or (accepted == 0 and accuracy is not None)
        or (accepted > 0 and (
            not _number(accuracy) or not 0 <= accuracy <= 100
            or accuracy != (100 * correct) / accepted
        ))
        or (correct == 0 and median is not None)
        or (correct > 0 and (not _number(median) or median < 0))
    ):
        issues.append("invalid_decode_summary")


def _comparison(context, mismatch):
    checks = context.get("comparison")
    if checks is None:
        return None
    if not isinstance(checks, Mapping):
        mismatch.append("missing_comparison_context")
        return None
    fields = (
        ("same_subject_partition", "comparison_subject_mismatch"),
        ("same_metric_unit", "comparison_metric_mismatch"),
        ("same_resolution", "temporal_resolution_mismatch"),
        ("same_device_method", "device_method_mismatch"),
        ("compatible_protocol", "protocol_mismatch"),
        ("compatible_conditions", "wrong_conditions"),
        ("reference_sufficient", "insufficient_reference"),
    )
    for key, code in fields:
        if checks.get(key) is False:
            mismatch.append(code)
        elif checks.get(key) is not True:
            mismatch.append("missing_comparison_context")

    method_checks = [checks.get(key) for key in ("same_device_method", "compatible_protocol")]
    if any(value is False for value in method_checks):
        return False
    return True if all(value is True for value in method_checks) else None


def evaluate(kind, record, *, context=None):
    """Return the evaluation fields of Task 2 information_status.

    Context carries trusted adapter checks. Pass None as record for an expected
    reading with no source record. Inputs are read only.
    """
    if kind not in KINDS:
        raise ValueError("Unsupported record kind")
    if context is None:
        context = {}
    if not isinstance(context, Mapping):
        raise TypeError("context must be a mapping")

    missing, issues, mismatch, notes = [], [], [], []
    source = unit = observed_time = False
    method = None
    if record is None:
        missing.append("missing_record")
        record = {}
    elif not isinstance(record, Mapping):
        issues.append("invalid_record_type")
        record = {}
    else:
        comparison = context.get("comparison")
        sleep_target = None
        if kind == "sleep_record" and comparison is not None:
            if isinstance(comparison, Mapping):
                field = comparison.get("sleep_field")
                if isinstance(field, str) and field in SLEEP_UNITS:
                    sleep_target = field
            if sleep_target is None:
                mismatch.append("missing_sleep_comparison_target")
            elif not _text(record.get("sleep_metric_method")):
                mismatch.append("unknown_sleep_method")
        values = (
            () if kind == "decode_session" else
            (record.get(sleep_target),) if sleep_target else
            tuple(record.get(key) for key in SLEEP_UNITS) if kind == "sleep_record" else
            (record.get("value"),)
        )
        if values and all(value is None for value in values):
            missing.append("missing_sleep_target_value" if sleep_target else "missing_value")
        invalid_value = any(value is not None and (not _number(value) or value < 0) for value in values)
        if invalid_value:
            issues.append("invalid_value")

        origin = record.get("data_origin")
        expected_mode = MODES.get(origin) if isinstance(origin, str) else None
        simulated = record.get("is_simulated")
        if expected_mode is None or simulated is not (origin == "simulated_mission"):
            issues.append("invalid_provenance")
        if (kind == "decode_session" and origin not in ("live_decode", "simulated_mission")) or (
            kind != "decode_session" and origin == "live_decode"
        ):
            issues.append("invalid_provenance")
        subject = context.get("subject")
        if not isinstance(subject, Mapping):
            issues.append("unverified_subject")
        elif (not _text(record.get("subject_id"))
                or subject.get("subject_profile_id") != record.get("subject_id")
                or subject.get("subject_mode") != expected_mode
                or (origin == "real_research" and not _text(subject.get("source_participant_id")))
                or (origin == "real_research" and context.get("source_link_verified") is not True)):
            issues.append("subject_source_mismatch")
        if (any(not _text(record.get(key)) for key in (kind + "_id", "schema_version"))
                or _utc(record.get("created_at_utc")) is None):
            issues.append("invalid_record_metadata")
        source = _source_known(record, kind)
        if not source:
            issues.append("unknown_source")
        observed_time = _observed_time(record, kind, context)
        if not observed_time:
            issues.append("unknown_measurement_time")

        if kind == "measurement":
            unit = _measurement(record, issues, mismatch)
            context_field = "measurement_context"
        elif kind == "sleep_record":
            _sleep_consistency(record, issues)
            unit = not missing and not invalid_value
            context_field = "sleep_metric_method"
        else:
            context_field = "technical_context"
            _decode(record, context, issues, mismatch)
            unit = record.get("session_state") == "completed" and not any(
                code in issues for code in (
                    "invalid_value", "invalid_decode_summary", "incomplete_decode_summary",
                    "missing_decode_timing", "unverified_decode_events",
                )
            )

        if kind == "measurement" and not unit and not missing:
            issues.append("unknown_unit")
        if context.get("require_measurement_context") is True and not _text(record.get(context_field)):
            issues.append("missing_measurement_context")
        if context.get("conditions_compatible") is False:
            mismatch.append("wrong_conditions")
        duplicate = context.get("duplicate_state", "none")
        if duplicate == "exact":
            notes.append("duplicate_observation")
        elif duplicate == "conflict":
            issues.append("conflicting_duplicate")
        elif duplicate != "none":
            issues.append("unknown_duplicate_state")
        method = _comparison(context, mismatch)

    if missing:
        status = "no_reading"
    elif issues:
        status = "incomplete"
    elif mismatch:
        status = "not_comparable"
    else:
        status = "valid"

    if status != "valid" or notes or (kind == "decode_session" and record.get("is_practice") is True):
        eligible = False
    elif context.get("comparison") is not None:
        eligible = True
    else:
        eligible = None
    return {
        "subject_id": record.get("subject_id") if _text(record.get("subject_id")) else None,
        "record_ref": record.get(kind + "_id") if _text(record.get(kind + "_id")) else None,
        "status": status,
        "reason_codes": list(dict.fromkeys(missing + issues + mismatch + notes)),
        "source_known": source,
        "unit_verified": unit,
        "measurement_time_known": observed_time,
        "method_consistent": method,
        "reference_eligible": eligible,
        "ruleset_version": RULESET_VERSION,
    }


def information_status(kind, record, *, information_status_id, created_at_utc,
                       schema_version, context=None):
    """Attach caller-owned persistence metadata to an evaluation."""
    if not _text(information_status_id) or not _text(schema_version) or _utc(created_at_utc) is None:
        raise ValueError("Output ID, schema version and UTC creation time are required")
    result = evaluate(kind, record, context=context)
    subject = context.get("subject") if context else None
    expected_mode = MODES.get(record.get("data_origin")) if (
        isinstance(record, Mapping) and isinstance(record.get("data_origin"), str)
    ) else None
    if (not result["record_ref"] or not result["subject_id"] or expected_mode is None
            or not isinstance(subject, Mapping)
            or subject.get("subject_profile_id") != result["subject_id"]
            or subject.get("subject_mode") != expected_mode
            or record.get("is_simulated") is not (expected_mode == "mission_simulation")
            or "subject_source_mismatch" in result["reason_codes"]
            or "invalid_provenance" in result["reason_codes"]):
        raise ValueError("A record link and a verified subject partition are required for persistence")
    if result["status"] == "no_reading" and "invalid_record_metadata" in result["reason_codes"]:
        raise ValueError("A missing-value target must be an existing contract record")
    return {
        **result,
        "information_status_id": information_status_id,
        "schema_version": schema_version,
        "data_origin": "application_generated",
        "is_simulated": record["is_simulated"],
        "created_at_utc": created_at_utc,
    }

