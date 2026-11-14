#!/usr/bin/env python3
"""Record raw Ask NASA answers and publish a hash-bound reviewed fallback (FR-AS-07).

Usage (with uvicorn ask_nasa:app --port 8008 running):
  python record_answers.py                                  # default questions -> ../app/public/data/cached_answers.json
  python record_answers.py --questions q.json --out file.json --url http://localhost:8008

q.json: ["question 1", "question 2", ...] or [{"question": "...", "context": {...}}, ...]
  python record_answers.py --from-recording recordings/2026-11-14-gptoss20b.raw.json

The raw recording is immutable. The publisher never rewrites model science: an
unreviewed/withdrawn answer becomes blocked, with an explicit publication reason.
Review decisions bind to the exact input, not just its question or model name.
"""
import argparse
import copy
import hashlib
import json
import pathlib
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent
DEFAULT_OUT = HERE.parent / "app" / "public" / "data" / "cached_answers.json"
DEFAULT_POLICY = HERE / "cache_review.json"
DEFAULT_QUESTIONS = [
    "Why do we measure sleep on a long mission?",
    "What does a Decode result below my reference mean?",
    "Why is pulse alone not enough to judge heart health?",
    "How does light affect the sleep cycle in space?",
    "What dose of melatonin should I take tonight?",
]
DEFAULT_CONTEXT = {"crew_id": "sim:crew:fahim", "day": 27}


def entry_hash(entry):
    return hashlib.sha256(json.dumps(entry, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()


def archive_recording(raw, directory):
    """Content-addressed, exclusive write; never replace an earlier model recording."""
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f"{hashlib.sha256(raw).hexdigest()}.raw.json"
    try:
        with path.open("xb") as f:
            f.write(raw)
    except FileExistsError:
        if path.read_bytes() != raw:
            raise ValueError("Raw recording hash collision; refusing overwrite")
    return path


def publish(recording, policy, raw_sha256):
    """Apply an explicit review decision, keeping model text intact or withholding it."""
    decisions = {r["entry_sha256"]: r for r in policy["reviews"]}
    out = []
    for original in recording:
        digest = entry_hash(original)
        review = decisions.get(digest)
        item = copy.deepcopy(original)
        response = item["response"]
        decision = review["decision"] if review else "pending_review"
        if decision not in ("retain", "withdraw", "pending_review"):
            raise ValueError(f"Unknown publication decision: {decision}")
        metadata_changes = []
        if decision != "retain":
            reason = review["reason"] if review else "This exact recording has not been checked against its sources."
            response.update(status="blocked", reason="publication_review", science=None, citations=[], limits=(
                "Publication review withheld this recorded response. " + reason +
                " This is a publication decision, not a new answer from the model. No medical advice is provided."
            ))
        else:
            # A Markdown corpus file's page 1 is not an original PDF or web-page locator.
            for citation in response.get("citations", []):
                if citation.get("page") is not None:
                    citation["page"] = None
                    metadata_changes.append("Removed corpus page number; it is not an original-source page.")
                for correction in review.get("citation_locator_corrections", []):
                    if citation.get("source_id") == correction["source_id"]:
                        old = citation.get("excerpt", "")
                        citation["excerpt"] = old.replace(correction["from"], correction["to"])
                        if citation["excerpt"] != old:
                            metadata_changes.append("Corrected printed-page locator in citation excerpt.")
        item["publication_review"] = {
            "policy_version": policy["policy_version"], "decision": decision,
            "review_kind": policy["review_kind"], "raw_recording_sha256": raw_sha256,
            "entry_sha256": digest, "original_status": original["response"]["status"],
            "science_text_changed": False, "science_text_withheld": decision != "retain",
            "citation_metadata_changes": sorted(set(metadata_changes)),
        }
        out.append(item)
    return out


def render(records):
    return json.dumps(records, indent=2, ensure_ascii=False) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:8008")
    ap.add_argument("--questions")
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    ap.add_argument("--from-recording", help="Reproduce publication without calling the model")
    ap.add_argument("--review-policy", default=str(DEFAULT_POLICY))
    ap.add_argument("--recordings-dir", default=str(HERE / "recordings"))
    a = ap.parse_args()
    policy = json.loads(pathlib.Path(a.review_policy).read_text(encoding="utf-8"))
    if a.from_recording:
        raw = pathlib.Path(a.from_recording).read_bytes()
    else:
        items = json.loads(pathlib.Path(a.questions).read_text(encoding="utf-8")) if a.questions else DEFAULT_QUESTIONS
        recording = []
        for it in items:
            q, ctx = (it, DEFAULT_CONTEXT) if isinstance(it, str) else (it["question"], it.get("context", DEFAULT_CONTEXT))
            body = json.dumps({"question": q, "context": ctx}).encode()
            req = urllib.request.Request(f"{a.url}/ask", data=body, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=180) as r:
                resp = json.load(r)
            recording.append({"question": q, "response": resp, "label": "Recorded from the onboard model"})
            print(f"[{resp['status']}] {q}")
        raw = render(recording).encode()
        print(f"raw recording saved -> {archive_recording(raw, pathlib.Path(a.recordings_dir))}")
    out = publish(json.loads(raw), policy, hashlib.sha256(raw).hexdigest())
    pathlib.Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    pathlib.Path(a.out).write_text(render(out), encoding="utf-8")
    print(f"published {len(out)} reviewed entries -> {a.out}")


if __name__ == "__main__":
    main()
