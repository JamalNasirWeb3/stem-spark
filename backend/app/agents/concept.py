"""Concept Agent: turns a science concept into candidate real-life problems.

It also acts as the second STEM guardrail: Claude judges whether the concept is
a genuine STEM topic, catching what the keyword gate in app/guardrails.py misses.
"""

from pydantic import BaseModel, Field

from app import llm
from app.agents._prompt import lesson_details
from app.schemas import LessonContext, Problem

INSTRUCTIONS = """\
You are the Concept Agent.

First decide whether the concept is a genuine science, technology, engineering \
or mathematics topic that can be taught at the given grade. A STEM-sounding \
word inside a non-STEM topic (for example "the heart of Romeo and Juliet") is \
not STEM. If it is not a STEM topic, or not safe to teach to children, set \
is_stem_topic to false, give a one-sentence off_topic_reason addressed to the \
teacher, and return no problems.

Otherwise set is_stem_topic to true, leave off_topic_reason empty, and propose \
exactly 4 real-life problems that students could work on through this concept. \
Each problem must:
- be a real need people actually face, connected to students' own lives, \
school or community;
- be solvable by students designing, building and testing something within \
the lesson time, using materials that fit the classroom context;
- need the concept to solve it, not just mention it.
Make the four problems clearly different from each other (for example safety, \
environment or community, health, design or innovation).

title: a short, student-friendly name, at most 8 words.
description: the driving question students will answer, one or two sentences, \
phrased as a question.
"""


class _ProblemDraft(BaseModel):
    title: str
    description: str


class ConceptAgentOutput(BaseModel):
    is_stem_topic: bool
    off_topic_reason: str = Field(description="Empty when is_stem_topic is true.")
    problems: list[_ProblemDraft]


def suggest_problems(concept: str, ctx: LessonContext) -> list[Problem]:
    if llm.use_templates():
        return _template_problems(concept, ctx)

    result = llm.generate(
        agent_instructions=INSTRUCTIONS,
        request=lesson_details(concept, ctx),
        output=ConceptAgentOutput,
        effort="medium",
    )
    if not result.is_stem_topic or not result.problems:
        reason = result.off_topic_reason or "This doesn't look like a STEM topic."
        raise llm.AgentError(
            "off_topic",
            f"{reason} STEM SPARK only builds science, technology, "
            "engineering and mathematics lessons.",
            422,
        )
    return [
        Problem(id=f"p{i}", title=p.title.strip(), description=p.description.strip())
        for i, p in enumerate(result.problems, start=1)
    ]


def _template_problems(concept: str, ctx: LessonContext) -> list[Problem]:
    audience = f"{ctx.grade_level} students"
    return [
        Problem(
            id="p1",
            title=f"Staying safe with {concept}",
            description=(
                f"How can {audience} use what they know about {concept} to make an "
                "everyday device or situation safer?"
            ),
        ),
        Problem(
            id="p2",
            title=f"{concept} in our community",
            description=(
                f"Where does {concept} show up in our school or neighbourhood, and "
                f"what problem could {audience} solve with it?"
            ),
        ),
        Problem(
            id="p3",
            title=f"Designing with {concept}",
            description=(
                f"How might {audience} design a low-cost product that relies on "
                f"{concept} to meet a real need?"
            ),
        ),
    ]
