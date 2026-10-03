"""Sign-in and daily limits, against a fake Supabase (no network)."""

from types import SimpleNamespace

import httpx
import pytest
from fastapi.testclient import TestClient

from app import auth
from app.main import app

client = TestClient(app)
SUPABASE = "https://test.supabase.co"


class FakeSupabase:
    """Answers the two Supabase endpoints app.auth uses."""

    def __init__(self):
        self.valid_tokens = {"good-token": {"id": "teacher-1", "email": "t@school.org"}}
        self.used = 0
        self.inserted = []
        self.down = False

    def get(self, url, headers, params=None):
        if self.down:
            raise httpx.ConnectError("down")
        token = headers["Authorization"].removeprefix("Bearer ")
        if url.endswith("/auth/v1/user"):
            user = self.valid_tokens.get(token)
            return SimpleNamespace(status_code=200 if user else 401, json=lambda: user)
        assert url == f"{SUPABASE}/rest/v1/generations"
        assert headers["Prefer"] == "count=exact"
        return SimpleNamespace(
            status_code=200, headers={"content-range": f"0-0/{self.used}"}, request=None
        )

    def post(self, url, json, headers):
        assert url == f"{SUPABASE}/rest/v1/generations"
        self.inserted.append((headers["Authorization"], json))
        return SimpleNamespace(raise_for_status=lambda: None)


@pytest.fixture
def supabase(monkeypatch):
    monkeypatch.setenv("STEM_AUTH", "on")
    monkeypatch.setenv("SUPABASE_URL", SUPABASE + "/")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "anon-key")
    fake = FakeSupabase()
    monkeypatch.setattr(auth, "_http", lambda: fake)
    return fake


def _problems(token=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return client.post("/api/problems", json={"concept": "Magnetism"}, headers=headers)


def test_health_reports_auth(supabase, monkeypatch):
    assert client.get("/api/health").json()["auth"] == "on"
    monkeypatch.delenv("SUPABASE_URL")
    assert client.get("/api/health").json()["auth"] == "not_configured"


def test_requires_sign_in(supabase):
    res = _problems()
    assert res.status_code == 401
    assert res.json()["detail"]["code"] == "not_signed_in"


def test_rejects_unknown_token(supabase):
    res = _problems("forged")
    assert res.status_code == 401
    assert res.json()["detail"]["code"] == "session_expired"


def test_signed_in_teacher_is_counted(supabase):
    assert _problems("good-token").status_code == 200
    assert supabase.inserted == [("Bearer good-token", {"kind": "problems"})]


def test_daily_limit(supabase, monkeypatch):
    monkeypatch.setenv("DAILY_PROBLEM_LIMIT", "3")
    supabase.used = 3
    res = _problems("good-token")
    assert res.status_code == 429
    assert res.json()["detail"]["code"] == "daily_limit"
    assert "3 problem searches" in res.json()["detail"]["message"]
    assert supabase.inserted == []


def test_lesson_plan_stream_requires_sign_in(supabase):
    problem = _problems("good-token").json()["problems"][0]
    res = client.post("/api/lesson-plan/stream", json={"concept": "Magnetism", "problem": problem})
    assert res.status_code == 401
    res = client.post(
        "/api/lesson-plan/stream",
        json={"concept": "Magnetism", "problem": problem},
        headers={"Authorization": "Bearer good-token"},
    )
    assert res.status_code == 200
    assert supabase.inserted[-1] == ("Bearer good-token", {"kind": "lesson_plan"})


def test_off_topic_is_rejected_before_counting(supabase):
    res = client.post(
        "/api/problems",
        json={"concept": "Shakespeare sonnets"},
        headers={"Authorization": "Bearer good-token"},
    )
    assert res.status_code == 422
    assert supabase.inserted == []


def test_supabase_down(supabase):
    supabase.down = True
    res = _problems("good-token")
    assert res.status_code == 503
    assert res.json()["detail"]["code"] == "auth_unavailable"


def test_missing_settings_fail_closed(supabase, monkeypatch):
    monkeypatch.delenv("SUPABASE_ANON_KEY")
    res = _problems("good-token")
    assert res.status_code == 503
    assert res.json()["detail"]["code"] == "auth_not_configured"
