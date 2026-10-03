import json
import logging
from collections.abc import Iterator
from queue import Empty, Queue
from threading import Thread
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse

from app import auth, guardrails, llm, pipeline
from app.auth import Teacher
from app.schemas import LessonPlan, LessonPlanRequest, ProblemsRequest, ProblemsResponse

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

HEARTBEAT_SECONDS = 15

# The signed-in teacher, or None when sign-in is off (STEM_AUTH=off).
CurrentTeacher = Annotated[Teacher | None, Depends(auth.current_teacher)]

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
    return {"status": "ok", "agents": agents, "auth": auth.auth_status()}


@app.post("/api/problems")
def problems(req: ProblemsRequest, teacher: CurrentTeacher) -> ProblemsResponse:
    concept = req.concept.strip()
    _reject(guardrails.check_concept(concept))
    _reject(guardrails.check_classroom_context(req.context.classroom_context))
    auth.record_generation(teacher, "problems")
    proposed = pipeline.propose_problems(concept, req.context)
    return ProblemsResponse(
        concept=concept, problems=[guardrails.sign_problem(concept, p) for p in proposed]
    )


def _checked_lesson_request(req: LessonPlanRequest, teacher: Teacher | None) -> str:
    concept = req.concept.strip()
    _reject(guardrails.check_concept(concept))
    _reject(guardrails.check_classroom_context(req.context.classroom_context))
    _reject(guardrails.verify_problem(concept, req.problem), status=403)
    auth.record_generation(teacher, "lesson_plan")
    return concept


@app.post("/api/lesson-plan")
def lesson_plan(req: LessonPlanRequest, teacher: CurrentTeacher) -> LessonPlan:
    concept = _checked_lesson_request(req, teacher)
    return pipeline.build_lesson_plan(concept, req.problem, req.context)


@app.post("/api/lesson-plan/stream")
def lesson_plan_stream(req: LessonPlanRequest, teacher: CurrentTeacher) -> StreamingResponse:
    """Same as /api/lesson-plan, but streams progress as newline-delimited JSON.

    Events: {"type": "agent_done", "agent": "stem" | "sts_edp"}, then either
    {"type": "plan", "plan": {...}} or {"type": "error", "code": ..., "message": ...}.
    Blank lines between events are heartbeats; clients skip them.
    Sign-in, guardrail and daily-limit rejections still come back as normal HTTP
    errors before streaming starts.
    """
    concept = _checked_lesson_request(req, teacher)
    queue: Queue[str | None] = Queue()

    def run() -> None:
        try:
            for step in pipeline.run_lesson_plan(concept, req.problem, req.context):
                if isinstance(step, LessonPlan):
                    queue.put(_event({"type": "plan", "plan": step.model_dump()}))
                else:
                    queue.put(_event({"type": "agent_done", "agent": step}))
        except llm.AgentError as e:
            queue.put(_event({"type": "error", "code": e.code, "message": e.message}))
        except Exception:
            log.exception("Lesson plan pipeline failed")
            queue.put(
                _event(
                    {
                        "type": "error",
                        "code": "agent_failed",
                        "message": "The AI agents could not build this lesson plan. Please retry.",
                    }
                )
            )
        finally:
            queue.put(None)

    def events() -> Iterator[str]:
        # Blank lines are heartbeats: proxies such as Vercel's cancel a request that
        # sends nothing for 120 s, and one agent can take nearly that long.
        yield "\n"
        while True:
            try:
                item = queue.get(timeout=HEARTBEAT_SECONDS)
            except Empty:
                yield "\n"
                continue
            if item is None:
                return
            yield item

    Thread(target=run, daemon=True).start()
    return StreamingResponse(events(), media_type="application/x-ndjson")


def _event(data: dict) -> str:
    return json.dumps(data) + "\n"
