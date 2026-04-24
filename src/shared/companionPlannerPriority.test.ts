import { describe, expect, it } from "vitest";

import { computePlannerPriorityScores } from "./companionPlannerPriority";

describe("companionPlannerPriority epic pressure", () => {
  it("raises campaigns with no linked next step", () => {
    const scores = computePlannerPriorityScores({
      currentDate: "2026-04-18",
      tasks: [],
      inboxTasks: [],
      activeEpics: [
        {
          id: "epic-1",
          title: "Founder relaunch",
          endDate: "2026-04-24",
          progressPercentage: 20,
          daysRemaining: 6,
        },
      ],
      rituals: [],
      calendarEvents: [],
    });

    const epicScore = scores.find((entry) => entry.kind === "epic");

    expect(epicScore?.score).toBeGreaterThanOrEqual(36);
    expect(epicScore?.reasons).toContain("no concrete next step is attached yet");
  });

  it("raises campaigns with slipping linked work", () => {
    const scores = computePlannerPriorityScores({
      currentDate: "2026-04-18",
      tasks: [
        {
          id: "task-1",
          title: "Rewrite relaunch offer",
          taskDate: "2026-04-16",
          scheduledTime: null,
          estimatedDuration: 60,
          recurrencePattern: null,
          completed: false,
          epicId: "epic-1",
        },
        {
          id: "task-2",
          title: "Tighten CTA",
          taskDate: "2026-04-17",
          scheduledTime: null,
          estimatedDuration: 45,
          recurrencePattern: null,
          completed: false,
          epicId: "epic-1",
        },
      ],
      inboxTasks: [],
      activeEpics: [
        {
          id: "epic-1",
          title: "Founder relaunch",
          endDate: "2026-04-21",
          progressPercentage: 28,
          daysRemaining: 3,
        },
      ],
      rituals: [],
      calendarEvents: [],
    });

    const epicScore = scores.find((entry) => entry.kind === "epic");

    expect(epicScore?.score).toBeGreaterThanOrEqual(55);
    expect(epicScore?.reasons).toContain("linked work is already slipping");
  });

  it("raises campaigns whose next linked work is still too large to start cleanly", () => {
    const scores = computePlannerPriorityScores({
      currentDate: "2026-04-18",
      tasks: [
        {
          id: "task-1",
          title: "Build full course sales page",
          taskDate: null,
          scheduledTime: null,
          estimatedDuration: 150,
          subtaskTitles: [],
          recurrencePattern: null,
          completed: false,
          epicId: "epic-1",
        },
      ],
      inboxTasks: [],
      activeEpics: [
        {
          id: "epic-1",
          title: "Course launch",
          endDate: "2026-05-12",
          progressPercentage: 34,
          daysRemaining: 24,
        },
        {
          id: "epic-2",
          title: "Marketing cleanup",
          endDate: "2026-05-30",
          progressPercentage: 42,
          daysRemaining: 42,
        },
        {
          id: "epic-3",
          title: "Ops cleanup",
          endDate: "2026-06-10",
          progressPercentage: 50,
          daysRemaining: 53,
        },
        {
          id: "epic-4",
          title: "Personal brand",
          endDate: "2026-06-20",
          progressPercentage: 25,
          daysRemaining: 63,
        },
      ],
      rituals: [],
      calendarEvents: [],
    });

    const epicScore = scores.find((entry) =>
      entry.kind === "epic" && entry.epicId === "epic-1"
    );

    expect(epicScore?.reasons).toContain(
      "linked work is still too large to start cleanly",
    );
    expect(epicScore?.reasons).toContain("competes with several active campaigns");
  });
});
