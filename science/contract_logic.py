"""Python versions of the contract's shared functions (docs/CONTRACT_P0.md section 4).

These reproduce every file in contracts/vectors/ (checked by science/tests/test_contract_logic.py and
reported by science/validate.py as `golden_vectors_python`). They follow the contract rules and the
app's TypeScript engine (app/src/engine/decode.ts, reference.ts, schedule.ts) line by line:

  score_decode          contract D-9
  build_reference       contract D-10 (demonstration heuristic, not a medical threshold)
  compare_to_reference  contract D-10 (descriptive position only)
  rest_opportunity      SRS section 10 (half-open intervals, prep and travel included)

science/validate.py uses them for the Python side of the vectors. They mirror the contract and the
app; they do not replace Shaimaa's science/reference.py and science/schedule.py, whose open
differences are listed in docs/reference/INTEGRATION_NOTES.md.
"""

import math
import statistics
from datetime import date, datetime, timedelta, timezone

MINUTE_MS = 60_000


# --------------------------------------------------------------------------- D-9 scoring

def score_decode(planned_duration_ms, session_state, events, interrupted_at_ms=None):
    """Response states and summaries from raw trial events (D-9).

    Accepted = correct + incorrect. Missed, late, duplicate and interrupted are never accepted.
    accuracy_percent is unrounded and null when nothing was accepted.
    One addition to the TypeScript port: in an interrupted session (interrupted_at_ms given), an
    unanswered trial is the one still open at the cut, so it is `interrupted` rather than `missed`.
    Neither is accepted, so the summaries are identical either way.
    """
    cut = interrupted_at_ms
    answered = set()
    rts = []
    states = []
    for e in events:
        resp, stim = e["response_monotonic_ms"], e["stimulus_monotonic_ms"]
        if cut is not None and (resp is None or resp >= cut):
            states.append("interrupted")
        elif resp is None or e["response_digit"] is None:
            states.append("missed")
        elif resp > planned_duration_ms:
            states.append("late")
        elif e["trial_index"] in answered:
            states.append("duplicate")
        else:
            answered.add(e["trial_index"])
            if e["response_digit"] == e["correct_digit"]:
                rts.append(resp - stim)
                states.append("correct")
            else:
                states.append("incorrect")
    accepted = sum(s in ("correct", "incorrect") for s in states)
    correct = states.count("correct")
    return {
        "response_states": states,
        "accepted_responses": accepted,
        "correct_count": correct,
        "accuracy_percent": (100 * correct) / accepted if accepted else None,
        "median_correct_rt_ms": float(statistics.median(rts)) if rts else None,
    }


# --------------------------------------------------------------------------- D-10 reference

def _day(s):
    return date.fromisoformat(s[:10])


def _median(values):
    s = sorted(values)
    m = len(s) // 2
    return s[m] if len(s) % 2 else (s[m - 1] + s[m]) / 2


def build_reference(metric_code, target_date, history, params, open_follow_up, previous_reference):
    """Personal reference v1 (D-10): valid, non-practice values strictly before target_date,
    within lookback_days, excluding the first `exclude_first_sessions` sessions; median and min-max.
    While a follow-up on the same indicator is open, the previous reference is returned unchanged
    with frozen: true."""
    if open_follow_up and previous_reference:
        return {**previous_reference, "frozen": True}
    t = _day(target_date)
    lo = t - timedelta(days=params["lookback_days"])
    eligible = [
        h for h in history
        if h["info_status"] == "valid" and not h["is_practice"]
        and h["session_index"] > params["exclude_first_sessions"]
        and h["value"] is not None and lo <= _day(h["date"]) < t
    ]
    values = [h["value"] for h in eligible]
    n = len(values)
    return {
        "reference_status": "not_built" if n == 0 else "provisional" if n < params["min_valid"] else "usable_for_question",
        "reference_value": _median(values) if n else None,
        "range_low": min(values) if n else None,
        "range_high": max(values) if n else None,
        "valid_record_count": n,
        "start_date": lo.isoformat(),
        "end_date": (t - timedelta(days=1)).isoformat(),
        "frozen": False,
        "source_record_ids": [h["record_id"] for h in eligible],
    }


def _round3(x):
    # JavaScript Math.round (half toward +infinity), as in app/src/engine/reference.ts.
    return math.floor(x * 1000 + 0.5) / 1000


def compare_to_reference(value, reference):
    """Descriptive position of a value against a reference (D-10). Never a health judgement."""
    r = reference
    if (value is None or r.get("reference_status") != "usable_for_question" or r.get("reference_value") is None
            or r.get("range_low") is None or r.get("range_high") is None):
        return {"absolute_change": None, "relative_change": None, "position": "not_comparable"}
    ab = value - r["reference_value"]
    rel = _round3(ab / r["reference_value"]) if r["reference_value"] != 0 else None
    pos = "below_range" if value < r["range_low"] else "above_range" if value > r["range_high"] else "within_range"
    return {"absolute_change": ab, "relative_change": rel, "position": pos}


# --------------------------------------------------------------------------- SRS 10 schedule

def _ms(iso):
    if not iso:
        return None
    try:
        t = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except ValueError:
        return None
    if t.tzinfo is None:
        return None
    return int(round(t.timestamp() * 1000))


def _iso(ms):
    t = datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
    return t.strftime("%Y-%m-%dT%H:%M:%S") + (f".{t.microsecond // 1000:03d}Z" if t.microsecond else "Z")


def _blocked(it):
    return (it["start"] - (it["prep"] + it["travel"]) * MINUTE_MS, it["end"])


def _union(intervals):
    out = []
    for a, b in sorted((iv for iv in intervals if iv[1] > iv[0]), key=lambda iv: iv[0]):
        if out and a <= out[-1][1]:
            out[-1][1] = max(out[-1][1], b)
        else:
            out.append([a, b])
    return out


def free_minutes(window, blocked):
    """[longest continuous, total] free minutes inside the window."""
    clipped = _union([(max(a, window[0]), min(b, window[1])) for a, b in blocked])
    cursor, longest, total = window[0], 0, 0
    for a, b in clipped:
        if a > cursor:
            longest = max(longest, a - cursor)
            total += a - cursor
        cursor = max(cursor, b)
    if window[1] > cursor:
        longest = max(longest, window[1] - cursor)
        total += window[1] - cursor
    return [_js_round(longest / MINUTE_MS), _js_round(total / MINUTE_MS)]


def _js_round(x):
    return math.floor(x + 0.5)


def _overlaps(a, b):
    return a[0] < b[1] and b[0] < a[1]


def rest_opportunity(rest_window, items, step_minutes=15):
    """Longest continuous rest inside the window and the best move of up to two movable tasks.
    An unknown window or an unreadable task is not_computable (never zero)."""
    step = (step_minutes if step_minutes is not None else 15) * MINUTE_MS
    none = {"status": "not_computable", "current_minutes": None, "best_minutes": None,
            "current_total_minutes": None, "best_total_minutes": None, "changes": []}
    ws = _ms((rest_window or {}).get("start"))
    we = _ms((rest_window or {}).get("end"))
    if ws is None or we is None or we <= ws:
        return none
    parsed = []
    for it in items:
        s, e = _ms(it.get("start")), _ms(it.get("end"))
        if s is None or e is None or e <= s:
            return none
        parsed.append({"id": it["item_id"], "start": s, "end": e, "prep": it.get("prep_minutes") or 0,
                       "travel": it.get("travel_minutes") or 0, "fixed": it["is_fixed"],
                       "earliest": _ms(it.get("movable_earliest_start")), "latest": _ms(it.get("movable_latest_end"))})
    window = (ws, we)
    cur, cur_total = free_minutes(window, [_blocked(p) for p in parsed])
    movable = [p for p in parsed if not p["fixed"] and p["earliest"] is not None and p["latest"] is not None
               and _overlaps(_blocked(p), window)]
    original = {p["id"]: p["start"] for p in parsed}

    def evaluate(moves):
        placed = [{**p, **moves.get(p["id"], {})} for p in parsed]
        for i in range(len(placed)):
            for j in range(i + 1, len(placed)):
                if (placed[i]["id"] in moves or placed[j]["id"] in moves) and _overlaps(_blocked(placed[i]), _blocked(placed[j])):
                    return None
        longest, total = free_minutes(window, [_blocked(p) for p in placed])
        changes = [{"id": k, **v} for k, v in moves.items()]
        shift = sum(abs(c["start"] - original[c["id"]]) for c in changes)
        return {"changes": changes, "longest": longest, "total": total, "shift": shift}

    options = {}
    for it in movable:
        dur = it["end"] - it["start"]
        lst = []
        s = it["earliest"]
        while s + dur <= it["latest"]:
            if s != it["start"] and s - (it["prep"] + it["travel"]) * MINUTE_MS >= it["earliest"]:
                lst.append({"start": s, "end": s + dur})
            s += step
        options[it["id"]] = lst

    candidates = []
    for it in movable:
        for p in options[it["id"]]:
            c = evaluate({it["id"]: p})
            if c:
                candidates.append(c)
    for a in range(len(movable)):
        for b in range(a + 1, len(movable)):
            for pa in options[movable[a]["id"]]:
                for pb in options[movable[b]["id"]]:
                    c = evaluate({movable[a]["id"]: pa, movable[b]["id"]: pb})
                    if c:
                        candidates.append(c)
    candidates.sort(key=lambda c: (-c["longest"], -c["total"], len(c["changes"]), c["shift"], c["changes"][0]["start"]))
    best = candidates[0] if candidates else None
    if best is None or best["longest"] <= cur:
        return {"status": "no_valid_alternative", "current_minutes": cur, "best_minutes": cur,
                "current_total_minutes": cur_total, "best_total_minutes": cur_total, "changes": []}
    return {"status": "improved", "current_minutes": cur, "best_minutes": best["longest"],
            "current_total_minutes": cur_total, "best_total_minutes": best["total"],
            "changes": [{"item_id": c["id"], "new_start": _iso(c["start"]), "new_end": _iso(c["end"])} for c in best["changes"]]}


FUNCTIONS = {
    "score_decode": score_decode,
    "build_reference": build_reference,
    "compare_to_reference": compare_to_reference,
    "rest_opportunity": rest_opportunity,
}
