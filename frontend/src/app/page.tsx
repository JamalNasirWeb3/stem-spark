"use client";

import { useState, useSyncExternalStore } from "react";
import LessonPlanView from "@/components/LessonPlanView";
import { fetchLessonPlan, fetchProblems, type LessonPlan, type Problem } from "@/lib/api";
import {
  getSavedPlans,
  getServerSavedPlans,
  savePlan,
  subscribeSavedPlans,
} from "@/lib/savedPlans";

// The pipeline pauses after the Concept Agent: the teacher picks a problem here,
// then the remaining agents run in a second request.
type Step = "concept" | "select" | "plan";

export default function Home() {
  const [step, setStep] = useState<Step>("concept");
  const [concept, setConcept] = useState("");
  const [problems, setProblems] = useState<Problem[]>([]);
  const [plan, setPlan] = useState<LessonPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saved = useSyncExternalStore(subscribeSavedPlans, getSavedPlans, getServerSavedPlans);

  async function run<T>(task: () => Promise<T>, onDone: (result: T) => void) {
    setLoading(true);
    setError(null);
    try {
      onDone(await task());
    } catch (err) {
      setError(navigator.onLine ? (err as Error).message : "You're offline. Connect to generate.");
    } finally {
      setLoading(false);
    }
  }

  function submitConcept(e: React.FormEvent) {
    e.preventDefault();
    run(
      () => fetchProblems(concept),
      (res) => {
        setConcept(res.concept);
        setProblems(res.problems);
        setStep("select");
      },
    );
  }

  function selectProblem(problem: Problem) {
    run(
      () => fetchLessonPlan(concept, problem),
      (result) => {
        setPlan(result);
        savePlan(result);
        setStep("plan");
      },
    );
  }

  function restart() {
    setStep("concept");
    setConcept("");
    setProblems([]);
    setPlan(null);
    setError(null);
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-indigo-600">STEM Spark</h1>
        <p className="text-sm opacity-70">From Science Concepts to Real-World STEM Solutions.</p>
      </header>

      {error && <p className="mb-4 rounded bg-red-100 p-3 text-sm text-red-800">{error}</p>}

      {step === "concept" && (
        <>
          <form onSubmit={submitConcept} className="flex flex-col gap-3 sm:flex-row">
            <input
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Science concept, e.g. Conductors & Insulators"
              className="flex-1 rounded border border-gray-300 px-3 py-2 text-black"
              minLength={2}
              required
            />
            <button
              disabled={loading}
              className="rounded bg-indigo-600 px-4 py-2 font-medium text-white disabled:opacity-50"
            >
              {loading ? "Thinking…" : "Find real-world problems"}
            </button>
          </form>

          {saved.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-2 font-semibold">Saved lesson plans</h2>
              <ul className="space-y-2">
                {saved.map((s) => (
                  <li key={s.savedAt}>
                    <button
                      onClick={() => {
                        setPlan(s.plan);
                        setStep("plan");
                      }}
                      className="text-left text-indigo-600 underline"
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
        <section>
          <h2 className="mb-4 font-semibold">Choose a problem for “{concept}”</h2>
          <ul className="space-y-3">
            {problems.map((p) => (
              <li key={p.id}>
                <button
                  disabled={loading}
                  onClick={() => selectProblem(p)}
                  className="w-full rounded border border-gray-300 p-4 text-left hover:border-indigo-500 disabled:opacity-50"
                >
                  <span className="block font-medium">{p.title}</span>
                  <span className="text-sm opacity-80">{p.description}</span>
                </button>
              </li>
            ))}
          </ul>
          {loading && <p className="mt-4 text-sm">Building your lesson plan…</p>}
          <button onClick={restart} className="mt-6 text-sm underline">
            Start over
          </button>
        </section>
      )}

      {step === "plan" && plan && (
        <>
          <LessonPlanView plan={plan} />
          <button onClick={restart} className="mt-8 text-sm underline">
            New lesson plan
          </button>
        </>
      )}
    </main>
  );
}
