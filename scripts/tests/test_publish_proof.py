"""Tests for scripts/publish_proof.py (FR-SIM-04, FR-AS-08). Synthetic inputs in a temporary repo root."""
import importlib.util
import json
import pathlib

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("publish_proof", ROOT / "scripts" / "publish_proof.py")
pp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pp)

NOW = "2026-11-14T10:00:00Z"


def validation():
    return {
        "schema_version": "1.0",
        "generated_at_utc": "2026-11-14T09:12:00Z",
        "generated_by": "science/validate.py",
        "seed": 42,
        "areas": {
            "execution_integrity": {"checks": [
                {"id": "units_present", "label": "Every measurement has a unit", "value": 1.0, "unit": "rate",
                 "numerator": 412, "denominator": 412, "passed": True},
            ]},
            "measurement_analysis": {"checks": [
                {"id": "detection_hits", "label": "Changes found on held-out crew", "method": "One fixed threshold",
                 "value": 3, "unit": "count", "numerator": None, "denominator": None, "passed": None},
                {"id": "lead_days_median", "label": "Days of lead", "value": None, "unit": "days"},
            ]},
            "use": {"checks": [{"id": "daily_check_seconds_median", "label": "Daily check time", "value": 151.5, "unit": "s",
                                "numerator": None, "denominator": 9}]},
        },
        "illustrative_parameters": ["decode_decline_per_hour"],
    }


def eval_file(model="gpt-oss:20b"):
    rows = ([{"answerable": True, "status": "answered", "pass": True}] * 8
            + [{"answerable": True, "status": "not_in_library", "pass": False}] * 2
            + [{"answerable": False, "status": "not_in_library", "pass": True}] * 4
            + [{"answerable": False, "status": "blocked", "pass": True}])
    return {"model": model, "library_version": "lib-v1",
            "counts": {"total": 15, "passed": 13, "correct_source": 8, "correct_abstention": 5, "blocked": 1, "answered": 8},
            "results": rows}


def write(root, rel, data):
    p = root / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(data if isinstance(data, str) else json.dumps(data))
    return p


def numbers(obj):
    if isinstance(obj, bool):
        return []
    if isinstance(obj, (int, float)):
        return [obj]
    if isinstance(obj, dict):
        return [n for v in obj.values() for n in numbers(v)]
    if isinstance(obj, list):
        return [n for v in obj for n in numbers(v)]
    return []


def test_missing_inputs_give_explicit_nulls(tmp_path):
    proof = pp.build_proof(tmp_path, NOW)
    assert proof["status"] == "not_generated"
    assert proof["generated_by"] == "scripts/publish_proof.py" and proof["generated_at_utc"] == NOW
    v = proof["validation"]
    assert v["status"] == "not_generated" and v["areas"] is None and v["seed"] is None and v["source_generated_at_utc"] is None
    a = proof["assistant_eval"]
    assert a["status"] == "not_generated" and a["models"] is None


def test_not_generated_holds_no_numbers(tmp_path):
    proof = pp.build_proof(tmp_path, NOW)
    assert numbers({k: v for k, v in proof.items() if k != "proof_version"}) == []


def test_copies_validation_numbers_with_source(tmp_path):
    write(tmp_path, "science/out/validation.json", validation())
    v = pp.build_proof(tmp_path, NOW)["validation"]
    assert v["status"] == "generated" and v["problems"] == []
    assert v["source"] == "science/out/validation.json"
    assert v["source_generated_at_utc"] == "2026-11-14T09:12:00Z" and v["seed"] == 42
    c = v["areas"]["execution_integrity"]["checks"][0]
    assert (c["value"], c["numerator"], c["denominator"], c["passed"]) == (1.0, 412, 412, True)
    assert v["areas"]["measurement_analysis"]["checks"][1]["value"] is None  # null stays null, never 0
    assert v["areas"]["knowledge_assistant"] is None
    assert v["illustrative_parameters"] == ["decode_decline_per_hour"]
    # Every number in the output exists in the input.
    assert set(numbers(v)) <= set(numbers(validation()))


@pytest.mark.parametrize("mutate, needle", [
    (lambda d: d["areas"]["execution_integrity"]["checks"][0].update(numerator=None), "count behind it"),
    (lambda d: d["areas"]["execution_integrity"]["checks"][0].update(value="1.0"), "number or null"),
    (lambda d: d["areas"]["execution_integrity"]["checks"][0].update(numerator=500), "larger than"),
    (lambda d: d["areas"]["execution_integrity"]["checks"][0].update(label="Crew is healthy"), "forbidden wording"),
    (lambda d: d["areas"]["execution_integrity"]["checks"][0].pop("value"), "'value' is required"),
    (lambda d: d["areas"]["execution_integrity"]["checks"][0].update(extra=1), "unknown keys"),
    (lambda d: d["areas"]["use"]["checks"].append(dict(d["areas"]["use"]["checks"][0])), "duplicate id"),
])
def test_bad_checks_are_dropped_and_reported(tmp_path, mutate, needle):
    d = validation()
    mutate(d)
    write(tmp_path, "science/out/validation.json", d)
    v = pp.build_proof(tmp_path, NOW)["validation"]
    assert any(needle in p for p in v["problems"]), v["problems"]
    assert v["status"] == "generated"


def test_unknown_area_and_bad_timestamp_reported(tmp_path):
    d = validation()
    d["areas"]["vibes"] = {"checks": []}
    d["generated_at_utc"] = "2026-11-14 09:12"
    write(tmp_path, "science/out/validation.json", d)
    v = pp.build_proof(tmp_path, NOW)["validation"]
    assert "vibes" not in v["areas"] and v["source_generated_at_utc"] is None
    assert any("unknown area" in p for p in v["problems"]) and any("ending in Z" in p for p in v["problems"])


@pytest.mark.parametrize("content", ["{bad json", "[]", json.dumps({"generated_at_utc": NOW})])
def test_invalid_validation_file(tmp_path, content):
    write(tmp_path, "science/out/validation.json", content)
    v = pp.build_proof(tmp_path, NOW)["validation"]
    assert v["status"] == "invalid" and v["areas"] is None and v["problems"]


def test_eval_files_per_model_with_rates(tmp_path):
    write(tmp_path, "science/out/assistant_eval_gptoss.json", eval_file())
    write(tmp_path, "science/out/assistant_eval_qwen.json", eval_file("qwen:27b"))
    proof = pp.build_proof(tmp_path, NOW)
    assert proof["status"] == "partial"
    a = proof["assistant_eval"]
    assert a["status"] == "generated" and [m["model"] for m in a["models"]] == ["gpt-oss:20b", "qwen:27b"]
    m = a["models"][0]
    assert m["source"] == "science/out/assistant_eval_gptoss.json" and m["source_modified_at_utc"].endswith("Z")
    assert (m["correct_source"], m["answerable"], m["correct_abstention"], m["unanswerable"], m["blocked"], m["total"]) == (8, 10, 5, 5, 1, 15)
    assert m["correct_source_rate"] == pytest.approx(0.8) and m["abstention_rate"] == 1.0 and m["blocked_rate"] == pytest.approx(1 / 15)
    assert m["derived_by"] == "ai/eval_summary.py"


def test_bad_eval_file_is_skipped(tmp_path):
    write(tmp_path, "science/out/assistant_eval_bad.json", {"model": "x"})
    a = pp.build_proof(tmp_path, NOW)["assistant_eval"]
    assert a["status"] == "invalid" and a["models"] is None and "not published" in a["problems"][0]


def test_all_generated(tmp_path):
    write(tmp_path, "science/out/validation.json", validation())
    write(tmp_path, "science/out/assistant_eval_gptoss.json", eval_file())
    assert pp.build_proof(tmp_path, NOW)["status"] == "generated"


def test_committed_proof_json_matches_inputs():
    """The committed proof.json was produced by this script from the inputs present in the repo."""
    committed = json.loads((ROOT / "app/public/data/proof.json").read_text())
    fresh = pp.build_proof(ROOT, committed["generated_at_utc"])
    for m in (fresh["assistant_eval"]["models"] or []) + (committed["assistant_eval"]["models"] or []):
        m.pop("source_modified_at_utc", None)
    assert committed["generated_by"] == "scripts/publish_proof.py"
    assert fresh == committed, "app/public/data/proof.json is stale: run python3 scripts/publish_proof.py"
