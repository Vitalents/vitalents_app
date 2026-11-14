"""Task 8 acceptance checks against independent expected scenario outcomes."""
from copy import deepcopy
import json
import unittest

from science import decode, reference, rules, simulator


def readings(case):
    return {row["slot_id"]: row for row in case["review"]["readings"]}


class SimulatorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.replay = simulator.run_all()
        cls.cases = {case["scenario"]["scenario_code"]: case for case in cls.replay["scenarios"]}

    def test_replay_is_deterministic_labeled_and_namespaced(self):
        self.assertEqual(self.replay, simulator.run_all())
        self.assertEqual(list(self.cases), ["S1", "S2", "S3", "S4"])
        self.assertEqual(self.replay["simulation_banner"], "SIMULATED DATA")
        crew_ids = [case["crew_profile"]["subject_profile_id"] for case in self.cases.values()]
        self.assertEqual(len(set(crew_ids)), 4)
        self.assertEqual(len({case["crew_profile"]["crew_label"] for case in self.cases.values()}), 4)
        all_fixture_ids = set()
        for case in self.cases.values():
            with self.subTest(case=case["scenario"]["scenario_code"]):
                profile = case["crew_profile"]
                self.assertTrue(profile["is_simulated"])
                self.assertEqual(profile["data_origin"], "simulated_mission")
                self.assertEqual(profile["subject_mode"], "mission_simulation")
                self.assertIn("(fictional)", profile["crew_label"])
                scenario = case["scenario"]
                self.assertEqual(scenario["crew_subject_ids"], crew_ids)
                self.assertEqual(scenario["simulation_banner"], "SIMULATED DATA")
                ids = scenario["fixture_record_ids"]
                self.assertEqual(len(ids), len(set(ids)))
                self.assertFalse(all_fixture_ids.intersection(ids))
                all_fixture_ids.update(ids)
                records = [*case["measurements"], *case["sleep_records"], *case["self_reports"],
                           *case["schedule"]["records"], *case["findings"], case["daily_review"],
                           case["follow_up"], case["action"]]
                for item in records:
                    self.assertTrue(item["is_simulated"])
                    self.assertEqual(item["subject_id"], profile["subject_profile_id"])
                    self.assertIn(item["data_origin"], ("simulated_mission", "application_generated"))
                self.assertEqual(case["follow_up"]["action_id"], case["action"]["action_id"])
                self.assertIn(case["action"]["finding_id"], case["daily_review"]["finding_ids"])
                self.assertEqual(case["daily_review"]["selected_action_id"], case["action"]["action_id"])
        json.dumps(self.replay, allow_nan=False)

    def test_s1_sleep_and_game_changes_are_separate_and_lead_to_plan(self):
        case = self.cases["S1"]
        slots = readings(case)
        for slot, observed, baseline, delta, unit in (
            ("sleep", 335, 425, -90, "minutes"), ("decode", 840, 620, 220, "ms"),
        ):
            with self.subTest(slot=slot):
                reading = slots[slot]
                self.assertEqual(reading["information_status"]["status"], "valid")
                self.assertTrue(reading["information_status"]["reference_eligible"])
                comparison = reading["comparison"]
                self.assertEqual(comparison["observed_value"], observed)
                self.assertEqual(comparison["reference_value"], baseline)
                self.assertEqual(comparison["difference"], delta)
                self.assertEqual(comparison["reason"], "frozen_reference")
                record = case["references"][slot]["record"]
                self.assertEqual(record["unit"], unit)
                self.assertEqual(record["valid_record_count"], 6 if slot == "sleep" else 5)
                self.assertLess(record["end_date"], case["daily_review"]["review_date"])
                self.assertEqual(record["source_record_ids"], case["references"][slot]["source_ids"])
        self.assertEqual([row["minutes_asleep"] for row in case["sleep_records"][-3:]], [365, 350, 335])
        plan = case["review"]["main_next_step"]
        self.assertEqual(plan["step_category"], "approved_plan_step")
        self.assertEqual(plan["execution_status"], "proposed")
        self.assertEqual(plan["owner_role"], "medical")
        self.assertEqual(plan["reference_ids"], [slots[slot]["comparison"]["reference_id"] for slot in ("sleep", "decode")])
        self.assertEqual(case["review"]["follow_ups"][0]["followup_status"], "action_open")
        self.assertEqual(case["decode"][-1]["verification"]["summary"]["accuracy_percent"], 80)

    def test_s1_schedule_calculates_opportunity_and_keeps_approval_pending(self):
        result = self.cases["S1"]["schedule"]["comparison"]
        self.assertEqual(result["status"], "feasible_alternatives")
        self.assertEqual(result["quantity"], "calculated_rest_opportunity")
        self.assertEqual(result["baseline"]["rest_opportunity_minutes"], 360)
        alternative = result["alternatives"][0]
        self.assertEqual(alternative["rest_opportunity_minutes"], 420)
        self.assertEqual(alternative["longest_rest_opportunity_minutes"], 420)
        self.assertEqual(alternative["rest_opportunity_delta_minutes"], 60)
        self.assertEqual(alternative["alternative_status"], "pending_approval")
        self.assertEqual(alternative["pending_approval_roles"], ["planner"])
        self.assertFalse(alternative["approval_satisfied"])

    def test_s2_missing_and_interrupted_have_no_imputed_reading_or_score(self):
        case = self.cases["S2"]
        slots = readings(case)
        self.assertIsNone(case["daily_review"]["sleep_record_id"])
        self.assertEqual(slots["sleep"]["information_status"]["status"], "no_reading")
        self.assertEqual(slots["decode"]["information_status"]["status"], "not_comparable")
        self.assertIn("session_interrupted", slots["decode"]["information_status"]["reason_codes"])
        for slot in ("sleep", "decode"):
            self.assertIsNone(slots[slot]["comparison"]["observed_value"])
            self.assertIsNone(slots[slot]["comparison"]["difference"])
        game = case["decode"][-1]
        self.assertTrue(game["verification"]["events_verified"])
        self.assertIsNone(game["verification"]["summary"])
        self.assertTrue(all(game["session"][field] is None for field in decode.SCORE_FIELDS))
        self.assertEqual(case["review"]["main_next_step"]["step_category"], "complete_measurement")
        self.assertEqual(case["review"]["main_next_step"]["slot_id"], "sleep")
        self.assertEqual(case["review"]["other_next_steps"][0]["slot_id"], "decode")
        self.assertEqual(case["review"]["follow_ups"][0]["followup_status"], "action_open")

    def test_s3_fixed_work_and_collision_reject_both_alternatives(self):
        case = self.cases["S3"]
        result = case["schedule"]["comparison"]
        self.assertEqual(result["status"], "no_valid_alternative")
        self.assertEqual(result["baseline"]["rest_opportunity_minutes"], 360)
        self.assertEqual([row["issues"][0]["code"] for row in result["alternatives"]],
                         ["crew_task_overlap", "fixed_activity"])
        self.assertTrue(all(row["alternative_status"] == "rejected" for row in result["alternatives"]))
        self.assertEqual(case["review"]["main_next_step"]["step_category"], "observe")
        for slot in ("sleep", "decode"):
            reading = readings(case)[slot]
            self.assertEqual(reading["raw_information_status"]["status"], "valid")
            self.assertEqual(reading["information_status"]["status"], "not_comparable")
            self.assertIsNone(reading["comparison"]["difference"])
        self.assertEqual(case["references"]["sleep"]["status"], "provisional")
        self.assertEqual(case["review"]["follow_ups"][0]["followup_status"], "watching")

    def test_s4_symptom_review_survives_favorable_game_and_temperature_limitation(self):
        case = self.cases["S4"]
        slots = readings(case)
        self.assertEqual(slots["decode"]["comparison"]["difference"], -80)
        self.assertEqual(slots["decode"]["information_status"]["status"], "valid")
        self.assertAlmostEqual(case["decode"][-1]["verification"]["summary"]["accuracy_percent"], 100 * 74 / 75)
        temperature = slots["skin_temperature"]["information_status"]
        self.assertEqual(temperature["status"], "incomplete")
        self.assertIn("unsupported_metric", temperature["reason_codes"])
        action = case["review"]["main_next_step"]
        self.assertEqual((action["step_category"], action["owner_role"]), ("request_review", "medical"))
        followup = case["follow_up"]
        self.assertEqual(followup["followup_status"], "review_requested")
        symptom = case["self_reports"][-1]
        self.assertEqual(action["supporting_record_ids"], [symptom["self_report_id"], followup["follow_up_id"]])
        preview = case["specialist_preview"]
        self.assertEqual(preview["status"], "preview_only")
        self.assertEqual(preview["intended_role"], "medical")
        self.assertEqual(preview["included_record_ids"], [symptom["self_report_id"], temperature["record_ref"]])
        self.assertNotIn(symptom["private_note"], json.dumps((case["review"], preview, case["schedule"])))

    def test_every_generated_ledger_reverifies_with_persisted_summaries(self):
        for case in self.cases.values():
            for game in case["decode"]:
                session = game["session"]
                with self.subTest(session=session["decode_session_id"]):
                    self.assertEqual(decode.verify(
                        session, game["events"], subject=case["crew_profile"],
                        key_registry=self.replay["decode_key_registry"], expected_event_ids=game["expected_event_ids"],
                    ), game["verification"])
        s1 = self.cases["S1"]
        key_versions = {game["session"]["key_version"] for game in s1["decode"]}
        self.assertEqual(len(key_versions), 2)
        valid_sources = set(s1["references"]["decode"]["source_ids"])
        today_key = s1["decode"][-1]["session"]["key_version"]
        self.assertEqual(valid_sources, {
            game["session"]["decode_session_id"] for game in s1["decode"][:-1]
            if game["session"]["key_version"] == today_key
        })

    def test_other_crew_cannot_supply_reference_day_or_review_trigger(self):
        s1, s4 = self.cases["S1"], self.cases["S4"]
        subject = s1["crew_profile"]
        foreign = deepcopy(s4["sleep_records"][0])
        target = reference.Observation(s1["sleep_records"][-1], {"subject": subject, "conditions_compatible": True})
        policy = simulator.DEMO_POLICIES["sleep"]
        candidate = reference.build_reference(
            target, [reference.Observation(foreign, {"subject": s4["crew_profile"]})], policy,
        )
        self.assertEqual(candidate.reference_status, "not_built")
        self.assertIsNone(candidate.exclusions[0].record_id)
        result = rules.evaluate([], subject_id=subject["subject_profile_id"], subject_mode="mission_simulation",
                                as_of_utc=s1["review"]["as_of_utc"], symptom_reports=s4["self_reports"],
                                follow_ups=[s4["follow_up"]])
        self.assertEqual(result["main_next_step"]["step_category"], "observe")
        self.assertEqual(result["follow_ups"], [])
