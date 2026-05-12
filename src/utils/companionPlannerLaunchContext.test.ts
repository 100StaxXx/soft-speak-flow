import { describe, expect, it } from "vitest";

import {
  createPlanDayBriefingContext,
  type CompanionPlannerLaunchTask,
} from "./companionPlannerLaunchContext";

const selectedDate = new Date("2026-04-18T12:00:00");
const currentTime = new Date("2026-04-18T09:00:00");

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

describe("createPlanDayBriefingContext", () => {
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
  });
});
