export type ExecutionModel = "sequential" | "overlap_early";

export interface JourneyPhase {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  phaseOrder: number;
}

export interface JourneyMilestone {
  id: string;
  title: string;
  description: string;
  targetDate: string;
  phaseOrder: number;
  phaseName: string;
  isPostcardMilestone: boolean;
  milestonePercent: number;
}

export interface JourneyRitual {
  id: string;
  title: string;
  description: string;
  frequency: "daily" | "5x_week" | "3x_week" | "custom";
  customDays?: number[];
  difficulty: "easy" | "medium" | "hard";
  estimatedMinutes?: number;
}

interface PlanningSignals {
  goal: string;
  epicContext?: string;
  timelineContext?: string;
  clarificationAnswers?: Record<string, string | number | undefined>;
}

export interface PlanningShapeDecision {
  executionModel: ExecutionModel;
  planningStyleReason: string;
}

interface EnforceSemanticsParams {
  executionModel: ExecutionModel;
  phases: JourneyPhase[];
  milestones: JourneyMilestone[];
  now: Date;
  daysAvailable: number;
}

const PARALLEL_KEYWORDS = [
  "sales",
  "sell",
  "clients",
  "client",
  "prospecting",
  "outreach",
  "follow-up",
  "follow up",
  "pipeline",
  "close deals",
  "close clients",
  "book meetings",
  "lead generation",
  "leads",
  "business development",
  "networking",
  "partnership",
  "partnerships",
  "fundraising",
  "donors",
  "recruiting",
  "recruitment",
  "hire",
  "hiring",
  "candidates",
  "account growth",
  "account expansion",
  "customer acquisition",
];

const EXISTING_SETUP_KEYWORDS = [
  "already have",
  "already built",
  "existing",
  "current pipeline",
  "crm",
  "script",
  "scripts",
  "template",
  "templates",
  "playbook",
  "offer",
  "lead list",
  "lead database",
  "client list",
  "book of business",
  "reusable",
  "repeatable",
];

const SEQUENTIAL_EPIC_CONTEXTS = new Set([
  "exam_preparation",
  "fitness_goal",
  "learning",
  "sports_goal",
  "music_goal",
  "audition_goal",
  "art_goal",
]);

function collectSignalText(signals: PlanningSignals): string {
  const clarificationText = Object.values(signals.clarificationAnswers || {})
    .filter((value): value is string | number => value !== undefined && value !== null && value !== "")
    .join(" ");

  return [
    signals.goal,
    signals.epicContext,
    signals.timelineContext,
    clarificationText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

export function inferExecutionModel(signals: PlanningSignals): PlanningShapeDecision {
  const signalText = collectSignalText(signals);

  if (signals.epicContext && SEQUENTIAL_EPIC_CONTEXTS.has(signals.epicContext)) {
    return {
      executionModel: "sequential",
      planningStyleReason: "deadline_driven_linear_goal",
    };
  }

  const parallelGoal = includesAny(signalText, PARALLEL_KEYWORDS);
  const existingSetup = includesAny(signalText, EXISTING_SETUP_KEYWORDS);

  if (parallelGoal || existingSetup) {
    return {
      executionModel: "overlap_early",
      planningStyleReason: "parallelizable_goal",
    };
  }

  return {
    executionModel: "sequential",
    planningStyleReason: "deadline_driven_linear_goal",
  };
}

export function getExecutionModelInstructions(executionModel: ExecutionModel): string {
  if (executionModel === "overlap_early") {
    return `PLANNING SHAPE: This goal should use overlap_early planning.

- Keep the phase-based timeline, but treat phases as emphasis periods instead of strict gates.
- Start real execution in phase 1 as soon as the minimum setup exists.
- Do not postpone outreach, follow-ups, relationship work, interviews, donor contact, or conversion work if they can begin earlier.
- Phase 2 should build volume, learning, and iteration while earlier work continues.
- Phase 3 can emphasize conversion, closing, optimization, or review while keeping the main rhythm active.
- Avoid plans where meaningful action waits until late in the timeline.
- Use plain English in every phase name and description.`;
  }

  return `PLANNING SHAPE: This goal should use sequential planning.

- Distinct phases are acceptable when the work has clearer dependencies.
- Early phases can focus more on setup and foundation before heavier execution.
- Keep the plan realistic and deadline-driven.
- Use plain English in every phase name and description.`;
}

function phaseBoundaries(daysAvailable: number): [number, number] {
  const first = Math.max(1, Math.floor(daysAvailable * 0.3));
  const second = Math.max(first + 1, Math.floor(daysAvailable * 0.7));
  return [first, second];
}

function milestoneDateFromPercent(now: Date, daysAvailable: number, percent: number): string {
  const dayOffset = Math.max(1, Math.floor((daysAvailable * percent) / 100));
  const targetDate = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
  return targetDate.toISOString().split("T")[0];
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function ensureSentence(value: string): string {
  const text = normalizeWhitespace(value);
  if (!text) return "";
  if (/[.!?]$/.test(text)) return text;
  return `${text}.`;
}

const EARLY_ACTION_TERMS = [
  "start",
  "begin",
  "launch",
  "real action",
  "first action",
  "outreach",
  "follow-up",
  "follow up",
  "contact",
  "call",
  "conversation",
  "application",
  "meeting",
  "recruit",
  "prospect",
];

const WATERFALL_DELAY_TERMS = [
  "after setup",
  "once setup is complete",
  "finish setup first",
  "then begin",
  "later stage",
  "final phase",
  "before starting",
];

function includesAnyTerm(value: string, terms: string[]): boolean {
  const lower = value.toLowerCase();
  return terms.some((term) => lower.includes(term));
}

function chapterCountForDays(daysAvailable: number): number {
  if (daysAvailable <= 14) return 3;
  if (daysAvailable <= 30) return 4;
  if (daysAvailable <= 60) return 5;
  return 6;
}

export function createFallbackScheduleParts(
  executionModel: ExecutionModel,
  now: Date,
  deadline: string,
  daysAvailable: number,
): {
  phases: JourneyPhase[];
  milestones: JourneyMilestone[];
  rituals: JourneyRitual[];
  suggestedChapterCount: number;
} {
  const today = now.toISOString().split("T")[0];
  const [firstBoundary, secondBoundary] = phaseBoundaries(daysAvailable);
  const phase1End = new Date(now.getTime() + firstBoundary * 24 * 60 * 60 * 1000);
  const phase2End = new Date(now.getTime() + secondBoundary * 24 * 60 * 60 * 1000);
  const chapterCount = chapterCountForDays(daysAvailable);

  const phases = executionModel === "overlap_early"
    ? [
      {
        id: `phase-${Date.now()}-1`,
        name: "Launch and First Steps",
        description: "Set up the basics and start taking real action right away.",
        startDate: today,
        endDate: phase1End.toISOString().split("T")[0],
        phaseOrder: 1,
      },
      {
        id: `phase-${Date.now()}-2`,
        name: "Build Momentum",
        description: "Keep the work moving each week while follow-ups and next steps build.",
        startDate: phase1End.toISOString().split("T")[0],
        endDate: phase2End.toISOString().split("T")[0],
        phaseOrder: 2,
      },
      {
        id: `phase-${Date.now()}-3`,
        name: "Results and Review",
        description: "Focus on results and review while keeping your main rhythm alive.",
        startDate: phase2End.toISOString().split("T")[0],
        endDate: deadline,
        phaseOrder: 3,
      },
    ]
    : [
      {
        id: `phase-${Date.now()}-1`,
        name: "Foundation",
        description: "Build the groundwork and get clear on your next steps.",
        startDate: today,
        endDate: phase1End.toISOString().split("T")[0],
        phaseOrder: 1,
      },
      {
        id: `phase-${Date.now()}-2`,
        name: "Core Work",
        description: "Spend most of your time on the main work that moves the goal forward.",
        startDate: phase1End.toISOString().split("T")[0],
        endDate: phase2End.toISOString().split("T")[0],
        phaseOrder: 2,
      },
      {
        id: `phase-${Date.now()}-3`,
        name: "Final Push",
        description: "Tighten the plan, finish strong, and get across the line.",
        startDate: phase2End.toISOString().split("T")[0],
        endDate: deadline,
        phaseOrder: 3,
      },
    ];

  const milestonePercents = executionModel === "overlap_early"
    ? {
      3: [20, 60, 100],
      4: [15, 40, 70, 100],
      5: [15, 35, 55, 75, 100],
      6: [12, 28, 45, 62, 80, 100],
    }
    : {
      3: [33, 66, 100],
      4: [25, 50, 75, 100],
      5: [20, 40, 60, 80, 100],
      6: [17, 33, 50, 67, 83, 100],
    };

  const percents = milestonePercents[chapterCount as keyof typeof milestonePercents];

  const milestones = percents.map((percent, index) => {
    const phaseOrder = executionModel === "overlap_early"
      ? percent <= 30 ? 1 : percent <= 75 ? 2 : 3
      : percent <= 33 ? 1 : percent <= 66 ? 2 : 3;
    const phaseName = phases[phaseOrder - 1].name;

    const title = index === percents.length - 1
      ? "Goal achieved!"
      : executionModel === "overlap_early"
      ? [
        "First real progress",
        "Steady weekly momentum",
        "Strong follow-through",
        "Results taking shape",
        "Finish line in sight",
      ][index] || `Checkpoint ${index + 1}`
      : `Checkpoint ${index + 1}`;

    const description = index === percents.length - 1
      ? "Complete your goal."
      : executionModel === "overlap_early"
      ? "Keep the work active and moving forward."
      : "Reach the next clear stage of progress.";

    return {
      id: `milestone-${Date.now()}-${index}`,
      title,
      description,
      targetDate: milestoneDateFromPercent(now, daysAvailable, percent),
      phaseOrder,
      phaseName,
      isPostcardMilestone: true,
      milestonePercent: percent,
    };
  });

  const rituals = executionModel === "overlap_early"
    ? [
      {
        id: `ritual-${Date.now()}-1`,
        title: "Daily action block",
        description: "Take one real action each day instead of waiting until everything is set up.",
        frequency: "daily" as const,
        difficulty: "medium" as const,
        estimatedMinutes: 30,
      },
      {
        id: `ritual-${Date.now()}-2`,
        title: "Follow-up review",
        description: "Review replies, next steps, and open loops each week.",
        frequency: "custom" as const,
        customDays: [0],
        difficulty: "easy" as const,
        estimatedMinutes: 20,
      },
    ]
    : [
      {
        id: `ritual-${Date.now()}-1`,
        title: "Daily progress action",
        description: "Take one concrete step toward your goal.",
        frequency: "daily" as const,
        difficulty: "medium" as const,
        estimatedMinutes: 30,
      },
      {
        id: `ritual-${Date.now()}-2`,
        title: "Weekly review",
        description: "Review your progress and plan the next week.",
        frequency: "custom" as const,
        customDays: [0],
        difficulty: "easy" as const,
        estimatedMinutes: 20,
      },
    ];

  return {
    phases,
    milestones,
    rituals,
    suggestedChapterCount: chapterCount,
  };
}

export function enforceExecutionModelSemantics({
  executionModel,
  phases,
  milestones,
  now,
  daysAvailable,
}: EnforceSemanticsParams): {
  phases: JourneyPhase[];
  milestones: JourneyMilestone[];
} {
  if (executionModel !== "overlap_early" || phases.length === 0 || milestones.length === 0) {
    return { phases, milestones };
  }

  const sortedPhases = [...phases].sort((a, b) => a.phaseOrder - b.phaseOrder);
  const firstPhase = sortedPhases[0];

  const nextPhases = phases.map((phase) => {
    if (phase.id === firstPhase.id) {
      const combined = `${phase.name} ${phase.description}`;
      const hasEarlyAction = includesAnyTerm(combined, EARLY_ACTION_TERMS);
      const hasDelayLanguage = includesAnyTerm(combined, WATERFALL_DELAY_TERMS);

      if (hasEarlyAction && !hasDelayLanguage) {
        return phase;
      }

      const safeDescription = ensureSentence(phase.description || "");
      const overlapSentence = "Start real action in this phase while setup is still underway.";
      const description = safeDescription.includes(overlapSentence)
        ? safeDescription
        : normalizeWhitespace(`${safeDescription} ${overlapSentence}`);

      return {
        ...phase,
        description,
      };
    }

    return phase;
  });

  const postcardMilestones = milestones
    .filter((milestone) => milestone.isPostcardMilestone)
    .sort((a, b) => a.milestonePercent - b.milestonePercent);

  if (postcardMilestones.length === 0) {
    return {
      phases: nextPhases,
      milestones,
    };
  }

  const firstPostcard = postcardMilestones[0];
  const earlyPercentTarget = daysAvailable <= 21 ? 20 : 15;

  const nextMilestones = milestones.map((milestone) => {
    if (milestone.id !== firstPostcard.id) {
      return milestone;
    }

    const needsEarlierMilestone = milestone.milestonePercent > earlyPercentTarget;
    const targetPercent = needsEarlierMilestone ? earlyPercentTarget : milestone.milestonePercent;

    return {
      ...milestone,
      milestonePercent: targetPercent,
      targetDate: milestoneDateFromPercent(now, daysAvailable, targetPercent),
      phaseOrder: firstPhase.phaseOrder,
      phaseName: firstPhase.name,
    };
  });

  return {
    phases: nextPhases,
    milestones: nextMilestones,
  };
}
