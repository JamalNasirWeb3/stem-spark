// Types mirror backend/app/schemas.py — keep them in sync.

// `token` is the backend's guardrail signature: send problems back unchanged.
export type Problem = { id: string; title: string; description: string; token?: string };

export type LessonContext = {
  grade_level: string;
  lesson_minutes: number;
  classroom_context: string;
};

export type ProblemsResponse = { concept: string; problems: Problem[] };

export type StemIntegration = {
  science: string;
  technology: string;
  engineering: string;
  mathematics: string;
};

export type EdpStage = { stage: string; description: string; minutes: number };

export type StsEdp = { science_technology_society: string; stages: EdpStage[] };

export type LessonPlan = {
  concept: string;
  problem: Problem;
  context: LessonContext;
  objectives: string[];
  materials: string[];
  stem_integration: StemIntegration;
  sts_edp: StsEdp;
  activities: string[];
  hots_questions: string[];
  assessment: string[];
  problem_solving_task: string;
  expected_solution: string;
};

/** An API error. Guardrail rejections carry a `code` and a teacher-facing message. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

async function errorFrom(res: Response): Promise<ApiError> {
  const detail = await res
    .json()
    .then((b) => b?.detail)
    .catch(() => undefined);
  if (detail && typeof detail.message === "string") {
    return new ApiError(detail.message, res.status, detail.code);
  }
  const message =
    res.status === 422
      ? "Please check what you entered and try again."
      : `Request failed (${res.status})`;
  return new ApiError(message, res.status);
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await errorFrom(res);
  return res.json() as Promise<T>;
}

export function fetchProblems(concept: string, context: LessonContext) {
  return post<ProblemsResponse>("/api/problems", { concept, context });
}

/** Agents the streaming endpoint reports as finished. The Lesson Plan Agent's result is the plan. */
export type PlanAgent = "stem" | "sts_edp";

type PlanEvent =
  | { type: "agent_done"; agent: PlanAgent }
  | { type: "plan"; plan: LessonPlan }
  | { type: "error"; code: string; message: string };

/**
 * Builds the lesson plan through the streaming endpoint, which reports each
 * agent as it finishes (newline-delimited JSON), so the UI can show real progress.
 */
export async function fetchLessonPlan(
  concept: string,
  problem: Problem,
  context: LessonContext,
  onAgentDone: (agent: PlanAgent) => void,
): Promise<LessonPlan> {
  const res = await fetch("/api/lesson-plan/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ concept, problem, context }),
  });
  if (!res.ok || !res.body) throw await errorFrom(res);

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buffer += value;
    const lines = buffer.split("\n");
    buffer = done ? "" : (lines.pop() ?? "");
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as PlanEvent;
      if (event.type === "agent_done") onAgentDone(event.agent);
      else if (event.type === "plan") return event.plan;
      else throw new ApiError(event.message, 502, event.code);
    }
    if (done) break;
  }
  throw new ApiError("The connection to the agents was lost. Please try again.", 502);
}

export type AgentsStatus = "ready" | "demo" | "setup needed" | "offline";

/** "ready" when Claude runs the agents, "demo" when the backend uses templates. */
export async function checkAgents(): Promise<AgentsStatus> {
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    if (!res.ok) return "offline";
    const body = (await res.json()) as { agents?: string };
    if (body.agents === "template") return "demo";
    if (body.agents === "not_configured") return "setup needed";
    return "ready";
  } catch {
    return "offline";
  }
}
