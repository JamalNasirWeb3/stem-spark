"""Formats teacher-supplied data for agent requests.

Values are wrapped in tags so the shared brief can tell Claude to treat them as
data, not instructions (see app/llm.py).
"""

from app.schemas import LessonContext, Problem, StemIntegration


def lesson_details(concept: str, ctx: LessonContext) -> str:
    classroom = ctx.classroom_context or "Not specified."
    return (
        f"<concept>{concept}</concept>\n"
        f"<grade_level>{ctx.grade_level}</grade_level>\n"
        f"<lesson_minutes>{ctx.lesson_minutes}</lesson_minutes>\n"
        f"<classroom_context>{classroom}</classroom_context>"
    )


def chosen_problem(problem: Problem) -> str:
    return (
        f"<problem>\n<title>{problem.title}</title>\n"
        f"<driving_question>{problem.description}</driving_question>\n</problem>"
    )


def stem_mapping(stem: StemIntegration) -> str:
    return (
        "<stem_integration>\n"
        f"<science>{stem.science}</science>\n"
        f"<technology>{stem.technology}</technology>\n"
        f"<engineering>{stem.engineering}</engineering>\n"
        f"<mathematics>{stem.mathematics}</mathematics>\n"
        "</stem_integration>"
    )
