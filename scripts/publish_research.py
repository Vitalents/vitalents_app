#!/usr/bin/env python3
"""Copy the research-track outputs (FR-RT-01) into the app: research/out/model_*.json -> app/public/data/research/.

Also writes app/public/data/research/index.json, one entry per subject, so the Research screen can find the
file for the scenario's crew member. Generated files only: never edit app/public/data/ by hand.
Refuses any file that is not marked simulated.

Usage: python3 research/model.py && python3 scripts/publish_research.py
"""
import json
import pathlib
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "research/out"
DST = ROOT / "app/public/data/research"


def main() -> int:
    files = sorted(SRC.glob("model_*.json"))
    if not files:
        print("publish_research: no research/out/model_*.json; run python3 research/model.py first", file=sys.stderr)
        return 1
    DST.mkdir(parents=True, exist_ok=True)
    for old in DST.glob("model_*.json"):
        old.unlink()
    entries = []
    for f in files:
        res = json.loads(f.read_text(encoding="utf-8"))
        if res.get("is_simulated") is not True or not str(res.get("research_model_id", "")).startswith("sim:"):
            print(f"publish_research: {f.name} is not simulated; refusing to publish", file=sys.stderr)
            return 1
        shutil.copyfile(f, DST / f.name)
        entries.append({"subject_id": res["subject_id"], "file": f.name, "model_version": res["model_version"], "verdict": res["verdict"]})
    index = {"index_version": "1.0", "label": "Research prototype on simulated data — not used for any step or alert", "models": entries}
    (DST / "index.json").write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"publish_research: {len(entries)} model file(s) -> {DST.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
