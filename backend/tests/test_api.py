import json

import pytest
from fastapi.testclient import TestClient

from app.agents.sts_edp import allocate_minutes
from app.main import app

client = TestClient(app)


def test_health():
    assert client.get("/api/health").json() == {"status": "ok", "agents": "template"}


def test_full_pipeline():
    res = client.post("/api/problems", json={"concept": "Conductors & Insulators"})
    assert res.status_code == 200
    body = res.json()
    assert body["concept"] == "Conductors & Insulators"
    assert len(body["problems"]) >= 1

    chosen = body["problems"][0]
    res = client.post("/api/lesson-plan", json={"concept": body["concept"], "problem": chosen})
    assert res.status_code == 200
    plan = res.json()
    assert plan["problem"] == chosen
    assert [s["stage"] for s in plan["sts_edp"]["stages"]] == [
        "Ask",
        "Imagine",
        "Plan",
        "Create",
        "Test",
        "Improve",
        "Share",
    ]


def test_rejects_empty_concept():
    assert client.post("/api/problems", json={"concept": ""}).status_code == 422


def test_context_flows_into_plan():
    context = {
        "grade_level": "Grade 8",
        "lesson_minutes": 40,
        "classroom_context": "35 students, no lab",
    }
    res = client.post("/api/problems", json={"concept": "Magnetism", "context": context})
    assert res.status_code == 200
    problem = res.json()["problems"][0]
    assert "Grade 8" in problem["description"]

    res = client.post(
        "/api/lesson-plan", json={"concept": "Magnetism", "problem": problem, "context": context}
    )
    plan = res.json()
    assert plan["context"] == context
    assert sum(s["minutes"] for s in plan["sts_edp"]["stages"]) == 40


@pytest.mark.parametrize("minutes", [30, 45, 80, 120, 240])
def test_stage_minutes_sum_to_lesson_length(minutes):
    allocation = allocate_minutes(minutes)
    assert sum(allocation.values()) == minutes
    assert all(m > 0 for m in allocation.values())


def test_rejects_out_of_range_lesson_time():
    body = {"concept": "Magnetism", "context": {"lesson_minutes": 5}}
    assert client.post("/api/problems", json=body).status_code == 422


def _stream_events(res):
    return [json.loads(line) for line in res.text.splitlines() if line]


def test_stream_reports_each_agent_then_plan():
    problem = client.post("/api/problems", json={"concept": "Magnetism"}).json()["problems"][0]
    res = client.post("/api/lesson-plan/stream", json={"concept": "Magnetism", "problem": problem})
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("application/x-ndjson")
    events = _stream_events(res)
    assert [e["type"] for e in events] == ["agent_done", "agent_done", "plan"]
    assert [e["agent"] for e in events[:2]] == ["stem", "sts_edp"]
    assert events[2]["plan"]["problem"] == problem


def test_stream_rejects_untrusted_problem_before_streaming():
    fake = {"id": "x", "title": "Made-up topic", "description": "Not from the agent", "token": ""}
    res = client.post("/api/lesson-plan/stream", json={"concept": "Magnetism", "problem": fake})
    assert res.status_code == 403
    assert res.json()["detail"]["code"] == "untrusted_problem"
