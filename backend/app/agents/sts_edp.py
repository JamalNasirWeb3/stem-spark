"""STS–EDP Agent: frames the lesson with Science–Technology–Society and the
Engineering Design Process.

Placeholder implementation: returns templated text until an LLM is wired in.
"""

from app.schemas import EdpStage, Problem, StemIntegration, StsEdp

EDP_STAGES = ["Ask", "Imagine", "Plan", "Create", "Test", "Improve", "Share"]


def build(concept: str, problem: Problem, stem: StemIntegration) -> StsEdp:
    return StsEdp(
        science_technology_society=(
            f"Students explore how {concept} affects people's daily lives and how "
            f"technology helps society address: {problem.title}."
        ),
        stages=[
            EdpStage(stage=stage, description=f"{stage}: placeholder activity for {problem.title}.")
            for stage in EDP_STAGES
        ],
    )
