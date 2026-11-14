"""Synthetic S1, S2 and S4 and approval gates using the actual Task 3-5 APIs."""

from copy import deepcopy
from dataclasses import replace
import json
from pathlib import Path
import unittest

from science import reference, rules, status
from test_reference import DECODE, SLEEP, UTC, decode, hr, publish, sleep

CASES = json.loads(Path(__file__).with_name("fixtures").joinpath("tasks6_7_synthetic.json").read_text(
    encoding="utf-8-sig"
))
SUBJECT = CASES["subject_id"]
S1 = CASES["scenario_s1"]
RULE = S1["rule"]
EVIDENCE = S1["evidence"]
RULE_KEY = RULE["rule_definition_id"], RULE["rule_version"]
EVIDENCE_KEY = EVIDENCE["evidence_source_id"], EVIDENCE["source_version"]


def evaluate(readings=(), **options):
    return rules.evaluate(readings, subject_id=SUBJECT, subject_mode="mission_simulation",
                          as_of_utc=UTC, **options)


def with_reference(slot, policy, observed, factory):
    series = publish(observed, [factory(i) for i in (1, 2, 3)], policy)
    return rules.Reading(slot, policy.kind, observed, policy, series)


def s1_inputs():
    sleep_slot = with_reference("sleep", SLEEP, sleep(4, S1["sleep_minutes_asleep"]), sleep)
    game = with_reference("game", DECODE, decode(4, S1["decode_median_correct_rt_ms"]), decode)
    match = rules.ApprovedMatch(
        *RULE_KEY, SUBJECT, "mission_simulation", "synthetic:approval", "medical",
        *EVIDENCE_KEY, "Record observations for the synthetic follow-up.", ("sleep", "game"),
        ("synthetic:sleep_record:4", "synthetic:decode_session:4"),
        ("synthetic:ref-1", "synthetic:ref-1"),
    )
    config = {"approved_matches": [match], "rule_definitions": {RULE_KEY: RULE},
              "evidence_sources": {EVIDENCE_KEY: EVIDENCE}}
    return (sleep_slot, game), config


class RulesTests(unittest.TestCase):
    def test_s1_keeps_sleep_and_decode_separate_and_offers_approved_step(self):
        self.assertTrue(CASES["examples_are_synthetic"])
        readings, options = s1_inputs()
        before = deepcopy((readings, options))
        result = evaluate(readings, **options)
        comparisons = [item["comparison"] for item in result["readings"]]
        self.assertEqual([item["difference"] for item in comparisons], [-70, 80])
        self.assertEqual([x["finding_kind"] for x in result["observations"]],
                         ["descriptive_change", "descriptive_change", "approved_plan_step"])
        self.assertEqual(result["main_next_step"]["step_category"], "approved_plan_step")
        self.assertEqual(result["main_next_step"]["rule_version"], RULE_KEY[1])
        self.assertEqual(result["main_next_step"]["source_version"], EVIDENCE_KEY[1])
        self.assertEqual(result["main_next_step"]["owner_role"], "medical")
        self.assertEqual((readings, options), before)
        json.dumps(result, allow_nan=False)

    def test_s2_missing_sleep_and_interrupted_decode_preserve_followup(self):
        missing = rules.Reading("sleep", SLEEP.kind, reference.Observation(None, {}), SLEEP)
        interrupted = rules.Reading("game", DECODE.kind, decode(4, session_state="interrupted"), DECODE)
        followup = {"follow_up_id": "synthetic:action-open", "subject_id": SUBJECT,
                    "data_origin": "application_generated", "is_simulated": True,
                    "followup_status": "action_open"}
        result = evaluate((missing, interrupted), follow_ups=[followup])
        self.assertEqual(result["main_next_step"]["step_category"], "complete_measurement")
        self.assertEqual(len(result["observations"]), 2)
        self.assertEqual(len(result["other_next_steps"]), 1)
        self.assertEqual(result["readings"][0]["information_status"]["status"], "no_reading")
        self.assertIn("session_interrupted", result["readings"][1]["information_status"]["reason_codes"])
        self.assertTrue(all(x["comparison"]["difference"] is None for x in result["readings"]))
        self.assertEqual(result["follow_ups"][0]["followup_status"], "action_open")

    def test_s4_good_decode_never_hides_reported_symptom_or_request(self):
        game = with_reference("game", DECODE, decode(4, 510), decode)
        symptom = {"self_report_id": "synthetic:symptom", "report_kind": "symptom",
                   "subject_id": SUBJECT, "is_simulated": True, "data_origin": "application_generated",
                   "symptom_text": "Fictional symptom", "private_note": "private test marker"}
        temperature = rules.Reading("temperature", "measurement",
                                    hr(4, 1.2, metric_code="skin_temperature_variation"))
        result = evaluate([game, temperature], symptom_reports=[symptom],
                          review_request_ids=["synthetic:user-request"])
        self.assertEqual(result["readings"][0]["comparison"]["difference"], -110)
        self.assertEqual(result["main_next_step"]["step_category"], "request_review")
        self.assertEqual(result["main_next_step"]["supporting_record_ids"],
                         ["synthetic:symptom", "synthetic:user-request"])
        self.assertEqual(result["main_next_step"]["owner_role"], "medical")
        self.assertEqual(result["readings"][0]["information_status"]["status"], "valid")
        self.assertEqual(result["observations"][1]["finding_kind"], "context_conflict")
        self.assertNotIn("private test marker", json.dumps(result))

    def test_review_outranks_missing_and_plan_steps_and_preserves_both(self):
        readings, options = s1_inputs()
        absent = rules.Reading("other", "measurement", reference.Observation(None, {}))
        result = evaluate((*readings, absent), review_request_ids=["synthetic:request"], **options)
        self.assertEqual(result["main_next_step"]["step_category"], "request_review")
        self.assertEqual([s["step_category"] for s in result["other_next_steps"]],
                         ["complete_measurement", "approved_plan_step"])

    def test_missing_rule_or_unapproved_version_reports_limitation(self):
        readings, options = s1_inputs()
        for definitions in ({}, {RULE_KEY: {**RULE, "approval_state": "draft"}},
                            {RULE_KEY: {**RULE, "rule_version": "synthetic:other"}}):
            with self.subTest(definitions=definitions):
                result = evaluate(readings, **{**options, "rule_definitions": definitions})
                self.assertEqual(result["main_next_step"]["step_category"], "observe")
                self.assertIn({"code": "approved_rule_version_unavailable", "rule_id": RULE_KEY[0],
                               "rule_version": RULE_KEY[1]}, result["limitations"])
                self.assertEqual(len(result["observations"]), 2)

    def test_expected_rule_without_approved_match_is_explicit(self):
        result = evaluate(expected_rule_versions=[RULE_KEY])
        self.assertEqual(result["main_next_step"]["step_category"], "observe")
        self.assertEqual(result["limitations"][0]["code"], "approved_match_unavailable")

    def test_plan_defers_when_evidence_exact_version_or_role_is_missing(self):
        readings, options = s1_inputs()
        result = evaluate(readings, **{**options, "evidence_sources": {}})
        self.assertEqual(result["limitations"][0]["code"], "versioned_evidence_unavailable")
        wrong_role = replace(options["approved_matches"][0], approver_role="astronaut")
        result = evaluate(readings, **{**options, "approved_matches": [wrong_role]})
        self.assertEqual(result["limitations"][0]["code"], "rule_scope_or_approval_role_mismatch")

    def test_plan_materially_depends_on_actual_comparison_quality(self):
        readings, options = s1_inputs()
        unready = replace(readings[0], series=reference.ReferenceSeries())
        result = evaluate((unready, readings[1]), **options)
        self.assertEqual(result["main_next_step"]["step_category"], "observe")
        self.assertEqual(result["limitations"][0]["code"], "required_readings_unavailable")
        self.assertEqual(result["readings"][0]["raw_information_status"]["status"], "valid")
        self.assertEqual(result["readings"][0]["information_status"]["status"], "not_comparable")

    def test_plan_cannot_relabel_valid_measurement_as_a_different_metric(self):
        readings, options = s1_inputs()
        policy = replace(reference.DEMO_RESTING_HR, metric="hr_daily_bpm")
        wrong_metric = rules.Reading("sleep", "measurement", hr(4), policy)
        match = replace(options["approved_matches"][0],
                        supporting_record_ids=("synthetic:measurement:4", "synthetic:decode_session:4"))
        rule = {**RULE, "required_metric_codes": ["hr_daily_bpm"], "required_quality": "valid"}
        result = evaluate((wrong_metric, readings[1]),
                          **{**options, "approved_matches": [match], "rule_definitions": {RULE_KEY: rule}})
        self.assertEqual(result["readings"][0]["metric"], "hr_resting_bpm")
        self.assertEqual(result["limitations"][0]["code"], "required_readings_unavailable")

    def test_changed_record_cannot_reuse_approved_match(self):
        readings, options = s1_inputs()
        different = sleep(5, 350)
        result = evaluate((replace(readings[0], observation=different), readings[1]), **options)
        self.assertEqual(result["limitations"][0]["code"], "approval_record_binding_mismatch")

    def test_changed_reference_cannot_reuse_approved_match(self):
        readings, options = s1_inputs()
        original = options["approved_matches"][0]
        stale = replace(original, reference_ids=("synthetic:old-reference", "synthetic:ref-1"))
        result = evaluate(readings, **{**options, "approved_matches": [stale]})
        self.assertEqual(result["limitations"][0]["code"], "approval_reference_binding_mismatch")

    def test_astronaut_can_own_a_medically_approved_plan_step(self):
        readings, options = s1_inputs()
        astronaut_step = {**RULE, "owner_role": "astronaut"}
        result = evaluate(readings, **{**options, "rule_definitions": {RULE_KEY: astronaut_step}})
        self.assertEqual(result["main_next_step"]["step_category"], "approved_plan_step")
        self.assertEqual(result["main_next_step"]["owner_role"], "astronaut")

    def test_approved_medical_rule_can_only_offer_review(self):
        readings, options = s1_inputs()
        rule = {**RULE, "rule_class": "approved_medical_condition", "allowed_next_step": "request_review"}
        result = evaluate(readings, **{**options, "rule_definitions": {RULE_KEY: rule}})
        self.assertEqual(result["main_next_step"]["step_category"], "request_review")
        self.assertEqual(result["main_next_step"]["action_text"], "Request specialist review.")

    def test_cross_partition_payloads_are_omitted(self):
        other = rules.Reading("foreign", DECODE.kind, decode(4, origin="live_decode"), DECODE)
        report = {"self_report_id": "synthetic:foreign-report", "report_kind": "symptom",
                  "subject_id": SUBJECT, "is_simulated": False, "data_origin": "application_generated"}
        result = evaluate([other], symptom_reports=[report])
        self.assertEqual(result["main_next_step"]["step_category"], "observe")
        self.assertEqual(result["readings"], [])
        self.assertNotIn("synthetic:foreign-report", json.dumps(result))

    def test_scope_safe_followup_in_review_is_visible_with_no_readings(self):
        followup = {"follow_up_id": "synthetic:review", "subject_id": SUBJECT,
                    "data_origin": "application_generated", "is_simulated": True,
                    "followup_status": "under_specialist_review"}
        result = evaluate(follow_ups=[followup])
        self.assertEqual(result["main_next_step"]["step_category"], "request_review")
        self.assertEqual(result["follow_ups"][0]["followup_status"], "under_specialist_review")
        self.assertEqual(result["readings"], [])

    def test_raw_information_matches_status_and_note_cannot_supply_comparator(self):
        original = sleep(4)
        row = replace(original, context={**original.context, "comparison": "untrusted"})
        result = evaluate([rules.Reading("sleep", SLEEP.kind, row)])
        assessment = result["readings"][0]
        self.assertEqual(assessment["information_status"],
                         status.evaluate(SLEEP.kind, original.record, context=original.context))

    def test_unsupported_temperature_cannot_prompt_repeat_as_a_validated_metric(self):
        row = hr(4, 1.2, metric_code="skin_temperature_variation")
        result = evaluate([rules.Reading("temperature", "measurement", row)])
        self.assertEqual(result["main_next_step"]["step_category"], "observe")
        self.assertEqual(result["observations"][0]["finding_kind"], "context_conflict")

    def test_s2_missing_selected_decode_metric_is_incomplete_for_review(self):
        game = decode(4, None, accepted_responses=0, correct_count=0, accuracy_percent=None)
        result = evaluate([rules.Reading("game", DECODE.kind, game, DECODE)])
        self.assertEqual(result["readings"][0]["raw_information_status"]["status"], "valid")
        self.assertEqual(result["main_next_step"]["step_category"], "complete_measurement")
