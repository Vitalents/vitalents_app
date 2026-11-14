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
