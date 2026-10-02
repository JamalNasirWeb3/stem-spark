"""The STEM Spark pipeline, split at the teacher-selection step.

Stage 1 (`propose_problems`) runs the Concept Agent and returns to the teacher.
Stage 2 (`build_lesson_plan`) resumes with the chosen problem and runs the
STEM -> STS-EDP -> Lesson Plan agents in sequence. The API is stateless: the
client holds the concept and selected problem between the two calls.
"""

from app.agents import concept, lesson_plan, stem, sts_edp
from app.schemas import LessonPlan, Problem


def propose_problems(concept_name: str) -> list[Problem]:
    return concept.suggest_problems(concept_name)


def build_lesson_plan(concept_name: str, problem: Problem) -> LessonPlan:
    stem_result = stem.integrate(concept_name, problem)
    edp_result = sts_edp.build(concept_name, problem, stem_result)
    return lesson_plan.compose(concept_name, problem, stem_result, edp_result)
