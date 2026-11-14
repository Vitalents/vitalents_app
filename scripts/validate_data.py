#!/usr/bin/env python3
"""Validate Vitalents data files against contracts/*.schema.json (contract v1.0).

Usage:
  python3 scripts/validate_data.py                     # every JSON under app/public/data and contracts/examples
  python3 scripts/validate_data.py path/to/file.json   # specific files

A data file is a bundle: {"bundle_version": "1.0", "<entity>": [records...], ...}.
Keys that are not entity names (bundle_version, expected, notes) are ignored.

Besides the JSON Schemas, this enforces the rules JSON Schema cannot express (docs/CONTRACT_P0.md):
  R1 IDs are unique across the bundle.
  R2 A record's realm (prefix before ':') equals its subject's realm.
  R3 A record only references IDs in its own realm, or lib:/rule: IDs.
  R4 Realm and provenance agree: sim -> is_simulated true (except a live round played into a simulation),
     research -> is_simulated false, live -> is_simulated false.
  R5 subject_profile.subject_mode matches its realm.
Exit code 1 on any error.
"""
import json, sys, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTRACTS = ROOT / "contracts"
try:
    from jsonschema import Draft202012Validator
except ImportError:
    sys.exit("pip install jsonschema")

SCHEMAS = {p.name.replace(".schema.json", ""): Draft202012Validator(json.loads(p.read_text()))
           for p in CONTRACTS.glob("*.schema.json")}
ID_RE = re.compile(r"^(sim|live|research|lib|rule):[A-Za-z0-9_.:-]+$")
MODE_FOR_REALM = {"sim": "mission_simulation", "research": "real_research", "live": "live_player"}
SHARED_REALMS = {"lib", "rule"}


def realm(i):
    return i.split(":", 1)[0] if isinstance(i, str) and ID_RE.match(i) else None


def iter_ids(value):
    if isinstance(value, str) and ID_RE.match(value):
        yield value
    elif isinstance(value, list):
        for v in value:
            yield from iter_ids(v)


def check_bundle(path):
    errors = []
    data = json.loads(path.read_text())
    if not isinstance(data, dict):
        return [f"{path}: top level must be an object (bundle)"]
    seen = {}
    records = []
    for ent, recs in data.items():
        if ent not in SCHEMAS:
            continue
        if not isinstance(recs, list):
            errors.append(f"{path}: '{ent}' must be a list"); continue
        for n, rec in enumerate(recs):
            where = f"{path.name}:{ent}[{n}]"
            for e in sorted(SCHEMAS[ent].iter_errors(rec), key=lambda e: list(e.path)):
                loc = "/".join(str(p) for p in e.path) or "(record)"
                errors.append(f"{where} {loc}: {e.message}")
            pk = rec.get(f"{ent}_id")
            if pk:
                if pk in seen:
                    errors.append(f"{where}: duplicate id {pk} (also {seen[pk]})")  # R1
                seen[pk] = where
            records.append((ent, where, rec))
    live_sessions = {rec.get("decode_session_id") for ent, _, rec in records
                     if ent == "decode_session" and rec.get("played_live_into_simulation")}
    for ent, where, rec in records:
        pk = rec.get(f"{ent}_id")
        own = realm(pk)
        subj = rec.get("subject_id")
        if subj and own and realm(subj) != own:  # R2
            errors.append(f"{where}: id realm '{own}' differs from subject realm '{realm(subj)}'")
        for field, value in rec.items():  # R3
            if field == f"{ent}_id":
                continue
            for ref in iter_ids(value):
                r = realm(ref)
                if own and r not in (own, *SHARED_REALMS):
                    errors.append(f"{where} {field}: cross-realm reference {ref}")
        sim = rec.get("is_simulated")  # R4
        live_ok = rec.get("data_origin") == "live_decode" and (
            rec.get("played_live_into_simulation") or rec.get("decode_session_id") in live_sessions)
        if own == "sim" and sim is False and not live_ok:
            errors.append(f"{where}: sim realm record must have is_simulated true")
        if own in ("research", "live") and sim is True:
            errors.append(f"{where}: {own} realm record cannot be simulated")
        if own == "research" and rec.get("data_origin") == "simulated_mission":
            errors.append(f"{where}: research realm cannot carry simulated_mission data")
        if ent == "subject_profile" and own in MODE_FOR_REALM and rec.get("subject_mode") != MODE_FOR_REALM[own]:  # R5
            errors.append(f"{where}: subject_mode must be {MODE_FOR_REALM[own]} for realm {own}")
    return errors


def main(argv):
    if argv:
        files = [pathlib.Path(a) for a in argv]
    else:
        files = sorted((ROOT / "app/public/data").rglob("*.json")) + sorted((CONTRACTS / "examples").glob("*.json"))
        files = [f for f in files if f.name not in ("cached_answers.json",)]
    total = 0
    for f in files:
        errs = check_bundle(f)
        total += len(errs)
        print(("OK   " if not errs else "FAIL ") + str(f.relative_to(ROOT) if f.is_relative_to(ROOT) else f))
        for e in errs[:50]:
            print("     " + e)
    print(f"\n{len(files)} file(s), {total} error(s)")
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
