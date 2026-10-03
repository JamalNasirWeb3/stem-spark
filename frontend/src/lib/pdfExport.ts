// Builds a printable PDF of a lesson plan in the browser, so export works offline
// and without the backend. pdfmake (~2 MB with fonts) is loaded on demand.

import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import type { LessonPlan } from "./api";

const INK = "#1e2a4a";
const MUTED = "#52607a";
const LINE = "#cfd8e3";

async function loadPdfMake() {
  const [{ default: pdfMake }, { default: vfs }] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  pdfMake.addVirtualFileSystem(vfs);
  return pdfMake;
}

/** Fetch the PDF code ahead of time so the service worker caches it for offline use. */
export function preloadPdfExport() {
  loadPdfMake().catch(() => {});
}

function section(title: string, body: Content): Content {
  return [{ text: title, style: "h2" }, body];
}

/** A short paragraph section kept on one page together with its heading. */
function textSection(title: string, text: string): Content {
  return { stack: [{ text: title, style: "h2" }, { text }], unbreakable: true };
}

// pdfmake mutates list arrays in place while laying out, so always pass copies;
// otherwise exporting would corrupt the plan in React state and localStorage.
function bullets(items: string[]): Content {
  return { ul: [...items], margin: [0, 0, 0, 4] };
}

/** File-name-safe slug, shortened at a word boundary to at most `max` characters. */
function slug(text: string, max = 60) {
  const s = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (s.length <= max) return s;
  const cut = s.slice(0, max + 1);
  return cut.slice(0, cut.lastIndexOf("-")) || s.slice(0, max);
}

export function buildDocDefinition(plan: LessonPlan): TDocumentDefinitions {
  const stem = plan.stem_integration;
  // Plans saved before lesson context existed have no `context` or stage minutes.
  const ctx = plan.context as LessonPlan["context"] | undefined;
  const hasMinutes = plan.sts_edp.stages.some((s) => s.minutes != null);
  const meta = ctx
    ? [ctx.grade_level, `${ctx.lesson_minutes} minutes`, ctx.classroom_context].filter(Boolean)
    : [];

  const cell = (label: string, text: string): Content => ({
    stack: [
      { text: label, bold: true, color: INK },
      { text, color: MUTED, fontSize: 10 },
    ],
    margin: [4, 4, 4, 4],
  });

  return {
    info: { title: `${plan.concept}: ${plan.problem.title}`, creator: "STEM Lesson Planner AI" },
    pageSize: "A4",
    pageMargins: [48, 56, 48, 56],
    defaultStyle: { font: "Roboto", fontSize: 11, color: INK, lineHeight: 1.25 },
    styles: {
      eyebrow: { fontSize: 9, color: MUTED, characterSpacing: 1 },
      h1: { fontSize: 20, bold: true, margin: [0, 2, 0, 4] },
      h2: { fontSize: 13, bold: true, margin: [0, 14, 0, 6] },
      muted: { color: MUTED },
    },
    footer: (page, pages) => ({
      columns: [
        { text: "STEM Lesson Planner AI", style: "muted", fontSize: 8 },
        { text: `Page ${page} of ${pages}`, style: "muted", fontSize: 8, alignment: "right" },
      ],
      margin: [48, 16, 48, 0],
    }),
    content: [
      { text: plan.concept.toUpperCase(), style: "eyebrow" },
      { text: plan.problem.title, style: "h1" },
      { text: plan.problem.description, style: "muted" },
      meta.length ? { text: meta.join("  ·  "), fontSize: 10, margin: [0, 6, 0, 0] } : "",
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 499, y2: 0, lineWidth: 1, lineColor: LINE }],
        margin: [0, 10, 0, 0],
      },

      section("Objectives", bullets(plan.objectives)),
      section("Materials", bullets(plan.materials)),
      section("STEM Integration", {
        table: {
          widths: ["*", "*"],
          body: [
            [cell("Science", stem.science), cell("Technology", stem.technology)],
            [cell("Engineering", stem.engineering), cell("Mathematics", stem.mathematics)],
          ],
        },
        layout: { hLineColor: () => LINE, vLineColor: () => LINE },
      }),
      textSection("Science–Technology–Society", plan.sts_edp.science_technology_society),
      section("Engineering Design Process", {
        table: {
          headerRows: 1,
          widths: hasMinutes ? [60, 40, "*"] : [60, "*"],
          body: [
            (hasMinutes ? ["Stage", "Min", "What students do"] : ["Stage", "What students do"]).map(
              (h) => ({ text: h, bold: true, fillColor: "#eef2f7" }),
            ),
            ...plan.sts_edp.stages.map((s) =>
              hasMinutes
                ? [{ text: s.stage, bold: true }, String(s.minutes ?? ""), s.description]
                : [{ text: s.stage, bold: true }, s.description],
            ),
          ],
        },
        layout: { hLineColor: () => LINE, vLineColor: () => LINE },
      }),
      section("Activities", bullets(plan.activities)),
      section("HOTS Questions", { ol: [...plan.hots_questions] }),
      section("Assessment", bullets(plan.assessment)),
      textSection("Problem-Solving Task", plan.problem_solving_task),
      textSection("Expected Solution", plan.expected_solution),
    ],
  };
}

export async function downloadLessonPlanPdf(plan: LessonPlan) {
  const pdfMake = await loadPdfMake();
  const name = slug(`${plan.concept} ${plan.problem.title}`) || "lesson-plan";
  await pdfMake.createPdf(buildDocDefinition(plan)).download(`${name}.pdf`);
}
