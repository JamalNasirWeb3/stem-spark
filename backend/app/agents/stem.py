"""STEM Agent: maps the selected problem onto Science, Technology, Engineering, Mathematics.

Placeholder implementation: returns templated text until an LLM is wired in.
"""

from app.schemas import Problem, StemIntegration


def integrate(concept: str, problem: Problem) -> StemIntegration:
    return StemIntegration(
        science=f"Core ideas of {concept} that explain the problem.",
        technology=f"Tools and devices used to investigate {concept}.",
        engineering=f"Designing a solution to: {problem.title}.",
        mathematics="Measuring, recording, and comparing results from tests.",
    )
