"""Descriptive personal references for Task 2 records using Task 3 quality checks."""

from collections import defaultdict
from collections.abc import Mapping
from dataclasses import asdict, dataclass, replace
from datetime import date
from fractions import Fraction
from math import isfinite
from statistics import median

from . import status

ENGINE_VERSION = "reference-1.0.1"
SLEEP_METRICS = {field: status.SLEEP_UNITS[field] for field in (
    "minutes_asleep", "recorded_interval_ms", "minutes_awake",
    "minutes_to_fall_asleep", "minutes_after_wakeup",
)}
DECODE_METRICS = {
    "accepted_responses": "count",
    "correct_count": "count",
    "accuracy_percent": "%",
    "median_correct_rt_ms": "ms",
}
TIME_BASES = {
    "real_research": "research_local_unknown_offset",
    "simulated_mission": "mission_defined",
    "application_generated": "UTC",
    "live_decode": "UTC",
}
COMPATIBILITY_CHECKS = (
    "same_subject_partition", "same_metric_unit", "same_resolution",
    "same_device_method", "compatible_protocol", "compatible_conditions",
)
MAX_FINITE_FLOAT = float.fromhex("0x1.fffffffffffffp+1023")
UNAVAILABLE = "reference_unavailable"
DECODE_LIMIT = "Repeated exposure may still affect DECODE performance."


def _text(value):
    return isinstance(value, str) and bool(value.strip())


def _number(value):
    return type(value) is int or (type(value) is float and isfinite(value))


def _unit_and_resolution(kind, metric):
    if kind == "measurement" and metric in status.METRICS:
        unit, resolution, _ = status.METRICS[metric]
        return unit, resolution
    if kind == "sleep_record" and metric in SLEEP_METRICS:
        return SLEEP_METRICS[metric], "daily"
    if kind == "decode_session" and metric in DECODE_METRICS:
        return DECODE_METRICS[metric], "session"
    return None, None


@dataclass(frozen=True)
class Policy:
    kind: str
    metric: str
    version: str
    lookback_days: int
    minimum_days: int

    def __post_init__(self):
        if self.kind not in status.KINDS or not _text(self.metric) or not _text(self.version):
            raise ValueError("A record kind, metric and policy version are required")
        if (type(self.minimum_days) is not int or type(self.lookback_days) is not int
                or not 1 <= self.minimum_days <= self.lookback_days):
            raise ValueError("Require 1 <= minimum_days <= lookback_days")


# Opt-in demonstration profile. Choose a separate explicitly scoped policy for each other metric.
DEMO_RESTING_HR = Policy("measurement", "hr_resting_bpm", "demo-resting-hr-v1", 14, 5)


@dataclass(frozen=True)
class Observation:
    """A Task 2 record and its trusted, record-specific adapter context."""

    record: object
    context: Mapping


@dataclass(frozen=True)
class ReferenceKey:
    kind: str
    metric: str
    unit: str
    resolution: str
    partition: tuple
    method: tuple
    protocol: tuple
    conditions: tuple

    def checks_against(self, other):
        return {
            "same_subject_partition": self.partition == other.partition,
            "same_metric_unit": self.kind == other.kind and self.metric == other.metric
            and self.unit == other.unit,
            "same_resolution": self.resolution == other.resolution,
            "same_device_method": self.method == other.method,
            "compatible_protocol": self.protocol == other.protocol,
            "compatible_conditions": self.conditions == other.conditions,
        }


@dataclass(frozen=True)
class Source:
    record_id: str
    day: date
    value: object
    source_file: object
    source_field: object
    source_row_number: object
    hour_local: object
    observed_at_utc: object
    start_at_utc: object
    end_at_utc: object
    schema_version: str


@dataclass(frozen=True)
class Exclusion:
    record_id: object
    reasons: tuple


@dataclass(frozen=True)
class Candidate:
    policy: Policy
    key: object
    target_day: object
    reference_status: str
    reason: str
    reference_value: object = None
    sources: tuple = ()
    exclusions: tuple = ()
    daily_values: tuple = ()
    method: str = "median of daily medians"
    engine_version: str = ENGINE_VERSION
    status_ruleset_version: str = status.RULESET_VERSION

    @property
    def limitations(self):
        base = ("Descriptive comparison under the named policy and recorded conditions.",)
        return (*base, DECODE_LIMIT) if self.policy.kind == "decode_session" else base


def _record(observation):
    return observation.record if isinstance(observation.record, Mapping) else {}


def _context(observation):
    # Never accept a caller-supplied comparison as evidence for a reference.
    return {k: v for k, v in observation.context.items() if k != "comparison"}


def _day(kind, record):
    field = "start_at_utc" if kind == "decode_session" else "observation_date"
    value = record.get(field)
    if not isinstance(value, str):
        return None
    try:
        day = date.fromisoformat(value[:10] if kind == "decode_session" else value)
    except ValueError:
        return None
    return day if value[:10] == day.isoformat() else None


def _status_context(observation, policy, checks, sufficient):
    result = _context(observation)
    comparison = {**checks, "reference_sufficient": sufficient}
    if policy.kind == "sleep_record" and policy.metric in status.SLEEP_UNITS:
        comparison["sleep_field"] = policy.metric
    result["comparison"] = comparison
    return result


def _reading(observation, policy):
    """Check a selected value before checking compatibility with any reference."""
    kind, metric = policy.kind, policy.metric
    record, context = _record(observation), _context(observation)
    raw = status.evaluate(kind, observation.record, context=context)
    unit, resolution = _unit_and_resolution(kind, metric)
    if unit is None:
        return None, None, ("unsupported_reference_metric",)
    if kind == "sleep_record":
        # Supply an inapplicable comparator with satisfied dimensions to use Task 3's
        # selected-field check. This result is local to validation, never a published status.
        target_context = _status_context(observation, policy, dict.fromkeys(COMPATIBILITY_CHECKS, True), True)
        targeted = status.evaluate(kind, observation.record, context=target_context)
        if targeted["status"] != "valid":
            return None, None, tuple(dict.fromkeys(targeted["reason_codes"] + raw["reason_codes"]))
    if raw["status"] != "valid":
        return None, None, tuple(raw["reason_codes"])
    if raw["reference_eligible"] is False:
        return None, None, tuple(raw["reason_codes"] or ["practice_session"])
    if kind == "measurement" and record.get("metric_code") != metric:
        return None, None, ("comparison_metric_mismatch",)

    field = "value" if kind == "measurement" else metric
    value = record.get(field)
    if value is None:
        return None, None, ("missing_selected_value",)
    if not _number(value) or value < 0 or value > MAX_FINITE_FLOAT:
        return None, None, ("invalid_reference_value",)
    if context.get("conditions_compatible") is not True:
        return None, None, ("unverified_measurement_conditions",)

    origin, subject = record["data_origin"], context["subject"]
    basis = subject.get("timezone_basis")
    if basis != TIME_BASES[origin]:
        return None, None, ("unverified_time_basis",)
    dataset = subject.get("research_dataset_version") if origin == "real_research" else None
    participant = subject.get("source_participant_id") if origin == "real_research" else None
    if origin == "real_research" and not _text(dataset):
        return None, None, ("unverified_dataset_version",)
    if kind == "decode_session" and subject.get("source_participant_id") is not None:
        return None, None, ("decode_research_subject_link",)

    partition = (origin, subject["subject_mode"], record["subject_id"], participant, dataset, basis)
    protocol = ()
    if kind == "measurement":
        method = (record.get("capture_method"), record.get("source_file"), record.get("source_field"))
        conditions = (record.get("measurement_context"), record.get("hour_local") if resolution == "hourly" else None)
    elif kind == "sleep_record":
        method = (record.get("sleep_metric_method"), record.get("source_file"))
        conditions = (record.get("sleep_metric_method"),)
    else:
        if context.get("decode_familiarization_verified") is not True or not _text(context.get("decode_exposure_band")):
            return None, None, ("unverified_decode_familiarization",)
        start, end = (status.parse_utc(record[field]) for field in ("start_at_utc", "end_at_utc"))
        # A verified clock adjustment may pass raw status. The reference still needs reliable ordering.
        if (end - start).total_seconds() != record["elapsed_monotonic_ms"] / 1000:
            return None, None, ("decode_ordering_unverified",)
        method = (record["app_version"], record["input_method"])
        protocol = (record["protocol_version"], record["key_version"], record["planned_duration_ms"])
        conditions = (record.get("technical_context"), context["decode_exposure_band"])
    locator = record.get("source_row_number")
    if locator is not None and (type(locator) is not int or locator < 1):
        return None, None, ("invalid_source_row_number",)
    if not _text(conditions[0]) or not _text(method[0]) or any(
        item is not None and not _text(item) for item in method
    ):
        return None, None, ("missing_or_invalid_reference_context",)
    return ReferenceKey(kind, metric, unit, resolution, partition, method, protocol, conditions), value, ()


def _signature(observation, kind):
    # Source locators and mutable status/reference links do not change the observed payload.
    ignored = {kind + "_id", "created_at_utc", "source_row_number", "reference_id", "quality_record_id"}
    signature = {k: v for k, v in _record(observation).items() if k not in ignored and v is not None}
    # Normalize valid UTC spellings for duplicate detection. Preserve the
    # original spelling in Source for the selected record's provenance.
    time_fields = {
        "measurement": ("observed_at_utc",),
        "sleep_record": (),
        "decode_session": ("start_at_utc", "end_at_utc"),
    }
    for field in time_fields[kind]:
        instant = status.parse_utc(signature.get(field))
        if instant is not None:
            signature[field] = instant
    return signature


def _prior_rows(target, history, key, target_day, lookback):
    kind = key.kind
    grouped, by_id = defaultdict(list), defaultdict(list)
    exclusions = []
    current_id = _record(target).get(kind + "_id")
    for observation in history:
        record = _record(observation)
        record_id = record.get(kind + "_id")
        record_id = record_id if _text(record_id) else None
        if (record.get("subject_id") != key.partition[2] or record.get("data_origin") != key.partition[0]):
            # The audit reveals no identifiers from other partitions.
            exclusions.append(Exclusion(None, ("comparison_subject_mismatch",)))
            continue
        subject = observation.context.get("subject")
        if isinstance(subject, Mapping) and (
            subject.get("subject_profile_id") != key.partition[2]
            or subject.get("subject_mode") != key.partition[1]
            or (key.partition[0] == "real_research" and (
                subject.get("source_participant_id") != key.partition[3]
                or subject.get("research_dataset_version") != key.partition[4]
            ))
        ):
            exclusions.append(Exclusion(None, ("comparison_subject_mismatch",)))
            continue

        day = _day(kind, record)
        if day is None:
            reasons = ("unknown_measurement_time",)
        elif record_id is not None and record_id == current_id:
            reasons = ("current_record",)
        elif day >= target_day:
            reasons = ("current_or_future_day",)
        elif (target_day - day).days > lookback:
            reasons = ("outside_lookback",)
        else:
            reasons = ()
        if reasons:
            exclusions.append(Exclusion(record_id, reasons))
            continue

        # A real export has one daily row or one row per local hour. Other sources
        # may take independent readings in distinct documented conditions/methods.
        field = record.get("metric_code") if kind == "measurement" else kind
        if kind == "decode_session":
            start_at = record.get("start_at_utc")
            occurrence = status.parse_utc(start_at) or start_at
            scope = ()
        else:
            occurrence = record.get("hour_local") if key.resolution == "hourly" else None
            scope = (record.get("source_file"),)
            if key.partition[0] != "real_research":
                if kind == "measurement":
                    scope = (*scope, record.get("capture_method"), record.get("measurement_context"))
                else:
                    scope = (*scope, record.get("sleep_metric_method"))
        # JSON-shaped invalid field values must still pass through the quality gate.
        natural = (day, repr(field), repr(occurrence), repr(scope))
        index = (observation, record_id, day)
        grouped[natural].append(index)
        if record_id is not None:
            by_id[record_id].append(index)
    conflict_ids = {
        record_id for record_id, rows in by_id.items()
        if any(row[0].context.get("duplicate_state") == "conflict" for row in rows)
        or any(_signature(row[0], kind) != _signature(rows[0][0], kind) for row in rows[1:])
    }
    return grouped, conflict_ids, exclusions


def _collect(target, history, policy, key, target_day, lookback):
    grouped, conflict_ids, exclusions = _prior_rows(target, history, key, target_day, lookback)
    target_instant = _record(target).get("observed_at_utc") if key.kind == "measurement" else None
    sources = []
    for rows in grouped.values():
        conflict = any(
            record_id in conflict_ids or observation.context.get("duplicate_state") == "conflict"
            for observation, record_id, _ in rows
        ) or any(
            _signature(row[0], key.kind) != _signature(rows[0][0], key.kind) for row in rows[1:]
        )
        accepted = []
        for observation, record_id, day in rows:
            record = _record(observation)
            other, value, reasons = _reading(observation, policy)
            if conflict:
                reasons = ("conflicting_duplicate",)
            elif other is not None:
                comparison = other.checks_against(key)
                assessment = status.evaluate(
                    policy.kind, observation.record,
                    context=_status_context(observation, policy, comparison, True),
                )
                reasons = tuple(assessment["reason_codes"])
                if not reasons:
                    if (key.kind == "decode_session"
                            and status.parse_utc(record["end_at_utc"]).date() >= target_day):
                        reasons = ("session_not_finished_before_target_day",)
                    if (target_instant is not None and record.get("observed_at_utc") is not None
                            and status.parse_utc(record["observed_at_utc"]) >= status.parse_utc(target_instant)):
                        reasons = ("measurement_utc_not_prior",)
            if reasons:
                exclusions.append(Exclusion(record_id, reasons))
            else:
                accepted.append(Source(
                    record_id, day, value, record.get("source_file"), record.get("source_field"),
                    record.get("source_row_number"), record.get("hour_local"), record.get("observed_at_utc"),
                    record.get("start_at_utc"), record.get("end_at_utc"), record["schema_version"],
                ))
        if accepted:
            accepted.sort(key=lambda item: (item.record_id, repr(item)))
            sources.append(accepted[0])
            exclusions.extend(Exclusion(item.record_id, ("duplicate_observation",)) for item in accepted[1:])
    return (
        tuple(sorted(sources, key=lambda row: (row.day, row.record_id))),
        tuple(sorted(exclusions, key=lambda row: (row.record_id or "", row.reasons))),
    )


def _daily(sources):
    values = defaultdict(list)
    for row in sources:
        # Exact arithmetic also prevents overflow when averaging two large finite values.
        values[row.day].append(Fraction(str(row.value)))
    return tuple((day, median(values[day])) for day in sorted(values))


def build_reference(target, history, policy):
    """Build an immutable candidate. Only an explicit activation can change a series."""
    key, _, reasons = _reading(target, policy)
    day = _day(policy.kind, _record(target))
    if key is None or day is None:
        return Candidate(policy, key, day, "not_built", ", ".join(reasons) or "unknown_target_day")
    sources, exclusions = _collect(target, history, policy, key, day, policy.lookback_days)
    daily = _daily(sources)
    if len(daily) < policy.minimum_days:
        return Candidate(
            policy, key, day, "provisional" if daily else "not_built",
            "insufficient_valid_days" if daily else "no_eligible_history",
            sources=sources, exclusions=exclusions,
            daily_values=tuple((item_day, float(value)) for item_day, value in daily),
        )
    return Candidate(
        policy, key, day, "usable_for_question", "minimum_valid_days_met",
        reference_value=float(median(value for _, value in daily)), sources=sources,
        exclusions=exclusions, daily_values=tuple((item_day, float(value)) for item_day, value in daily),
    )



@dataclass(frozen=True)
class Decision:
    decision_id: str
    actor_id: str
    role: str
    at_utc: str
    reason: str

    def __post_init__(self):
        if not all(_text(value) for value in (
            self.decision_id, self.actor_id, self.role, self.at_utc, self.reason,
        )):
            raise ValueError("A decision requires an ID, actor, role, time and reason")
        if status.parse_utc(self.at_utc) is None:
            raise ValueError("Decision time must match the Task 2 UTC format")


@dataclass(frozen=True)
class Event:
    action: str
    reference_id: str
    decision: Decision
    candidate: object = None


@dataclass(frozen=True)
class ReferenceSeries:
    """Append-only value object. Store updates with atomic compare-and-swap in the app."""

    events: tuple = ()

    @property
    def active(self):
        return next((event for event in reversed(self.events) if event.action == "activate"), None)

    def _append(self, event):
        duplicate = next(
            (old for old in self.events if old.decision.decision_id == event.decision.decision_id), None
        )
        if duplicate is not None:
            if event == duplicate:
                return self
            raise ValueError("Decision ID already in use")
        if self.events and status.parse_utc(event.decision.at_utc) < status.parse_utc(self.events[-1].decision.at_utc):
            raise ValueError("Decision time precedes the last recorded event")
        return replace(self, events=(*self.events, event))

    def activate(self, candidate, *, reference_id, decision, expected_reference_id):
        """Publish a reviewed candidate with a new ID and an explicit expected prior ID."""
        event = Event("activate", reference_id, decision, candidate)
        if event in self.events:
            return self
        if (candidate.reference_status != "usable_for_question" or candidate.key is None
                or candidate.reference_value is None or not candidate.sources or not _text(reference_id)):
            raise ValueError("Activation requires a usable candidate and a reference ID")
        active = self.active
        if expected_reference_id != (active.reference_id if active else None):
            raise ValueError("Active reference changed since review")
        if any(item.reference_id == reference_id for item in self.events):
            raise ValueError("Reference ID already in use")
        if active:
            if self.events[-1].action in ("freeze", "request_review"):
                raise ValueError("Record a review resolution before activating a replacement")
            if candidate.key != active.candidate.key:
                raise ValueError("A different reference key requires its own series")
            if candidate.target_day <= active.candidate.target_day:
                raise ValueError("Replacement requires a later comparison target")
        return self._append(event)

    def decide(self, action, *, reference_id, decision):
        """Freeze, request review, or resolve a hold without replacing the baseline."""
        event = Event(action, reference_id, decision)
        if event in self.events:
            return self
        if self.active is None or reference_id != self.active.reference_id:
            raise ValueError("Decision requires the current active reference ID")
        transitions = {
            "activate": {"freeze", "request_review"},
            "freeze": {"request_review", "resolve_review"},
            "request_review": {"resolve_review"},
            "resolve_review": {"freeze", "request_review"},
        }
        if action not in transitions[self.events[-1].action]:
            raise ValueError("Unsupported state transition")
        return self._append(event)


@dataclass(frozen=True)
class Comparison:
    reference_status: str
    reason: str
    raw_information: dict
    information_status: dict
    assessment_context: dict
    reference_id: object = None
    reference_value: object = None
    observed_value: object = None
    difference: object = None
    limitations: tuple = ()


def _sources_precede_target(candidate, target, day):
    record = _record(target)
    current_id = record.get(candidate.key.kind + "_id")
    instant = record.get("observed_at_utc") if candidate.key.kind == "measurement" else None
    return all(
        source.day < day and source.record_id != current_id and (
            instant is None or source.observed_at_utc is None
            or status.parse_utc(source.observed_at_utc) < status.parse_utc(instant)
        )
        for source in candidate.sources
    )


def compare(target, policy, series, *, as_of_utc):
    """Assess one observation against the active version as of the given UTC time."""
    as_of = status.parse_utc(as_of_utc)
    if as_of is None:
        raise ValueError("Comparison as-of time must match the Task 2 UTC format")
    visible = ReferenceSeries(tuple(
        event for event in series.events if status.parse_utc(event.decision.at_utc) <= as_of
    ))
    active = visible.active
    kind = policy.kind
    raw = status.evaluate(kind, target.record, context=_context(target))
    key, value, reasons = _reading(target, policy)
    day = _day(kind, _record(target))
    state, reason = "not_built", UNAVAILABLE
    checks = {}
    candidate = active.candidate if active else None
    if key is None:
        reason = ", ".join(reasons)
    elif candidate is not None and key.partition != candidate.key.partition:
        checks = {"same_subject_partition": False}
        reason = "incompatible_reference"
    elif candidate is not None:
        checks = key.checks_against(candidate.key)
        if not all(checks.values()):
            reason = "incompatible_reference"
        elif day < candidate.target_day or not _sources_precede_target(candidate, target, day):
            reason = "reference_postdates_target"
        elif policy != candidate.policy:
            state, reason = "needs_review", "reference_policy_changed"
        elif visible.events[-1].action == "request_review":
            state, reason = "needs_review", "review_requested"
        else:
            state = "usable_for_question"
            reason = "frozen_reference" if visible.events[-1].action == "freeze" else "active_reference"

    # Run Task 3 with the selected field and computed checks. Fail closed if the
    # reading itself cannot be admitted, even when a prior active version exists.
    if raw["status"] == "valid" and key is None:
        checks["compatible_conditions"] = False
    sufficient = state == "usable_for_question"
    context = _status_context(target, policy, checks, sufficient)
    assessed = status.evaluate(kind, target.record, context=context)
    compared = sufficient and assessed["reference_eligible"] is True
    baseline = candidate.reference_value if compared else None
    difference = float(Fraction(str(value)) - Fraction(str(baseline))) if compared else None
    reference_id = None
    if active and all(checks.get(k) is True for k in COMPATIBILITY_CHECKS) and reason != "reference_postdates_target":
        reference_id = active.reference_id
    return Comparison(
        state, reason, raw, assessed, context, reference_id, baseline, value,
        difference, candidate.limitations if compared else (),
    )


def task2_record(activation, *, schema_version):
    """Project an activation to the existing Task 2 personal_reference fields."""
    if activation.action != "activate" or not _text(schema_version):
        raise ValueError("An activation and schema version are required")
    candidate = activation.candidate
    return {
        "personal_reference_id": activation.reference_id,
        "schema_version": schema_version,
        "subject_id": candidate.key.partition[2],
        "data_origin": "application_generated",
        "is_simulated": candidate.key.partition[0] == "simulated_mission",
        "created_at_utc": activation.decision.at_utc,
        "metric_code": candidate.policy.metric,
        "reference_version": activation.reference_id,
        "reference_status": candidate.reference_status,
        "method": candidate.method,
        "start_date": min(source.day for source in candidate.sources).isoformat(),
        "end_date": max(source.day for source in candidate.sources).isoformat(),
        "comparison_target_date": candidate.target_day.isoformat(),
        "source_record_ids": [source.record_id for source in candidate.sources],
        "valid_record_count": len(candidate.sources),
        "reference_value": candidate.reference_value,
        "unit": candidate.key.unit,
        "eligibility_notes": (
            f"{candidate.policy.version}: {len(candidate.daily_values)} valid days, "
            f"minimum {candidate.policy.minimum_days}, lookback {candidate.policy.lookback_days} days. "
            + " ".join(candidate.limitations)
        ),
        "approved_by_role": activation.decision.role,
    }


def audit_event(event):
    """Return a JSON-ready snapshot of a version or lifecycle decision."""
    def serialize(value):
        if isinstance(value, date):
            return value.isoformat()
        if isinstance(value, dict):
            return {key: serialize(item) for key, item in value.items()}
        if isinstance(value, tuple):
            return [serialize(item) for item in value]
        return value

    return serialize(asdict(event))



def restore_series(audit_log):
    """Replay trusted audit snapshots emitted by audit_event, in storage order."""
    series = ReferenceSeries()
    for snapshot in audit_log:
        action, ref_id = snapshot["action"], snapshot["reference_id"]
        decision = Decision(**snapshot["decision"])
        if action != "activate":
            series = series.decide(action, reference_id=ref_id, decision=decision)
            continue
        values = dict(snapshot["candidate"])
        key = values["key"]
        values["key"] = ReferenceKey(**{
            name: tuple(value) if isinstance(value, list) else value for name, value in key.items()
        })
        values["policy"] = Policy(**values["policy"])
        values["target_day"] = date.fromisoformat(values["target_day"])
        values["sources"] = tuple(
            Source(**{**row, "day": date.fromisoformat(row["day"])}) for row in values["sources"]
        )
        values["exclusions"] = tuple(
            Exclusion(row["record_id"], tuple(row["reasons"])) for row in values["exclusions"]
        )
        values["daily_values"] = tuple(
            (date.fromisoformat(day), value) for day, value in values["daily_values"]
        )
        series = series.activate(
            Candidate(**values), reference_id=ref_id, decision=decision,
            expected_reference_id=series.active.reference_id if series.active else None,
        )
    return series

