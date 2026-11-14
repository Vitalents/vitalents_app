#!/usr/bin/env python3
"""Forbidden-wording check (NFR-06, docs/SRS.md section 13). Exit 1 on any hit.

Scans user-facing text: string literals and JSX text in app/src/**/*.ts(x), and every string value in content/*.json.
Skips the generated app/src/data/contract.ts and test files. A line ending in `// lang-ok` is allowed.

Usage: python3 scripts/check_language.py
"""
import json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PATTERNS = [
    (r"\bhealthy\b", "healthy"),
    (r"\ball clear\b", "all clear"),
    (r"\bnormal\b", "normal (as a status)"),
    (r"\bdiagnos\w*", "diagnosis / diagnose"),
    (r"\breadiness score\b", "readiness score"),
    (r"\bnot ready\b", "not ready"),
    (r"\bready\b", "ready (as a verdict)"),
    (r"\bfit for duty\b", "fit for duty"),
    (r"\bfatigue detected\b", "fatigue detected"),
    (r"\bproves?\b", "proves"),
    (r"\bcaused by\b", "caused by"),
    (r"\bworked\b", "worked"),
    (r"\bbest treatment\b", "best treatment"),
    (r"\bvalidated\b", "validated"),
    (r"\bwill improve your sleep\b", "will improve your sleep"),
]
COMPILED = [(re.compile(p, re.IGNORECASE), label) for p, label in PATTERNS]
# User-facing text in TS/TSX: quoted strings, template literals, and JSX text between tags.
STRING_RE = re.compile(r"'(?:[^'\\\n]|\\.)*'|\"(?:[^\"\\\n]|\\.)*\"|`(?:[^`\\]|\\.)*`|>([^<>{}\n]+)<")


NEGATION = re.compile(r"\b(no|not|never|cannot|without|n't)\b[\w\s,]{0,30}$", re.IGNORECASE)


def scan_text(text):
    """A forbidden word is allowed only when negated just before it ("not a diagnosis", "does not prove")."""
    hits = []
    for rx, label in COMPILED:
        for m in rx.finditer(text):
            if not NEGATION.search(text[: m.start()]):
                hits.append(label)
                break
    return hits


def scan_ts(path):
    hits = []
    for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if line.rstrip().endswith("// lang-ok") or line.lstrip().startswith(("//", "*", "/*", "import ")):
            continue
        for m in STRING_RE.finditer(line):
            frag = m.group(1) if m.group(1) is not None else m.group(0)[1:-1]
            for label in scan_text(frag):
                hits.append((path, n, label, frag.strip()[:80]))
    return hits


def scan_json(path):
    hits = []
    def walk(v, where):
        if isinstance(v, str):
            for label in scan_text(v):
                hits.append((path, where, label, v[:80]))
        elif isinstance(v, list):
            for i, x in enumerate(v):
                walk(x, f"{where}[{i}]")
        elif isinstance(v, dict):
            for k, x in v.items():
                if k in ("review_status",):  # editorial notes, not shown to users
                    continue
                walk(x, f"{where}.{k}")
    walk(json.loads(path.read_text(encoding="utf-8")), "$")
    return hits


def main():
    hits = []
    for p in sorted((ROOT / "app/src").rglob("*.ts*")):
        if p.name == "contract.ts" or ".test." in p.name:
            continue
        hits += scan_ts(p)
    for p in sorted((ROOT / "content").glob("*.json")):
        hits += scan_json(p)
    for path, where, label, frag in hits:
        print(f"{path.relative_to(ROOT)}:{where}: '{label}' in \"{frag}\"")
    print(f"\ncheck_language: {len(hits)} hit(s)")
    return 1 if hits else 0


if __name__ == "__main__":
    sys.exit(main())
