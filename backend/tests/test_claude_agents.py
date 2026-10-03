"""The Claude-backed agents, run against a fake Anthropic client (no API calls)."""

import json
from types import SimpleNamespace

import anthropic
import httpx2
import pytest
from fastapi.testclient import TestClient

from app import llm
from app.main import app

client = TestClient(app)

CANNED = {
    "ConceptAgentOutput": {
        "is_stem_topic": True,
        "off_topic_reason": "",
        "problems": [
            {"title": "Shock-proof phone chargers", "description": "How can we stop shocks?"},
            {"title": "Safe classroom wiring", "description": "How can we make wiring safe?"},
        ],
    },
    "StemIntegration": {
        "science": "S text",
        "technology": "T text",
        "engineering": "E text",
        "mathematics": "M text",
    },
    "_StsEdpDraft": {
        "science_technology_society": "STS text",
        **{s: f"{s} activity" for s in ["ask", "imagine", "plan", "create", "test", "improve"]},
        "share": "share activity",
    },
    "_LessonPlanDraft": {
        "objectives": ["Classify materials"],
        "materials": ["1 battery per group"],
        "activities": ["Ask (8 min): hook"],
        "hots_questions": ["Why does graphite conduct?"],
        "assessment": ["Exit ticket"],
        "problem_solving_task": "Build a safe cover.",
        "expected_solution": "A gap-free rubber cover.",
    },
}


class FakeMessages:
    def __init__(self, overrides=None, error=None):
        self.calls = []
        self.overrides = overrides or {}
        self.error = error

    def create(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        name = kwargs["output_config"]["format"]["schema"]["title"]
        stop_reason, payload = self.overrides.get(name, ("end_turn", CANNED[name]))
        return SimpleNamespace(
            model=kwargs["model"],
            stop_reason=stop_reason,
            content=[SimpleNamespace(type="text", text=json.dumps(payload))],
            usage=SimpleNamespace(
                input_tokens=10,
                output_tokens=10,
                cache_read_input_tokens=0,
                cache_creation_input_tokens=0,
            ),
            _request_id="req_test",
        )


@pytest.fixture
def fake_claude(monkeypatch):
    monkeypatch.setenv("STEM_AGENTS", "claude")
    messages = FakeMessages()
    fake = SimpleNamespace(api_key="test-key", beta=SimpleNamespace(messages=messages))
    monkeypatch.setattr(llm, "_client", lambda: fake)
    return messages


def test_missing_credentials(monkeypatch):
    monkeypatch.setenv("STEM_AGENTS", "claude")
    no_key = SimpleNamespace(api_key=None, auth_token=None, credentials=None)
    monkeypatch.setattr(llm, "_client", lambda: no_key)
    assert client.get("/api/health").json()["agents"] == "not_configured"
    res = client.post("/api/problems", json={"concept": "Magnetism"})
    assert res.status_code == 503
    assert res.json()["detail"]["code"] == "agents_not_configured"


def test_health_reports_model(fake_claude):
    assert client.get("/api/health").json() == {"status": "ok", "agents": llm.MODEL}


def _plan_request(concept="Conductors & Insulators", minutes=80):
    context = {"grade_level": "Grade 6", "lesson_minutes": minutes, "classroom_context": ""}
    res = client.post("/api/problems", json={"concept": concept, "context": context})
    assert res.status_code == 200, res.json()
    problem = res.json()["problems"][0]
    return {"concept": concept, "problem": problem, "context": context}


def test_full_pipeline_with_claude(fake_claude):
    res = client.post("/api/lesson-plan", json=_plan_request(minutes=40))
    assert res.status_code == 200
    plan = res.json()
    assert plan["problem"]["title"] == "Shock-proof phone chargers"
    assert plan["stem_integration"]["science"] == "S text"
    assert plan["objectives"] == ["Classify materials"]
    # Stage order and minutes are enforced in code regardless of model output.
    stages = plan["sts_edp"]["stages"]
    assert [s["stage"] for s in stages] == [
        "Ask",
        "Imagine",
        "Plan",
        "Create",
        "Test",
        "Improve",
        "Share",
    ]
    assert stages[0]["description"] == "ask activity"
    assert sum(s["minutes"] for s in stages) == 40
    assert len(fake_claude.calls) == 4  # Concept, STEM, STS-EDP, Lesson Plan


def test_request_shape(fake_claude):
    client.post("/api/lesson-plan", json=_plan_request())
    for call in fake_claude.calls:
        assert call["model"] == llm.MODEL
        assert call["fallbacks"] == "default"
        assert call["betas"] == ["server-side-fallback-2026-07-01"]
        # Both system blocks are cached; teacher data stays in the user message.
        assert all(b["cache_control"] == {"type": "ephemeral"} for b in call["system"])
        assert call["system"][0]["text"] == llm.SHARED_BRIEF
        assert "<concept>Conductors & Insulators</concept>" in call["messages"][0]["content"]
    efforts = [c["output_config"]["effort"] for c in fake_claude.calls]
    assert efforts == ["medium", "medium", "medium", "medium"]


def test_concept_agent_rejects_off_topic(fake_claude):
    fake_claude.overrides["ConceptAgentOutput"] = (
        "end_turn",
        {"is_stem_topic": False, "off_topic_reason": "This is a literature topic.", "problems": []},
    )
    # "heart" passes the keyword gate; Claude catches it.
    res = client.post("/api/problems", json={"concept": "The heart of Romeo and Juliet"})
    assert res.status_code == 422
    detail = res.json()["detail"]
    assert detail["code"] == "off_topic"
    assert "literature topic" in detail["message"]


def test_refusal_is_reported(fake_claude):
    fake_claude.overrides["StemIntegration"] = ("refusal", {})
    res = client.post("/api/lesson-plan", json=_plan_request())
    assert res.status_code == 422
    assert res.json()["detail"]["code"] == "agent_refused"


def test_truncated_output_is_reported(fake_claude):
    fake_claude.overrides["_LessonPlanDraft"] = ("max_tokens", {})
    res = client.post("/api/lesson-plan", json=_plan_request())
    assert res.status_code == 502
    assert res.json()["detail"]["code"] == "agent_failed"


def test_invalid_json_is_reported(fake_claude):
    fake_claude.overrides["StemIntegration"] = ("end_turn", {"science": "only one field"})
    res = client.post("/api/lesson-plan", json=_plan_request())
    assert res.status_code == 502


def _api_error(cls, status):
    request = httpx2.Request("POST", "https://api.anthropic.com/v1/messages")
    return cls("boom", response=httpx2.Response(status, request=request), body=None)


@pytest.mark.parametrize(
    ("error", "code"),
    [
        (_api_error(anthropic.AuthenticationError, 401), "agents_not_configured"),
        (_api_error(anthropic.RateLimitError, 429), "agents_busy"),
        (_api_error(anthropic.InternalServerError, 500), "agents_unavailable"),
    ],
)
def test_api_errors_become_teacher_messages(fake_claude, error, code):
    fake_claude.error = error
    res = client.post("/api/problems", json={"concept": "Magnetism"})
    assert res.status_code == 503
    assert res.json()["detail"]["code"] == code
