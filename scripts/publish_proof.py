#!/usr/bin/env python3
"""Publish the evidence numbers for the Proof screen (FR-SIM-04, FR-AS-08, Increment 6).

Reads, only if they exist:
  science/out/validation.json          written by science/validate.py
  science/out/assistant_eval*.json     written by `ai/ask_nasa.py --eval ... --out ...`
checks their shape, and writes app/public/data/proof.json.

proof.json holds only numbers copied from those files (the assistant rates are computed from the copied
counts by ai/eval_summary.py, with the counts kept beside them), each with its source path and time.
A missing input gives explicit nulls and "status": "not_generated", never a placeholder number (CLAUDE.md rule 6).

Usage:
  python3 scripts/publish_proof.py                 # repo paths
  python3 scripts/publish_proof.py --check         # validate inputs, print problems, write nothing
"""
from __future__ import annotations

import datetime as dt
import importlib.util
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
VALIDATION = "science/out/validation.json"
EVAL_GLOB = "assistant_eval*.json"
EVAL_DIR = "science/out"
OUT = "app/public/data/proof.json"
GENERATED_BY = "scripts/publish_proof.py"
PROOF_VERSION = "1.0"

# The four areas of SRS 14.3. knowledge_assistant is optional in validation.json: the eval files carry it.
AREAS = ("execution_integrity", "measurement_analysis", "knowledge_assistant", "use")
CHECK_KEYS = {"id", "label", "method", "value", "unit", "numerator", "denominator", "passed", "scenario"}
ID_RE = re.compile(r"^[a-z][a-z0-9_]*$")
UTC_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z$")


def _load(name: str, path: pathlib.Path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


eval_summary = _load("eval_summary", ROOT / "ai" / "eval_summary.py")
language = _load("check_language", ROOT / "scripts" / "check_language.py")


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def mtime_utc(p: pathlib.Path) -> str:
    t = dt.datetime.fromtimestamp(p.stat().st_mtime, dt.timezone.utc).replace(microsecond=0)
    return t.isoformat().replace("+00:00", "Z")


def _num(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def _count(v) -> bool:
    return isinstance(v, int) and not isinstance(v, bool) and v >= 0


def check_check(c, where: str) -> list[str]:
    """Problems with one check entry; an empty list means it is published."""
    if not isinstance(c, dict):
        return [f"{where}: must be an object"]
    p = []
    if not isinstance(c.get("id"), str) or not ID_RE.match(c["id"]):
        p.append(f"{where}: 'id' must be snake_case text")
    if not isinstance(c.get("label"), str) or not c["label"].strip():
        p.append(f"{where}: 'label' must be text")
    else:
        for hit in language.scan_text(c["label"]) + language.scan_text(c.get("method") or ""):
            p.append(f"{where}: forbidden wording '{hit}' in label or method")
    if "value" not in c:
        p.append(f"{where}: 'value' is required (a number, or null when not measured)")
    elif c["value"] is not None and not _num(c["value"]):
        p.append(f"{where}: 'value' must be a number or null")
    for k in ("unit", "method", "scenario"):
        if c.get(k) is not None and not isinstance(c[k], str):
            p.append(f"{where}: '{k}' must be text or null")
    for k in ("numerator", "denominator"):
        if c.get(k) is not None and not _count(c[k]):
            p.append(f"{where}: '{k}' must be a non-negative integer or null")
    if _count(c.get("numerator")) and _count(c.get("denominator")) and c["numerator"] > c["denominator"]:
        p.append(f"{where}: numerator is larger than denominator")
    if c.get("unit") == "rate" and c.get("value") is not None and not (_count(c.get("numerator")) and _count(c.get("denominator"))):
        p.append(f"{where}: a rate needs the count behind it (numerator and denominator)")
    if c.get("passed") is not None and not isinstance(c["passed"], bool):
        p.append(f"{where}: 'passed' must be true, false or null")
    extra = set(c) - CHECK_KEYS
    if extra:
        p.append(f"{where}: unknown keys {sorted(extra)}")
    return p


def empty_validation(status: str, problems: list[str]) -> dict:
    return {"status": status, "source": VALIDATION, "source_generated_at_utc": None, "source_generated_by": None,
            "seed": None, "areas": None, "illustrative_parameters": None, "problems": problems}


def read_validation(root: pathlib.Path) -> dict:
    path = root / VALIDATION
    if not path.exists():
        return empty_validation("not_generated", [])
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        return empty_validation("invalid", [f"{VALIDATION}: not valid JSON ({e.msg})"])
    if not isinstance(data, dict):
        return empty_validation("invalid", [f"{VALIDATION}: top level must be an object"])
    problems = []
    at = data.get("generated_at_utc")
    if not isinstance(at, str) or not UTC_RE.match(at):
        problems.append(f"{VALIDATION}: 'generated_at_utc' must be a UTC timestamp ending in Z")
    areas_in = data.get("areas")
    if not isinstance(areas_in, dict):
        problems.append(f"{VALIDATION}: 'areas' must be an object keyed by {', '.join(AREAS)}")
        return empty_validation("invalid", problems)
    for k in areas_in:
        if k not in AREAS:
            problems.append(f"{VALIDATION}: unknown area '{k}' (not published)")
    areas = {}
    for name in AREAS:
        area = areas_in.get(name)
        if area is None:
            areas[name] = None
            continue
        checks = area.get("checks") if isinstance(area, dict) else None
        if not isinstance(checks, list):
            problems.append(f"{VALIDATION}: areas.{name}.checks must be a list")
            areas[name] = None
            continue
        kept, seen = [], set()
        for i, c in enumerate(checks):
            where = f"areas.{name}.checks[{i}]"
            cp = check_check(c, where)
            if not cp and c["id"] in seen:
                cp = [f"{where}: duplicate id '{c['id']}'"]
            if cp:
                problems.extend(cp)
                continue
            seen.add(c["id"])
            kept.append({k: c.get(k) for k in ("id", "label", "method", "value", "unit", "numerator", "denominator", "passed", "scenario")})
        areas[name] = {"checks": kept}
    seed = data.get("seed")
    if seed is not None and not (isinstance(seed, int) and not isinstance(seed, bool)):
        problems.append(f"{VALIDATION}: 'seed' must be an integer or null")
        seed = None
    ill = data.get("illustrative_parameters")
    if ill is not None and not (isinstance(ill, list) and all(isinstance(x, str) for x in ill)):
        problems.append(f"{VALIDATION}: 'illustrative_parameters' must be a list of text")
        ill = None
    by = data.get("generated_by") if isinstance(data.get("generated_by"), str) else None
    return {"status": "generated", "source": VALIDATION,
            "source_generated_at_utc": at if isinstance(at, str) and UTC_RE.match(at) else None,
            "source_generated_by": by, "seed": seed, "areas": areas, "illustrative_parameters": ill, "problems": problems}


def read_evals(root: pathlib.Path) -> dict:
    files = sorted((root / EVAL_DIR).glob(EVAL_GLOB)) if (root / EVAL_DIR).is_dir() else []
    models, problems = [], []
    for f in files:
        rel = f.relative_to(root).as_posix()
        try:
            s = eval_summary.summarize_file(f)
        except (OSError, eval_summary.EvalShapeError) as e:
            problems.append(f"{rel}: {e} (not published)")
            continue
        warnings = s.pop("warnings")
        problems.extend(f"{rel}: {w}" for w in warnings)
        models.append({"source": rel, "source_modified_at_utc": mtime_utc(f), "derived_by": "ai/eval_summary.py", **s})
    status = "generated" if models else ("invalid" if files else "not_generated")
    return {"status": status, "source_pattern": f"{EVAL_DIR}/{EVAL_GLOB}", "models": models or None, "problems": problems}


def build_proof(root: pathlib.Path = ROOT, now: str | None = None) -> dict:
    v = read_validation(root)
    a = read_evals(root)
    states = {v["status"], a["status"]}
    status = "generated" if states == {"generated"} else ("partial" if "generated" in states else "not_generated")
    return {"proof_version": PROOF_VERSION, "generated_by": GENERATED_BY, "generated_at_utc": now or utc_now(),
            "status": status, "validation": v, "assistant_eval": a}


def main(argv: list[str]) -> int:
    proof = build_proof()
    for section in ("validation", "assistant_eval"):
        s = proof[section]
        print(f"{section}: {s['status']}")
        for p in s["problems"]:
            print(f"  {p}")
    if "--check" in argv:
        return 1 if any(proof[s]["status"] == "invalid" for s in ("validation", "assistant_eval")) else 0
    out = ROOT / OUT
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(proof, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT} (status {proof['status']})")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
