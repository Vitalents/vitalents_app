"""Recompute DECODE scores from a sealed Task 2 response ledger."""
from collections.abc import Mapping
from math import isclose
from statistics import median
from sys import float_info

from . import status

VERIFIER_VERSION = "decode-ledger-1.0.0"
INPUT_METHODS = ("keyboard", "touch", "other")
SCORE_FIELDS = ("accepted_responses", "correct_count", "accuracy_percent", "median_correct_rt_ms")


def _text(value):
    return isinstance(value, str) and bool(value.strip())


def _time(value):
    return type(value) in (int, float) and 0 <= value <= float_info.max


def _digit(value):
    return type(value) is int and 1 <= value <= 9


def _same_number(claim, actual, *, rt=False):
    if actual is None:
        return claim is None
    if not _time(claim):
        return False
    return isclose(claim, actual, rel_tol=0, abs_tol=1e-7) if rt else claim == actual


def _valid_key(key):
    return (isinstance(key, Mapping) and len(key) == 9
            and all(_text(symbol) and _digit(digit) for symbol, digit in key.items())
            and len(set(key.values())) == 9)


def _event_matches_session(event, session):
    fields = ("decode_session_id", "subject_id", "data_origin", "schema_version")
    return (all(event.get(field) == session[field] for field in fields)
            and event.get("is_simulated") is session["is_simulated"]
            and status.parse_utc(event.get("created_at_utc")) is not None)


def _check_event(event, key, elapsed, completed, input_method, first):
    """Return the computed state, acceptance, RT and any row-level issues."""
    shown = event.get("stimulus_monotonic_ms")
    answered = event.get("response_monotonic_ms")
    choice = event.get("response_digit")
    symbol = event.get("symbol_id")
    focus = event.get("focus_state")
    if (not _text(symbol) or symbol not in key
            or not _digit(event.get("correct_digit")) or event["correct_digit"] != key[symbol]):
        return None, False, None, ["invalid_symbol_key_binding"]
    if not _time(shown) or shown >= elapsed:
        return None, False, None, ["invalid_stimulus_time"]
    if ((answered is None) != (choice is None)
            or (answered is not None and (not _time(answered) or answered < shown or not _digit(choice)))):
        return None, False, None, ["invalid_response_payload"]
    if (event.get("input_method") not in INPUT_METHODS
            or event.get("input_method") != input_method
            or focus not in ("foreground", "background", "unknown")):
        return None, False, None, ["invalid_capture_context"]

    rt = None if answered is None else answered - shown
    if first is not None:
        prior, prior_accepted = first
        late_after_miss = (
            prior["response_state"] == "missed" and answered is not None
            and answered >= status.DECODE_WINDOW_MS
        )
        if (answered is None or (shown, symbol) != (prior["stimulus_monotonic_ms"], prior["symbol_id"])
                or (prior_accepted and answered < prior["response_monotonic_ms"])
                or (not prior_accepted and not late_after_miss)):
            return None, False, None, ["conflicting_trial_events"]

    if not completed and answered is not None and answered >= elapsed:
        return None, False, None, ["response_outside_partial_capture"]
    if answered is not None and answered >= status.DECODE_WINDOW_MS:
        state = "late"
    elif focus != "foreground":
        if completed:
            return None, False, None, ["unverified_foreground"]
        state = "interrupted"
    elif first is not None:
        state = "duplicate"
    elif answered is None:
        state = "missed" if completed or event.get("response_state") == "missed" else "interrupted"
    else:
        state = "correct" if choice == key[symbol] else "incorrect"

    accepted = state in ("correct", "incorrect")
    problems = []
    if event.get("response_state") != state or event.get("is_accepted") is not accepted:
        problems.append("event_classification_mismatch")
    if not _same_number(event.get("response_time_ms"), rt, rt=True):
        problems.append("event_rt_mismatch")
    return state, accepted, rt, problems


def verify(session, events, *, subject, key_registry, expected_event_ids,
           clock_adjustment_verified=False):
    """Audit a Task 2 session. Event IDs must come from a trusted capture seal.

    The seal supplies capture order and includes every event, including rejected
    attempts. Passing None means completeness is unknown. This is a read-only
    verifier. A valid partial ledger can be inspected without publishing a score.
    """
    issues = []
    result = {
        "verifier_version": VERIFIER_VERSION, "events_verified": False,
        "score_status": "unavailable", "summary": None, "information_status": None,
        "issues": issues, "event_counts": None,
        "interpretation": "Descriptive DECODE task performance only.",
    }

    def finish():
        result["information_status"] = status.evaluate(
            "decode_session", session, context={
                "subject": subject, "events_verified": result["events_verified"],
                "clock_adjustment_verified": clock_adjustment_verified,
            },
        )
        return result

    if not isinstance(session, Mapping):
        issues.append({"code": "invalid_session_record"})
        return finish()
    origin = session.get("data_origin")
    if (origin not in ("simulated_mission", "live_decode")
            or session.get("is_simulated") is not (origin == "simulated_mission")
            or not isinstance(subject, Mapping)
            or subject.get("subject_profile_id") != session.get("subject_id")
            or subject.get("subject_mode") != status.MODES[origin]
            or subject.get("source_participant_id") is not None
            or subject.get("research_dataset_version") is not None
            or not all(_text(session.get(field)) for field in ("decode_session_id", "subject_id", "schema_version"))):
        issues.append({"code": "invalid_session_partition"})
        return finish()

    state = session.get("session_state")
    completed = state == "completed"
    elapsed = session.get("elapsed_monotonic_ms")
    if (state not in ("completed", "started", "interrupted", "aborted")
            or type(session.get("planned_duration_ms")) is not int
            or session.get("planned_duration_ms") != status.DECODE_WINDOW_MS
            or elapsed is None and state != "started"
            or elapsed is not None and (not _time(elapsed) or elapsed > status.DECODE_WINDOW_MS)
            or completed and elapsed != status.DECODE_WINDOW_MS):
        issues.append({"code": "invalid_measurement_window"})
        return finish()

    version = session.get("key_version")
    key = key_registry.get(version) if isinstance(key_registry, Mapping) and _text(version) else None
    if not _valid_key(key):
        issues.append({"code": "unknown_or_invalid_key"})
        return finish()
    if not isinstance(events, (list, tuple)) or not isinstance(expected_event_ids, (list, tuple)):
        issues.append({"code": "missing_ledger_or_seal"})
        return finish()
    if not all(_text(event_id) for event_id in expected_event_ids) or (
            len(set(expected_event_ids)) != len(expected_event_ids)):
        issues.append({"code": "invalid_ledger_seal"})
        return finish()

    by_id = {}
    for event in events:
        event_id = event.get("decode_response_event_id") if isinstance(event, Mapping) else None
        if not _text(event_id):
            issues.append({"code": "invalid_event_identity"})
        elif event_id in by_id:
            issues.append({"code": "duplicate_event_identity", "event_id": event_id})
        else:
            by_id[event_id] = event
    if by_id.keys() != set(expected_event_ids):
        issues.append({"code": "ledger_membership_mismatch"})
    if issues:
        return finish()

    counts = dict.fromkeys(("correct", "incorrect", "missed", "late", "duplicate", "interrupted"), 0)
    first_by_trial = {}
    correct_rts = []
    previous_trial_end = 0
    previous_response = 0
    for event_id in expected_event_ids:
        event = by_id[event_id]
        trial = event.get("trial_index")
        if not _event_matches_session(event, session):
            problems = ["event_session_partition_mismatch"]
        elif type(trial) is not int or not 0 <= trial <= len(first_by_trial):
            problems = ["invalid_trial_sequence"]
        else:
            first = first_by_trial.get(trial)
            computed, accepted, rt, problems = _check_event(
                event, key, elapsed or 0, completed, session.get("input_method"), first,
            )
            answered = event.get("response_monotonic_ms")
            if not problems and answered is not None and answered < previous_response:
                problems = ["response_order_mismatch"]
            if not problems and first is None:
                if event["stimulus_monotonic_ms"] < previous_trial_end:
                    problems = ["overlapping_trials"]
                else:
                    first_by_trial[trial] = (event, accepted)
                    previous_trial_end = (event["response_monotonic_ms"] if accepted
                                          else event["stimulus_monotonic_ms"])
            if not problems:
                if answered is not None:
                    previous_response = answered
                counts[computed] += 1
                if computed == "correct":
                    correct_rts.append(rt)
        issues.extend({"code": code, "event_id": event_id} for code in problems)
    if issues:
        return finish()

    result["event_counts"] = counts
    result["events_verified"] = True
    if not completed or session.get("interruption_reasons"):
        if any(session.get(field) is not None for field in SCORE_FIELDS):
            issues.append({"code": "score_claim_for_unfinished_session"})
            result["events_verified"] = False
        return finish()

    correct = counts["correct"]
    accepted = correct + counts["incorrect"]
    summary = {
        "accepted_responses": accepted,
        "correct_count": correct,
        "accuracy_percent": 100 * correct / accepted if accepted else None,
        "median_correct_rt_ms": median(correct_rts) if correct_rts else None,
        "incorrect_count": counts["incorrect"],
    }
    stored_summary = any(session.get(field) is not None for field in SCORE_FIELDS)
    if stored_summary:
        for field in SCORE_FIELDS:
            claim, actual = session.get(field), summary[field]
            matches = _same_number(claim, actual, rt=field == "median_correct_rt_ms")
            if field in ("accepted_responses", "correct_count"):
                matches = type(claim) is int and claim == actual
            if not matches:
                issues.append({"code": "stored_summary_mismatch", "field": field})
    if issues:
        result["events_verified"] = False
    finish()
    if not issues and result["information_status"]["status"] == "valid":
        result["summary"] = summary
        result["score_status"] = "practice_only" if session["is_practice"] else "scored"
    return result
