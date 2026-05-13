import { describe, expect, it } from "vitest";

import {
  createPlanDayBriefingContext,
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

describe("createPlanDayBriefingContext", () => {
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
});
