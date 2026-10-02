"""Concept Agent: turns a science concept into candidate real-life problems.

Placeholder implementation: returns templated problems until an LLM is wired in.
"""

from app.schemas import Problem


def suggest_problems(concept: str) -> list[Problem]:
    return [
        Problem(
            id="p1",
            title=f"Staying safe with {concept}",
            description=(
                f"How can we use what we know about {concept} to make an everyday "
                "device or situation safer?"
            ),
        ),
        Problem(
            id="p2",
            title=f"{concept} in our community",
            description=(
                f"Where does {concept} show up in our school or neighbourhood, and "
                "what problem could we solve with it?"
            ),
        ),
        Problem(
            id="p3",
            title=f"Designing with {concept}",
            description=(
                f"How might we design a low-cost product that relies on {concept} "
                "to meet a real need?"
            ),
        ),
    ]
