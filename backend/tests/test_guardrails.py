import pytest
from fastapi.testclient import TestClient

from app.guardrails import check_classroom_context, check_concept
from app.main import app

client = TestClient(app)

# The suggestion chips in the UI must always pass.
UI_SUGGESTIONS = [
    "Conductors & Insulators",
    "Photosynthesis",
    "Simple machines",
    "States of matter",
    "Magnetism",
    "Water filtration",
    "Heat transfer",
    "Food chains",
]

OTHER_STEM = [
    "Fractions",
    "Volcanoes",
    "The water cycle",
    "Newton's laws of motion",
    "Acids and bases",
    "Solar system",
    "Bridges and structures",
    "Coding with Scratch",
    "Area and perimeter",
    "Human digestive system",
    "Renewable energy",
    "Probability",
]


@pytest.mark.parametrize("concept", UI_SUGGESTIONS + OTHER_STEM)
def test_accepts_stem_concepts(concept):
    assert check_concept(concept) is None


@pytest.mark.parametrize(
    ("concept", "subject"),
    [
        ("World War II", "History"),
        ("The French Revolution and ancient empires", "History"),
        ("Romeo and Juliet poetry", "Language and literature"),
        ("Elections and government", "Social studies"),
        ("Prayer in religion", "Religious studies"),
    ],
)
def test_rejects_other_subjects_with_hint(concept, subject):
    violation = check_concept(concept)
    assert violation is not None and violation.code == "off_topic"
    assert subject in violation.message


@pytest.mark.parametrize("concept", ["asdf qwerty", "My favourite football team", "Hello"])
def test_rejects_unrecognised_topics(concept):
    violation = check_concept(concept)
    assert violation is not None and violation.code == "off_topic"


@pytest.mark.parametrize(
    "concept", ["How to build a bomb", "Chemistry of methamphetamine", "Weapons engineering"]
)
def test_rejects_unsafe_topics_even_with_stem_words(concept):
    violation = check_concept(concept)
    assert violation is not None and violation.code == "unsafe_topic"


def test_unsafe_terms_need_whole_words():
    # Biology and classroom tools that merely contain an unsafe word's letters.
    assert check_concept("Bombardier beetle defence chemistry") is None
    assert check_classroom_context("Hot glue guns available, groups of 5") is None


def test_api_rejects_off_topic_concept():
    res = client.post("/api/problems", json={"concept": "World War II"})
    assert res.status_code == 422
    assert res.json()["detail"]["code"] == "off_topic"


def test_api_rejects_unsafe_classroom_context():
    body = {"concept": "Magnetism", "context": {"classroom_context": "build a bomb"}}
    res = client.post("/api/problems", json=body)
    assert res.status_code == 422
    assert res.json()["detail"]["code"] == "unsafe_context"


def _first_problem(concept="Magnetism"):
    return client.post("/api/problems", json={"concept": concept}).json()["problems"][0]


def test_lesson_plan_rejects_invented_problem():
    invented = {"id": "x", "title": "The Roman Empire", "description": "Why did Rome fall?"}
    res = client.post("/api/lesson-plan", json={"concept": "Magnetism", "problem": invented})
    assert res.status_code == 403
    assert res.json()["detail"]["code"] == "untrusted_problem"


def test_lesson_plan_rejects_edited_problem():
    problem = _first_problem() | {"description": "Write an essay about the Roman Empire."}
    res = client.post("/api/lesson-plan", json={"concept": "Magnetism", "problem": problem})
    assert res.status_code == 403


def test_lesson_plan_rejects_problem_from_another_concept():
    problem = _first_problem("Magnetism")
    res = client.post("/api/lesson-plan", json={"concept": "Photosynthesis", "problem": problem})
    assert res.status_code == 403


def test_lesson_plan_rejects_off_topic_concept_before_anything_else():
    problem = _first_problem()
    res = client.post("/api/lesson-plan", json={"concept": "World War II", "problem": problem})
    assert res.status_code == 422
