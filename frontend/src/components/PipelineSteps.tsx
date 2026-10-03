export type StepState = "todo" | "active" | "done";

const STEPS = [
  { name: "Concept Agent", hint: "Finds real-life problems" },
  { name: "Teacher selection", hint: "You choose the problem" },
  { name: "STEM Agent", hint: "Links S, T, E and M" },
  { name: "STS–EDP Agent", hint: "Society + design process" },
  { name: "Lesson Plan Agent", hint: "Teacher-ready plan" },
];

const RING: Record<StepState, string> = {
  todo: "border-line text-muted",
  active: "border-accent text-foreground animate-pulse",
  done: "border-accent bg-accent text-accent-contrast",
};

export default function PipelineSteps({ states }: { states: StepState[] }) {
  return (
    <ol className="grid grid-cols-5 gap-2 text-center">
      {STEPS.map((step, i) => (
        <li key={step.name} className="flex flex-col items-center">
          <span
            className={`mb-2 flex size-10 items-center justify-center rounded-full border-[3px] text-sm font-medium sm:size-12 ${RING[states[i]]}`}
            aria-label={`${step.name}: ${states[i]}`}
          >
            {states[i] === "done" ? "✓" : i + 1}
          </span>
          <span className="text-xs font-semibold sm:text-base">{step.name}</span>
          <span className="hidden text-sm text-muted sm:block">{step.hint}</span>
        </li>
      ))}
    </ol>
  );
}
