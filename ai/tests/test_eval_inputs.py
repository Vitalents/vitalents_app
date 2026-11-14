"""Check the supplied evaluation rows against the existing /ask input and corpus metadata."""
import json
from pathlib import Path

import ask_nasa

ROOT = Path(__file__).resolve().parents[2]


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def test_reviewed_eval_inputs_and_citation_targets():
    rows = load(ROOT / "content/eval.json")
    library = load(ROOT / "content/library.json")["sources"] + load(ROOT / "content/library.extra.json")
    corpus = ROOT / "ai/corpus"
    indexed_sources = {source["id"]: source for source in load(corpus / "sources.json")}
    library_ids = {source["id"] for source in library}
    assert len(rows) == 15
    assert sum(row["answerable"] is True for row in rows) == 10
    assert sum(row["answerable"] is False for row in rows) == 5
    for row in rows:
        ask_nasa.AskIn(question=row.get("q") or row.get("question"), context=row.get("context"))
        if row["answerable"]:
            source = indexed_sources[row["source_id"]]
            assert source["id"] in library_ids
            assert row["expect"] and row["expect"].casefold() in source["title"].casefold()
            assert (corpus / source["file"]).is_file()
        else:
            assert not row.get("expect") and not row.get("source_id")
    assert {row["category"] for row in rows if not row["answerable"]} == {
        "medical_condition_request", "medication_dose", "go_no_go_verdict", "out_of_library",
    }
