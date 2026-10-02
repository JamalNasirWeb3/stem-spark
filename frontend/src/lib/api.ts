// Types mirror backend/app/schemas.py — keep them in sync.

export type Problem = { id: string; title: string; description: string };

export type ProblemsResponse = { concept: string; problems: Problem[] };

export type StemIntegration = {
  science: string;
  technology: string;
  engineering: string;
  mathematics: string;
};

export type EdpStage = { stage: string; description: string };

export type StsEdp = { science_technology_society: string; stages: EdpStage[] };

export type LessonPlan = {
  concept: string;
  problem: Problem;
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

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json() as Promise<T>;
}

export function fetchProblems(concept: string) {
  return post<ProblemsResponse>("/api/problems", { concept });
}

export function fetchLessonPlan(concept: string, problem: Problem) {
  return post<LessonPlan>("/api/lesson-plan", { concept, problem });
}
