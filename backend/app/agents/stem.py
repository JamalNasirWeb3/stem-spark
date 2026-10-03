"""STEM Agent: maps the selected problem onto Science, Technology, Engineering, Mathematics."""

from app import llm
from app.agents._prompt import chosen_problem, lesson_details
from app.schemas import LessonContext, Problem, StemIntegration

INSTRUCTIONS = """\
You are the STEM Agent. Map the teacher's chosen problem onto the four STEM \
disciplines for this lesson. Write two to four sentences for each, specific to \
this problem and grade, never generic:
- science: the core scientific ideas students need, and how they explain the \
problem.
- technology: the tools, devices or technologies students use or examine \
(for example a circuit tester, a thermometer, a simple app or sensor).
- engineering: what students design and build, with its success criteria and \
constraints (cost, materials, size, time).
- mathematics: the actual quantities students measure, count, calculate, \
compare or graph, and how the numbers inform their design decisions.
"""


def integrate(concept: str, problem: Problem, ctx: LessonContext) -> StemIntegration:
    if llm.use_templates():
        return _template_integration(concept, problem, ctx)

    return llm.generate(
        agent_instructions=INSTRUCTIONS,
        request=f"{lesson_details(concept, ctx)}\n{chosen_problem(problem)}",
        output=StemIntegration,
        effort="medium",
    )


def _template_integration(concept: str, problem: Problem, ctx: LessonContext) -> StemIntegration:
    return StemIntegration(
        science=f"Core ideas of {concept} that explain the problem, at {ctx.grade_level} level.",
        technology=f"Tools and devices used to investigate {concept}.",
        engineering=f"Designing a solution to: {problem.title}.",
        mathematics="Measuring, recording, and comparing results from tests.",
    )
