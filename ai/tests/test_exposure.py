"""Exposure guards for publishing the API through the Cloudflare Tunnel (no Ollama needed)."""
from fastapi.testclient import TestClient

import ask_nasa


def _client():
    ask_nasa._hits.clear()
    return TestClient(ask_nasa.app)


def test_cors_allows_our_sites_only():
    c = _client()
    for origin in ("https://vitalents.life", "https://www.vitalents.life", "https://main.vitalents.pages.dev", "http://localhost:5173"):
        r = c.options("/ask", headers={"Origin": origin, "Access-Control-Request-Method": "POST",
                                       "Access-Control-Request-Headers": "content-type"})
        assert r.headers.get("access-control-allow-origin") == origin, origin
    r = c.options("/ask", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"})
    assert r.headers.get("access-control-allow-origin") is None


def test_rate_limit_per_visitor(monkeypatch):
    monkeypatch.setattr(ask_nasa, "RATE_LIMIT", 3)
    c = _client()
    codes = [c.post("/ask", json={"question": ""}, headers={"CF-Connecting-IP": "203.0.113.7"}).status_code for _ in range(4)]
    assert codes[:3] != [429, 429, 429] and codes[3] == 429
    # A different visitor is not affected.
    assert c.post("/ask", json={"question": ""}, headers={"CF-Connecting-IP": "203.0.113.8"}).status_code != 429


def test_oversized_and_overlong_requests_refused():
    c = _client()
    big = "x" * (ask_nasa.MAX_BODY_BYTES + 10)
    assert c.post("/ask", content=big, headers={"Content-Type": "application/json"}).status_code == 413
    assert c.post("/ask", json={"question": "q" * (ask_nasa.MAX_QUESTION_CHARS + 1)}).status_code == 422


def test_diagnosis_questions_are_refused_before_retrieval():
    yes = ["My headache started this morning and my vision looks blurry. Do I have SANS?",
           "Am I getting sick?", "Is this a sign of something serious?", "What's wrong with me?",
           "Could I have space motion sickness?", "Can you diagnose this?", "Should I worry about this rash?"]
    no = ["What is SANS?", "Why do we measure sleep on a long mission?",
          "How does light affect the sleep cycle in space?", "What does a Decode result below my reference mean?"]
    assert all(ask_nasa.is_diagnosis_question(q) for q in yes)
    assert not any(ask_nasa.is_diagnosis_question(q) for q in no)
    c = _client()
    r = c.post("/ask", json={"question": yes[0]}).json()
    assert r["status"] == "blocked" and "Request help" in r["limits"]
