"""Lesson Plan Agent: assembles the final teacher-ready lesson plan.

Placeholder implementation: returns templated text until an LLM is wired in.
"""

from app.schemas import LessonPlan, Problem, StemIntegration, StsEdp


def compose(concept: str, problem: Problem, stem: StemIntegration, sts_edp: StsEdp) -> LessonPlan:
    return LessonPlan(
        concept=concept,
        problem=problem,
        objectives=[
            f"Explain the key ideas of {concept}.",
            f"Apply {concept} to design a solution for a real-world problem.",
        ],
        materials=["Placeholder materials list"],
        stem_integration=stem,
        sts_edp=sts_edp,
        activities=[stage.description for stage in sts_edp.stages],
        hots_questions=[
            f"Why does {concept} matter for this problem?",
            "How would you improve your design if you had different materials?",
        ],
        assessment=["Design rubric", "Test results record", "Group presentation"],
        problem_solving_task=problem.description,
        expected_solution=f"A tested design that addresses: {problem.title}.",
    )
