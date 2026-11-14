"""science/validate.py writes validation.json in the shape of docs/proof/validation_schema.md (FR-SIM-04).

Run: cd science && python3 -m pytest -q tests/test_validate.py
"""
import importlib.util
import json
from pathlib import Path

import pytest

from science import validate

ROOT = Path(__file__).resolve().parents[2]


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture(scope="module")
def result():
    return validate.build(now="2026-11-14T09:00:00Z")


def checks(result):
    return {c["id"]: c for area in result["areas"].values() if area for c in area["checks"]}


def test_publisher_accepts_every_check(result, tmp_path):
    publish_proof = _load("publish_proof", ROOT / "scripts/publish_proof.py")
    for name, area in result["areas"].items():
        for i, c in enumerate((area or {}).get("checks", [])):
            assert publish_proof.check_check(c, f"{name}[{i}]") == []
    (tmp_path / "science/out").mkdir(parents=True)
    (tmp_path / "science/out/validation.json").write_text(json.dumps(result))
    read = publish_proof.read_validation(tmp_path)
    assert read["status"] == "generated" and read["problems"] == []
    assert sum(len(a["checks"]) for a in read["areas"].values() if a) == len(checks(result))


def test_top_level(result):
    assert set(result["areas"]) == {"execution_integrity", "measurement_analysis", "knowledge_assistant", "use"}
    assert result["seed"] == 42 and result["generated_at_utc"].endswith("Z")
    assert result["illustrative_parameters"]


def test_rates_carry_counts(result):
    for c in checks(result).values():
        if c["unit"] == "rate" and c["value"] is not None:
            assert isinstance(c["numerator"], int) and isinstance(c["denominator"], int) and c["denominator"] > 0
            assert c["value"] == c["numerator"] / c["denominator"]


def test_integrity_results(result):
    c = checks(result)
    for cid in ("units_present", "timestamps_ordered", "versions_recorded", "schema_valid", "id_realm_rules",
                "decode_ledgers_verified", "information_status_reproduced", "golden_vectors_python"):
        assert c[cid]["passed"] is True, (cid, c[cid])
    assert c["decode_ledgers_verified"]["denominator"] == 24
    assert c["golden_vectors_python"]["denominator"] == len(list((ROOT / "contracts/vectors").glob("*/*.json")))
    # Not measured here: null, never 0.
    assert c["permission_tests"]["value"] is None and c["sync_dedupe_test"]["value"] is None


def test_no_leakage(result):
    c = checks(result)
    assert c["holdout_no_overlap"]["value"] == 0 and c["holdout_no_overlap"]["passed"] is True
    assert c["reference_from_earlier_days"]["passed"] is True
    assert c["reference_no_absorb_s1"]["passed"] is True and c["reference_no_absorb_s1"]["scenario"] == "S1"
    for cid in ("detection_hits", "detection_false_alarms", "fixed_threshold_hits", "fixed_threshold_false_alarms"):
        assert c[cid]["numerator"] <= c[cid]["denominator"]


def test_missing_is_null(result):
    c = checks(result)
    assert c["daily_check_seconds_median"]["value"] is None
    assert c["decode_round_seconds_median"]["value"] == 90.0


def test_cli_writes_file(tmp_path):
    out = tmp_path / "validation.json"
    assert validate.main(["--out", str(out), "--now", "2026-11-14T09:00:00Z"]) == 0
    assert json.loads(out.read_text())["generated_by"] == "science/validate.py"
