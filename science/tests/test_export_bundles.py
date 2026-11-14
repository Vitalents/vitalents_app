"""science/export_bundles.py: Shaimaa's S1-S4 replay as contract v1.0 app bundles (FR-SIM-02, FR-SIM-03).

Run: cd science && python3 -m pytest -q tests/test_export_bundles.py
"""
import importlib.util
import json
import re
from pathlib import Path

import pytest

from science import decode, export_bundles, simulator, status

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "app/public/data/fixtures"
UTC_FIELD = re.compile(r"(_utc|_at)$")


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


validate_data = _load("validate_data", ROOT / "scripts/validate_data.py")
check_language = _load("check_language", ROOT / "scripts/check_language.py")


@pytest.fixture(scope="module")
def replay():
    return simulator.run_all()


@pytest.fixture(scope="module")
def outputs(replay):
    return export_bundles.export(replay)


@pytest.fixture(scope="module")
def written(outputs, tmp_path_factory):
    return export_bundles.write(outputs, tmp_path_factory.mktemp("export"))


def bundles(outputs):
    return {Path(k).stem: v for k, v in outputs.items() if k.startswith("scenarios/")}


def strings(v):
    if isinstance(v, str):
        yield v
    elif isinstance(v, list):
        for x in v:
            yield from strings(x)
    elif isinstance(v, dict):
        for x in v.values():
            yield from strings(x)


def test_deterministic(replay):
    a = export_bundles.dumps(export_bundles.export(replay))
    b = export_bundles.dumps(export_bundles.export(simulator.run_all()))
    assert a == b


def test_every_bundle_validates(written):
    for code in ("S1", "S2", "S3", "S4", "S5"):
        errors = validate_data.check_bundle(written / "scenarios" / f"{code}.json")
        assert errors == [], (code, errors[:5])


def test_s5_is_the_existing_fixture(written):
    assert (written / "scenarios/S5.json").read_bytes() == (FIXTURES / "S5.json").read_bytes()


def test_bundle_shape_matches_hand_made_fixture(outputs):
    s1_fixture = json.loads((FIXTURES / "S1.json").read_text())
    for code, b in bundles(outputs).items():
        assert list(b)[:3] == ["bundle_version", "notes", "simulator_scenario"]
        assert b["bundle_version"] == s1_fixture["bundle_version"]
        assert b["simulator_scenario"][0]["scenario_code"] == code
        assert len(b["subject_profile"]) == 1
        assert b["simulator_scenario"][0]["crew_subject_ids"] == [b["subject_profile"][0]["subject_profile_id"]]
        assert b["simulator_scenario"][0]["simulation_banner"] == "SIMULATED DATA"


def test_provenance_ids_and_time(outputs):
    for code, b in bundles(outputs).items():
        for entity, rows in b.items():
            if not isinstance(rows, list):
                continue
            for r in rows:
                rid = r[f"{entity}_id"]
                if entity != "subject_profile":
                    assert rid.split(":")[1] == entity, rid          # D-1 <realm>:<entity>:<key>
                assert rid.startswith("sim:")
                if "is_simulated" in r:
                    assert r["is_simulated"] is True
                for k, v in r.items():
                    if UTC_FIELD.search(k) and isinstance(v, str):
                        assert v.endswith("Z"), (rid, k, v)
        # The replay's review day is mission day 27 = 2026-11-14 (D-2).
        assert b["daily_review"][0]["review_date"] == "2026-11-14"


def test_values_come_from_the_replay(replay, outputs):
    """Every measured value is the replay's value; only dates and IDs change."""
    conv = export_bundles.Converter(replay["scenarios"][0]["daily_review"]["review_date"])
    b = bundles(outputs)
    for s in replay["scenarios"]:
        out = b[s["scenario"]["scenario_code"]]
        sleep = {r["sleep_record_id"]: r for r in out["sleep_record"]}
        for r in s["sleep_records"]:
            assert sleep[conv.remap_id(r["sleep_record_id"])]["minutes_asleep"] == r["minutes_asleep"]
        sessions = {r["decode_session_id"]: r for r in out["decode_session"]}
        for g in s["decode"]:
            mine = sessions[conv.remap_id(g["session"]["decode_session_id"])]
            for k in decode.SCORE_FIELDS:
                assert mine[k] == g["session"][k]
        assert len(out["decode_response_event"]) == sum(len(g["events"]) for g in s["decode"])


def test_s1_story(outputs):
    s1 = bundles(outputs)["S1"]
    last = max(s1["sleep_record"], key=lambda r: r["observation_date"])
    assert (last["observation_date"], last["minutes_asleep"]) == ("2026-11-14", 335)
    today = next(s for s in s1["decode_session"] if s["start_at_utc"].startswith("2026-11-14"))
    assert today["median_correct_rt_ms"] == 840.0
    refs = {r["metric_code"]: r for r in s1["personal_reference"]}
    assert refs["minutes_asleep"]["reference_value"] == 425.0 and refs["median_correct_rt_ms"]["reference_value"] == 620.0
    assert all(r["frozen"] for r in refs.values())
    assert today["decode_session_id"] not in refs["median_correct_rt_ms"]["source_record_ids"]
    assert s1["follow_up"][0]["followup_status"] == "action_open"
    kinds = {m["item_kind"]: m for m in s1["mission_schedule"]}
    assert (kinds["rest_window"]["start_at"], kinds["rest_window"]["end_at"]) == ("2026-11-14T23:00:00Z", "2026-11-15T06:00:00Z")
    assert kinds["task"]["is_fixed"] is False


def test_other_scenarios(outputs):
    b = bundles(outputs)
    s2 = b["S2"]
    assert "2026-11-14" not in {r["observation_date"] for r in s2["sleep_record"]}       # absent, never zero
    st = {s["record_ref"]: s for s in s2["information_status"]}
    dec = s2["decode_session"][0]
    assert dec["session_state"] == "interrupted" and st[dec["decode_session_id"]]["status"] == "not_comparable"
    s3 = b["S3"]
    assert sum(1 for m in s3["mission_schedule"] if m["item_kind"] == "task" and m["is_fixed"]) == 1
    assert s3["follow_up"][0]["followup_status"] == "watching"
    s4 = b["S4"]
    temp = next(m for m in s4["measurement"] if m["metric_code"] == "nightly_skin_temperature")
    st4 = {s["record_ref"]: s for s in s4["information_status"]}
    assert st4[temp["measurement_id"]]["status"] == "incomplete"
    assert "unsupported_metric" in st4[temp["measurement_id"]]["reason_codes"]
    assert s4["follow_up"][0]["followup_status"] == "review_requested"


def test_status_rows_agree_with_engines(replay, outputs):
    """Every stored status equals status.evaluate() on the exported record, and each DECODE row
    equals the status that science/decode.verify attached to the replay's ledger."""
    conv = export_bundles.Converter(replay["scenarios"][0]["daily_review"]["review_date"])
    b = bundles(outputs)
    for s in replay["scenarios"]:
        out = b[s["scenario"]["scenario_code"]]
        profile = out["subject_profile"][0]
        stored = {r["record_ref"]: r for r in out["information_status"]}
        verified = {conv.remap_id(g["session"]["decode_session_id"]): g["verification"] for g in s["decode"]}
        n = 0
        for kind in status.KINDS:
            for r in out.get(kind, []):
                rid = r[f"{kind}_id"]
                ctx = {"subject": {"subject_profile_id": profile["subject_profile_id"], "subject_mode": profile["subject_mode"]}}
                if kind == "decode_session":
                    ctx["events_verified"] = verified[rid]["events_verified"]
                    assert stored[rid]["status"] == verified[rid]["information_status"]["status"]
                assert stored[rid]["status"] == status.evaluate(kind, r, context=ctx)["status"]
                n += 1
        assert n == len(stored)


def test_exported_ledgers_still_verify(replay, outputs):
    """The converted sessions and events pass Shaimaa's verifier with the converted capture seal."""
    conv = export_bundles.Converter(replay["scenarios"][0]["daily_review"]["review_date"])
    b = bundles(outputs)
    n = 0
    for s in replay["scenarios"]:
        out = b[s["scenario"]["scenario_code"]]
        events = {}
        for e in out["decode_response_event"]:
            events.setdefault(e["decode_session_id"], []).append(e)
        for g in s["decode"]:
            sid = conv.remap_id(g["session"]["decode_session_id"])
            session = next(x for x in out["decode_session"] if x["decode_session_id"] == sid)
            seal = [conv.remap_id(i) for i in g["expected_event_ids"]]
            audit = decode.verify(session, events[sid], subject=out["subject_profile"][0],
                                  key_registry=replay["decode_key_registry"], expected_event_ids=seal)
            assert audit["events_verified"] and not audit["issues"], (sid, audit["issues"])
            n += 1
    assert n == 24


def test_wording(outputs):
    hits = [(code, t, check_language.scan_text(t)) for code, b in bundles(outputs).items()
            for t in strings(b) if check_language.scan_text(t)]
    assert hits == []
