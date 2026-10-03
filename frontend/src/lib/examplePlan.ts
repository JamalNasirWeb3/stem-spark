// A hand-written, finished lesson plan shown by "See a finished example".
// Bundled with the app (no backend call) so it works offline. It follows the
// reference example in idea.md; stage minutes match backend allocate_minutes(80).

import type { LessonPlan } from "./api";

export const EXAMPLE_PLAN: LessonPlan = {
  concept: "Conductors & Insulators",
  problem: {
    id: "example",
    title: "Making electrical devices safe to touch",
    description:
      "How can we choose the right materials to make an electrical device safe and prevent electric shocks?",
  },
  context: {
    grade_level: "Grade 6",
    lesson_minutes: 80,
    classroom_context: "35 students, no lab, low-cost local materials only, groups of 5",
  },
  objectives: [
    "Classify common materials as electrical conductors or insulators using a simple circuit tester.",
    "Explain why insulators are used on wires, plugs and switches to protect people from electric shock.",
    "Design, build and test an insulated cover for an exposed electrical connection.",
    "Record test results in a table and use them to justify a design choice.",
  ],
  materials: [
    "Per group: 1 battery (1.5 V AA) with holder, 1 small bulb or LED, 3 crocodile-clip wires",
    "Test samples: aluminium foil, paper clip, coin, pencil graphite, plastic spoon, rubber band, cardboard, wood stick, cloth, glass marble",
    "Build materials: tape, rubber from old bicycle tubes, plastic bottle pieces, cardboard, string",
    "Printed results table and design sheet (one per group)",
  ],
  stem_integration: {
    science:
      "Conductors let electric current flow because their electrons move easily; insulators resist that flow. The human body conducts, which is why exposed wires are dangerous.",
    technology:
      "Students build a simple circuit tester and use it as a tool to check materials, the same way electricians use testers before touching wires.",
    engineering:
      "Groups design an insulated cover for a bare wire joint that must block current, stay in place, and be cheap to make.",
    mathematics:
      "Students record results in a table, count how many materials conduct, and compare designs on a 1–5 scoring scale for safety, cost and durability.",
  },
  sts_edp: {
    science_technology_society:
      "Many electrical accidents at home come from damaged cables and makeshift repairs. Students connect the science of insulators to real safety standards for plugs and wiring, and to how local electricians make safe low-cost repairs.",
    stages: [
      {
        stage: "Ask",
        minutes: 8,
        description:
          "Show a photo of a frayed charger cable. Ask: why is this dangerous, and what stops a normal cable from shocking us?",
      },
      {
        stage: "Imagine",
        minutes: 8,
        description:
          "Groups brainstorm everyday materials that might block electricity and predict which samples will conduct.",
      },
      {
        stage: "Plan",
        minutes: 8,
        description:
          "Each group builds the circuit tester, then sketches an insulated cover for a bare wire joint and lists the materials it will use.",
      },
      {
        stage: "Create",
        minutes: 27,
        description:
          "Test all 10 samples with the circuit tester and record results. Then build the insulated cover from the materials that tested as insulators.",
      },
      {
        stage: "Test",
        minutes: 13,
        description:
          "Wrap the cover around the joint and touch the tester probes to its outside. The bulb must stay off. Score the design for safety, cost and durability.",
      },
      {
        stage: "Improve",
        minutes: 8,
        description:
          "Groups fix any gaps or weak points found in testing and retest once.",
      },
      {
        stage: "Share",
        minutes: 8,
        description:
          "Each group gives a 1-minute pitch: what they built, their test evidence, and one way it keeps people safe.",
      },
    ],
  },
  activities: [
    "Warm-up (Ask): frayed-cable photo discussion and think-pair-share on electrical safety.",
    "Prediction table (Imagine): students predict conductor or insulator for each sample before testing.",
    "Tester build and material testing (Plan, Create): groups build a battery-bulb tester and test 10 samples.",
    "Design challenge (Create, Test, Improve): build, test and improve an insulated cover for a bare wire joint.",
    "Gallery pitch (Share): groups present designs; the class votes on the safest low-cost solution.",
  ],
  hots_questions: [
    "Why is graphite in a pencil a conductor when wood is not? What does this tell you about where a material comes from?",
    "If your cover passes the test when dry, would it still be safe when wet? How could you test that safely?",
    "An electrician has only tape and plastic bottle pieces. Which would you recommend for a permanent repair, and why?",
    "Design a rule a younger student could follow to tell whether something is safe to touch near electricity.",
  ],
  assessment: [
    "Results table: all 10 samples tested and correctly classified (formative).",
    "Design sheet: sketch, material choices and reasons linked to test evidence (rubric, 4 levels).",
    "Product test: the cover blocks current in the bulb test (pass/fail plus improvement notes).",
    "Exit ticket: one conductor, one insulator, and one sentence on why insulators prevent shocks.",
  ],
  problem_solving_task:
    "Your school's science room has an exposed wire joint on an old lamp. Using only low-cost materials, design and build a cover that makes the joint safe to touch. Prove it works with your circuit tester.",
  expected_solution:
    "A cover made from tested insulators such as rubber strips or plastic with no gaps, firmly wrapped and secured with tape. The tester bulb stays off when the probes touch the outside, and the group can explain that the insulator stops current from reaching a person's hand.",
};
