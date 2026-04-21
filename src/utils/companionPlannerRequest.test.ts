import { describe, expect, it } from "vitest";

import type { CompanionPlannerRequest } from "@/types/companionPlanner";
import { sanitizePlannerContext } from "@/utils/companionPlannerRequest";

describe("sanitizePlannerContext", () => {
  it("drops malformed dynamic planner entries and strips nullable ai signal fields", () => {
    const context: CompanionPlannerRequest["plannerContext"] = {
      tasks: [
        {
          id: "task-1",
          title: "Plan my day",
          taskDate: null,
          scheduledTime: null,
          estimatedDuration: null,
          recurrencePattern: null,
        },
        {
          id: "",
          title: "Broken task",
          taskDate: null,
          scheduledTime: null,
          estimatedDuration: null,
          recurrencePattern: null,
        },
      ] as CompanionPlannerRequest["plannerContext"]["tasks"],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [
        {
          id: "evt-1",
          title: "Focus block",
          start: "2026-04-20T10:00:00-07:00",
          end: "2026-04-20T11:00:00-07:00",
          isAllDay: false,
          provider: "google",
          readOnly: true,
        },
        {
          id: "evt-bad",
          title: "",
          start: "2026-04-20T12:00:00-07:00",
          end: "2026-04-20T13:00:00-07:00",
          isAllDay: false,
          provider: "google",
          readOnly: true,
        },
      ] as CompanionPlannerRequest["plannerContext"]["calendarEvents"],
      contactsNeedingAttention: [
        {
          id: "contact-good",
          name: "Taylor",
          daysSinceContact: 14,
          hasOverdueReminder: false,
        },
        {
          id: "contact-bad",
          name: "Jordan",
          daysSinceContact: Number.NaN,
          hasOverdueReminder: false,
        },
      ] as CompanionPlannerRequest["plannerContext"]["contactsNeedingAttention"],
      priorityScores: [
        {
          id: "priority-good",
          kind: "task",
          title: "Plan my day",
          score: 42,
          reasons: ["due today"],
        },
        {
          id: "priority-bad",
          kind: "task",
          title: "Broken score",
          score: Number.NaN,
          reasons: ["bad data"],
        },
      ] as CompanionPlannerRequest["plannerContext"]["priorityScores"],
      aiSignals: {
        preferredDifficulty: null,
        preferredHabitFrequency: null,
        preferredEpicDuration: null,
        commonContexts: ["focus", "", null] as unknown as string[],
        suggestedWorkload: "normal",
      } as unknown as CompanionPlannerRequest["plannerContext"]["aiSignals"],
    };

    const sanitized = sanitizePlannerContext(context);

    expect(sanitized.tasks).toHaveLength(1);
    expect(sanitized.calendarEvents).toHaveLength(1);
    expect(sanitized.contactsNeedingAttention).toEqual([
      expect.objectContaining({
        id: "contact-good",
        daysSinceContact: 14,
      }),
    ]);
    expect(sanitized.priorityScores).toEqual([
      expect.objectContaining({
        id: "priority-good",
        score: 42,
      }),
    ]);
    expect(sanitized.aiSignals).toEqual({
      commonContexts: ["focus"],
      suggestedWorkload: "normal",
    });
  });
});
