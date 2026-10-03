"""Guardrails that keep the planner on STEM topics.

Two gates, both enforced server-side because the client can be bypassed:

1. Entered concepts (`check_concept`) must contain recognisable STEM vocabulary
   and no unsafe terms. Classroom context is screened for unsafe terms too.
2. Selected problems (`sign_problem` / `verify_problem`) must be ones the Concept
   Agent issued for that concept. The API is stateless, so each problem carries
   an HMAC token instead of being remembered server-side.

The vocabulary check is a deterministic first line. When LLM agents are wired in,
add an LLM topic classifier inside `check_concept` and keep the keyword gate.
"""

import hashlib
import hmac
import json
import os
import re
import secrets
from dataclasses import dataclass

from app.schemas import Problem

# Entries ending in "*" match as a word prefix ("magnet*" -> magnetism, magnets).
# Other entries match the whole word, optionally plural ("cell" -> cell, cells).
_STEM_TERMS = """
science scien* experiment* hypothes* laborator*
physic* force motion gravit* friction energy energies kinetic momentum velocity
acceleration speed mass weight density pressure buoyan* float* lever pulley axle
incline* wedge screw machine* electric* electron* circuit* conduct* insulat*
magnet* battery batteries voltage light lens lenses mirror refract* optic* sound
wave* vibrat* frequenc* heat thermal temperature* thermo* radiation convection
nuclear atom* matter solid* liquid* gas gases plasma evaporat* condens* melting
freezing boiling sublimation
chemi* compound* molecul* reaction* acid* alkali* mixture* dissolv* solub* crystal*
oxid* rust* corrosion combustion polymer* metal* salt* periodic
biolog* cell cellular organism* plant* animal* photosynth* ecosystem* food*chain*
food*web* habitat* adaptation* evolution* genetic* gene dna heredit* life*cycle*
organ skelet* bone muscle* digest* respirat* circulat* heart blood lung* brain
nervous senses microb* bacteri* virus* fung* germ* disease* immun* vaccin*
nutrition nutrient* pollinat* seed* germinat* insect* species biodivers* decompos*
symbio* predator* prey anatom* body
earth geolog* rock* mineral* soil* erosion weathering volcan* earthquake* tectonic*
fossil* water rain* cloud* weather climate* atmospher* air wind* ocean* river*
flood* drought* pollut* recycl* renewable* solar sun moon* planet* star galax*
universe astronom* space orbit* eclipse* season* tide* environment* conservation
sustainab* carbon greenhouse
technolog* engineer* robot* coding programming computer* comput* algorithm* software
hardware internet data sensor* electronic* automat* ai bridge* material* prototype*
invent* filtr* filter* pump* engine* vehicle* aerodynam* flight rocket* satellite*
drone*
math* arithmetic number* fraction* decimal* percent* ratio* proportion* geometr*
angle* shape* area perimeter volume measur* graph* statistic* probabil* algebra*
equation* calculus trigonometr* pattern* symmetr* average addition subtraction
multiplicat* division integer* coordinate* estimat*
""".split()

# Topics never acceptable in a school lesson planner, even alongside STEM words.
_UNSAFE_TERMS = """
bomb weapon* firearm* gunpowder ammunition explosive*device* nerve*agent*
meth methamphetamine narcotic* suicide self*harm porn* terroris*
""".split()

# Non-STEM school subjects, only used to give a more helpful rejection message.
_OTHER_SUBJECTS = {
    "History": "histor* war wars ancient empire* dynast* pharaoh*",
    "Religious studies": "religio* bible quran torah prayer* god gods church mosque temple",
    "Language and literature": "poem* poetry novel* literature grammar spelling shakespeare essay*",
    "Social studies": "politic* election* government* citizenship econom* business*",
    "Arts": "painting* drawing* sculpture* dance* drama theatre theater",
}


def _pattern(terms: list[str]) -> re.Pattern[str]:
    parts = []
    for term in terms:
        prefix = term.endswith("*")
        # A "*" inside a term joins words, e.g. "food*chain*" -> "food chain(s)".
        body = r"[\s-]+".join(re.escape(w) for w in term.rstrip("*").split("*"))
        parts.append(rf"\b{body}" if prefix else rf"\b{body}(?:s|es)?\b")
    return re.compile("|".join(parts), re.IGNORECASE)


_STEM_RE = _pattern(_STEM_TERMS)
_UNSAFE_RE = _pattern(_UNSAFE_TERMS)
_OTHER_RES = {subject: _pattern(terms.split()) for subject, terms in _OTHER_SUBJECTS.items()}

STEM_EXAMPLES = "Magnetism, Photosynthesis, Simple machines, Water filtration, Fractions"


@dataclass(frozen=True)
class GuardrailViolation:
    code: str
    message: str


def check_concept(concept: str) -> GuardrailViolation | None:
    """Return a violation if the concept is unsafe or not a STEM topic, else None."""
    if _UNSAFE_RE.search(concept):
        return GuardrailViolation(
            "unsafe_topic",
            "This topic can't be used for a school lesson plan. Please enter a "
            "science, technology, engineering or mathematics concept.",
        )
    if _STEM_RE.search(concept):
        return None
    subject = next((s for s, rx in _OTHER_RES.items() if rx.search(concept)), None)
    looks_like = f" It looks like a {subject} topic." if subject else ""
    return GuardrailViolation(
        "off_topic",
        f"STEM Lesson Planner only builds science, technology, engineering and "
        f"mathematics lessons.{looks_like} Try a STEM concept such as {STEM_EXAMPLES}.",
    )


def check_classroom_context(text: str) -> GuardrailViolation | None:
    if text and _UNSAFE_RE.search(text):
        return GuardrailViolation(
            "unsafe_context",
            "The classroom context contains content that can't be used in a school "
            "lesson plan. Please remove it and try again.",
        )
    return None


# Set GUARDRAIL_SECRET in production so tokens survive restarts and work across
# workers. Without it, a random per-process key is used, so restarting the
# server invalidates problem lists that are already on screen.
_SECRET = os.environ.get("GUARDRAIL_SECRET", "").encode() or secrets.token_bytes(32)


def _token(concept: str, problem: Problem) -> str:
    payload = json.dumps(
        [concept.strip().casefold(), problem.id, problem.title, problem.description]
    )
    return hmac.new(_SECRET, payload.encode(), hashlib.sha256).hexdigest()


def sign_problem(concept: str, problem: Problem) -> Problem:
    return problem.model_copy(update={"token": _token(concept, problem)})


def verify_problem(concept: str, problem: Problem) -> GuardrailViolation | None:
    if problem.token and hmac.compare_digest(problem.token, _token(concept, problem)):
        return None
    return GuardrailViolation(
        "untrusted_problem",
        "Lesson plans can only be built from a problem suggested for this concept. "
        "Please find real-life problems again and choose one.",
    )
