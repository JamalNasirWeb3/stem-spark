from fastapi import FastAPI

from app import pipeline
from app.schemas import LessonPlan, LessonPlanRequest, ProblemsRequest, ProblemsResponse

app = FastAPI(title="STEM Spark API")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/problems")
def problems(req: ProblemsRequest) -> ProblemsResponse:
    concept = req.concept.strip()
    return ProblemsResponse(concept=concept, problems=pipeline.propose_problems(concept))


@app.post("/api/lesson-plan")
def lesson_plan(req: LessonPlanRequest) -> LessonPlan:
    return pipeline.build_lesson_plan(req.concept.strip(), req.problem)
