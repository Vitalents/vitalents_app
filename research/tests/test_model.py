"""FR-RT-01: research model on simulated data. Run: python3 -m pytest -q research"""
import json
import pathlib

import numpy as np
import pytest

import model as M

FIX = M.FIXTURES


def bundle(name="S1.json"):
    return json.loads((FIX / name).read_text(encoding="utf-8"))


def test_rows_use_only_valid_sessions_with_both_inputs():
    rows, excluded = M.rows_from_bundle(bundle())
    assert [e["record_id"] for e in excluded] == ["sim:decode_session:d23"]
    assert "not_comparable" in excluded[0]["reason"]
    assert len(rows) == 13
    b = bundle()
    sleep_dates = {s["sleep_record_id"]: s["observation_date"] for s in b["sleep_record"]}
    alert_dates = {s["self_report_id"]: s["report_date"] for s in b["self_report"]}
    for r in rows:
        sid, sleep_id, alert_id = r.record_ids
        assert sid.startswith("sim:decode_session:")
        assert sleep_dates[sleep_id] == r.date == alert_dates[alert_id]


def test_missing_input_is_excluded_never_zero():
    b = bundle()
    b["sleep_record"][0]["recorded_interval_ms"] = None
    b["self_report"] = [s for s in b["self_report"] if s["report_date"] != "2026-11-03"]
    rows, excluded = M.rows_from_bundle(b)
    reasons = {e["date"]: e["reason"] for e in excluded}
    assert reasons["2026-10-31"] == "no valid sleep record for the night before"
    assert reasons["2026-11-03"] == "no alertness rating that morning"
    assert all(r.sleep_h > 0 for r in rows)


def test_refuses_non_simulated_data():
    b = bundle()
    b["sleep_record"][0]["sleep_record_id"] = "live:sleep_record:x"
    with pytest.raises(M.NotSimulated):
        M._check_simulated(b, "x")
    b = bundle()
    b["subject_profile"][0]["subject_mode"] = "real_research"
    with pytest.raises(M.NotSimulated):
        M._check_simulated(b, "x")


def test_leave_one_day_out_never_trains_on_the_held_out_day():
    rows, _ = M.rows_from_bundle(bundle())
    ev = M.leave_one_day_out(rows)
    assert ev["held_out_days"] == len(rows)
    assert all(d["train_days"] == len(rows) - 1 for d in ev["days"])


def test_forward_only_uses_earlier_days_only():
    rows, _ = M.rows_from_bundle(bundle())
    ev = M.forward_only(rows)
    dates = [r.date for r in rows]
    assert ev["held_out_days"] > 0
    for d in ev["days"]:
        assert d["train_days"] == sum(x < d["date"] for x in dates)
        assert d["train_days"] >= M.FORWARD_MIN_TRAIN


def test_baseline_is_the_training_median():
    med, lo, hi = M.baseline(np.array([40.0, 42.0, 44.0, 43.0]))
    assert med == 42.5 and lo <= med <= hi


def test_constant_input_is_left_out():
    rows, _ = M.rows_from_bundle(bundle("S4.json"))
    fit = M.final_fit(rows)
    alert = next(c for c in fit["coefficients"] if c["input"] == "alertness")
    assert alert["used"] is False and alert["per_unit"] is None


def test_expected_range_contains_expected_value():
    rows, _ = M.rows_from_bundle(bundle())
    for d in M.leave_one_day_out(rows)["days"]:
        assert d["model"]["low"] <= d["model"]["expected"] <= d["model"]["high"]


def test_verdict_rules():
    def s(beats, mc, bc, t=0):
        return {"summary": {"beats_baseline": beats, "model_closer_days": mc, "baseline_closer_days": bc, "tied_days": t}}
    assert M.verdict(None, None) == "not_evaluated"
    assert M.verdict(s(False, 9, 1), s(True, 9, 1)) == "not_better"
    assert M.verdict(s(True, 4, 9), s(True, 9, 1)) == "mixed"  # lower error, but closer on fewer days
    assert M.verdict(s(True, 9, 1), s(False, 1, 9)) == "mixed"
    assert M.verdict(s(True, 9, 1), s(True, 6, 2)) == "better"


def test_output_is_labelled_deterministic_and_simulated(tmp_path):
    a, b = tmp_path / "a", tmp_path / "b"
    assert M.main(["--out", str(a)]) == 0 and M.main(["--out", str(b)]) == 0
    files = sorted(p.name for p in a.glob("model_*.json"))
    assert "model_fahim.json" in files
    for f in files:
        assert (a / f).read_bytes() == (b / f).read_bytes()
        res = json.loads((a / f).read_text(encoding="utf-8"))
        assert res["is_simulated"] is True and res["research_model_id"].startswith("sim:research_model:")
        assert res["label"].startswith("Research prototype on simulated data")
        assert any("independent validation" in x for x in res["limits"])
        assert res["verdict"] in {"better", "mixed", "not_better", "not_evaluated"}


def test_fahim_verdict_is_reported_honestly():
    res = M.run_subject(next(s for s in M.load_subjects(FIX) if s.subject_id == "sim:crew:fahim"))
    loo = res["evaluation"]["leave_one_day_out"]["summary"]
    fwd = res["evaluation"]["forward_only"]["summary"]
    # Slightly lower error leaving one day out, higher forward-only, closer on fewer than half the days: mixed.
    assert loo["beats_baseline"] and not fwd["beats_baseline"]
    assert res["verdict"] == "mixed"
    assert any("moved together" in x for x in res["limits"])


def test_committed_outputs_match_a_fresh_run(tmp_path):
    M.main(["--out", str(tmp_path)])
    committed = sorted(pathlib.Path(M.OUT).glob("model_*.json"))
    assert committed, "run python3 research/model.py"
    for p in committed:
        assert p.read_bytes() == (tmp_path / p.name).read_bytes(), f"{p.name} is stale: run python3 research/model.py"
