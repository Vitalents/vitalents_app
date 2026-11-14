"""Synthetic schedule arithmetic and S3 constraint/approval tests."""

from copy import deepcopy
from dataclasses import replace
import json
import unittest

from science import schedule
from test_rules import CASES, SUBJECT

DEMO = CASES["schedule"]
CLOCK = DEMO["clock_reference"]
ROW = DEMO["movable"]
RESOURCE = ROW["resource_constraints"][0]
TASK = ROW["mission_schedule_id"]


def interval(start, end, clock=CLOCK):
    return schedule.Interval(start, end, clock)


HORIZON = interval(*DEMO["horizon"])
WINDOW = interval(*DEMO["rest_window"])
EARLIER = interval(*DEMO["earlier"])


def proposal(*moves, ref="synthetic:earlier"):
    return schedule.Alternative(ref, moves)


EARLY_PROPOSAL = proposal(schedule.Move(TASK, EARLIER))


def compare(rows=(ROW,), alternatives=(EARLY_PROPOSAL,), **changes):
    constraints = {"subject_id": SUBJECT, "clock_reference": CLOCK, "clock_basis": "UTC",
                   "horizon": HORIZON, "rest_window": WINDOW,
                   "resource_availability": {RESOURCE: [HORIZON]}, **changes}
    return schedule.compare(rows, alternatives=alternatives, **constraints)


class ScheduleTests(unittest.TestCase):
    def test_midnight_example_improves_rest_opportunity_from_six_to_seven_hours(self):
        original = deepcopy(ROW)
        result = compare()
        earlier = result["alternatives"][0]
        self.assertEqual(result["status"], "feasible_alternatives")
        self.assertEqual(result["quantity"], "calculated_rest_opportunity")
        self.assertEqual(result["baseline"]["rest_opportunity_minutes"], 360)
        self.assertEqual(earlier["rest_opportunity_minutes"], 420)
        self.assertEqual(earlier["rest_opportunity_delta_minutes"], 60)
        self.assertEqual(earlier["longest_rest_opportunity_minutes"], 420)
        self.assertEqual(earlier["alternative_status"], "pending_approval")
        self.assertFalse(earlier["approval_satisfied"])
        self.assertEqual(ROW, original)
        json.dumps(result, allow_nan=False)

    def test_s3_fixed_task_blocks_move_and_fixed_briefing_cannot_move(self):
        blocker = {**ROW, "mission_schedule_id": "synthetic:fixed", "is_fixed": True,
                   "start_at": EARLIER.start_at, "end_at": EARLIER.end_at}
        move_fixed = proposal(schedule.Move(blocker["mission_schedule_id"],
                              interval("2026-11-14T21:00:00Z", "2026-11-14T22:00:00Z")),
                              ref="synthetic:move-fixed")
        result = compare((ROW, blocker), (EARLY_PROPOSAL, move_fixed))
        self.assertEqual(result["status"], "no_valid_alternative")
        self.assertEqual(result["limitations"], [
            {"code": "no_valid_alternative", "text": "No valid alternative."}])
        self.assertEqual(result["baseline"]["rest_opportunity_minutes"], 360)
        self.assertEqual([outcome["issues"][0]["code"] for outcome in result["alternatives"]],
                         ["crew_task_overlap", "fixed_activity"])
        self.assertTrue(all(x["alternative_status"] == "rejected" for x in result["alternatives"]))

    def test_s3_empty_candidate_set_is_explicit(self):
        self.assertEqual(compare(alternatives=[])["status"], "no_valid_alternative")

    def test_buffers_reduce_opportunity_and_conflict_before_task_start(self):
        activity = {**ROW, "prep_minutes": 20, "travel_minutes": 10}
        result = compare([activity])
        self.assertEqual(result["baseline"]["rest_opportunity_minutes"], 350)
        self.assertEqual(result["alternatives"][0]["rest_opportunity_minutes"], 410)
        blocker = {**ROW, "mission_schedule_id": "synthetic:fixed",
                   "start_at": "2026-11-14T21:00:00Z", "end_at": "2026-11-14T21:50:00Z",
                   "is_fixed": True}
        result = compare([activity, blocker])
        self.assertEqual(result["status"], "no_valid_alternative")
        self.assertEqual(result["alternatives"][0]["issues"][0]["code"], "crew_task_overlap")

    def test_fragmented_rest_reports_total_and_longest(self):
        activity = {**ROW, "start_at": "2026-11-15T01:00:00Z", "end_at": "2026-11-15T02:00:00Z"}
        baseline = compare([activity])["baseline"]
        self.assertEqual(baseline["rest_opportunity_minutes"], 360)
        self.assertEqual(baseline["longest_rest_opportunity_minutes"], 240)
        self.assertEqual(len(baseline["rest_intervals"]), 2)

    def test_resource_calendar_must_cover_buffers_and_can_block_all_alternatives(self):
        row = {**ROW, "travel_minutes": 10}
        available = [interval("2026-11-14T23:00:00Z", "2026-11-15T00:10:00Z"),
                     interval("2026-11-15T01:00:00Z", "2026-11-15T02:00:00Z")]
        later = proposal(schedule.Move(TASK, available[1]))
        result = compare([row], [later], resource_availability={RESOURCE: available})
        self.assertEqual(result["status"], "no_valid_alternative")
        self.assertEqual(result["alternatives"][0]["issues"][0]["code"], "resource_unavailable")

    def test_missing_resource_calendar_is_distinct_from_unavailability(self):
        missing = compare(resource_availability={})
        self.assertEqual(missing["status"], "insufficient_constraints")
        self.assertIsNone(missing["baseline"])
        self.assertEqual(missing["limitations"][0]["code"], "missing_resource_calendar")
        known = compare(resource_availability={RESOURCE: []})
        self.assertEqual(known["status"], "invalid_constraints")
        self.assertEqual(known["limitations"][0]["code"], "resource_unavailable")

    def test_unknown_buffer_or_resource_metadata_is_not_assumed_zero(self):
        for field in ("prep_minutes", "travel_minutes", "resource_constraints", "approval_role"):
            with self.subTest(field=field):
                result = compare([{**ROW, field: None}])
                self.assertEqual(result["status"], "insufficient_constraints")
                self.assertEqual(result["limitations"][0]["code"], "missing_activity_constraints")

    def test_bad_intervals_need_dated_ordered_endpoints(self):
        for end in ("00:00", "2026-11-14T00:00:00Z", ROW["start_at"],
                    "2026-11-15T00:00:00", "2026-11-15T00:00:00+02:00"):
            with self.subTest(end=end):
                result = compare([{**ROW, "end_at": end}])
                self.assertEqual(result["status"], "invalid_constraints")
                self.assertEqual(result["limitations"][0]["code"], "invalid_interval")

    def test_overlapping_baseline_is_invalid_and_touching_intervals_are_allowed(self):
        duplicate = {**ROW, "mission_schedule_id": "synthetic:other"}
        self.assertEqual(compare([ROW, duplicate])["limitations"][0]["code"], "crew_task_overlap")
        touching = {**duplicate, "start_at": EARLIER.start_at, "end_at": EARLIER.end_at}
        self.assertEqual(compare([ROW, touching])["baseline"]["rest_opportunity_minutes"], 360)

    def test_fixed_rate_mission_clock_carries_dates_and_requires_same_clock(self):
        clock = "synthetic:mission-clock-a"
        row = {**ROW, "clock_reference": clock, "start_at": ROW["start_at"][:-1],
               "end_at": ROW["end_at"][:-1], "resource_constraints": []}
        hour = interval("2026-11-15T00:00:00", "2026-11-15T01:00:00", clock)
        opts = {"clock_reference": clock, "clock_basis": "fixed_rate_mission_clock",
                "horizon": interval(*(value[:-1] for value in DEMO["horizon"]), clock),
                "rest_window": interval(*(value[:-1] for value in DEMO["rest_window"]), clock),
                "resource_availability": {}}
        first = compare([row], [proposal(schedule.Move(TASK, hour))], **opts)
        self.assertEqual(first["alternatives"][0]["rest_opportunity_minutes"], 360)
        self.assertEqual(first["alternatives"][0]["longest_rest_opportunity_minutes"], 300)
        wrong_clock = replace(hour, clock_reference="synthetic:mission-clock-b")
        second = compare([row], [proposal(schedule.Move(TASK, wrong_clock))], **opts)
        self.assertEqual(second["alternatives"][0]["issues"][0]["code"], "clock_reference_mismatch")

    def test_approval_is_role_and_snapshot_bound(self):
        original = compare()["alternatives"][0]
        key = original["proposal_key"]
        wrong = schedule.Approval("synthetic:wrong", key, "medical")
        right = schedule.Approval("synthetic:right", key, "planner")
        self.assertFalse(compare(approvals=[wrong])["alternatives"][0]["approval_satisfied"])
        allowed = compare(approvals=[right])["alternatives"][0]
        self.assertEqual(allowed["alternative_status"], "valid")
        self.assertEqual(allowed["approval_records"], [
            {"role": "planner", "approval_record_id": "synthetic:right"}])
        changed = compare([{**ROW, "prep_minutes": 10}], approvals=[right])["alternatives"][0]
        self.assertNotEqual(changed["proposal_key"], key)
        self.assertFalse(changed["approval_satisfied"])

    def test_multi_move_requires_both_roles(self):
        check = {**ROW, "mission_schedule_id": "synthetic:check", "approval_role": "medical",
                 "start_at": "2026-11-15T01:00:00Z", "end_at": "2026-11-15T02:00:00Z"}
        moved_check = interval("2026-11-14T21:00:00Z", "2026-11-14T22:00:00Z")
        moves = proposal(schedule.Move(TASK, EARLIER),
                         schedule.Move(check["mission_schedule_id"], moved_check))
        first = compare([ROW, check], [moves])["alternatives"][0]
        self.assertEqual(first["required_approval_roles"], ["medical", "planner"])
        med = schedule.Approval("synthetic:med", first["proposal_key"], "medical")
        planner = schedule.Approval("synthetic:planner", first["proposal_key"], "planner")
        second = compare([ROW, check], [moves], approvals=[planner])["alternatives"][0]
        self.assertEqual(second["pending_approval_roles"], ["medical"])
        final = compare([ROW, check], [moves], approvals=iter([med, planner]))["alternatives"][0]
        self.assertTrue(final["approval_satisfied"])

    def test_invalid_moves_do_not_hide_feasible_alternative(self):
        longer = replace(EARLIER, end_at="2026-11-14T23:30:00Z")
        invalid = proposal(schedule.Move(TASK, longer), ref="synthetic:longer")
        result = compare(alternatives=[invalid, EARLY_PROPOSAL])
        self.assertEqual(result["status"], "feasible_alternatives")
        self.assertEqual(result["alternatives"][0]["issues"][0]["code"], "activity_duration_changed")
        self.assertEqual(result["alternatives"][1]["alternative_status"], "pending_approval")

    def test_candidate_buffers_must_fit_inside_constraint_horizon(self):
        row = {**ROW, "prep_minutes": 10}
        outside = interval("2026-11-14T20:00:00Z", "2026-11-14T21:00:00Z")
        result = compare([row], [proposal(schedule.Move(TASK, outside))])
        codes = [issue["code"] for issue in result["alternatives"][0]["issues"]]
        self.assertIn("outside_constraint_horizon", codes)
        self.assertEqual(result["status"], "no_valid_alternative")

    def test_zero_rest_is_valid_and_distinct_from_missing_constraints(self):
        row = {**ROW, "start_at": WINDOW.start_at, "end_at": WINDOW.end_at}
        result = compare([row], [])
        self.assertEqual(result["baseline"]["rest_opportunity_minutes"], 0)
        self.assertEqual(result["baseline"]["rest_intervals"], [])
        self.assertEqual(result["status"], "no_valid_alternative")

    def test_resource_calendar_intervals_can_touch(self):
        resources = {RESOURCE: [
            interval("2026-11-14T22:00:00Z", "2026-11-14T23:30:00Z"),
            interval("2026-11-14T23:30:00Z", "2026-11-15T00:00:00Z"),
        ]}
        result = compare(resource_availability=resources)
        self.assertEqual(result["status"], "feasible_alternatives")

    def test_baseline_approved_schedule_scope_is_checked(self):
        row = {**ROW, "subject_id": "synthetic:other"}
        result = compare([row])
        self.assertEqual(result["limitations"], [{"code": "activity_outside_simulated_subject"}])
