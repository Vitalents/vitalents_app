"""FR-SIM-02: app stories must be traceable, chronological and reproducible."""
import json
from pathlib import Path

import pytest

from scripts.make_fixtures import s2, s3, s4, s5
from scripts.validate_data import check_app_semantics, check_scenario_family

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "app/public/data/fixtures"


def fixture(code):
    return json.loads((FIXTURES / f"{code}.json").read_text())


@pytest.mark.parametrize("code", ["S1", "S2", "S3", "S4", "S5"])
def test_complete_app_fixture_is_semantically_supported(code):
    assert check_app_semantics(fixture(code), code) == []


@pytest.mark.parametrize("code,builder", [("S2", s2), ("S3", s3), ("S4", s4), ("S5", s5)])
def test_checked_in_scenario_matches_its_generator(code, builder):
    assert fixture(code) == builder()


def test_s5_preserves_all_s1_history_and_its_ledgers():
    assert check_scenario_family(FIXTURES) == []


@pytest.mark.parametrize("mutation,needle", [
    (lambda d: d.pop("decode_response_event"), "missing Decode response ledger"),
    (lambda d: d["decode_session"][0].update(correct_count=999), "does not rescore"),
    (lambda d: d["finding"][0].update(rule_id="rule:R-MISSING-01"), "missing record/source/rule"),
    (lambda d: d["finding"][0].update(rule_version="unrecorded"), "rule_version does not match"),
    (lambda d: d["share_package"][0].update(prepared_at_utc="2026-11-14T07:12:00Z"), "future/unavailable record"),
    (lambda d: d["sharing_permission"][0].update(permission_time_utc="2026-11-14T07:00:00Z"), "permission precedes"),
    (lambda d: d.pop("personal_reference"), "missing record/source/rule"),
    (lambda d: d["personal_reference"][0].update(reference_value=1), "does not match its eligible sources"),
    (lambda d: d["personal_reference"][0]["source_record_ids"].pop(), "D-10 eligible historical records"),
])
def test_validator_rejects_shape_valid_but_untraceable_stories(mutation, needle):
    data = fixture("S4")
    mutation(data)
    assert any(needle in e for e in check_app_semantics(data)), needle


def test_s3_rule_cannot_be_planted_on_one_low_session():
    data = fixture("S3")
    day25 = next(s for s in data["decode_session"] if s["decode_session_id"].endswith("d25"))
    day25["correct_count"] = 46
    assert any("R-PLAN-01 needs two" in e for e in check_app_semantics(data))


def test_draft_plan_rule_cannot_claim_approval():
    data = fixture("S3")
    action = next(a for a in data["action"] if a["action_id"].endswith("rest-d27"))
    action["step_category"] = "approved_plan_step"
    assert any("draft rule cannot produce an approved plan" in e for e in check_app_semantics(data))


@pytest.mark.parametrize("status", ["valid", "limited", "stale"])
def test_absent_measurement_cannot_claim_a_usable_reading(status):
    data = fixture("S1")
    pulse = next(r for r in data["measurement"] if r["value"] is None)
    quality = next(r for r in data["information_status"] if r["record_ref"] == pulse["measurement_id"])
    quality["status"] = status
    assert any("absent measurement cannot be a usable" in e for e in check_app_semantics(data))


def test_s5_shared_history_change_is_rejected(tmp_path):
    s1, s5 = fixture("S1"), fixture("S5")
    s5["measurement"][0]["value"] += 1
    for code, data in [("S1", s1), ("S5", s5)]:
        (tmp_path / f"{code}.json").write_text(json.dumps(data))
    assert any("shared Fahim history differs" in e for e in check_scenario_family(tmp_path))
