from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    assert client.get("/api/health").json() == {"status": "ok"}


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
