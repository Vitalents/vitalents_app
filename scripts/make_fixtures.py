#!/usr/bin/env python3
"""Stand-in scenario fixtures S2-S5 and the scenario index (FR-SIM-02, S-07 stand-in).

Usage: python3 scripts/make_fixtures.py

Writes app/public/data/fixtures/S2.json ... S5.json and index.json. S1.json is left as is
(S5 reuses it). All values are SIMULATED and plainly invented for the demo; Shaimaa's simulator
replaces these files. Every Decode session written here carries its decode_response_event rows,
accuracy_percent is stored unrounded and start/end UTC match elapsed_monotonic_ms exactly, so
science/status.py can verify them.
"""
import copy
import datetime
import json
import pathlib
import random
import statistics
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from science.contract_logic import build_reference  # noqa: E402
OUT = ROOT / "app/public/data/fixtures"
V = "1.0"
T = "2026-11-14T06:00:00Z"   # fixture creation time
DAY27 = datetime.date(2026, 11, 14)
WINDOW = 90_000
BANNER = "SIMULATED DATA"
CLOCK = "UTC on a fictional mission calendar (day 27 = 2026-11-14)"


def date(d):
    return (DAY27 + datetime.timedelta(days=d - 27)).isoformat()


class Builder:
    """Collects records for one subject in one bundle."""

    def __init__(self, subject, tag, seed):
        self.subject = subject
        self.tag = tag          # short key used in record IDs, e.g. "c2"
        self.rng = random.Random(seed)
        self.b = {}

    def add(self, entity, rec):
        # Persistence follows the captured observation; the fixture generation clock
        # must not make a final reading or a share appear before its source existed.
        if rec.get("created_at_utc") == T:
            at = next((rec.get(k) for k in ("end_at_utc", "submitted_at_utc", "observed_at_utc",
                                           "opened_at_utc", "prepared_at_utc", "permission_time_utc", "occurred_at_utc")
                       if rec.get(k)), None)
            if at:
                rec["created_at_utc"] = at
            elif entity == "sleep_record":
                rec["created_at_utc"] = f"{rec['observation_date']}T06:00:00Z"
            elif entity in ("finding", "action", "daily_review"):
                rec["created_at_utc"] = f"{date(27)}T08:00:00Z"
            elif entity == "information_status":
                source = next((r for rows in self.b.values() for r in rows
                               if rec.get("record_ref") in (r.get(f"{kind}_id") for kind in self.b)), None)
                if source:
                    rec["created_at_utc"] = source["created_at_utc"]
        self.b.setdefault(entity, []).append(rec)
        return rec

    def base(self, ent, rid, origin="simulated_mission"):
        return {f"{ent}_id": rid, "schema_version": V, "data_origin": origin, "created_at_utc": T,
                "subject_id": self.subject, "is_simulated": True}

    def rid(self, ent, key):
        return f"sim:{ent}:{self.tag}-{key}"

    def info(self, ref, status, reasons=(), eligible=True, key=None):
        return self.add("information_status", self.base("information_status", self.rid("information_status", key or ref.split(":")[-1]),
                                                        "application_generated") | {
            "record_ref": ref, "status": status, "reason_codes": list(reasons), "source_known": True,
            "unit_verified": True, "measurement_time_known": True, "method_consistent": True,
            "reference_eligible": eligible, "ruleset_version": "status-1.0"})

    def profile(self, label):
        self.add("subject_profile", {"subject_profile_id": self.subject, "schema_version": V,
                                     "data_origin": "simulated_mission", "created_at_utc": T,
                                     "subject_mode": "mission_simulation", "crew_label": label,
                                     "mission_phase": "during", "mission_profile_version": "demo-1",
                                     "timezone_basis": "mission_defined", "preferred_language": "en"})

    def sleep(self, d, hours):
        sid = self.rid("sleep_record", f"d{d:02d}")
        self.add("sleep_record", self.base("sleep_record", sid) | {
            "observation_date": date(d), "recorded_interval_ms": round(hours * 3_600_000),
            "recorded_interval_hours": hours, "minutes_asleep": round(hours * 60 * 0.92),
            "minutes_awake": round(hours * 60 * 0.08), "sleep_metric_method": "simulated wrist estimate"})
        self.info(sid, "valid", key=f"sl-d{d:02d}")
        return sid

    def pulse(self, d, bpm):
        mid = self.rid("measurement", f"hr-d{d:02d}")
        self.add("measurement", self.base("measurement", mid) | {
            "metric_code": "hr_resting_bpm", "value": float(bpm), "unit": "bpm", "observation_date": date(d),
            "observed_at_utc": f"{date(d)}T06:10:00Z", "capture_method": "simulated wrist PPG",
            "source_metric_granularity": "daily", "quality_record_id": self.rid("information_status", f"hr-d{d:02d}")})
        self.info(mid, "valid", key=f"hr-d{d:02d}")
        return mid

    def alertness(self, d, rating, mood="fine"):
        return self.add("self_report", self.base("self_report", self.rid("self_report", f"alert-d{d:02d}"), "application_generated") | {
            "report_kind": "daily_check_alertness", "report_date": date(d), "submitted_at_utc": f"{date(d)}T07:28:00Z",
            "alertness_rating": rating, "mood_code": mood})["self_report_id"]

    def decode(self, d, correct, incorrect=1, interrupted_at_ms=None, eligible=True):
        """A simulated session with its full event ledger.

        Completed: trials run through the 90 s window; the trial open at 90 000 ms is `missed`.
        Interrupted: trials stop at `interrupted_at_ms`; the open trial is `interrupted`.
        """
        sid = self.rid("decode_session", f"d{d:02d}")
        end_ms = interrupted_at_ms if interrupted_at_ms is not None else WINDOW
        answers = ["correct"] * correct + ["incorrect"] * incorrect
        self.rng.shuffle(answers)
        # Spread the answered trials across the window, then one open trial at the end.
        budget = end_ms - 400
        gaps = [self.rng.uniform(0.85, 1.15) for _ in answers]
        scale = budget / sum(gaps)
        t, last_symbol, rts, events = 0, None, [], []
        for i, ans in enumerate(answers, 1):
            step = int(gaps[i - 1] * scale)
            rt = max(400, step - 150)
            symbol = self.rng.choice([s for s in range(1, 10) if s != last_symbol])
            last_symbol = symbol
            cd = (symbol * 7 + d) % 9 + 1  # key permutation differs per session (seeded by day)
            rd = cd if ans == "correct" else (cd % 9) + 1
            events.append(self._event(sid, d, i, symbol, cd, rd, t, t + rt, ans, True))
            if ans == "correct":
                rts.append(rt)
            t += rt + 150
        symbol = self.rng.choice([s for s in range(1, 10) if s != last_symbol])
        open_state = "interrupted" if interrupted_at_ms is not None else "missed"
        events.append(self._event(sid, d, len(answers) + 1, symbol, (symbol * 7 + d) % 9 + 1, None, min(t, end_ms - 1), None, open_state, False))
        for e in events:
            self.add("decode_response_event", e)
        accepted = correct + incorrect
        start = datetime.datetime(DAY27.year, DAY27.month, DAY27.day, 7, 30) + datetime.timedelta(days=d - 27)
        end = start + datetime.timedelta(milliseconds=end_ms)
        rec = self.base("decode_session", sid) | {
            "protocol_version": "decode-1.0", "key_version": f"seed-{self.tag}-{d}",
            "start_at_utc": start.strftime("%Y-%m-%dT%H:%M:%SZ"), "end_at_utc": end.strftime("%Y-%m-%dT%H:%M:%S.") + f"{end.microsecond // 1000:03d}Z",
            "planned_duration_ms": WINDOW, "elapsed_monotonic_ms": end_ms, "is_practice": False,
            "session_state": "interrupted" if interrupted_at_ms is not None else "completed",
            "interruption_reasons": ["page_hidden"] if interrupted_at_ms is not None else [],
            "input_method": "touch", "app_version": "demo-0.1",
            "accepted_responses": accepted, "correct_count": correct,
            "accuracy_percent": (100 * correct) / accepted if accepted else None,
            "median_correct_rt_ms": float(statistics.median(rts)) if rts else None}
        if interrupted_at_ms is None:
            rec["end_at_utc"] = end.strftime("%Y-%m-%dT%H:%M:%SZ")
        self.add("decode_session", rec)
        for event in events:
            event["created_at_utc"] = rec["end_at_utc"]
        if interrupted_at_ms is not None:
            self.info(sid, "not_comparable", ["interrupted_page_hidden"], False, key=f"dec-d{d:02d}")
        else:
            self.info(sid, "valid", [], eligible, key=f"dec-d{d:02d}")
        return sid

    def _event(self, sid, d, i, symbol, cd, rd, stim, resp, state, accepted):
        return self.base("decode_response_event", f"{sid.replace('decode_session', 'decode_response_event')}-t{i:03d}") | {
            "decode_session_id": sid, "trial_index": i, "symbol_id": f"sym_{symbol}", "correct_digit": cd,
            "response_digit": rd, "stimulus_monotonic_ms": stim, "response_monotonic_ms": resp,
            "response_time_ms": (resp - stim) if resp is not None else None, "response_state": state,
            "is_accepted": accepted, "input_method": "touch", "focus_state": "foreground" if state != "interrupted" else "background"}

    def finding(self, key, kind, sup, expl, lim, owner="astronaut", rule="rule:R-OBS-01", created=None):
        return self.add("finding", self.base("finding", self.rid("finding", key), "application_generated") | {
            "created_at_utc": created or f"{date(27)}T08:00:00Z",
            "review_id": self.rid("daily_review", "d27"), "rule_id": rule, "rule_version": "1.0", "finding_kind": kind,
            "supporting_record_ids": sup, "explanation": expl, "limitations": lim, "owner_role": owner})["finding_id"]

    def action(self, key, fid, cat, reason, text, src, owner, status, due="2026-11-15T07:00:00Z", created=None):
        return self.add("action", self.base("action", self.rid("action", key), "application_generated") | {
            "created_at_utc": created or f"{date(27)}T08:00:00Z",
            "finding_id": fid, "step_category": cat, "reason_text": reason, "action_text": text,
            "source_reference_id": src, "owner_role": owner, "execution_status": status, "follow_up_due_utc": due})["action_id"]

    def follow_up(self, key, aid, status, opened, role, due="2026-11-15T07:00:00Z"):
        return self.add("follow_up", self.base("follow_up", self.rid("follow_up", key), "application_generated") | {
            "action_id": aid, "followup_status": status, "opened_at_utc": opened, "next_review_due_utc": due, "assigned_role": role})["follow_up_id"]

    def schedule(self, key, label, start, end, fixed, kind, extra=None):
        return self.add("mission_schedule", self.base("mission_schedule", self.rid("mission_schedule", key)) | {
            "mission_day": date(27), "clock_reference": "UTC", "activity_label": label, "start_at": start, "end_at": end,
            "is_fixed": fixed, "approval_role": "planner", "item_kind": kind} | (extra or {}))

    def review(self, explanation, *, reading_ids=(), sleep_id=None, decode_id=None, reports=(), findings=(), action=None):
        return self.add("daily_review", self.base("daily_review", self.rid("daily_review", "d27"), "application_generated") | {
            "review_date": date(27), "reading_ids": list(reading_ids), "sleep_record_id": sleep_id, "decode_session_id": decode_id,
            "self_report_ids": list(reports), "finding_ids": list(findings), "selected_action_id": action,
            "review_explanation": explanation})

    def reference(self, target_day, *, frozen=False, freeze_reason=None):
        """Build the stored D-10 reference from its exact historical source IDs."""
        statuses = {r["record_ref"]: r["status"] for r in self.b.get("information_status", [])}
        sessions = sorted(self.b["decode_session"], key=lambda s: s["start_at_utc"])
        history = [{"record_id": s["decode_session_id"], "date": s["start_at_utc"][:10], "value": s["correct_count"],
                    "info_status": statuses.get(s["decode_session_id"]), "is_practice": s["is_practice"], "session_index": i}
                   for i, s in enumerate(sessions, 1)]
        ref = build_reference("decode_correct_count", date(target_day), history,
                              {"lookback_days": 14, "min_valid": 5, "exclude_first_sessions": 2}, False, None)
        rid = self.rid("personal_reference", f"decode-d{target_day}")
        self.add("personal_reference", self.base("personal_reference", rid, "application_generated") | ref | {
            "created_at_utc": f"{date(target_day)}T07:29:00Z", "metric_code": "decode_correct_count",
            "reference_version": "ref-1.0", "unit": "count", "comparison_target_date": date(target_day),
            "method": "Median of valid past sessions in a 14-day window, excluding the first two sessions",
            "eligibility_notes": "Demonstration heuristic using 5 valid sessions in 14 days, not a medical threshold.",
            "frozen": frozen, "freeze_reason": freeze_reason,
        })
        return rid

    def scenario(self, code, seed, outcomes, record_ids):
        return {"simulator_scenario_id": f"sim:scenario:{code}", "schema_version": V, "data_origin": "simulated_mission",
                "created_at_utc": T, "scenario_code": code, "scenario_version": "0.1-standin", "seed": seed,
                "crew_subject_ids": [self.subject], "fixture_record_ids": list(record_ids), "expected_outcomes": outcomes,
                "simulation_banner": BANNER, "scenario_clock_basis": CLOCK}

    def bundle(self, scenario, notes):
        out = {"bundle_version": "1.0", "notes": notes, "simulator_scenario": [scenario]}
        out.update(self.b)
        return out


NOTE = "STAND-IN fixture (scripts/make_fixtures.py) so the demo can switch scenarios. Shaimaa's simulator replaces it. All values are simulated."


def s2():
    """Missing measurement: no sleep record last night, today's Decode interrupted."""
    seed = 202
    b = Builder("sim:crew:c2", "c2", seed)
    b.profile("Crew B (fictional crew member)")
    sleep_h = {20: 7.0, 21: 6.8, 22: 7.2, 23: 6.9, 24: 7.1, 25: 7.0, 26: 6.8}
    hr = {20: 58, 21: 59, 22: 58, 23: 60, 24: 59, 25: 58, 26: 59, 27: 60}
    dec = {20: 44, 21: 46, 22: 45, 23: 47, 24: 46, 25: 45, 26: 46}
    for d in range(20, 28):
        if d in sleep_h:
            b.sleep(d, sleep_h[d])          # day 27 deliberately has NO sleep record (absent, not zero)
        b.pulse(d, hr[d])
        b.alertness(d, 7)
        if d in dec:
            b.decode(d, dec[d], eligible=d > 21)
    dec27 = b.decode(27, 18, interrupted_at_ms=41_000)
    f_sleep = b.finding("missing-sleep-d27", "missing_data", [],
                        "No sleep reading for last night (mission day 27). Nothing is filled in.",
                        "A missing reading says nothing about how the night went.", rule="rule:R-MEAS-02")
    f_dec = b.finding("interrupted-dec-d27", "missing_data", [dec27],
                      "Today's Decode round was interrupted (page hidden after 41 s). It is saved but not comparable.",
                      "An interrupted round is not compared with your reference.", rule="rule:R-MEAS-01")
    a_dec = b.action("repeat-dec-d27", f_dec, "complete_measurement", "Today's Decode round was interrupted.",
                     "Repeat Decode in the same conditions", "lib:cognition-battery", "astronaut", "proposed")
    b.action("sync-sleep-d27", f_sleep, "complete_measurement", "No sleep reading arrived for last night.",
             "Check that the wrist sensor synced", "lib:nasa-standard-measures", "astronaut", "proposed")
    b.review("Recorded: resting pulse, alertness, an interrupted Decode round. Missing: last night's sleep. No health status is inferred from missing data.",
             reading_ids=[b.rid("measurement", "hr-d27")], decode_id=dec27, reports=[b.rid("self_report", "alert-d27")],
             findings=[f_sleep, f_dec], action=a_dec)
    sc = b.scenario("S2", seed, [
        "Sleep for day 27 shows 'No reading'; nothing is filled in or shown as fine",
        "Today's Decode is saved but marked not comparable (interrupted, page hidden)",
        "No health status is invented from missing or interrupted data",
        "Next step offers to complete the measurement (repeat Decode, check sensor sync)"], [dec27, f_sleep, f_dec])
    return b.bundle(sc, NOTE)


def s3():
    """No schedule alternative: short nights, but every evening item is fixed."""
    seed = 303
    b = Builder("sim:crew:c3", "c3", seed)
    b.profile("Crew C (fictional crew member)")
    sleep_h = {13: 7.0, 14: 7.2, 15: 6.9, 16: 7.1, 17: 7.0, 18: 6.8, 19: 7.2, 20: 7.0, 21: 6.9, 22: 7.1, 23: 7.0, 24: 6.8, 25: 6.9, 26: 5.3, 27: 5.5}
    dec = {13: 40, 14: 43, 15: 46, 16: 47, 17: 45, 18: 46, 19: 48, 20: 47, 21: 46, 22: 45, 23: 47, 24: 46, 25: 42, 26: 41}
    ids = {}
    for d in range(13, 28):
        b.sleep(d, sleep_h[d])
        b.pulse(d, 62 + (d % 3))
        b.alertness(d, 7)
        if d in dec:
            ids[d] = b.decode(d, dec[d], eligible=d > 14)
    ref = b.reference(25, frozen=True, freeze_reason="Frozen while the cognition follow-up opened on mission day 25 is open.")
    watch_at = f"{date(25)}T08:00:00Z"
    watch = b.finding("dec-d25", "descriptive_change", [ids[25], ref],
                      "One Decode session was below your personal range (42 vs 45-48).",
                      "One session describes performance on the Decode task.", created=watch_at)
    b.b["finding"][-1]["review_id"] = b.rid("daily_review", "d25")
    watch_action = b.action("dec-d25", watch, "observe", "One Decode session was below the personal range.",
                            "Keep the daily check and watch the next sessions", "lib:cognition-battery", "astronaut", "in_progress", created=watch_at)
    b.follow_up("dec-d25", watch_action, "watching", watch_at, "astronaut")
    f = b.finding("dec-d27", "descriptive_change", [ids[25], ids[26], ref, b.rid("sleep_record", "d26"), b.rid("sleep_record", "d27")],
                  "Two observations: 2 Decode sessions were below your personal range, and the last 2 nights were under 6 hours.",
                  "These happen together; this does not show that one caused the other.", rule="rule:R-PLAN-01")
    a = b.action("rest-d27", f, "observe", "Lower Decode results together with short recorded sleep; a demonstration workflow, not an approved medical plan.",
                 "Review tonight's rest window", "lib:nasa-sleep-risk", "astronaut", "proposed")
    b.schedule("rest-d27", "Rest window", "2026-11-14T23:00:00Z", "2026-11-15T06:00:00Z", True, "rest_window")
    b.schedule("debrief-d27", "Spacewalk debrief", "2026-11-14T22:00:00Z", "2026-11-14T23:30:00Z", True, "task", {"prep_minutes": 0, "travel_minutes": 0})
    b.schedule("groundcall-d27", "Ground support call", "2026-11-14T23:30:00Z", "2026-11-15T00:30:00Z", True, "task", {"prep_minutes": 10, "travel_minutes": 0})
    b.schedule("systems-d27", "Life-support check", "2026-11-14T20:00:00Z", "2026-11-14T22:00:00Z", True, "task", {"prep_minutes": 0, "travel_minutes": 0})
    b.review("Recorded: sleep, resting pulse, alertness. Changed: yesterday's Decode below your range. Missing: today's Decode.",
             reading_ids=[b.rid("measurement", "hr-d27")], sleep_id=b.rid("sleep_record", "d27"), decode_id=ids[26],
             reports=[b.rid("self_report", "alert-d27")], findings=[f], action=a)
    b.add("daily_review", b.base("daily_review", b.rid("daily_review", "d25"), "application_generated") | {
        "created_at_utc": watch_at, "review_date": date(25), "reading_ids": [b.rid("measurement", "hr-d25")],
        "sleep_record_id": b.rid("sleep_record", "d25"), "decode_session_id": ids[25],
        "self_report_ids": [b.rid("self_report", "alert-d25")], "finding_ids": [watch], "selected_action_id": watch_action,
        "review_explanation": "A first Decode observation below the personal range opens a descriptive follow-up.",
    })
    sc = b.scenario("S3", seed, [
        "Rest-window review shows every evening item as fixed",
        "The screen says: No valid alternative within the current constraints",
        "The system never moves a fixed task itself; any change goes to the planner for approval",
        "Rest opportunity tonight is shown as calculated (5 h 30 min), never as a promise of sleep"], [f, a])
    return b.bundle(sc, NOTE)


def s4():
    """A reported symptom needing review, with a good Decode result."""
    seed = 404
    b = Builder("sim:crew:c4", "c4", seed)
    b.profile("Crew D (fictional crew member)")
    for d in range(20, 28):
        b.sleep(d, [7.1, 7.0, 6.9, 7.2, 7.0, 7.1, 6.9, 7.0][d - 20])
        b.pulse(d, [60, 61, 60, 59, 61, 60, 60, 62][d - 20])
        b.alertness(d, 7)
    for d, c in {20: 45, 21: 47, 22: 46, 23: 47, 24: 46, 25: 48, 26: 47, 27: 47}.items():
        dec27 = b.decode(d, c, eligible=d > 21)
    ref = b.reference(27)
    sym = b.add("self_report", b.base("self_report", b.rid("self_report", "symptom-d27"), "application_generated") | {
        "report_kind": "symptom", "report_date": date(27), "submitted_at_utc": "2026-11-14T07:10:00Z",
        # TODO(question: contract needs symptom_onset_date and symptom_severity fields) - kept in the text for now.
        "symptom_text": "Onset 2026-11-14 · Severity: moderate · Headache and feeling hot since waking; felt warm to the touch (no thermometer reading taken)"})["self_report_id"]
    f = b.finding("symptom-d27", "review_request", [sym], "A reported symptom today: headache and feeling hot since waking.",
                  "A self-report with no temperature reading. The medical team decides what it means; a good Decode result does not change this.",
                  owner="medical", rule="rule:R-REV-02", created="2026-11-14T07:11:00Z")
    a = b.action("review-d27", f, "request_review", "A reported symptom needs a specialist's view.",
                 "Request a review by the medical team", "lib:nasa-medops", "medical", "accepted", due="2026-11-14T12:00:00Z", created="2026-11-14T07:11:00Z")
    b.follow_up("symptom-d27", a, "review_requested", "2026-11-14T07:11:00Z", "medical", due="2026-11-14T12:00:00Z")
    perm = b.rid("sharing_permission", "consult-d27")
    pkg = b.add("share_package", b.base("share_package", b.rid("share_package", "consult-d27"), "application_generated") | {
        "recipient_role": "medical", "previewed_record_ids": [sym, f, a, dec27, ref, b.rid("measurement", "hr-d27"), b.rid("sleep_record", "d27")],
        "excluded_field_codes": ["self_report.private_note"],
        "summary_text": "Sequence: symptom reported 07:10 (headache, feeling hot since waking; no thermometer reading); medical review requested 07:11; Decode completed 07:31:30. Measurements: resting pulse 62 bpm, recorded sleep 7.0 h, Decode 47 correct answers within the personal range 46-48 from 5 prior sessions (reference ref-1.0). The Decode result does not close the symptom review. Actions tried: none yet. Question: please review the symptom.",
        "permission_record_id": perm, "package_version": 1, "prepared_at_utc": "2026-11-14T07:35:00Z"})["share_package_id"]
    b.add("sharing_permission", b.base("sharing_permission", perm, "application_generated") | {
        "actor_role": "astronaut", "resource_kind": "share_package", "resource_id": pkg, "permission_kind": "share", "allowed": True,
        "policy_version": "share-0.1", "consent_basis": "Previewed and confirmed by the astronaut", "permission_time_utc": "2026-11-14T07:35:05Z"})
    b.review("Recorded: sleep, resting pulse, alertness, Decode, a reported symptom. Changed: a symptom needing review. A good Decode result does not close or delay the review.",
             reading_ids=[b.rid("measurement", "hr-d27")], sleep_id=b.rid("sleep_record", "d27"), decode_id=dec27,
             reports=[sym, b.rid("self_report", "alert-d27")], findings=[f], action=a)
    sc = b.scenario("S4", seed, [
        "Follow-up opens as review_requested immediately, assigned to the medical team",
        "A consult summary is prepared for the medical team (share preview, private notes excluded)",
        "Today's Decode is within the usual range and is shown, but never delays or hides the review",
        "The symptom stays listed; no temperature value is invented"], [sym, f, a, pkg])
    return b.bundle(sc, NOTE)


def s5():
    """Communication delay: Fahim's day 27 with a prepared summary waiting to send (24 min one way)."""
    seed = 505
    s1 = json.loads((OUT / "S1.json").read_text())
    bundle = {k: copy.deepcopy(v) for k, v in s1.items() if k not in ("simulator_scenario", "notes")}
    b = Builder("sim:crew:fahim", "s5", seed)
    perm = "sim:sharing_permission:s5-consult-d27"
    pkg = "sim:share_package:s5-consult-d27"
    b.add("share_package", b.base("share_package", pkg, "application_generated") | {
        "recipient_role": "medical",
        "previewed_record_ids": ["sim:finding:dec-d27", "sim:decode_session:d25", "sim:decode_session:d26", "sim:personal_reference:decode-d25",
                                 "sim:sleep_record:d25", "sim:sleep_record:d26", "sim:sleep_record:d27", "sim:follow_up:pain-d20", "sim:action:rest-d27"],
        "excluded_field_codes": ["self_report.private_note"],
        "summary_text": "Sequence: Decode below personal range on days 25-26; recorded sleep under 6 h on the last 3 nights; lower back pain follow-up still open. Actions tried: watching since day 25; rest-window review proposed. Question: any change to the plan?",
        "permission_record_id": perm, "package_version": 1, "prepared_at_utc": "2026-11-14T08:05:00Z"})
    b.add("sharing_permission", b.base("sharing_permission", perm, "application_generated") | {
        "actor_role": "astronaut", "resource_kind": "share_package", "resource_id": pkg, "permission_kind": "share", "allowed": True,
        "policy_version": "share-0.1", "consent_basis": "Previewed and confirmed by the astronaut", "permission_time_utc": "2026-11-14T08:05:00Z"})
    b.add("sync_event", b.base("sync_event", "sim:sync_event:s5-consult-d27-saved", "application_generated") | {
        "share_package_id": pkg, "sync_status": "saved_locally", "occurred_at_utc": "2026-11-14T08:05:00Z",
        "message_id": "msg-s5-consult-d27", "connection_available": False, "retry_number": 0})
    for k, v in b.b.items():
        bundle.setdefault(k, []).extend(v)
    sc = b.scenario("S5", seed, [
        "The consult summary starts as saved locally while the link is down",
        "With the link up it moves queued -> sent -> delivered, each state shown with its time; one-way delay 24 min",
        "'Reviewed' appears only after the medical team marks it reviewed",
        "Sending again never creates a duplicate; the app keeps working while the summary waits"], [pkg, perm])
    sc["crew_subject_ids"] = ["sim:crew:fahim"]
    return {"bundle_version": "1.0", "notes": NOTE + " S5 reuses the S1 history for Fahim; link delay setting: 24 min one way.",
            "simulator_scenario": [sc], **bundle}


INDEX = [
    ("S1", "Performance change", "sim:crew:fahim",
     "Fahim: Decode below his personal range after short nights; a rest-window step and the open pain follow-up.", "S1.json"),
    ("S2", "Missing measurement", "sim:crew:c2",
     "Crew B: no sleep reading for last night and an interrupted Decode round; nothing is invented.", "S2.json"),
    ("S3", "No schedule alternative", "sim:crew:c3",
     "Crew C: short nights, but every evening task is fixed; the system says no valid alternative exists.", "S3.json"),
    ("S4", "Presentation needing review", "sim:crew:c4",
     "Crew D: a reported symptom opens a review right away, even with a good Decode result.", "S4.json"),
    ("S5", "Communication delay", "sim:crew:fahim",
     "Fahim: a consult summary waits to send and moves through each delivery state with a 24-minute delay.", "S5.json"),
]


def main():
    for code, fn in (("S2", s2), ("S3", s3), ("S4", s4), ("S5", s5)):
        bundle = fn()
        (OUT / f"{code}.json").write_text(json.dumps(bundle, indent=2) + "\n")
        print(code, {k: len(v) for k, v in bundle.items() if isinstance(v, list)})
    index = {"index_version": "1.0", "scenarios": [
        {"code": c, "title": t, "subject_id": s, "description": d, "file": f} for c, t, s, d, f in INDEX]}
    (OUT / "index.json").write_text(json.dumps(index, indent=2) + "\n")
    print("index", len(INDEX))


if __name__ == "__main__":
    main()
