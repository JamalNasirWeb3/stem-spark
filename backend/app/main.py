import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from app import guardrails, llm, pipeline
from app.schemas import LessonPlan, LessonPlanRequest, ProblemsRequest, ProblemsResponse

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="STEM Lesson Planner AI")


@app.exception_handler(llm.AgentError)
def agent_error(_: Request, exc: llm.AgentError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status, content={"detail": {"code": exc.code, "message": exc.message}}
    )


def _reject(violation: guardrails.GuardrailViolation | None, status: int = 422) -> None:
    if violation:
        raise HTTPException(
            status_code=status, detail={"code": violation.code, "message": violation.message}
        )


@app.get("/api/health")
def health() -> dict[str, str]:
    if llm.use_templates():
        agents = "template"
    elif not llm.credentials_configured():
        agents = "not_configured"
    else:
        agents = llm.MODEL
    return {"status": "ok", "agents": agents}


@app.post("/api/problems")
def problems(req: ProblemsRequest) -> ProblemsResponse:
    concept = req.concept.strip()
    _reject(guardrails.check_concept(concept))
    _reject(guardrails.check_classroom_context(req.context.classroom_context))
    proposed = pipeline.propose_problems(concept, req.context)
    return ProblemsResponse(
        concept=concept, problems=[guardrails.sign_problem(concept, p) for p in proposed]
    )


@app.post("/api/lesson-plan")
def lesson_plan(req: LessonPlanRequest) -> LessonPlan:
    concept = req.concept.strip()
    _reject(guardrails.check_concept(concept))
    _reject(guardrails.check_classroom_context(req.context.classroom_context))
    _reject(guardrails.verify_problem(concept, req.problem), status=403)
    return pipeline.build_lesson_plan(concept, req.problem, req.context)
