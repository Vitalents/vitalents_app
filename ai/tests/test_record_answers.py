"""Publication checks use the recorded model output; no model or clinical inference."""
import copy
import hashlib
import json
import pathlib

import record_answers as recorder


ROOT = pathlib.Path(__file__).resolve().parents[2]
POLICY = json.loads((ROOT / "ai/cache_review.json").read_text())
RAW_PATH = ROOT / "ai" / POLICY["raw_recording"]
RAW = RAW_PATH.read_bytes()
ORIGINAL = json.loads(RAW)


def published():
    return recorder.publish(ORIGINAL, POLICY, hashlib.sha256(RAW).hexdigest())


def test_public_cache_is_reproducible_from_immutable_recording():
    assert hashlib.sha256(RAW).hexdigest() == POLICY["raw_recording_sha256"]
    assert (ROOT / "app/public/data/cached_answers.json").read_text() == recorder.render(published())
    assert len(published()) == 5
    assert {r["publication_review"]["decision"] for r in published()} == {"retain", "withdraw"}


def test_two_unsupported_answers_are_withheld_not_reworded_as_model_output():
    cache = published()
    for i in (0, 2):
        assert ORIGINAL[i]["response"]["status"] == "answered"
        assert ORIGINAL[i]["response"]["science"]
        assert cache[i]["response"]["status"] == "blocked"
        assert cache[i]["response"]["science"] is None
        assert cache[i]["response"]["citations"] == []
        assert "publication decision, not a new answer from the model" in cache[i]["response"]["limits"]
        assert cache[i]["publication_review"]["science_text_withheld"] is True
    serialized = recorder.render(cache)
    assert "ensuring that astronauts maintain the necessary rest" not in serialized
    assert "Pulse rate alone cannot detect arrhythmias" not in serialized
    assert "heart shape and mass" not in serialized


def test_retained_science_is_identical_and_citation_locators_are_honest():
    cache = published()
    assert cache[1]["response"]["status"] == "not_in_library"
    assert cache[4]["response"]["status"] == "blocked"
    assert cache[3]["response"]["science"] == ORIGINAL[3]["response"]["science"]
    assert all(c["page"] is None for c in cache[3]["response"]["citations"])
    assert "[p. 1, Executive Summary]" in cache[3]["response"]["citations"][1]["excerpt"]
    assert "[p. 2, Executive Summary]" in ORIGINAL[3]["response"]["citations"][1]["excerpt"]


def test_a_new_answer_to_the_same_question_is_not_implicitly_reviewed():
    changed = copy.deepcopy(ORIGINAL)
    changed[3]["response"]["science"] += " An unsupported new claim."
    result = recorder.publish(changed, POLICY, "new-recording")
    assert result[3]["publication_review"]["decision"] == "pending_review"
    assert result[3]["response"]["science"] is None
    assert result[3]["response"]["status"] == "blocked"
    assert changed[3]["response"]["science"].endswith("An unsupported new claim.")


def test_archiving_is_content_addressed_and_never_overwrites(tmp_path):
    first = recorder.archive_recording(RAW, tmp_path)
    again = recorder.archive_recording(RAW, tmp_path)
    other = recorder.archive_recording(b"[]", tmp_path)
    assert first == again and first != other
    assert first.read_bytes() == RAW
