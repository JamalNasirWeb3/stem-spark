import type { LessonPlan } from "@/lib/api";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export default function LessonPlanView({ plan }: { plan: LessonPlan }) {
  const stem = plan.stem_integration;
  // Plans saved before lesson context existed have no `context` or stage minutes.
  const ctx = plan.context as LessonPlan["context"] | undefined;
  return (
    <article>
      <p className="text-sm uppercase tracking-wide text-muted">{plan.concept}</p>
      <h2 className="text-2xl font-bold">{plan.problem.title}</h2>
      <p className="mt-1 text-muted">{plan.problem.description}</p>
      {ctx && (
        <p className="mt-3 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full border border-line px-3 py-1">{ctx.grade_level}</span>
          <span className="rounded-full border border-line px-3 py-1">
            {ctx.lesson_minutes} minutes
          </span>
          {ctx.classroom_context && (
            <span className="rounded-full border border-line px-3 py-1">
              {ctx.classroom_context}
            </span>
          )}
        </p>
      )}

      <Section title="Objectives">
        <List items={plan.objectives} />
      </Section>
      <Section title="Materials">
        <List items={plan.materials} />
      </Section>
      <Section title="STEM Integration">
        <dl className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["Science", stem.science],
              ["Technology", stem.technology],
              ["Engineering", stem.engineering],
              ["Mathematics", stem.mathematics],
            ] as const
          ).map(([label, text]) => (
            <div key={label} className="rounded-lg border border-line bg-card p-3">
              <dt className="font-semibold">{label}</dt>
              <dd className="text-sm text-muted">{text}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section title="Science–Technology–Society">
        <p>{plan.sts_edp.science_technology_society}</p>
      </Section>
      <Section title="Engineering Design Process">
        <ol className="space-y-2">
          {plan.sts_edp.stages.map((s) => (
            <li key={s.stage} className="flex gap-3">
              <span className="w-20 shrink-0 font-semibold">
                {s.stage}
                {s.minutes != null && (
                  <span className="block text-xs font-normal text-muted">{s.minutes} min</span>
                )}
              </span>
              <span>{s.description}</span>
            </li>
          ))}
        </ol>
      </Section>
      <Section title="Activities">
        <List items={plan.activities} />
      </Section>
      <Section title="HOTS Questions">
        <List items={plan.hots_questions} />
      </Section>
      <Section title="Assessment">
        <List items={plan.assessment} />
      </Section>
      <Section title="Problem-Solving Task">
        <p>{plan.problem_solving_task}</p>
      </Section>
      <Section title="Expected Solution">
        <p>{plan.expected_solution}</p>
      </Section>
    </article>
  );
}
