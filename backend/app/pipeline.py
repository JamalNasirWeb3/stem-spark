"""The STEM SPARK pipeline, split at the teacher-selection step.

Stage 1 (`propose_problems`) runs the Concept Agent and returns to the teacher.
Stage 2 (`build_lesson_plan`) resumes with the chosen problem and runs the
STEM -> STS-EDP -> Lesson Plan agents in sequence. The API is stateless: the
client holds the concept, lesson context and selected problem between the two calls.
"""

from collections.abc import Iterator

from app.agents import concept, lesson_plan, stem, sts_edp
from app.schemas import LessonContext, LessonPlan, Problem


def propose_problems(concept_name: str, ctx: LessonContext) -> list[Problem]:
    return concept.suggest_problems(concept_name, ctx)


def run_lesson_plan(
    concept_name: str, problem: Problem, ctx: LessonContext
) -> Iterator[str | LessonPlan]:
    """Run stage 2, yielding each agent's name as it finishes, then the finished plan.

    The streaming endpoint turns these into progress events for the UI.
    """
    stem_result = stem.integrate(concept_name, problem, ctx)
    yield "stem"
    edp_result = sts_edp.build(concept_name, problem, stem_result, ctx)
    yield "sts_edp"
    yield lesson_plan.compose(concept_name, problem, stem_result, edp_result, ctx)


def build_lesson_plan(concept_name: str, problem: Problem, ctx: LessonContext) -> LessonPlan:
    *_, plan = run_lesson_plan(concept_name, problem, ctx)
    return plan
