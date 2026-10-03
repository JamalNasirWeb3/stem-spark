"""Lesson Plan Agent: assembles the final teacher-ready lesson plan.

Claude writes the teaching content; the concept, problem, context, STEM mapping
and EDP stages from earlier agents are carried over unchanged.
"""

from pydantic import BaseModel

from app import llm
from app.agents._prompt import chosen_problem, lesson_details, stem_mapping
from app.schemas import LessonContext, LessonPlan, Problem, StemIntegration, StsEdp

INSTRUCTIONS = """\
You are the Lesson Plan Agent. Using everything the earlier agents produced, \
write the final teacher-ready lesson plan. A teacher should be able to teach \
from it tomorrow without further preparation.

- objectives: three to five measurable learning objectives starting with an \
action verb (classify, explain, design, measure, justify...).
- materials: everything needed, with quantities, stating what is per group and \
what is per class. Respect budget, lab access and group size in the classroom \
context.
- activities: the lesson as a timed sequence that follows the EDP stages, one \
item per step, each starting with its stage and minutes, for example \
"Ask (8 min): ...". Include teacher moves and student actions, and any safety \
precaution where it applies.
- hots_questions: four to six higher-order thinking questions (analyse, \
evaluate, create) tied to this problem, not recall questions.
- assessment: three to five items covering formative checks during the lesson \
and a summative product or performance with clear success criteria.
- problem_solving_task: the challenge exactly as you would read it to students, \
including the constraints and success criteria.
- expected_solution: what a successful group's solution looks like and the \
evidence it would produce, so the teacher knows what to look for.
"""


class _LessonPlanDraft(BaseModel):
    objectives: list[str]
    materials: list[str]
    activities: list[str]
    hots_questions: list[str]
    assessment: list[str]
    problem_solving_task: str
    expected_solution: str


def _edp_outline(sts_edp: StsEdp) -> str:
    stages = "\n".join(f"{s.stage} ({s.minutes} min): {s.description}" for s in sts_edp.stages)
    return f"<sts>{sts_edp.science_technology_society}</sts>\n<edp_stages>\n{stages}\n</edp_stages>"


def compose(
    concept: str,
    problem: Problem,
    stem: StemIntegration,
    sts_edp: StsEdp,
    ctx: LessonContext,
) -> LessonPlan:
    if llm.use_templates():
        draft = _template_draft(concept, problem, sts_edp, ctx)
    else:
        draft = llm.generate(
            agent_instructions=INSTRUCTIONS,
            request=(
                f"{lesson_details(concept, ctx)}\n{chosen_problem(problem)}\n"
                f"{stem_mapping(stem)}\n{_edp_outline(sts_edp)}"
            ),
            output=_LessonPlanDraft,
            effort="high",
        )
    return LessonPlan(
        concept=concept,
        problem=problem,
        context=ctx,
        stem_integration=stem,
        sts_edp=sts_edp,
        **draft.model_dump(),
    )


def _template_draft(
    concept: str, problem: Problem, sts_edp: StsEdp, ctx: LessonContext
) -> _LessonPlanDraft:
    materials = ["Placeholder materials list"]
    if ctx.classroom_context:
        materials.append(f"Chosen to fit: {ctx.classroom_context}")
    return _LessonPlanDraft(
        objectives=[
            f"Explain the key ideas of {concept}.",
            f"Apply {concept} to design a solution for a real-world problem.",
        ],
        materials=materials,
        activities=[f"{s.description} ({s.minutes} min)" for s in sts_edp.stages],
        hots_questions=[
            f"Why does {concept} matter for this problem?",
            "How would you improve your design if you had different materials?",
        ],
        assessment=["Design rubric", "Test results record", "Group presentation"],
        problem_solving_task=problem.description,
        expected_solution=f"A tested design that addresses: {problem.title}.",
    )
