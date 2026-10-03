"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import AgentProgress, { CONCEPT_AGENTS, PLAN_AGENTS } from "@/components/AgentProgress";
import InstallButton from "@/components/InstallButton";
import LessonPlanView from "@/components/LessonPlanView";
import PipelineSteps, { type StepState } from "@/components/PipelineSteps";
import {
  ApiError,
  type AgentsStatus,
  checkAgents,
  fetchLessonPlan,
  fetchProblems,
  type LessonContext,
  type LessonPlan,
  type Problem,
} from "@/lib/api";
import { EXAMPLE_PLAN } from "@/lib/examplePlan";
import { downloadLessonPlanPdf, preloadPdfExport } from "@/lib/pdfExport";
import {
  getSavedPlans,
  getServerSavedPlans,
  savePlan,
  subscribeSavedPlans,
} from "@/lib/savedPlans";

// The pipeline pauses after the Concept Agent: the teacher picks a problem here,
// then the remaining agents run in a second request.
type Step = "concept" | "select" | "plan";
type AgentsBadge = AgentsStatus | "checking";
// Timing for the progress bar. `done` counts agents finished in the current request.
type Progress = { startedAt: number; stageStartedAt: number; done: number };

// Only called from event handlers; the React Compiler can't tell and flags Date.now().
const timestamp = () => Date.now();

const CONCEPT_SUGGESTIONS = [
  "Conductors & Insulators",
  "Photosynthesis",
  "Simple machines",
  "States of matter",
  "Magnetism",
  "Water filtration",
  "Heat transfer",
  "Food chains",
];

const GRADES = Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`);

const LESSON_TIMES = [
  { minutes: 40, label: "40 minutes (single period)" },
  { minutes: 60, label: "60 minutes" },
  { minutes: 80, label: "80 minutes (double period)" },
  { minutes: 120, label: "120 minutes (triple period)" },
];

const FIELD =
  "w-full rounded-lg border border-line bg-card px-4 py-3 text-foreground placeholder:text-muted focus:border-accent focus:outline-none";

function stepStates(step: Step, loading: boolean, agentsDone: number): StepState[] {
  if (step === "plan") return ["done", "done", "done", "done", "done"];
  if (step === "select") {
    // The second request reports each agent as it finishes: STEM -> STS-EDP -> Lesson Plan.
    if (!loading) return ["done", "active", "todo", "todo", "todo"];
    const agents = [0, 1, 2].map<StepState>((i) =>
      i < agentsDone ? "done" : i === agentsDone ? "active" : "todo",
    );
    return ["done", "done", ...agents];
  }
  return [loading ? "active" : "todo", "todo", "todo", "todo", "todo"];
}

export default function Home() {
  const [step, setStep] = useState<Step>("concept");
  const [concept, setConcept] = useState("");
  const [gradeLevel, setGradeLevel] = useState("Grade 6");
  const [lessonMinutes, setLessonMinutes] = useState(80);
  const [classroomContext, setClassroomContext] = useState("");
  const [problems, setProblems] = useState<Problem[]>([]);
  const [plan, setPlan] = useState<LessonPlan | null>(null);
  const [isExample, setIsExample] = useState(false);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<Progress>({
    startedAt: 0,
    stageStartedAt: 0,
    done: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentsBadge>("checking");

  const saved = useSyncExternalStore(subscribeSavedPlans, getSavedPlans, getServerSavedPlans);

  useEffect(() => {
    const check = () => checkAgents().then(setAgents);
    check();
    window.addEventListener("online", check);
    window.addEventListener("offline", check);
    return () => {
      window.removeEventListener("online", check);
      window.removeEventListener("offline", check);
    };
  }, []);

  const context: LessonContext = {
    grade_level: gradeLevel,
    lesson_minutes: lessonMinutes,
    classroom_context: classroomContext.trim(),
  };

  // Each step replaces the page content, so bring the new step into view.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (step === "plan") preloadPdfExport();
  }, [step]);

  async function exportPdf(p: LessonPlan) {
    setExporting(true);
    setError(null);
    try {
      await downloadLessonPlanPdf(p);
    } catch {
      setError("Couldn't create the PDF. Reconnect once so the PDF tools can load, then retry.");
    } finally {
      setExporting(false);
    }
  }

  async function run<T>(task: () => Promise<T>, onDone: (result: T) => void) {
    const startedAt = timestamp();
    setProgress({ startedAt, stageStartedAt: startedAt, done: 0 });
    setLoading(true);
    setError(null);
    try {
      onDone(await task());
    } catch (err) {
      setError(navigator.onLine ? (err as Error).message : "You're offline. Connect to generate.");
      // A problem list issued before a backend restart no longer verifies; start again.
      if (err instanceof ApiError && err.code === "untrusted_problem") setStep("concept");
    } finally {
      setLoading(false);
    }
  }

  function submitConcept(e: React.FormEvent) {
    e.preventDefault();
    run(
      () => fetchProblems(concept, context),
      (res) => {
        setConcept(res.concept);
        setProblems(res.problems);
        setStep("select");
      },
    );
  }

  function selectProblem(problem: Problem) {
    run(
      () =>
        fetchLessonPlan(concept, problem, context, () =>
          setProgress((p) => ({
            ...p,
            done: p.done + 1,
            stageStartedAt: timestamp(),
          })),
        ),
      (result) => {
        setPlan(result);
        setIsExample(false);
        savePlan(result);
        setStep("plan");
      },
    );
  }

  function showPlan(p: LessonPlan, example: boolean) {
    setPlan(p);
    setIsExample(example);
    setError(null);
    setStep("plan");
  }

  function restart() {
    setStep("concept");
    setProblems([]);
    setPlan(null);
    setIsExample(false);
    setError(null);
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:py-12">
      <header className="mb-10 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">STEM SPARK</h1>
          <p className="mt-2 font-serif text-lg italic text-muted sm:text-xl">
            From science concepts to real-world STEM solutions.
          </p>
        </div>
        <div className="mt-2 flex shrink-0 flex-col items-end gap-2">
          <span
            className="rounded-lg border border-line px-3 py-2 text-sm text-muted"
            role="status"
          >
            Agents:{" "}
            <span
              className={
                agents === "ready"
                  ? "font-semibold text-ready"
                  : agents === "offline" || agents === "setup needed"
                    ? "font-semibold text-danger-fg"
                    : ""
              }
            >
              {agents === "demo" ? "demo mode" : agents}
            </span>
          </span>
          <InstallButton />
        </div>
      </header>

      <PipelineSteps states={stepStates(step, loading, progress.done)} />

      {error && <p className="mt-6 rounded-lg bg-danger-bg p-3 text-sm text-danger-fg">{error}</p>}

      {step === "concept" && (
        <>
          <form
            onSubmit={submitConcept}
            className="mt-8 rounded-xl border border-line bg-card p-5 sm:p-7"
          >
            <h2 className="text-xl font-semibold sm:text-2xl">Start with a science concept</h2>
            <p className="mt-1 text-muted">
              Type the topic you are teaching. The agents will turn it into a problem-based STEM
              lesson.
            </p>
            <p className="mt-1 text-sm text-muted">
              Science, technology, engineering and mathematics topics only.
            </p>

            <label htmlFor="concept" className="mt-6 block font-medium">
              Science concept
            </label>
            <input
              id="concept"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="e.g. Conductors & Insulators"
              className={`${FIELD} mt-2 text-lg`}
              minLength={2}
              maxLength={200}
              required
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {CONCEPT_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setConcept(s)}
                  className="rounded-full border border-dashed border-line px-3 py-1 text-sm text-muted hover:border-accent hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="grade" className="block font-medium">
                  Grade level
                </label>
                <select
                  id="grade"
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  className={`${FIELD} mt-2`}
                >
                  {GRADES.map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="minutes" className="block font-medium">
                  Lesson time
                </label>
                <select
                  id="minutes"
                  value={lessonMinutes}
                  onChange={(e) => setLessonMinutes(Number(e.target.value))}
                  className={`${FIELD} mt-2`}
                >
                  {LESSON_TIMES.map((t) => (
                    <option key={t.minutes} value={t.minutes}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label htmlFor="classroom" className="mt-6 block font-medium">
              Classroom context <span className="font-normal text-muted">(optional)</span>
            </label>
            <textarea
              id="classroom"
              value={classroomContext}
              onChange={(e) => setClassroomContext(e.target.value)}
              placeholder="e.g. 35 students, no lab, low-cost local materials only, students work in groups of 5"
              maxLength={500}
              rows={3}
              className={`${FIELD} mt-2`}
            />

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                disabled={loading || concept.trim().length < 2}
                className="rounded-lg border-2 border-accent bg-accent px-5 py-3 font-medium text-accent-contrast disabled:border-line disabled:bg-transparent disabled:text-muted"
              >
                {loading ? "Concept Agent is thinking…" : "Find real-life problems"}
              </button>
              <button
                type="button"
                onClick={() => showPlan(EXAMPLE_PLAN, true)}
                className="rounded-lg border-2 border-accent px-5 py-3 font-medium"
              >
                See a finished example
              </button>
            </div>
            {loading && (
              <AgentProgress
                agents={CONCEPT_AGENTS}
                current={0}
                startedAt={progress.startedAt}
                stageStartedAt={progress.stageStartedAt}
              />
            )}
          </form>

          {saved.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-2 font-semibold">Saved lesson plans</h2>
              <ul className="space-y-2">
                {saved.map((s) => (
                  <li key={s.savedAt}>
                    <button
                      onClick={() => showPlan(s.plan, false)}
                      className="text-left underline underline-offset-4"
                    >
                      {s.plan.concept}: {s.plan.problem.title}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {step === "select" && (
        <section className="mt-8">
          <h2 className="mb-1 text-xl font-semibold">Step 2: Choose a problem for “{concept}”</h2>
          <p className="mb-4 text-muted">
            Pick the real-life problem you want your class to solve. The STEM, STS–EDP and Lesson
            Plan agents will then build the full lesson plan around it. ({gradeLevel} ·{" "}
            {lessonMinutes} minutes)
          </p>
          <ul className="space-y-3">
            {problems.map((p) => (
              <li key={p.id}>
                <button
                  disabled={loading}
                  onClick={() => {
                    setChosenId(p.id);
                    selectProblem(p);
                  }}
                  className="group flex w-full flex-col gap-3 rounded-xl border border-line bg-card p-4 text-left hover:border-accent disabled:opacity-60 sm:flex-row sm:items-center"
                >
                  <span className="flex-1">
                    <span className="block font-medium">{p.title}</span>
                    <span className="text-sm text-muted">{p.description}</span>
                  </span>
                  <span className="shrink-0 rounded-lg border-2 border-accent px-4 py-2 text-sm font-medium group-hover:bg-accent group-hover:text-accent-contrast">
                    {loading && chosenId === p.id ? "Building plan…" : "Build lesson plan →"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {loading && (
            <AgentProgress
              agents={PLAN_AGENTS}
              current={progress.done}
              startedAt={progress.startedAt}
              stageStartedAt={progress.stageStartedAt}
            />
          )}
          <button onClick={restart} className="mt-6 text-sm underline underline-offset-4">
            Start over
          </button>
        </section>
      )}

      {step === "plan" && plan && (
        <div className="mt-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            {isExample ? (
              <p className="rounded-full border border-line px-3 py-1 text-sm text-muted">
                Finished example
              </p>
            ) : (
              <span />
            )}
            <button
              onClick={() => exportPdf(plan)}
              disabled={exporting}
              className="rounded-lg border-2 border-accent bg-accent px-4 py-2 text-sm font-medium text-accent-contrast disabled:opacity-60"
            >
              {exporting ? "Preparing PDF…" : "Download PDF"}
            </button>
          </div>
          <LessonPlanView plan={plan} />
          <button onClick={restart} className="mt-8 text-sm underline underline-offset-4">
            {isExample ? "Back" : "New lesson plan"}
          </button>
        </div>
      )}

      <footer className="mt-12 text-center text-sm text-muted">
        Concept → Real problem → STEM integration → Engineering design process → Innovative lesson
        plan
      </footer>
    </main>
  );
}
