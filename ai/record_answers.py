#!/usr/bin/env python3
"""Record answers from a running Ask NASA service for the public site's cached mode (FR-AS-07).

Usage (with uvicorn ask_nasa:app --port 8008 running):
  python record_answers.py                                  # default questions -> ../app/public/data/cached_answers.json
  python record_answers.py --questions q.json --out file.json --url http://localhost:8008

q.json: ["question 1", "question 2", ...] or [{"question": "...", "context": {...}}, ...]
Output: [{"question", "response", "label": "Recorded from the onboard model"}]
Check every recorded answer by hand before committing it.
"""
import argparse
import json
import pathlib
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent
DEFAULT_OUT = HERE.parent / "app" / "public" / "data" / "cached_answers.json"
DEFAULT_QUESTIONS = [
    "Why do we measure sleep on a long mission?",
    "What does a Decode result below my reference mean?",
    "Why is pulse alone not enough to judge heart health?",
    "How does light affect the sleep cycle in space?",
    "What dose of melatonin should I take tonight?",
]
DEFAULT_CONTEXT = {"crew_id": "sim:crew:fahim", "day": 27}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:8008")
    ap.add_argument("--questions")
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    a = ap.parse_args()
    items = json.loads(pathlib.Path(a.questions).read_text(encoding="utf-8")) if a.questions else DEFAULT_QUESTIONS
    out = []
    for it in items:
        q, ctx = (it, DEFAULT_CONTEXT) if isinstance(it, str) else (it["question"], it.get("context", DEFAULT_CONTEXT))
        body = json.dumps({"question": q, "context": ctx}).encode()
        req = urllib.request.Request(f"{a.url}/ask", data=body, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=180) as r:
            resp = json.load(r)
        out.append({"question": q, "response": resp, "label": "Recorded from the onboard model"})
        print(f"[{resp['status']}] {q}")
    pathlib.Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    pathlib.Path(a.out).write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(f"saved {len(out)} answers -> {a.out}")


if __name__ == "__main__":
    main()
