# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

The project has a working scaffold. The full flow runs end to end, but **the four agents in `backend/app/agents/` are templated placeholders**, and no LLM is connected yet. Product concept: `idea.md` (`idea.docx` is the Word copy).

## Commands

Backend (`backend/`, managed with uv, Python 3.12):

```bash
uv run uvicorn app.main:app --reload --port 8000   # dev server
uv run pytest                                      # all tests
uv run pytest tests/test_api.py::test_full_pipeline  # single test
uv run ruff check . && uv run ruff format .        # lint + format (line length 100)
```

The default shell here is Windows PowerShell 5.1, which has no `&&`. Use `;` there, or run the chained commands through Bash.

Frontend (`frontend/`, Next.js 16 + React 19 + Tailwind 4):

```bash
npm run dev      # dev server on :3000 (service worker is NOT registered in dev)
npm run build    # production build (type-checks too)
npm start        # serve the production build, needed to test PWA/offline behavior
npm run lint
```

Run both servers together. The frontend proxies `/api/*` to `BACKEND_URL` (default `http://127.0.0.1:8000`). **Rewrites are resolved at build time**, so set `BACKEND_URL` before `npm run build`, not only before `npm start`. On this machine, ports 3000 and 8000 may be in use by another project. Use `-p`/`--port` to choose other ports.

`frontend/AGENTS.md` (loaded via `frontend/CLAUDE.md`) warns that Next.js 16 differs from older versions. Check the docs in `frontend/node_modules/next/dist/docs/` before using Next.js APIs. `next dev` writes that block back into `AGENTS.md`, so don't strip it from diffs.

## Architecture

- **Two-call, stateless API around the human step.** `POST /api/problems {concept}` runs only the Concept Agent and returns candidate problems. The teacher picks one in the UI. Then `POST /api/lesson-plan {concept, problem}` runs STEM → STS–EDP → Lesson Plan in sequence (`backend/app/pipeline.py`). The server stores no session state; the client holds the concept and chosen problem between the two calls.
- **Agents** live in `backend/app/agents/`, one module per agent. Each is a plain function that takes the earlier stages' Pydantic outputs. Replace the bodies with LLM calls and keep the signatures. `tests/test_api.py` runs the full two-call flow and checks the exact EDP stage order (Ask → … → Share). Real agents must keep that contract.
- **Schemas** in `backend/app/schemas.py` define the lesson plan shape. `frontend/src/lib/api.ts` has hand-written TypeScript copies. Change both together.
- **Frontend flow** is one client page (`frontend/src/app/page.tsx`) with three steps: concept → select → plan. `LessonPlanView` renders the plan.
- **PWA:** the manifest is in `src/app/manifest.ts` and icons are in `public/icon-*.png`. The service worker is `public/sw.js`, registered by `src/components/ServiceWorkerRegister.tsx` in production only. The service worker caches pages and static assets network-first and never caches `/api/*`. Offline access to generated plans comes from localStorage (`src/lib/savedPlans.ts`, read through `useSyncExternalStore`), not from the service worker. If you change cached assets in a breaking way, bump `CACHE` in `sw.js`.

## Product concept: STEM Spark

Tagline: "From Science Concepts to Real-World STEM Solutions."

An agentic AI tool that helps teachers turn a single science concept (e.g. "Conductors & Insulators") into a problem-based STEM lesson plan.

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

This is the one worked example of what each stage should produce. It's a good first end-to-end test case.

- **Input concept:** Conductors & Insulators
- **Concept Agent problem:** "How can we choose the right materials to make an electrical device safe and prevent electric shocks?"
- **STEM Agent mapping:** Science: conductors and insulators. Technology: testing tools and electrical circuits. Mathematics: measuring and comparing results. Engineering: designing a safe insulated electrical solution.

The stated goal for teachers is to cut lesson-planning time and move teaching from textbook content to real-world STEM challenges. Generated output should read as a ready-to-use classroom plan, not a generic summary.
