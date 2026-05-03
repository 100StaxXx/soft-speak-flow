import { describe, expect, it } from "vitest";
import { buildCompanionPlannerScheduleInsights } from "@/utils/companionPlannerSchedule";
import type {
  PlannerContextCalendarEvent,
  PlannerContextTask,
} from "@/types/companionPlanner";

const buildTask = (
  overrides: Partial<PlannerContextTask> = {},
): PlannerContextTask => ({
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

const buildCalendarEvent = (
  overrides: Partial<PlannerContextCalendarEvent> = {},
): PlannerContextCalendarEvent => ({
  id: crypto.randomUUID(),
  title: "Calendar event",
  start: "2026-04-18T16:00:00.000Z",
  end: "2026-04-18T17:00:00.000Z",
  isAllDay: false,
  provider: "google",
  readOnly: true,
  ...overrides,
});

describe("buildCompanionPlannerScheduleInsights", () => {
  it("detects conflicts and ranks open slots against planner memory", () => {
    const insights = buildCompanionPlannerScheduleInsights({
      horizon: "day",
      selectedDate: "2026-04-18",
      currentDateTime: "2026-04-18T07:30:00-07:00",
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
        buildTask({
          id: "task-a",
          title: "Inbox zero",
          scheduledTime: "09:00",
          estimatedDuration: 60,
        }),
        buildTask({
          id: "task-b",
          title: "Standup prep",
          scheduledTime: "09:30",
          estimatedDuration: 30,
        }),
        buildTask({
          id: "task-c",
          title: "Workout",
          scheduledTime: "12:00",
          estimatedDuration: 45,
        }),
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
  });

  it("flags overloaded days and suggests moving work to lighter dates", () => {
    const insights = buildCompanionPlannerScheduleInsights({
      horizon: "week",
      selectedDate: "2026-04-18",
      currentDateTime: "2026-04-18T07:30:00-07:00",
      plannerMemory: {
        wakeTime: "08:00",
        windDownTime: "20:00",
      },
      tasks: [
        buildTask({
          id: "heavy-1",
          title: "Strategy block",
          estimatedDuration: 180,
          scheduledTime: "08:00",
        }),
        buildTask({
          id: "heavy-2",
          title: "Client work",
          estimatedDuration: 150,
          scheduledTime: "11:30",
        }),
        buildTask({
          id: "heavy-3",
          title: "Planning",
          estimatedDuration: 60,
          scheduledTime: "15:00",
        }),
        buildTask({
          id: "light-1",
          title: "Check-in",
          taskDate: "2026-04-20",
          estimatedDuration: 30,
          scheduledTime: "10:00",
        }),
      ],
    });

    expect(insights.overloadedDates).toContain("2026-04-18");
    expect(insights.moveSuggestions[0]).toMatchObject({
      fromDate: "2026-04-18",
      toDate: "2026-04-19",
      taskId: "heavy-1",
    });
    expect(
      insights.dayLoads.find((load) => load.date === "2026-04-19")?.status,
    ).toBe("open");
  });

  it("treats connected calendar events as occupied time when finding conflicts and openings", () => {
    const insights = buildCompanionPlannerScheduleInsights({
      horizon: "day",
      selectedDate: "2026-04-18",
      currentDateTime: "2026-04-18T07:30:00-07:00",
      plannerMemory: {
        wakeTime: "08:00",
        windDownTime: "21:00",
      },
      tasks: [
        buildTask({
          id: "task-a",
          title: "Workout",
          scheduledTime: "09:00",
          estimatedDuration: 60,
        }),
      ],
      calendarEvents: [
        buildCalendarEvent({
          id: "event-a",
          title: "Doctor",
          start: "2026-04-18T16:00:00.000Z",
          end: "2026-04-18T17:30:00.000Z",
        }),
      ],
    });

    expect(insights.dayLoads[0]?.totalMinutes).toBeGreaterThan(120);
    expect(insights.suggestedSlots.some((slot) => slot.time === "16:00")).toBe(
      false,
    );
  });

  it("keeps late evening calendar events on the user's local date", () => {
    const insights = buildCompanionPlannerScheduleInsights({
      horizon: "day",
      selectedDate: "2026-04-18",
      currentDateTime: "2026-04-18T18:30:00-07:00",
      plannerMemory: {
        wakeTime: "08:00",
        windDownTime: "22:00",
      },
      tasks: [],
      calendarEvents: [
        buildCalendarEvent({
          id: "event-late",
          title: "Dinner",
          start: "2026-04-19T02:00:00.000Z",
          end: "2026-04-19T03:00:00.000Z",
        }),
      ],
    });

    expect(insights.dayLoads[0]).toMatchObject({
      date: "2026-04-18",
      taskCount: 1,
      totalMinutes: 60,
      status: "balanced",
    });
    expect(insights.suggestedSlots.some((slot) => slot.time === "19:00")).toBe(
      false,
    );
  });

  it("never suggests past openings for the current day late at night", () => {
    const insights = buildCompanionPlannerScheduleInsights({
      horizon: "day",
      selectedDate: "2026-04-20",
      currentDateTime: "2026-04-20T21:48:00-07:00",
      plannerMemory: {
        wakeTime: "08:00",
        windDownTime: "22:30",
        preferredWindows: [
          {
            timeOfDay: "morning",
            time: "09:00",
            reason: "Morning focus still tends to work best.",
            sourceCount: 2,
          },
        ],
      },
      tasks: [],
      calendarEvents: [],
    });

    expect(insights.suggestedSlots.some((slot) => slot.time === "08:00")).toBe(
      false,
    );
    expect(insights.suggestedSlots.some((slot) => slot.time === "09:00")).toBe(
      false,
    );
    expect(insights.suggestedSlots.every((slot) => slot.time >= "21:48")).toBe(
      true,
    );
  });
});
