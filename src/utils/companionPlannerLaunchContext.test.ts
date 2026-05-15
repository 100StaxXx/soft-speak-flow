import { describe, expect, it } from "vitest";

import {
  buildCompanionPlannerQuote,
  createPlanDayBriefingContext,
  getPlannerQuoteTimeBucket,
  NEUTRAL_PLANNER_MICRO_LINES,
  PLANNER_INSIGHT_STATEMENTS,
  PLANNER_QUOTE_TIME_BUCKETS,
  PLANNER_TIME_BUCKET_QUOTES,
  type CompanionPlannerLaunchTask,
} from "./companionPlannerLaunchContext";

const selectedDate = new Date("2026-04-18T12:00:00");
const currentTime = new Date("2026-04-18T09:00:00");
const INSIGHT_CATEGORIES = [
  "finish_scheduled",
  "needs_schedule",
  "campaign_opening",
  "reschedule_overload",
  "light_structured",
  "empty_day",
  "steady_progress",
] as const;
type PlannerInsightCategory = (typeof INSIGHT_CATEGORIES)[number];

const task = (
  id: string,
  overrides: Partial<CompanionPlannerLaunchTask> = {},
): CompanionPlannerLaunchTask => ({
  id,
  task_text: `Quest ${id}`,
  task_date: "2026-04-18",
  completed: false,
  scheduled_time: null,
  estimated_duration: 30,
  ...overrides,
});

const snapshotFor = (
  tasks: CompanionPlannerLaunchTask[],
  activeEpics: Parameters<typeof createPlanDayBriefingContext>[0]["activeEpics"] = [],
) =>
  createPlanDayBriefingContext({
    selectedDate,
    currentTime,
    tasks,
    activeEpics,
  }).dataSnapshot as Record<string, unknown>;

const dateKeyForInsightVariant = (index: number) =>
  new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10);

const taskForDate = (
  dateKey: string,
  id: string,
  overrides: Partial<CompanionPlannerLaunchTask> = {},
): CompanionPlannerLaunchTask => ({
  id,
  task_text: `Quest ${id}`,
  task_date: dateKey,
  completed: false,
  scheduled_time: null,
  estimated_duration: 30,
  ...overrides,
});

const scenarioForInsightCategory = (
  category: PlannerInsightCategory,
  dateKey: string,
): {
  tasks: CompanionPlannerLaunchTask[];
  activeEpics?: Parameters<typeof createPlanDayBriefingContext>[0]["activeEpics"];
} => {
  const makeTask = (
    id: string,
    overrides: Partial<CompanionPlannerLaunchTask> = {},
  ) => taskForDate(dateKey, id, overrides);

  switch (category) {
    case "finish_scheduled":
      return {
        tasks: [
          makeTask("a", { scheduled_time: "09:00" }),
          makeTask("b", { scheduled_time: "10:00" }),
        ],
      };
    case "needs_schedule":
      return {
        tasks: [
          makeTask("a"),
          makeTask("b"),
          makeTask("c"),
        ],
      };
    case "campaign_opening":
      return {
        tasks: [makeTask("a")],
        activeEpics: [{ id: "epic-1", title: "Launch Planner" }],
      };
    case "reschedule_overload":
      return {
        tasks: Array.from({ length: 8 }, (_, index) =>
          makeTask(`heavy-${index}`, { estimated_duration: 60 }),
        ),
      };
    case "light_structured":
      return {
        tasks: [
          makeTask("a", { scheduled_time: "09:00" }),
          makeTask("b", { scheduled_time: "10:00" }),
          makeTask("done-1", { completed: true }),
          makeTask("done-2", { completed: true }),
        ],
      };
    case "empty_day":
      return { tasks: [] };
    case "steady_progress":
      return {
        tasks: [
          makeTask("a", { scheduled_time: "09:00" }),
          makeTask("b", { scheduled_time: "10:00" }),
          makeTask("c"),
          makeTask("d"),
          makeTask("done-1", { completed: true }),
          makeTask("done-2", { completed: true }),
          makeTask("done-3", { completed: true }),
        ],
      };
  }
};

const INSIGHT_RELEVANCE_PATTERNS: Record<PlannerInsightCategory, RegExp> = {
  finish_scheduled: /\b(time|timed|schedule|scheduled|calendar|appointment|rails|optional)\b/i,
  needs_schedule:
    /\b(anchor|time|timed|calendar|schedule|scheduling|scheduled|slot|block|protected|appointment)\b/i,
  campaign_opening: /\bcampaign\b/i,
  reschedule_overload:
    /\b(overload|overloaded|reschedule|triage|fixed|move|shrink|reroute|heavy|smaller|pruning|red flag|later|extras|essentials?)\b/i,
  light_structured: /\b(light|timed|schedule|scheduled|structure|plan|calendar)\b/i,
  empty_day: /\b(blank|empty|open|quiet|calendar|schedule|scheduled|anchor|nothing)\b/i,
  steady_progress: /\b(steady|order|timed|quest|plan|queue|manageable|progress)\b/i,
};

const UNSUPPORTED_USER_ASSUMPTION_PATTERN =
  /\b(usually|normally|tend(?:s)? to|lately|you['’]ve (?:been|handled|survived)|future-you|completion rate|your mornings)\b/i;
const BORDERLINE_PLANNER_COPY_PATTERN =
  /\b(adult supervision|audition|side quest|abstract art|committee|slippery|matching socks|flex in the mirror|mischief|morally|heroics?|red flag|caffeine|feral|cursed|quiet architecture|philosophy seminar|puzzle box|willpower|prove anything|steal the whole day|wear too many hats|cooler head|remix|debate|defeat|good intentions|raccoon|goblin)\b/i;

const activePlannerQuoteLines = () => [
  ...Object.values(PLANNER_INSIGHT_STATEMENTS).flat(),
  ...Object.values(PLANNER_TIME_BUCKET_QUOTES).flat(),
  ...NEUTRAL_PLANNER_MICRO_LINES,
];

describe("createPlanDayBriefingContext", () => {
  it("keeps the approved quote time buckets explicit", () => {
    expect(PLANNER_QUOTE_TIME_BUCKETS).toEqual([
      "late_night",
      "early_morning",
      "morning",
      "noon",
      "evening",
      "night",
    ]);
  });

  it.each([
    ["late_night", "2026-05-15T00:00:00"],
    ["late_night", "2026-05-15T03:59:00"],
    ["early_morning", "2026-05-15T04:00:00"],
    ["early_morning", "2026-05-15T07:59:00"],
    ["morning", "2026-05-15T08:00:00"],
    ["morning", "2026-05-15T11:59:00"],
    ["noon", "2026-05-15T12:00:00"],
    ["noon", "2026-05-15T15:59:00"],
    ["evening", "2026-05-15T16:00:00"],
    ["evening", "2026-05-15T20:59:00"],
    ["night", "2026-05-15T21:00:00"],
    ["night", "2026-05-15T23:59:00"],
  ])("maps %s boundaries from %s", (bucket, dateTime) => {
    expect(getPlannerQuoteTimeBucket(new Date(dateTime))).toBe(bucket);
  });

  it("combines only base, time, and micro quote parts", () => {
    expect(
      buildCompanionPlannerQuote({
        baseQuote: "Base.",
        timeQuote: "Time.",
        microLine: "Micro.",
      }),
    ).toBe("Base. Time. Micro.");
    expect(
      buildCompanionPlannerQuote({
        baseQuote: " Base. ",
        timeQuote: null,
        microLine: " ",
      }),
    ).toBe("Base.");
  });

  it("keeps active planner quote pools free of unsupported user assumptions", () => {
    for (const line of activePlannerQuoteLines()) {
      expect(line).not.toMatch(UNSUPPORTED_USER_ASSUMPTION_PATTERN);
    }
  });

  it("keeps active planner quote pools aligned with the calmer planner tone", () => {
    for (const line of activePlannerQuoteLines()) {
      expect(line).not.toMatch(BORDERLINE_PLANNER_COPY_PATTERN);
    }
  });

  it.each(INSIGHT_CATEGORIES)(
    "selects at least ten distinct relevant statements for %s",
    (category) => {
      const selectedStatements = new Set<string>();

      for (let index = 0; index < 240; index += 1) {
        const dateKey = dateKeyForInsightVariant(index);
        const scenario = scenarioForInsightCategory(category, dateKey);
        const briefing = createPlanDayBriefingContext({
          selectedDate: new Date(`${dateKey}T12:00:00`),
          currentTime: new Date(`${dateKey}T09:00:00`),
          tasks: scenario.tasks,
          activeEpics: scenario.activeEpics,
        });
        const snapshot = briefing.dataSnapshot as Record<string, unknown>;
        const statement = snapshot.plannerInsightStatement;

        expect(snapshot.plannerInsightCategory).toBe(category);
        expect(statement).toEqual(expect.any(String));

        const trimmed = String(statement).trim();
        expect(trimmed, category).toBe(statement);
        expect(trimmed.length, category).toBeGreaterThan(20);
        expect(trimmed, category).toMatch(INSIGHT_RELEVANCE_PATTERNS[category]);
        selectedStatements.add(trimmed);
      }

      expect(selectedStatements.size, category).toBeGreaterThanOrEqual(10);
    },
  );

  it("writes a natural day summary instead of a raw planning snapshot", () => {
    const briefing = createPlanDayBriefingContext({
      selectedDate,
      currentTime,
      tasks: [
        task("timed", { scheduled_time: "09:00", estimated_duration: 45 }),
        task("anytime", { estimated_duration: 30 }),
        task("done", { completed: true, scheduled_time: "08:00" }),
      ],
      activeEpics: [{ id: "epic-1", title: "Launch Planner" }],
    });

    expect(briefing.content).toContain("Saturday, April 18 looks");
    expect(briefing.content).toContain("2 open quests");
    expect(briefing.content).toContain("1 timed and 1 anytime");
    expect(briefing.content).toContain("You're 1 of 3 complete");
    expect(briefing.content).not.toContain("Planning snapshot");
  });

  it.each([
    [
      "finish_scheduled",
      [
        task("a", { scheduled_time: "09:00" }),
        task("b", { scheduled_time: "10:00" }),
      ],
      [],
    ],
    [
      "needs_schedule",
      [
        task("a"),
        task("b"),
        task("c"),
      ],
      [],
    ],
    [
      "campaign_opening",
      [task("a")],
      [{ id: "epic-1", title: "Launch Planner" }],
    ],
    [
      "reschedule_overload",
      Array.from({ length: 8 }, (_, index) =>
        task(`heavy-${index}`, { estimated_duration: 60 }),
      ),
      [],
    ],
    [
      "light_structured",
      [
        task("a", { scheduled_time: "09:00" }),
        task("b", { scheduled_time: "10:00" }),
        task("done-1", { completed: true }),
        task("done-2", { completed: true }),
      ],
      [],
    ],
    [
      "empty_day",
      [],
      [],
    ],
    [
      "steady_progress",
      [
        task("a", { scheduled_time: "09:00" }),
        task("b", { scheduled_time: "10:00" }),
        task("c"),
        task("d"),
        task("done-1", { completed: true }),
        task("done-2", { completed: true }),
        task("done-3", { completed: true }),
      ],
      [],
    ],
  ])("classifies %s insight snapshots", (category, tasks, activeEpics) => {
    const snapshot = snapshotFor(tasks, activeEpics);

    expect(snapshot.plannerInsightCategory).toBe(category);
    expect(snapshot.plannerInsightStatement).toEqual(expect.any(String));
    expect(String(snapshot.plannerInsightStatement).length).toBeGreaterThan(20);
    expect(snapshot.plannerInsightStatement).toMatch(
      INSIGHT_RELEVANCE_PATTERNS[category as PlannerInsightCategory],
    );
  });

  it("uses empty-day copy when nothing is scheduled", () => {
    const briefing = createPlanDayBriefingContext({
      selectedDate,
      currentTime,
      tasks: [],
      activeEpics: [],
    });
    const snapshot = briefing.dataSnapshot as Record<string, unknown>;

    expect(briefing.content).toContain("no open quests");
    expect(snapshot.plannerInsightCategory).toBe("empty_day");
    expect(snapshot.plannerInsightStatement).toMatch(/day|scheduled|quest/i);
    expect(snapshot.plannerInsightStatement).not.toMatch(/next important quest/i);
  });

  it("uses night-safe campaign copy when planning today at night", () => {
    const briefing = createPlanDayBriefingContext({
      selectedDate: new Date("2026-05-14T12:00:00"),
      currentTime: new Date("2026-05-14T23:27:00"),
      tasks: [
        {
          id: "campaign-task",
          task_text: "Draft launch notes",
          task_date: "2026-05-14",
          completed: false,
          scheduled_time: null,
          estimated_duration: 30,
          epic_id: "epic-1",
          epic_title: "Launch Planner",
        },
      ],
      activeEpics: [{ id: "epic-1", title: "Launch Planner" }],
    });
    const snapshot = briefing.dataSnapshot as Record<string, unknown>;

    expect(snapshot.plannerInsightCategory).toBe("campaign_opening");
    expect(snapshot.plannerTimeBucket).toBe("night");
    expect(snapshot.plannerInsightStatement).toEqual(expect.any(String));
    expect(String(snapshot.plannerInsightStatement)).not.toMatch(
      /\b(daylight|runway|before the space disappears|before it evaporates|elbow room)\b/i,
    );
    expect(String(snapshot.plannerInsightStatement)).toMatch(
      /\b(tonight|tomorrow|small|block|campaign|loop|clear|done)\b/i,
    );
  });

  it("does not apply today's time bucket to future selected dates", () => {
    const briefing = createPlanDayBriefingContext({
      selectedDate: new Date("2026-05-15T12:00:00"),
      currentTime: new Date("2026-05-14T23:27:00"),
      tasks: [
        {
          id: "campaign-task",
          task_text: "Draft launch notes",
          task_date: "2026-05-15",
          completed: false,
          scheduled_time: null,
          estimated_duration: 30,
          epic_id: "epic-1",
          epic_title: "Launch Planner",
        },
      ],
      activeEpics: [{ id: "epic-1", title: "Launch Planner" }],
    });
    const snapshot = briefing.dataSnapshot as Record<string, unknown>;

    expect(snapshot.plannerTimeBucket).toBeNull();
    expect(snapshot.isSelectedDateToday).toBe(false);
  });
});
