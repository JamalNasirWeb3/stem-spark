"""STS–EDP Agent: frames the lesson with Science–Technology–Society and the
Engineering Design Process.

Stage order and minutes are fixed in code, not left to the model: the output
schema has one field per stage, and the minutes come from `allocate_minutes`,
so the plan always covers all seven stages and fits the lesson exactly.
"""

from pydantic import BaseModel

from app import llm
from app.agents._prompt import chosen_problem, lesson_details, stem_mapping
from app.schemas import EdpStage, LessonContext, Problem, StemIntegration, StsEdp

EDP_STAGES = ["Ask", "Imagine", "Plan", "Create", "Test", "Improve", "Share"]

# Relative share of lesson time per stage; hands-on Create and Test get the most.
_STAGE_WEIGHTS = {
    "Ask": 2,
    "Imagine": 2,
    "Plan": 2,
    "Create": 5,
    "Test": 3,
    "Improve": 2,
    "Share": 2,
}

INSTRUCTIONS = """\
You are the STS-EDP Agent. Structure the lesson around the chosen problem.

science_technology_society: three to five sentences connecting the problem to \
society: who is affected in real life, how technology helps or harms, and why \
it matters to these students and their community.

Then write what happens in each Engineering Design Process stage. Each stage \
has a fixed number of minutes given in <stage_minutes>; plan exactly what \
students and the teacher do in that time, in two to four sentences:
- ask: the hook and the driving question; students identify the need and \
constraints.
- imagine: students brainstorm and predict possible solutions.
- plan: groups choose a design, sketch it and list materials.
- create: groups build their prototype (and run any investigation it needs).
- test: groups test against the success criteria and record data.
- improve: groups use their results to modify and retest.
- share: groups present their solution and evidence.
Name concrete actions, materials and outputs. Respect the classroom context.
Do not start a stage description with its name or minutes; the app shows those \
separately.
"""


class _StsEdpDraft(BaseModel):
    science_technology_society: str
    ask: str
    imagine: str
    plan: str
    create: str
    test: str
    improve: str
    share: str


def allocate_minutes(total: int) -> dict[str, int]:
    """Split the lesson length across EDP stages so the parts sum exactly to `total`."""
    weight_sum = sum(_STAGE_WEIGHTS.values())
    minutes = {s: total * _STAGE_WEIGHTS[s] // weight_sum for s in EDP_STAGES}
    minutes["Create"] += total - sum(minutes.values())
    return minutes


def build(concept: str, problem: Problem, stem: StemIntegration, ctx: LessonContext) -> StsEdp:
    minutes = allocate_minutes(ctx.lesson_minutes)
    if llm.use_templates():
        return _template_sts_edp(concept, problem, minutes)

    stage_minutes = "\n".join(f"{s}: {minutes[s]} minutes" for s in EDP_STAGES)
    draft = llm.generate(
        agent_instructions=INSTRUCTIONS,
        request=(
            f"{lesson_details(concept, ctx)}\n{chosen_problem(problem)}\n"
            f"{stem_mapping(stem)}\n<stage_minutes>\n{stage_minutes}\n</stage_minutes>"
        ),
        output=_StsEdpDraft,
        effort="medium",
    )
    return StsEdp(
        science_technology_society=draft.science_technology_society,
        stages=[
            EdpStage(stage=s, description=getattr(draft, s.lower()), minutes=minutes[s])
            for s in EDP_STAGES
        ],
    )


def _template_sts_edp(concept: str, problem: Problem, minutes: dict[str, int]) -> StsEdp:
    return StsEdp(
        science_technology_society=(
            f"Students explore how {concept} affects people's daily lives and how "
            f"technology helps society address: {problem.title}."
        ),
        stages=[
            EdpStage(
                stage=stage,
                description=f"{stage}: placeholder activity for {problem.title}.",
                minutes=minutes[stage],
            )
            for stage in EDP_STAGES
        ],
    )
