import json
import logging
from collections.abc import Iterator

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse

from app import guardrails, llm, pipeline
from app.schemas import LessonPlan, LessonPlanRequest, ProblemsRequest, ProblemsResponse

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

app = FastAPI(title="STEM SPARK")


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


def _checked_lesson_request(req: LessonPlanRequest) -> str:
    concept = req.concept.strip()
    _reject(guardrails.check_concept(concept))
    _reject(guardrails.check_classroom_context(req.context.classroom_context))
    _reject(guardrails.verify_problem(concept, req.problem), status=403)
    return concept


@app.post("/api/lesson-plan")
def lesson_plan(req: LessonPlanRequest) -> LessonPlan:
    concept = _checked_lesson_request(req)
    return pipeline.build_lesson_plan(concept, req.problem, req.context)


@app.post("/api/lesson-plan/stream")
def lesson_plan_stream(req: LessonPlanRequest) -> StreamingResponse:
    """Same as /api/lesson-plan, but streams progress as newline-delimited JSON.

    Events: {"type": "agent_done", "agent": "stem" | "sts_edp"}, then either
    {"type": "plan", "plan": {...}} or {"type": "error", "code": ..., "message": ...}.
    Guardrail rejections still come back as normal HTTP errors before streaming starts.
    """
    concept = _checked_lesson_request(req)

    def events() -> Iterator[str]:
        try:
            for step in pipeline.run_lesson_plan(concept, req.problem, req.context):
                if isinstance(step, LessonPlan):
                    yield _event({"type": "plan", "plan": step.model_dump()})
                else:
                    yield _event({"type": "agent_done", "agent": step})
        except llm.AgentError as e:
            yield _event({"type": "error", "code": e.code, "message": e.message})
        except Exception:
            log.exception("Lesson plan pipeline failed")
            yield _event(
                {
                    "type": "error",
                    "code": "agent_failed",
                    "message": "The AI agents could not build this lesson plan. Please retry.",
                }
            )

    return StreamingResponse(events(), media_type="application/x-ndjson")


def _event(data: dict) -> str:
    return json.dumps(data) + "\n"
