"""Teacher sign-in (Supabase Auth, Google accounts) and per-teacher daily limits.

The frontend signs teachers in with Supabase and sends the session's access
token as `Authorization: Bearer <token>`. We check it by asking Supabase who the
token belongs to, so no JWT keys need configuring here.

Daily limits are counted in the Supabase `generations` table (see
supabase/schema.sql). Requests to it carry the teacher's own token, so row-level
security confines each teacher to their own rows, and the table has no
update/delete policy, so a teacher can't reset their count.

Settings: SUPABASE_URL and SUPABASE_ANON_KEY (the project's public key). Set
STEM_AUTH=off to run without sign-in (tests, local development).
"""

import logging
import os
from dataclasses import dataclass
from datetime import UTC, datetime
from functools import lru_cache
from typing import Annotated, Literal

import httpx
from fastapi import Header, HTTPException

log = logging.getLogger(__name__)

Kind = Literal["problems", "lesson_plan"]

# Lesson plans run three Claude calls (about $0.25 each); problem lists run one.
_DEFAULT_LIMITS: dict[Kind, int] = {"problems": 30, "lesson_plan": 10}
_LIMIT_ENV: dict[Kind, str] = {
    "problems": "DAILY_PROBLEM_LIMIT",
    "lesson_plan": "DAILY_LESSON_PLAN_LIMIT",
}
_LIMIT_MESSAGES: dict[Kind, str] = {
    "problems": "You've reached today's limit of {n} problem searches. Please try again tomorrow.",
    "lesson_plan": "You've reached today's limit of {n} lesson plans. Please try again tomorrow.",
}


@dataclass(frozen=True)
class Teacher:
    id: str
    email: str
    token: str


def auth_enabled() -> bool:
    return os.environ.get("STEM_AUTH", "on").lower() != "off"


def auth_status() -> str:
    """For /api/health: "on", "off", or "not_configured"."""
    if not auth_enabled():
        return "off"
    return "on" if _settings() else "not_configured"


def _settings() -> tuple[str, str] | None:
    url = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
    key = os.environ.get("SUPABASE_ANON_KEY", "").strip()
    return (url, key) if url and key else None


@lru_cache
def _http() -> httpx.Client:
    return httpx.Client(timeout=10.0)


def _error(status: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status, detail={"code": code, "message": message})


def _headers(key: str, token: str) -> dict[str, str]:
    return {"apikey": key, "Authorization": f"Bearer {token}"}


def current_teacher(authorization: Annotated[str | None, Header()] = None) -> Teacher | None:
    """FastAPI dependency: the signed-in teacher, or None when sign-in is off."""
    if not auth_enabled():
        return None
    settings = _settings()
    if not settings:
        raise _error(503, "auth_not_configured", "Sign-in is not configured on the server.")
    url, key = settings

    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise _error(401, "not_signed_in", "Please sign in with Google to create lesson plans.")
    token = token.strip()

    try:
        res = _http().get(f"{url}/auth/v1/user", headers=_headers(key, token))
    except httpx.HTTPError as e:
        log.warning("Supabase auth unreachable: %s", e)
        raise _error(503, "auth_unavailable", "Sign-in can't be checked right now.") from e
    if res.status_code in (401, 403):
        raise _error(401, "session_expired", "Your sign-in has expired. Please sign in again.")
    if res.status_code != 200:
        log.warning("Supabase auth returned %s", res.status_code)
        raise _error(503, "auth_unavailable", "Sign-in can't be checked right now.")
    user = res.json()
    return Teacher(id=user["id"], email=user.get("email") or "", token=token)


def _limit(kind: Kind) -> int:
    try:
        return int(os.environ.get(_LIMIT_ENV[kind], _DEFAULT_LIMITS[kind]))
    except ValueError:
        return _DEFAULT_LIMITS[kind]


def record_generation(teacher: Teacher | None, kind: Kind) -> None:
    """Enforce the teacher's daily limit for `kind`, then count this request."""
    if teacher is None:
        return
    settings = _settings()
    if not settings:
        raise _error(503, "auth_not_configured", "Sign-in is not configured on the server.")
    url, key = settings
    headers = _headers(key, teacher.token)
    since = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    limit = _limit(kind)

    try:
        res = _http().get(
            f"{url}/rest/v1/generations",
            params={"select": "id", "kind": f"eq.{kind}", "created_at": f"gte.{since}"},
            headers={**headers, "Prefer": "count=exact", "Range": "0-0"},
        )
        if res.status_code not in (200, 206):
            raise httpx.HTTPStatusError("count failed", request=res.request, response=res)
        used = int(res.headers.get("content-range", "*/0").rsplit("/", 1)[-1])
        if used >= limit:
            raise _error(429, "daily_limit", _LIMIT_MESSAGES[kind].format(n=limit))
        res = _http().post(
            f"{url}/rest/v1/generations",
            json={"kind": kind},
            headers={**headers, "Prefer": "return=minimal"},
        )
        res.raise_for_status()
    except (httpx.HTTPError, ValueError) as e:
        log.warning("Usage tracking failed: %s", e)
        raise _error(503, "auth_unavailable", "Usage limits can't be checked right now.") from e
