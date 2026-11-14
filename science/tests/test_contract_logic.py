"""science/contract_logic.py reproduces every shared vector in contracts/vectors/ (NFR-11, Python side).

Run: cd science && python3 -m pytest -q tests/test_contract_logic.py
"""
import json
from pathlib import Path

import pytest

from science.contract_logic import FUNCTIONS

ROOT = Path(__file__).resolve().parents[2]
VECTORS = sorted((ROOT / "contracts/vectors").glob("*/*.json"))


def close(actual, expected, tol):
    """Deep equality with a numeric tolerance; None never equals 0."""
    if isinstance(expected, bool) or expected is None or isinstance(expected, str):
        return actual == expected
    if isinstance(expected, (int, float)):
        return isinstance(actual, (int, float)) and not isinstance(actual, bool) and abs(actual - expected) <= tol
    if isinstance(expected, list):
        return isinstance(actual, list) and len(actual) == len(expected) and all(close(a, e, tol) for a, e in zip(actual, expected))
    if isinstance(expected, dict):
        return isinstance(actual, dict) and all(k in actual and close(actual[k], v, tol) for k, v in expected.items())
    return False


def run_vector(path):
    v = json.loads(path.read_text())
    out = FUNCTIONS[v["function"]](**v["input"])
    return close(out, v["expected"], v.get("tolerance", 0.001)), out, v["expected"]


def test_vectors_exist():
    assert len(VECTORS) >= 10


@pytest.mark.parametrize("path", VECTORS, ids=lambda p: f"{p.parent.name}/{p.stem}")
def test_vector(path):
    ok, out, expected = run_vector(path)
    assert ok, f"{path.name}: got {out}, expected {expected}"


def test_interrupted_open_trial_is_not_accepted():
    from science.contract_logic import score_decode
    events = [
        {"trial_index": 1, "correct_digit": 4, "response_digit": 4, "stimulus_monotonic_ms": 0, "response_monotonic_ms": 900},
        {"trial_index": 2, "correct_digit": 7, "response_digit": None, "stimulus_monotonic_ms": 1050, "response_monotonic_ms": None},
    ]
    out = score_decode(90_000, "interrupted", events, interrupted_at_ms=1500)
    assert out["response_states"] == ["correct", "interrupted"]
    assert out["accepted_responses"] == 1 and out["accuracy_percent"] == 100.0
