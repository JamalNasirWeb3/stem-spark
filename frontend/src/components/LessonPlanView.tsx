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
  return (
    <article>
      <p className="text-sm uppercase tracking-wide opacity-60">{plan.concept}</p>
      <h2 className="text-2xl font-bold">{plan.problem.title}</h2>
      <p className="mt-1 opacity-80">{plan.problem.description}</p>

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
            <div key={label} className="rounded border border-gray-200 p-3">
              <dt className="font-medium text-indigo-600">{label}</dt>
              <dd className="text-sm">{text}</dd>
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
            <li key={s.stage}>
              <span className="font-medium">{s.stage}</span>: {s.description}
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
