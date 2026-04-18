import { describe, expect, it } from "vitest";
import { buildCompanionPlannerScheduleInsights } from "@/utils/companionPlannerSchedule";
import type { PlannerContextTask } from "@/types/companionPlanner";

const buildTask = (overrides: Partial<PlannerContextTask> = {}): PlannerContextTask => ({
  id: crypto.randomUUID(),
  title: "Task",
  taskDate: "2026-04-18",
  scheduledTime: null,
  estimatedDuration: 30,
  recurrencePattern: null,
  recurrenceEndDate: null,
  completed: false,
  priority: "medium",
  source: "manual",
  epicId: null,
  epicTitle: null,
  ...overrides,
});

describe("buildCompanionPlannerScheduleInsights", () => {
  it("detects conflicts and ranks open slots against planner memory", () => {
    const insights = buildCompanionPlannerScheduleInsights({
      horizon: "day",
      selectedDate: "2026-04-18",
      plannerMemory: {
        preferredTimeOfDay: "morning",
        preferredTimeReason: "I am sharper before messages start flying.",
        preferredWindows: [
          {
            timeOfDay: "morning",
            time: "09:00",
            reason: "Deep work lands better before noon.",
            sourceCount: 3,
          },
        ],
        wakeTime: "08:00",
        windDownTime: "21:00",
        peakProductivityTimes: ["09:00", "10:00"],
      },
      tasks: [
        buildTask({ id: "task-a", title: "Inbox zero", scheduledTime: "09:00", estimatedDuration: 60 }),
        buildTask({ id: "task-b", title: "Standup prep", scheduledTime: "09:30", estimatedDuration: 30 }),
        buildTask({ id: "task-c", title: "Workout", scheduledTime: "12:00", estimatedDuration: 45 }),
      ],
    });

    expect(insights.conflicts).toHaveLength(1);
    expect(insights.conflicts[0]).toMatchObject({
      taskAId: "task-a",
      taskBId: "task-b",
      overlapMinutes: 30,
    });
    expect(insights.suggestedSlots[0]).toMatchObject({
      date: "2026-04-18",
      time: "08:00",
    });
    expect(insights.summary).toContain("overlap");
  });

  it("flags overloaded days and suggests moving work to lighter dates", () => {
    const insights = buildCompanionPlannerScheduleInsights({
      horizon: "week",
      selectedDate: "2026-04-18",
      plannerMemory: {
        wakeTime: "08:00",
        windDownTime: "20:00",
      },
      tasks: [
        buildTask({ id: "heavy-1", title: "Strategy block", estimatedDuration: 180, scheduledTime: "08:00" }),
        buildTask({ id: "heavy-2", title: "Client work", estimatedDuration: 150, scheduledTime: "11:30" }),
        buildTask({ id: "heavy-3", title: "Planning", estimatedDuration: 60, scheduledTime: "15:00" }),
        buildTask({ id: "light-1", title: "Check-in", taskDate: "2026-04-20", estimatedDuration: 30, scheduledTime: "10:00" }),
      ],
    });

    expect(insights.overloadedDates).toContain("2026-04-18");
    expect(insights.moveSuggestions[0]).toMatchObject({
      fromDate: "2026-04-18",
      toDate: "2026-04-19",
      taskId: "heavy-1",
    });
    expect(insights.dayLoads.find((load) => load.date === "2026-04-19")?.status).toBe("open");
  });
});
