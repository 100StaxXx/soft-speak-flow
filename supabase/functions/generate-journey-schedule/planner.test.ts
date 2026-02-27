import {
  createFallbackScheduleParts,
  enforceExecutionModelSemantics,
  getExecutionModelInstructions,
  inferExecutionModel,
} from "./planner.ts";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.test("infers overlap_early for sales goals with reusable setup", () => {
  const decision = inferExecutionModel({
    goal: "Build a consulting sales pipeline and close 5 clients",
    timelineContext: "I already have a CRM, scripts, and an existing offer.",
  });

  assert(decision.executionModel === "overlap_early", "Expected overlap_early execution model");
  assert(decision.planningStyleReason === "parallelizable_goal", "Expected parallelizable reason");
});

Deno.test("infers overlap_early for recruiting goals", () => {
  const decision = inferExecutionModel({
    goal: "Hire 3 engineers for the startup",
  });

  assert(decision.executionModel === "overlap_early", "Expected overlap_early for recruiting");
});

Deno.test("infers overlap_early for networking and fundraising goals", () => {
  const decision = inferExecutionModel({
    goal: "Grow my investor network and start fundraising conversations",
  });

  assert(decision.executionModel === "overlap_early", "Expected overlap_early for networking/fundraising");
});

Deno.test("keeps exam preparation goals sequential", () => {
  const decision = inferExecutionModel({
    goal: "Prepare for the bar exam",
    epicContext: "exam_preparation",
  });

  assert(decision.executionModel === "sequential", "Expected sequential model for exam prep");
});

Deno.test("keeps portfolio project goals sequential by default", () => {
  const decision = inferExecutionModel({
    goal: "Build a design portfolio site for my job search",
  });

  assert(decision.executionModel === "sequential", "Expected sequential model for portfolio project");
});

Deno.test("builds overlap-aware prompt instructions", () => {
  const instructions = getExecutionModelInstructions("overlap_early").toLowerCase();

  assert(instructions.includes("start real execution in phase 1"), "Expected phase 1 execution guidance");
  assert(instructions.includes("not postpone outreach"), "Expected overlap guidance");
});

Deno.test("creates overlap-aware fallback phases and earlier milestones", () => {
  const now = new Date("2026-02-27T00:00:00.000Z");
  const fallback = createFallbackScheduleParts("overlap_early", now, "2026-04-28", 60);

  assert(fallback.phases[0].description.includes("right away"), "Expected early-action phase description");
  assert(fallback.milestones[0].milestonePercent <= 15, "Expected early first milestone");
  assert(fallback.milestones.some((milestone) => milestone.phaseName === "Build Momentum"), "Expected middle overlap phase");
});

Deno.test("creates sequential fallback phases for linear goals", () => {
  const now = new Date("2026-02-27T00:00:00.000Z");
  const fallback = createFallbackScheduleParts("sequential", now, "2026-04-28", 60);

  assert(fallback.phases[0].name === "Foundation", "Expected sequential foundation phase");
  assert(fallback.milestones[0].milestonePercent === 20, "Expected evenly spaced sequential milestone");
});

Deno.test("enforces overlap semantics by pulling first milestone earlier", () => {
  const now = new Date("2026-02-27T00:00:00.000Z");
  const result = enforceExecutionModelSemantics({
    executionModel: "overlap_early",
    now,
    daysAvailable: 60,
    phases: [
      {
        id: "phase-1",
        name: "Foundation and Setup",
        description: "Finish setup first, then begin outreach.",
        startDate: "2026-02-27",
        endDate: "2026-03-20",
        phaseOrder: 1,
      },
      {
        id: "phase-2",
        name: "Core Work",
        description: "Main work",
        startDate: "2026-03-21",
        endDate: "2026-04-10",
        phaseOrder: 2,
      },
    ],
    milestones: [
      {
        id: "m-1",
        title: "First milestone",
        description: "First progress",
        targetDate: "2026-03-30",
        phaseOrder: 2,
        phaseName: "Core Work",
        isPostcardMilestone: true,
        milestonePercent: 45,
      },
    ],
  });

  assert(result.phases[0].description.includes("Start real action in this phase"), "Expected phase 1 overlap copy");
  assert(result.milestones[0].milestonePercent <= 15, "Expected early first milestone percent");
  assert(result.milestones[0].phaseOrder === 1, "Expected first milestone mapped to phase 1");
});

Deno.test("does not mutate sequential plans when enforcing semantics", () => {
  const now = new Date("2026-02-27T00:00:00.000Z");
  const phases = [
    {
      id: "phase-1",
      name: "Foundation",
      description: "Build foundation",
      startDate: "2026-02-27",
      endDate: "2026-03-20",
      phaseOrder: 1,
    },
  ];
  const milestones = [
    {
      id: "m-1",
      title: "Checkpoint",
      description: "Progress",
      targetDate: "2026-03-25",
      phaseOrder: 1,
      phaseName: "Foundation",
      isPostcardMilestone: true,
      milestonePercent: 30,
    },
  ];

  const result = enforceExecutionModelSemantics({
    executionModel: "sequential",
    now,
    daysAvailable: 60,
    phases,
    milestones,
  });

  assert(result.phases[0].description === phases[0].description, "Expected sequential description unchanged");
  assert(result.milestones[0].milestonePercent === milestones[0].milestonePercent, "Expected sequential milestones unchanged");
});
