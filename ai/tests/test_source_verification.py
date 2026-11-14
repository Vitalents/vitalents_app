"""Keep the recorded source-check scope tied to the actual excerpt files."""
import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_source_verification_matches_current_corpus_and_does_not_grant_approval():
    audit = json.loads((ROOT / "ai/source_verification.json").read_text())
    sources = json.loads((ROOT / "ai/corpus/sources.json").read_text())
    assert len(audit["sources"]) == len(sources) == 34
    assert {s["id"] for s in audit["sources"]} == {s["id"] for s in sources}
    assert all(s["approval_status"] == "draft" for s in sources)
    assert sum(s["ui_quote_matches"] for s in audit["sources"]) == 97
    assert sum(s["corpus_quote_matches"] for s in audit["sources"]) == 168
    assert sum(len(s["locator_corrections"]) for s in audit["sources"]) == 9
    assert audit["scope"]["clinical_validation"] is False
    assert audit["scope"]["human_approval_recorded"] is False
    assert audit["scope"]["all_redistribution_rights_cleared"] is False
    for source in audit["sources"]:
        raw = (ROOT / "ai/corpus" / source["corpus_file"]).read_bytes()
        assert hashlib.sha256(raw).hexdigest() == source["corrected_corpus_sha256"]
        text = raw.decode()
        for change in source["locator_corrections"]:
            assert change["old"] not in text
            assert change["corrected"] in text
