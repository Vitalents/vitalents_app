"""Compare supplied schedule proposals against one simulated mission timeline."""

import hashlib
import json
import re
from collections.abc import Mapping
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta

from .status import parse_utc

ENGINE_VERSION = "schedule-1.0.0"
TIMESTAMP = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,6})?")


@dataclass(frozen=True)
class Interval:
    start_at: str
    end_at: str
    clock_reference: str


@dataclass(frozen=True)
class Move:
    mission_schedule_id: str
    interval: Interval


@dataclass(frozen=True)
class Alternative:
    proposal_id: str
    moves: tuple[Move, ...]


@dataclass(frozen=True)
class Approval:
    """Trusted current approval for an exact proposal and constraint snapshot."""

    approval_record_id: str
    proposal_key: str
    role: str


@dataclass(frozen=True)
class _Activity:
    task_id: str
    start: datetime
    end: datetime
    is_fixed: bool
    prep: int
    travel: int
    resources: tuple
    approval_role: str

    @property
    def occupied(self):
        return self.start - timedelta(minutes=self.prep), self.end + timedelta(minutes=self.travel)


class _ConstraintError(ValueError):
    def __init__(self, code, ref=None):
        self.issue = {"code": code}
        if ref is not None:
            self.issue["reference"] = ref
        super().__init__(code)


def _text(value):
    return isinstance(value, str) and bool(value.strip())


def _timestamp(value, clock_basis):
    if not isinstance(value, str):
        return None
    if clock_basis == "UTC":
        main = value.removesuffix("Z").removesuffix("+00:00")
        if not TIMESTAMP.fullmatch(main):
            return None
        return parse_utc(value)
    if TIMESTAMP.fullmatch(value):
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            pass
    return None


def _parse(interval, clock_reference, clock_basis, ref):
    if not isinstance(interval, Interval):
        raise _ConstraintError("missing_interval" if interval is None else "invalid_interval", ref)
    if not _text(interval.clock_reference):
        raise _ConstraintError("missing_clock_reference", ref)
    if interval.clock_reference != clock_reference:
        raise _ConstraintError("clock_reference_mismatch", ref)
    start = _timestamp(interval.start_at, clock_basis)
    end = _timestamp(interval.end_at, clock_basis)
    if start is None or end is None or start >= end:
        raise _ConstraintError("invalid_interval", ref)
    return start, end


def _activity(row, subject_id, clock_reference, clock_basis):
    if not isinstance(row, Mapping) or not _text(row.get("mission_schedule_id")):
        raise _ConstraintError("missing_activity_identity")
    ref = row["mission_schedule_id"]
    if (row.get("subject_id") != subject_id or row.get("data_origin") != "simulated_mission"
            or row.get("is_simulated") is not True):
        raise _ConstraintError("activity_outside_simulated_subject")
    fields = ("prep_minutes", "travel_minutes", "resource_constraints", "approval_role", "is_fixed")
    if any(row.get(field) is None for field in fields):
        raise _ConstraintError("missing_activity_constraints", ref)
    interval = Interval(row.get("start_at"), row.get("end_at"), row.get("clock_reference"))
    start, end = _parse(interval, clock_reference, clock_basis, ref)
    prep, travel, resources, role, fixed = (row[field] for field in fields)
    if (type(prep) is not int or prep < 0 or type(travel) is not int or travel < 0
            or not isinstance(resources, (list, tuple)) or any(not _text(r) for r in resources)
            or type(fixed) is not bool or role not in ("planner", "medical")):
        raise _ConstraintError("invalid_activity_constraints", ref)
    # The caller maps mission_day to the declared mission clock. Arithmetic uses
    # the full dated start_at and end_at fields across calendar boundaries.
    return _Activity(ref, start, end, fixed, prep, travel, tuple(sorted(set(resources))), role)


def _merge(intervals):
    merged = []
    for start, end in sorted(intervals):
        if merged and start <= merged[-1][1]:
            old_start, old_end = merged[-1]
            merged[-1] = (old_start, max(old_end, end))
        else:
            merged.append((start, end))
    return merged


def _constraints(activities, horizon, calendars):
    issues = []
    previous_end = None
    for start, end, activity in sorted(
        ((*item.occupied, item) for item in activities), key=lambda item: (item[0], item[2].task_id)
    ):
        ref = activity.task_id
        if start < horizon[0] or end > horizon[1]:
            issues.append({"code": "outside_constraint_horizon", "reference": ref})
        if previous_end is not None and start < previous_end:
            issues.append({"code": "crew_task_overlap", "reference": ref})
        previous_end = end if previous_end is None else max(previous_end, end)
        for resource in activity.resources:
            if resource not in calendars:
                issues.append({"code": "missing_resource_calendar", "reference": ref, "resource": resource})
            elif not any(a <= start and end <= b for a, b in calendars[resource]):
                issues.append({"code": "resource_unavailable", "reference": ref, "resource": resource})
    return issues


def _opportunity(window, activities):
    start, end = window
    occupied = _merge((max(a, start), min(b, end)) for a, b in
                      (item.occupied for item in activities) if a < end and b > start)
    free = []
    cursor = start
    for left, right in occupied:
        if cursor < left:
            free.append((cursor, left))
        cursor = right
    if cursor < end:
        free.append((cursor, end))
    durations = [(right - left).total_seconds() / 60 for left, right in free]
    return {
        "rest_intervals": [{"start_at": left.isoformat(), "end_at": right.isoformat()}
                           for left, right in free],
        "rest_opportunity_minutes": sum(durations),
        "longest_rest_opportunity_minutes": max(durations, default=0),
    }


def _candidate(alternative, baseline, clock_reference, clock_basis):
    if not alternative.moves:
        raise _ConstraintError("no_schedule_change")
    proposed = baseline.copy()
    moved = set()
    for move in alternative.moves:
        ref = move.mission_schedule_id
        if not _text(ref) or ref not in baseline:
            raise _ConstraintError("unknown_activity")
        if ref in moved:
            raise _ConstraintError("duplicate_activity_move", ref)
        original = baseline[ref]
        start, end = _parse(move.interval, clock_reference, clock_basis, ref)
        if original.is_fixed:
            raise _ConstraintError("fixed_activity", ref)
        if end - start != original.end - original.start:
            raise _ConstraintError("activity_duration_changed", ref)
        if start == original.start:
            raise _ConstraintError("no_schedule_change", ref)
        proposed[ref] = _Activity(ref, start, end, False, original.prep, original.travel,
                                   original.resources, original.approval_role)
        moved.add(ref)
    return proposed, moved


def _key(constraint_snapshot, alternative, proposed, moved):
    changes = [(ref, proposed[ref].start.isoformat(), proposed[ref].end.isoformat())
               for ref in sorted(moved)]
    payload = (constraint_snapshot, alternative.proposal_id, changes)
    return hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode("utf-8")).hexdigest()


def compare(schedule, *, subject_id, clock_reference, clock_basis, rest_window, horizon,
            resource_availability, alternatives, approvals=()):
    """Calculate rest gaps and compare time-only moves within complete supplied constraints.

    The caller supplies a complete single-crew schedule for the horizon and
    resource calendars net of outside bookings. An explicit empty calendar means
    unavailable. UTC timestamps use Z or +00:00. A declared fixed-rate mission
    clock uses dated local timestamps without offsets or discontinuities.
    """
    result = {
        "engine_version": ENGINE_VERSION, "status": "invalid_constraints",
        "subject_id": subject_id, "clock_reference": clock_reference, "clock_basis": clock_basis,
        "quantity": "calculated_rest_opportunity", "baseline": None,
        "interpretation": "Unoccupied time inside the rest window. Actual sleep requires a separate record.",
        "alternatives": [], "limitations": [],
    }
    try:
        if not _text(subject_id) or not _text(clock_reference) or clock_basis is None:
            raise _ConstraintError("missing_subject_or_clock")
        if (clock_basis not in ("UTC", "fixed_rate_mission_clock")
                or (clock_reference == "UTC" and clock_basis != "UTC")):
            raise _ConstraintError("unsupported_clock_basis")
        if schedule is None or alternatives is None or resource_availability is None:
            raise _ConstraintError("missing_schedule_candidates_or_resource_constraints")
        if not isinstance(resource_availability, Mapping):
            raise _ConstraintError("invalid_resource_calendars")
        proposals = tuple(alternatives)
        approvals = tuple(approvals)
        domain = _parse(horizon, clock_reference, clock_basis, "horizon")
        window = _parse(rest_window, clock_reference, clock_basis, "rest_window")
        if not domain[0] <= window[0] < window[1] <= domain[1]:
            raise _ConstraintError("rest_window_outside_horizon")
        baseline = {}
        for row in schedule:
            item = _activity(row, subject_id, clock_reference, clock_basis)
            if item.task_id in baseline:
                raise _ConstraintError("duplicate_activity_identity", item.task_id)
            baseline[item.task_id] = item
        calendars = {}
        for key in sorted({r for activity in baseline.values() for r in activity.resources}):
            if resource_availability.get(key) is None:
                continue
            calendars[key] = _merge(
                _parse(interval, clock_reference, clock_basis, key)
                for interval in resource_availability[key]
            )
        issues = _constraints(baseline.values(), domain, calendars)
        if issues:
            result["limitations"] = issues
            if all(issue["code"].startswith("missing_") for issue in issues):
                result["status"] = "insufficient_constraints"
            return result
    except _ConstraintError as exc:
        result["limitations"].append(exc.issue)
        if exc.issue["code"].startswith("missing_"):
            result["status"] = "insufficient_constraints"
        return result
    except (OverflowError, TypeError):
        result["limitations"].append({"code": "invalid_constraint_data"})
        return result

    result["baseline"] = _opportunity(window, baseline.values())
    snapshot = (ENGINE_VERSION, subject_id, clock_reference, clock_basis, domain, window, calendars,
                [asdict(baseline[ref]) for ref in sorted(baseline)])
    seen_ids = set()
    for proposal in proposals:
        if (not isinstance(proposal, Alternative) or not _text(proposal.proposal_id)
                or proposal.proposal_id in seen_ids):
            result["limitations"].append({"code": "invalid_or_duplicate_proposal_identity"})
            return result
        seen_ids.add(proposal.proposal_id)

    for alternative in proposals:
        outcome = {"proposal_id": alternative.proposal_id, "alternative_status": "rejected",
                   "issues": [], "approval_satisfied": False}
        result["alternatives"].append(outcome)
        try:
            candidate, moved = _candidate(alternative, baseline, clock_reference, clock_basis)
            outcome["issues"] = _constraints(candidate.values(), domain, calendars)
        except _ConstraintError as exc:
            outcome["issues"].append(exc.issue)
        except (OverflowError, TypeError, AttributeError):
            outcome["issues"].append({"code": "invalid_move"})
        if outcome["issues"]:
            continue

        key = _key(snapshot, alternative, candidate, moved)
        roles = sorted({baseline[ref].approval_role for ref in moved})
        matched = sorted({(a.role, a.approval_record_id) for a in approvals if isinstance(a, Approval)
                          and a.proposal_key == key and _text(a.approval_record_id)
                          and a.role in roles})
        pending = sorted(set(roles) - {role for role, _ in matched})
        opportunity = _opportunity(window, candidate.values())
        outcome.update(
            alternative_status="pending_approval" if pending else "valid",
            proposal_key=key, required_approval_roles=roles, pending_approval_roles=pending,
            approval_records=[{"role": role, "approval_record_id": ref} for role, ref in matched],
            moves=[{"mission_schedule_id": ref, "start_at": candidate[ref].start.isoformat(),
                    "end_at": candidate[ref].end.isoformat()} for ref in sorted(moved)],
            approval_satisfied=not pending, **opportunity,
            rest_opportunity_delta_minutes=(
                opportunity["rest_opportunity_minutes"] - result["baseline"]["rest_opportunity_minutes"]
            ),
            longest_rest_opportunity_delta_minutes=(
                opportunity["longest_rest_opportunity_minutes"]
                - result["baseline"]["longest_rest_opportunity_minutes"]
            ),
        )
    if any(a["alternative_status"] != "rejected" for a in result["alternatives"]):
        result["status"] = "feasible_alternatives"
    else:
        result["status"] = "no_valid_alternative"
        result["limitations"].append({"code": "no_valid_alternative", "text": "No valid alternative."})
    return result
