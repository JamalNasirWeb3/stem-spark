# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

The full flow runs end to end. The four agents in `backend/app/agents/` call Claude (`claude-opus-5-5` by default) through the Anthropic Python SDK. Each agent still has its old templated version, which runs when `STEM_AGENTS=template`. Product concept: `idea.md` (`idea.docx` is the Word copy). The UI design source is `idea-brief.pdf`, a mockup of the first screen. When it and `idea.md` disagree, the brief is newer and wins.

## Commands

Backend (`backend/`, managed with uv, Python 3.12):

```bash
uv run uvicorn app.main:app --reload --port 8000   # dev server
uv run pytest                                      # all tests
uv run pytest tests/test_api.py::test_full_pipeline  # single test
uv run pytest tests/test_guardrails.py               # STEM-only guardrail tests
uv run pytest tests/test_claude_agents.py            # Claude code path, against a fake client
uv run ruff check . && uv run ruff format .        # lint + format (line length 100)
```

Backend settings live in `backend/.env`, which is git-ignored. `app/__init__.py` loads it with python-dotenv before anything reads settings, and real environment variables override it. `backend/.env.example` is the committed template. Restart uvicorn after editing `.env`, because `--reload` only watches `.py` files. Never read, print or commit `backend/.env`; it holds the user's API key. The settings:
- `ANTHROPIC_API_KEY` is required for the Claude agents. Without it, `/api/health` reports `agents: "not_configured"`, the UI badge says "setup needed", and requests fail with 503 `agents_not_configured`.
- `STEM_AGENT_MODEL` overrides the model (default `claude-opus-5-5`).
- `STEM_AGENTS=template` runs the templated agents, with no API calls.
- `GUARDRAIL_SECRET` is described under Architecture.

Tests never call the API: `tests/conftest.py` forces template mode, and `test_claude_agents.py` swaps in a fake client. Every Claude request costs real money, so get the user's approval before running anything against the real API.

The default shell here is Windows PowerShell 5.1, which has no `&&`. Use `;` there, or run the chained commands through Bash.

Frontend (`frontend/`, Next.js 16 + React 19 + Tailwind 4):

```bash
npm run dev      # dev server on :3000 (service worker is NOT registered in dev)
npm run build    # production build (type-checks too)
npm start        # serve the production build, needed to test PWA/offline behavior
npm run lint
```

Run both servers together. The frontend proxies `/api/*` to `BACKEND_URL` (default `http://127.0.0.1:8000`). **Rewrites are resolved at build time**, so set `BACKEND_URL` before `npm run build`, not only before `npm start`. `next.config.ts` raises `experimental.proxyTimeout` to 5 minutes. The default 30 s would cut off the lesson-plan request, which runs three Claude calls. On this machine, ports 3000 and 8000 may be in use by another project. Use `-p`/`--port` to choose other ports, for example backend on 8001 and `npx next dev -p 3001` with `BACKEND_URL=http://127.0.0.1:8001`. In PowerShell, `npm run dev -- -p 3001` loses the `--`, so call `npx next` directly. `next dev` only sends its client scripts to `localhost` and the hosts listed in `allowedDevOrigins` (`next.config.ts`, currently `127.0.0.1`). Opening the dev server from any other host, such as a LAN IP, shows the page, but nothing on it responds until that host is added there.

The user runs the dev servers in their own terminals. Check whether ports 3001 and 8001 are listening before you start servers or run `npm run build`. A build overwrites `.next` underneath a running `next dev`.

`frontend/AGENTS.md` (loaded via `frontend/CLAUDE.md`) warns that Next.js 16 differs from older versions. Check the docs in `frontend/node_modules/next/dist/docs/` before using Next.js APIs. `next dev` writes that block back into `AGENTS.md`, so don't strip it from diffs.

## Architecture

- **Two-call, stateless API around the human step.** `POST /api/problems {concept, context}` runs the guardrails and then the Concept Agent, and returns signed candidate problems. The teacher picks one in the UI. Then `POST /api/lesson-plan {concept, problem, context}` runs STEM → STS–EDP → Lesson Plan in sequence (`backend/app/pipeline.py`). The server stores no session state; the client holds the concept, context and chosen problem between the two calls. `GET /api/health` drives the "Agents: ready" badge.
- **STEM-only guardrails** (`backend/app/guardrails.py`) run on the server, because the client can be bypassed. (1) `check_concept` rejects concepts without STEM vocabulary (422 `off_topic`, with a hint naming the subject when it can tell) and rejects unsafe topics even when STEM words are present (422 `unsafe_topic`). Classroom context gets the unsafe check (`unsafe_context`). (2) `/api/problems` HMAC-signs every problem (`Problem.token`). `/api/lesson-plan` only accepts a problem whose token matches the concept (403 `untrusted_problem`), so a client can't send a made-up topic. Set `GUARDRAIL_SECRET` in production. Without it the key is random per process, so a restart invalidates problem lists already on screen, and the UI sends the teacher back to step 1. The keyword lists are a deterministic first line. The second line is the Concept Agent: its output includes `is_stem_topic`, and a `false` there becomes 422 `off_topic`, so Claude catches STEM-sounding non-STEM topics at no extra cost. `SHARED_BRIEF` also restricts every agent to safe STEM content. The UI suggestion chips must always pass (`tests/test_guardrails.py` checks them). Errors come back as `{detail: {code, message}}`, and `ApiError` in `api.ts` shows `message` to the teacher.
- **Lesson context** (`LessonContext`: `grade_level`, `lesson_minutes` (30–240), optional `classroom_context`) comes from the form fields in the brief. It has defaults (Grade 6, 80 minutes), so `context` can be left out of a request. Every agent receives it as `ctx`, and the finished `LessonPlan` echoes it back.
- **Agents** live in `backend/app/agents/`, one module per agent. Each is a plain function that takes the earlier stages' Pydantic outputs plus `ctx`, and they run in sequence in `pipeline.py`. Every Claude call goes through `app/llm.py` `generate()`:
  - **Request shape:** structured output (`output_config.format` built with `anthropic.transform_schema` from a Pydantic model), adaptive thinking with per-agent `effort` (medium for the first three agents, high for the Lesson Plan Agent), and server-side refusal fallback (`fallbacks="default"` + beta `server-side-fallback-2026-07-01`).
  - **Caching:** the system prompt is two cached blocks, the shared `SHARED_BRIEF` (audience, scope and safety rules, reference example) and then the agent's fixed `INSTRUCTIONS`. Teacher data goes only in the user message, wrapped in tags by `agents/_prompt.py`. Keep both system blocks byte-stable, with nothing per-request in them, or caching breaks.
  - **Why not `messages.parse()`:** it validates the JSON before you can check `stop_reason`, so `generate()` checks for `refusal` and `max_tokens` first, then validates.
  - **Errors:** SDK failures become `AgentError(code, message, status)`, which `main.py` returns as `{detail: {code, message}}`. The SDK raises a bare `TypeError` when it has no credentials, which is why `credentials_configured()` checks first.
  - **The model only writes prose.** Code fixes everything structural: problem ids and tokens, the EDP stage order (`_StsEdpDraft` has one field per stage), stage minutes (`allocate_minutes`), and the concept, problem, context and earlier agents' output carried into the final plan. Keep it that way.

  `tests/test_api.py` runs the full two-call flow. `tests/test_api.py` runs the full two-call flow and checks two contracts that real agents must keep: the exact EDP stage order (Ask → … → Share), and `EdpStage.minutes` summing exactly to `lesson_minutes`. `sts_edp.allocate_minutes` does that split today.
- **Schemas** in `backend/app/schemas.py` define the lesson plan shape. `frontend/src/lib/api.ts` has hand-written TypeScript copies. Change both together. Plans already saved in localStorage keep their old shape, so `LessonPlanView` has to tolerate missing fields (it already treats `context` and stage `minutes` as optional).
- **Frontend flow** is one client page (`frontend/src/app/page.tsx`) with three steps: concept → select → plan. `PipelineSteps` shows the 5-agent progress strip, and `LessonPlanView` renders the plan. "See a finished example" shows `src/lib/examplePlan.ts`. That plan is hand-written and bundled, so it works offline. Keep its stage minutes in line with `allocate_minutes(80)`.
- **PDF export** (`src/lib/pdfExport.ts`) builds the PDF in the browser with pdfmake, so it works offline and needs no backend. pdfmake (~2 MB with fonts) is loaded with a dynamic import when the plan screen opens, which also lets the service worker cache it. `buildDocDefinition` is a pure function and has to stay in sync with `LessonPlanView` when the plan shape changes. pdfmake mutates the arrays it is given, so always pass copies (`[...items]`). Otherwise an export corrupts the plan in React state and localStorage.
- **Styling:** colors are CSS variables in `src/app/globals.css`, exposed to Tailwind through `@theme inline` (`text-muted`, `border-line`, `bg-card`, `bg-accent`, …) and redefined for dark mode. Use those tokens, not raw Tailwind palette colors.
- **PWA:** the manifest is in `src/app/manifest.ts` and icons are in `public/icon-*.png`. The service worker is `public/sw.js`, registered by `src/components/ServiceWorkerRegister.tsx` in production only. The service worker caches pages and static assets network-first and never caches `/api/*`. Offline access to generated plans comes from localStorage (`src/lib/savedPlans.ts`, read through `useSyncExternalStore`), not from the service worker. If you change cached assets in a breaking way, bump `CACHE` in `sw.js`.

## Product concept: STEM Lesson Planner AI

Tagline: "From science concepts to real-world STEM solutions." `idea.md` calls it "STEM Spark". The brief's name is the one the UI uses. Internal keys such as the localStorage key `stem-spark:plans` and the service worker `CACHE` keep the old name, because renaming them would drop users' saved plans and caches.

An agentic AI tool that helps teachers turn a single science concept (e.g. "Conductors & Insulators") into a problem-based STEM lesson plan, tailored to grade level, lesson length, and classroom constraints (class size, no lab, low-cost materials, group size).

### Pipeline

The design is a sequential multi-agent pipeline with one human-in-the-loop step:

```
Concept → Real Problem → STEM Integration → EDP → Innovative Lesson Plan
```

1. **Concept Agent**: analyzes the input concept and proposes several real-life problems tied to it.
2. **Teacher Selection** (human step): the teacher reviews the generated problems and picks one. The pipeline has to pause here and resume with the teacher's choice.
3. **STEM Agent**: maps the selected problem onto Science, Technology, Mathematics, and Engineering components.
4. **STS–EDP Agent**: structures the lesson around Science–Technology–Society and the Engineering Design Process stages: Ask → Imagine → Plan → Create → Test → Improve → Share.
5. **Lesson Plan Agent**: produces the final teacher-ready plan with objectives, activities, materials, STEM integration, HOTS (higher-order thinking skills) questions, assessment, the problem-solving task, and the expected solution.

### Reference example (from `idea.md`)

This is the one worked example of what each stage should produce. It's a good first end-to-end test case. `frontend/src/lib/examplePlan.ts` builds it out into a full Grade 6, 80-minute plan, which is the quality bar for real agent output.

- **Input concept:** Conductors & Insulators
- **Concept Agent problem:** "How can we choose the right materials to make an electrical device safe and prevent electric shocks?"
- **STEM Agent mapping:** Science: conductors and insulators. Technology: testing tools and electrical circuits. Mathematics: measuring and comparing results. Engineering: designing a safe insulated electrical solution.

The stated goal for teachers is to cut lesson-planning time and move teaching from textbook content to real-world STEM challenges. Generated output should read as a ready-to-use classroom plan, not a generic summary.
