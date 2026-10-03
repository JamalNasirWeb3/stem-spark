"""Request/response models shared by the API and the agent pipeline."""

from pydantic import BaseModel, Field


class Problem(BaseModel):
    id: str
    title: str
    description: str
    # HMAC issued by the Concept Agent endpoint; proves the problem wasn't
    # invented by the client (see app/guardrails.py).
    token: str = ""


class LessonContext(BaseModel):
    """Teacher-supplied classroom details that every agent tailors its output to."""

    grade_level: str = Field(default="Grade 6", min_length=1, max_length=40)
    lesson_minutes: int = Field(default=80, ge=30, le=240)
    classroom_context: str = Field(default="", max_length=500)


class ProblemsRequest(BaseModel):
    concept: str = Field(min_length=2, max_length=200)
    context: LessonContext = LessonContext()


class ProblemsResponse(BaseModel):
    concept: str
    problems: list[Problem]


class StemIntegration(BaseModel):
    science: str
    technology: str
    engineering: str
    mathematics: str


class EdpStage(BaseModel):
    stage: str
    description: str
    minutes: int


class StsEdp(BaseModel):
    science_technology_society: str
    stages: list[EdpStage]


class LessonPlanRequest(BaseModel):
    concept: str = Field(min_length=2, max_length=200)
    problem: Problem
    context: LessonContext = LessonContext()


class LessonPlan(BaseModel):
    concept: str
    problem: Problem
    context: LessonContext
    objectives: list[str]
    materials: list[str]
    stem_integration: StemIntegration
    sts_edp: StsEdp
    activities: list[str]
    hots_questions: list[str]
    assessment: list[str]
    problem_solving_task: str
    expected_solution: str
