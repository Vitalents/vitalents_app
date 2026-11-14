#!/usr/bin/env python3
"""Assistant evaluation summary (FR-AS-08): rates from the output of `ask_nasa.py --eval`.

`ask_nasa.py --eval` writes counts but no rates. This module reads that file and adds, per model:

  correct_source_rate  = correct_source     / answerable questions
  abstention_rate      = correct_abstention / unanswerable questions
  blocked_rate         = blocked            / all questions

Every rate keeps the count behind it. A rate with an empty denominator is null, never 0.
Counts are recomputed from the per-question `results` and must agree with `counts` when both exist.
Pure standard library: no Ollama, no FastAPI, so scripts/publish_proof.py can import it.

Usage:
  python eval_summary.py ../science/out/assistant_eval_gptoss.json [../science/out/assistant_eval_qwen.json ...]
  python eval_summary.py FILE... --out summary.json      # also write the summaries as JSON
"""
from __future__ import annotations

import json
import pathlib
import sys

# FR-AS-08: the question set is 15 questions, 10 answerable and 5 not. Used only to warn, never to fill a gap.
EXPECTED_ANSWERABLE = 10
EXPECTED_UNANSWERABLE = 5
COUNT_KEYS = ("total", "passed", "correct_source", "correct_abstention", "blocked", "answered")


class EvalShapeError(ValueError):
    """The file is not the output of `ask_nasa.py --eval`."""


def _is_count(v) -> bool:
    return isinstance(v, int) and not isinstance(v, bool) and v >= 0


def _rate(num: int | None, den: int | None) -> float | None:
    if num is None or not den:
        return None
    return num / den


def summarize(ev: dict) -> dict:
    """Return counts and rates for one eval file. Raises EvalShapeError when the shape is wrong."""
    if not isinstance(ev, dict):
        raise EvalShapeError("top level must be an object")
    results = ev.get("results")
    counts = ev.get("counts")
    if results is None and counts is None:
        raise EvalShapeError("needs 'results' or 'counts'")
    if counts is not None:
        if not isinstance(counts, dict):
            raise EvalShapeError("'counts' must be an object")
        for k, v in counts.items():
            if k in COUNT_KEYS and not _is_count(v):
                raise EvalShapeError(f"counts.{k} must be a non-negative integer")

    warnings: list[str] = []
    answerable = unanswerable = None
    from_results: dict[str, int] = {}
    if results is not None:
        if not isinstance(results, list):
            raise EvalShapeError("'results' must be a list")
        for i, r in enumerate(results):
            if not isinstance(r, dict) or not isinstance(r.get("answerable"), bool) or not isinstance(r.get("status"), str):
                raise EvalShapeError(f"results[{i}] needs boolean 'answerable' and string 'status'")
            if not isinstance(r.get("pass"), bool):
                raise EvalShapeError(f"results[{i}] needs boolean 'pass'")
        answerable = sum(1 for r in results if r["answerable"])
        unanswerable = len(results) - answerable
        from_results = {
            "total": len(results),
            "passed": sum(1 for r in results if r["pass"]),
            "correct_source": sum(1 for r in results if r["answerable"] and r["pass"]),
            "correct_abstention": sum(1 for r in results if not r["answerable"] and r["pass"]),
            "blocked": sum(1 for r in results if r["status"] == "blocked"),
            "answered": sum(1 for r in results if r["status"] == "answered"),
        }
        if counts is not None:
            for k, v in from_results.items():
                if k in counts and counts[k] != v:
                    raise EvalShapeError(f"counts.{k} is {counts[k]} but the results give {v}")

    def get(k: str) -> int | None:
        if k in from_results:
            return from_results[k]
        return counts.get(k) if counts is not None else None

    total = get("total")
    out = {
        "model": ev.get("model") if isinstance(ev.get("model"), str) else None,
        "library_version": ev.get("library_version") if isinstance(ev.get("library_version"), str) else None,
        "total": total,
        "answerable": answerable,
        "unanswerable": unanswerable,
        "passed": get("passed"),
        "correct_source": get("correct_source"),
        "correct_abstention": get("correct_abstention"),
        "blocked": get("blocked"),
        "answered": get("answered"),
    }
    out["correct_source_rate"] = _rate(out["correct_source"], answerable)
    out["abstention_rate"] = _rate(out["correct_abstention"], unanswerable)
    out["blocked_rate"] = _rate(out["blocked"], total)
    if out["model"] is None:
        warnings.append("model name missing")
    if answerable is None:
        warnings.append("no per-question results: answerable and unanswerable counts unknown, so the source and abstention rates are null")
    elif (answerable, unanswerable) != (EXPECTED_ANSWERABLE, EXPECTED_UNANSWERABLE):
        warnings.append(
            f"FR-AS-08 expects {EXPECTED_ANSWERABLE} answerable and {EXPECTED_UNANSWERABLE} unanswerable questions; "
            f"this file has {answerable} and {unanswerable}"
        )
    out["warnings"] = warnings
    return out


def summarize_file(path: str | pathlib.Path) -> dict:
    p = pathlib.Path(path)
    try:
        ev = json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise EvalShapeError(f"not valid JSON: {e}") from e
    return summarize(ev)


def _fmt(num, den) -> str:
    return "n/a" if num is None or den is None else f"{num}/{den}"


def main(argv: list[str]) -> int:
    out_path = None
    if "--out" in argv:
        i = argv.index("--out")
        out_path = argv[i + 1]
        argv = argv[:i] + argv[i + 2:]
    if not argv:
        print(__doc__)
        return 2
    summaries, failed = [], 0
    for f in argv:
        try:
            s = summarize_file(f)
        except (OSError, EvalShapeError) as e:
            print(f"FAIL {f}: {e}")
            failed += 1
            continue
        s["source"] = str(f)
        summaries.append(s)
        print(
            f"{s['model'] or '(unnamed model)'}: correct source {_fmt(s['correct_source'], s['answerable'])}"
            f" · correct abstention {_fmt(s['correct_abstention'], s['unanswerable'])}"
            f" · blocked {_fmt(s['blocked'], s['total'])}"
        )
        for w in s["warnings"]:
            print(f"  warning: {w}")
    if out_path:
        pathlib.Path(out_path).write_text(json.dumps(summaries, indent=2) + "\n", encoding="utf-8")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
