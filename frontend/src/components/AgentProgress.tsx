"use client";

import { useEffect, useState } from "react";

export type AgentEstimate = { name: string; seconds: number };

// Rough durations measured with Claude Opus 5.5 at medium effort. They only shape
// how fast the bar fills; the backend reports when each agent really finishes.
export const CONCEPT_AGENTS: AgentEstimate[] = [{ name: "Concept Agent", seconds: 20 }];
export const PLAN_AGENTS: AgentEstimate[] = [
  { name: "STEM Agent", seconds: 15 },
  { name: "STS–EDP Agent", seconds: 20 },
  { name: "Lesson Plan Agent", seconds: 60 },
];

/** Share of an agent's slice of the bar to fill after `elapsed` seconds. Never reaches 1. */
function stageFill(elapsed: number, expected: number): number {
  if (elapsed <= expected) return 0.9 * (elapsed / expected);
  return 0.9 + 0.08 * (1 - Math.exp(-(elapsed - expected) / expected));
}

function formatElapsed(seconds: number): string {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function AgentProgress({
  agents,
  current,
  startedAt,
  stageStartedAt,
}: {
  agents: AgentEstimate[];
  /** Index of the agent that is running now. */
  current: number;
  startedAt: number;
  stageStartedAt: number;
}) {
  const [now, setNow] = useState(startedAt);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const index = Math.min(current, agents.length - 1);
  const total = agents.reduce((sum, a) => sum + a.seconds, 0);
  const finished = agents.slice(0, index).reduce((sum, a) => sum + a.seconds, 0);
  const inStage = Math.max(0, (now - stageStartedAt) / 1000);
  const fill = (finished + agents[index].seconds * stageFill(inStage, agents[index].seconds)) / total;
  const percent = Math.round(fill * 100);

  return (
    <div className="mt-6 rounded-xl border border-line bg-card p-4" role="status">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">
          {agents[index].name} is working…
          {agents.length > 1 && (
            <span className="font-normal text-muted">
              {" "}
              Step {index + 1} of {agents.length}
            </span>
          )}
        </span>
        <span className="text-muted tabular-nums">
          {formatElapsed(Math.max(0, (now - startedAt) / 1000))}
        </span>
      </div>
      <div
        className="mt-3 h-2.5 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-label="Lesson planning progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300 ease-linear motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>
      {agents.length > 1 && (
        <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {agents.map((a, i) => (
            <li key={a.name} className={i === index ? "font-semibold text-foreground" : ""}>
              {i < index ? "✓ " : ""}
              {a.name}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
