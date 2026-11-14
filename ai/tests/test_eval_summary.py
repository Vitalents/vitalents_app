"""FR-AS-08: rates from a synthetic `ask_nasa.py --eval` file. No Ollama, no model."""
import json

import pytest

import eval_summary as es


def row(answerable, status, ok):
    return {"question": "q", "answerable": answerable, "status": status, "pass": ok, "reason": None, "citations": []}


def synthetic():
    # 10 answerable: 7 answered with the right source, 2 abstained, 1 blocked.
    # 5 unanswerable: 4 abstained (pass), 1 answered (fail).
    results = (
        [row(True, "answered", True)] * 7
        + [row(True, "not_in_library", False)] * 2
        + [row(True, "blocked", False)]
        + [row(False, "not_in_library", True)] * 3
        + [row(False, "blocked", True)]
        + [row(False, "answered", False)]
    )
    counts = {"total": 15, "passed": 11, "correct_source": 7, "correct_abstention": 4, "blocked": 2, "answered": 8}
    return {"model": "gpt-oss:20b", "library_version": "lib-v3", "counts": counts, "results": results}


def test_rates_and_counts():
    s = es.summarize(synthetic())
    assert (s["answerable"], s["unanswerable"], s["total"]) == (10, 5, 15)
    assert (s["correct_source"], s["correct_abstention"], s["blocked"]) == (7, 4, 2)
    assert s["correct_source_rate"] == pytest.approx(0.7)
    assert s["abstention_rate"] == pytest.approx(0.8)
    assert s["blocked_rate"] == pytest.approx(2 / 15)
    assert s["model"] == "gpt-oss:20b" and s["library_version"] == "lib-v3"
    assert s["warnings"] == []


def test_counts_must_agree_with_results():
    ev = synthetic()
    ev["counts"]["blocked"] = 3
    with pytest.raises(es.EvalShapeError, match="blocked"):
        es.summarize(ev)


def test_counts_only_gives_null_rates_not_zero():
    ev = synthetic()
    del ev["results"]
    s = es.summarize(ev)
    assert s["answerable"] is None and s["unanswerable"] is None
    assert s["correct_source_rate"] is None and s["abstention_rate"] is None
    assert s["blocked_rate"] == pytest.approx(2 / 15)
    assert any("answerable" in w for w in s["warnings"])


def test_empty_results_give_null_rates():
    s = es.summarize({"model": "m", "results": []})
    assert s["total"] == 0
    assert s["correct_source_rate"] is None and s["abstention_rate"] is None and s["blocked_rate"] is None


def test_unexpected_split_warns():
    ev = synthetic()
    ev["results"] = ev["results"][:12]
    del ev["counts"]
    s = es.summarize(ev)
    assert any("FR-AS-08" in w for w in s["warnings"])


@pytest.mark.parametrize("bad", [[], {"model": "m"}, {"results": "x"}, {"results": [{"answerable": "yes", "status": "answered", "pass": True}]},
                                 {"counts": {"blocked": -1}}, {"counts": {"blocked": True}}])
def test_bad_shapes_rejected(bad):
    with pytest.raises(es.EvalShapeError):
        es.summarize(bad)


def test_cli_writes_summary(tmp_path, capsys):
    f = tmp_path / "assistant_eval_gptoss.json"
    f.write_text(json.dumps(synthetic()))
    out = tmp_path / "summary.json"
    assert es.main([str(f), "--out", str(out)]) == 0
    assert "correct source 7/10" in capsys.readouterr().out
    data = json.loads(out.read_text())
    assert data[0]["source"] == str(f) and data[0]["abstention_rate"] == pytest.approx(0.8)


def test_cli_fails_on_bad_file(tmp_path):
    f = tmp_path / "assistant_eval_bad.json"
    f.write_text("{not json")
    assert es.main([str(f)]) == 1
