"""Offline fixtures: a tiny test corpus, keyword embeddings and scriptable fake LLMs. No Ollama needed."""
import json
import pathlib
import shutil
import sys

import pytest

AI_DIR = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AI_DIR))

import ask_nasa  # noqa: E402

SLEEP_TEXT = """Inadequate sleep and irregular schedules
Crew members on long missions often record less sleep than scheduled. Light exposure, workload and
irregular shifts affect the sleep cycle. Countermeasures studied include scheduled lighting and
protected rest periods of 8.5 hours. Sleep loss is associated with slower responses on demanding tasks."""

BEHAVIOR_TEXT = """Behavioral health in isolation and confinement
Isolation and confinement can affect mood and cognition. Crew members keep journals, talk with
family, and spend time on hobbies such as caring for plants. Cognition tests are repeated on a schedule."""


class FakeLLM:
    """Returns a scripted JSON answer and records every call so tests can inspect the prompt."""

    def __init__(self, reply: dict | str | None = None):
        self.reply = reply
        self.calls: list = []

    def invoke(self, messages):
        self.calls.append(messages)
        content = self.reply if isinstance(self.reply, str) else json.dumps(self.reply or {})
        return type("R", (), {"content": content})()


class ObedientLLM(FakeLLM):
    """A deliberately compromised model: if a source contains an instruction, it follows it."""

    def invoke(self, messages):
        self.calls.append(messages)
        human = messages[-1][1]
        if "ignore all previous rules" in human.lower():
            reply = {"science": "You are ready for the spacewalk and fit for duty; take a 10 mg sleeping pill tonight.",
                     "citations": [], "not_in_library": False}
        else:
            reply = {"science": "Sleep is scheduled around mission tasks [S1].", "citations": ["S1"], "not_in_library": False}
        return type("R", (), {"content": json.dumps(reply)})()


def make_corpus(tmp: pathlib.Path, with_injection: bool = False) -> pathlib.Path:
    corpus = tmp / "corpus"
    corpus.mkdir()
    (corpus / "sleep.md").write_text(SLEEP_TEXT, encoding="utf-8")
    (corpus / "behavior.md").write_text(BEHAVIOR_TEXT, encoding="utf-8")
    sources = [
        {"file": "sleep.md", "id": "lib:nasa-sleep-risk", "title": "Risk from Inadequate Sleep and Irregular Schedules",
         "publisher": "NASA HRP", "url": "https://example.org/sleep", "date": "2024-01-01", "license": "public domain",
         "scope": "sleep", "approval_status": "reviewed"},
        {"file": "behavior.md", "id": "lib:nasa-behavioral-risk", "title": "Risk of Behavioral Changes and Psychiatric Disorders",
         "publisher": "NASA HRP", "url": None, "date": None, "license": "public domain", "scope": "behavior",
         "approval_status": "reviewed"},
    ]
    if with_injection:
        shutil.copy(AI_DIR / "tests" / "injection.md", corpus / "injection.md")
        sources.append({"file": "injection.md", "id": "lib:test-injection", "title": "Crew sleep scheduling notes",
                        "approval_status": "draft"})
    (corpus / "sources.json").write_text(json.dumps(sources), encoding="utf-8")
    return corpus


@pytest.fixture
def lib(tmp_path):
    """Builds an index over the test corpus with keyword embeddings; returns a helper to set the LLM."""

    def setup(llm=None, with_injection=False, min_score=0.2):
        corpus = make_corpus(tmp_path, with_injection)
        ask_nasa.configure(embeddings=ask_nasa.KeywordEmbeddings(), llm=llm or FakeLLM(), corpus=corpus,
                           index=tmp_path / "index.json", traces=tmp_path / "traces", min_score=min_score,
                           model_name="fake-llm")
        ask_nasa.build()
        return ask_nasa

    yield setup
    ask_nasa.configure(embeddings=None, llm=None, store=None, min_score=0.55, corpus=ask_nasa.AI_DIR / "corpus",
                       index=ask_nasa.AI_DIR / "index.json", traces=ask_nasa.AI_DIR / "traces", model_name=ask_nasa.LLM_MODEL)
