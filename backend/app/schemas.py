"""Request/response models shared by the API and the agent pipeline."""

from pydantic import BaseModel, Field


class Problem(BaseModel):
    id: str
    title: str
    description: str


class ProblemsRequest(BaseModel):
    concept: str = Field(min_length=2, max_length=200)


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


class StsEdp(BaseModel):
    science_technology_society: str
    stages: list[EdpStage]


class LessonPlanRequest(BaseModel):
    concept: str = Field(min_length=2, max_length=200)
    problem: Problem


class LessonPlan(BaseModel):
    concept: str
    problem: Problem
    objectives: list[str]
    materials: list[str]
    stem_integration: StemIntegration
    sts_edp: StsEdp
    activities: list[str]
    hots_questions: list[str]
    assessment: list[str]
    problem_solving_task: str
    expected_solution: str
