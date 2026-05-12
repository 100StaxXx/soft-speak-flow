import { describe, expect, it } from "vitest";

import type { CompanionPlannerRequest } from "@/types/companionPlanner";
import {
  sanitizePlannerContext,
  sanitizePlannerConversationHistory,
  sanitizePlannerParsedInput,
  sanitizePlannerSessionState,
  summarizePlannerRequestForDebug,
} from "@/utils/companionPlannerRequest";
import {
  validateCompanionPlannerRequest,
} from "@/utils/companionPlannerRequestValidation";

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
          taskId: "task-1",
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

  it("strips stale deleted campaign context before building a planner request", () => {
    const context: CompanionPlannerRequest["plannerContext"] = {
      tasks: [
        {
          id: "task-stale-ritual",
          title: "Daily Hydration",
          taskDate: "2026-04-21",
          scheduledTime: null,
          estimatedDuration: 10,
          recurrencePattern: "daily",
          epicId: "deleted-epic",
          epicTitle: "Gain 10 pounds of muscle",
          habitSourceId: "deleted-habit",
        },
        {
          id: "task-stale-standalone",
          title: "Buy running shoes",
          taskDate: "2026-04-21",
          scheduledTime: null,
          estimatedDuration: 20,
          recurrencePattern: null,
          epicId: "deleted-epic",
          epicTitle: "Gain 10 pounds of muscle",
          habitSourceId: null,
        },
      ] as CompanionPlannerRequest["plannerContext"]["tasks"],
      inboxTasks: [],
      activeEpics: [],
      rituals: [
        {
          id: "deleted-habit",
          epicId: "deleted-epic",
          epicTitle: "Gain 10 pounds of muscle",
          title: "Daily Hydration",
          frequency: "daily",
          preferredTime: "08:00",
          currentStreak: 2,
        },
      ],
      calendarEvents: [],
      priorityScores: [
        {
          id: "epic:deleted-epic",
          kind: "epic",
          title: "Gain 10 pounds of muscle",
          score: 91,
          reasons: ["stale campaign"],
          epicId: "deleted-epic",
        },
        {
          id: "ritual:deleted-habit",
          kind: "ritual",
          title: "Daily Hydration",
          score: 88,
          reasons: ["stale ritual"],
          ritualId: "deleted-habit",
          epicId: "deleted-epic",
        },
        {
          id: "epic:orphan-deleted",
          kind: "epic",
          title: "Gain 10 pounds of muscle",
          score: 75,
          reasons: ["legacy orphan score"],
          epicId: null,
        },
        {
          id: "ritual:orphan-deleted",
          kind: "ritual",
          title: "Daily Hydration",
          score: 74,
          reasons: ["legacy orphan ritual score"],
          ritualId: "deleted-habit",
          epicId: null,
        },
        {
          id: "task:task-stale-standalone",
          kind: "task",
          title: "Buy running shoes",
          score: 70,
          reasons: ["still useful as standalone"],
          taskId: "task-stale-standalone",
          epicId: "deleted-epic",
        },
      ],
      aiSignals: {
        commonContexts: [],
      },
    };

    const sanitized = sanitizePlannerContext(context);

    expect(sanitized.tasks).toEqual([
      expect.objectContaining({
        id: "task-stale-standalone",
        epicId: null,
        epicTitle: null,
      }),
    ]);
    expect(sanitized.rituals).toEqual([]);
    expect(sanitized.priorityScores).toEqual([
      expect.objectContaining({
        id: "task:task-stale-standalone",
        epicId: null,
      }),
    ]);
    expect(JSON.stringify(sanitized)).not.toContain("Daily Hydration");
    expect(JSON.stringify(sanitized)).not.toContain("Gain 10 pounds of muscle");
  });

  it("drops deleted ritual tasks and scores even when their campaign is still active", () => {
    const context: CompanionPlannerRequest["plannerContext"] = {
      tasks: [
        {
          id: "task-deleted-ritual",
          title: "Daily Hydration",
          taskDate: "2026-04-21",
          scheduledTime: null,
          estimatedDuration: 10,
          recurrencePattern: "daily",
          epicId: "epic-active",
          epicTitle: "Active Campaign",
          habitSourceId: "deleted-habit",
        },
        {
          id: "task-active-ritual",
          title: "Mobility Flow",
          taskDate: "2026-04-21",
          scheduledTime: null,
          estimatedDuration: 15,
          recurrencePattern: "daily",
          epicId: "epic-active",
          epicTitle: "Active Campaign",
          habitSourceId: "active-habit",
        },
        {
          id: "task-active-quest",
          title: "Campaign admin",
          taskDate: "2026-04-21",
          scheduledTime: null,
          estimatedDuration: 20,
          recurrencePattern: null,
          epicId: "epic-active",
          epicTitle: "Active Campaign",
          habitSourceId: null,
        },
      ] as CompanionPlannerRequest["plannerContext"]["tasks"],
      inboxTasks: [],
      activeEpics: [
        {
          id: "epic-active",
          title: "Active Campaign",
          endDate: "2026-05-01",
          progressPercentage: 20,
        },
      ],
      rituals: [
        {
          id: "active-habit",
          epicId: "epic-active",
          epicTitle: "Active Campaign",
          title: "Mobility Flow",
          frequency: "daily",
          preferredTime: "08:00",
          currentStreak: 2,
        },
      ],
      calendarEvents: [],
      priorityScores: [
        {
          id: "task:task-deleted-ritual",
          kind: "task",
          title: "Daily Hydration",
          score: 80,
          reasons: ["stale cached ritual task"],
          taskId: "task-deleted-ritual",
          epicId: "epic-active",
        },
        {
          id: "ritual:deleted-habit",
          kind: "ritual",
          title: "Daily Hydration",
          score: 75,
          reasons: ["stale cached ritual score"],
          ritualId: "deleted-habit",
          epicId: "epic-active",
        },
        {
          id: "ritual:active-habit",
          kind: "ritual",
          title: "Daily Hydration",
          score: 70,
          reasons: ["active ritual"],
          ritualId: "active-habit",
          epicId: "epic-active",
        },
        {
          id: "task:task-active-quest",
          kind: "task",
          title: "Campaign admin",
          score: 65,
          reasons: ["active campaign quest"],
          taskId: "task-active-quest",
          epicId: "epic-active",
        },
      ],
      aiSignals: {
        commonContexts: [],
      },
    };

    const sanitized = sanitizePlannerContext(context);

    expect(sanitized.tasks).toEqual([
      expect.objectContaining({ id: "task-active-ritual" }),
      expect.objectContaining({ id: "task-active-quest" }),
    ]);
    expect(sanitized.priorityScores).toEqual([
      expect.objectContaining({
        id: "ritual:active-habit",
        title: "Mobility Flow",
      }),
      expect.objectContaining({ id: "task:task-active-quest" }),
    ]);
    expect(JSON.stringify(sanitized)).not.toContain("Daily Hydration");
    expect(JSON.stringify(sanitized)).not.toContain("deleted-habit");
  });

  it("drops standalone habit tasks when the source habit is no longer active", () => {
    const context: CompanionPlannerRequest["plannerContext"] = {
      tasks: [
        {
          id: "task-deleted-standalone-habit",
          title: "Daily Hydration",
          taskDate: "2026-04-21",
          scheduledTime: null,
          estimatedDuration: 10,
          recurrencePattern: "daily",
          habitSourceId: "habit-deleted",
        },
        {
          id: "task-active-standalone-habit",
          title: "Daily Stretching",
          taskDate: "2026-04-21",
          scheduledTime: null,
          estimatedDuration: 15,
          recurrencePattern: "daily",
          habitSourceId: "habit-active",
        },
      ] as CompanionPlannerRequest["plannerContext"]["tasks"],
      inboxTasks: [],
      activeEpics: [],
      activeHabitIds: ["habit-active"],
      rituals: [],
      calendarEvents: [],
      priorityScores: [
        {
          id: "task:task-deleted-standalone-habit",
          kind: "task",
          title: "Daily Hydration",
          score: 80,
          reasons: ["stale deleted habit task"],
          taskId: "task-deleted-standalone-habit",
        },
        {
          id: "task:task-active-standalone-habit",
          kind: "task",
          title: "Daily Hydration",
          score: 75,
          reasons: ["live habit task"],
          taskId: "task-active-standalone-habit",
        },
      ],
    };

    const sanitized = sanitizePlannerContext(context);

    expect(sanitized.tasks).toEqual([
      expect.objectContaining({ id: "task-active-standalone-habit" }),
    ]);
    expect(sanitized.priorityScores).toEqual([
      expect.objectContaining({
        id: "task:task-active-standalone-habit",
        title: "Daily Stretching",
      }),
    ]);
    expect(JSON.stringify(sanitized)).not.toContain("Daily Hydration");
  });

  it("keeps active standalone rituals in the general scope", () => {
    const context: CompanionPlannerRequest["plannerContext"] = {
      tasks: [],
      inboxTasks: [],
      activeEpics: [],
      activeHabitIds: ["habit-active"],
      rituals: [
        {
          id: "habit-active",
          epicId: "general",
          epicTitle: "your goals",
          title: "Mobility reset",
          frequency: "custom",
          preferredTime: "08:00",
          customDays: [2],
          estimatedMinutes: 20,
        },
      ],
      calendarEvents: [],
      priorityScores: [
        {
          id: "ritual:habit-active",
          kind: "ritual",
          title: "Mobility reset",
          score: 68,
          reasons: ["due tomorrow"],
          ritualId: "habit-active",
          epicId: "general",
        },
      ],
    };

    const sanitized = sanitizePlannerContext(context);

    expect(sanitized.rituals).toEqual([
      expect.objectContaining({
        id: "habit-active",
        epicId: "general",
        epicTitle: "your goals",
        title: "Mobility reset",
      }),
    ]);
    expect(sanitized.priorityScores).toEqual([
      expect.objectContaining({
        id: "ritual:habit-active",
        title: "Mobility reset",
      }),
    ]);
  });

  it("treats an empty active habit scope as authoritative", () => {
    const context: CompanionPlannerRequest["plannerContext"] = {
      tasks: [
        {
          id: "task-deleted-standalone-habit",
          title: "Daily Hydration",
          taskDate: "2026-04-21",
          scheduledTime: null,
          estimatedDuration: 10,
          recurrencePattern: "daily",
          habitSourceId: "habit-deleted",
        },
      ] as CompanionPlannerRequest["plannerContext"]["tasks"],
      inboxTasks: [],
      activeEpics: [],
      activeHabitIds: [],
      rituals: [],
      calendarEvents: [],
      priorityScores: [
        {
          id: "task:task-deleted-standalone-habit",
          kind: "task",
          title: "Daily Hydration",
          score: 80,
          reasons: ["stale deleted habit task"],
          taskId: "task-deleted-standalone-habit",
        },
      ],
    };

    const sanitized = sanitizePlannerContext(context);

    expect(sanitized.activeHabitIds).toEqual([]);
    expect(sanitized.tasks).toEqual([]);
    expect(sanitized.priorityScores).toEqual([]);
    expect(JSON.stringify(sanitized)).not.toContain("Daily Hydration");
  });

  it("drops orphan task priority scores without an active task id", () => {
    const context: CompanionPlannerRequest["plannerContext"] = {
      tasks: [
        {
          id: "task-active",
          title: "Daily Stretching",
          taskDate: "2026-04-21",
          scheduledTime: null,
          estimatedDuration: 15,
          recurrencePattern: null,
        },
      ] as CompanionPlannerRequest["plannerContext"]["tasks"],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [],
      priorityScores: [
        {
          id: "task:orphan",
          kind: "task",
          title: "Daily Hydration",
          score: 80,
          reasons: ["stale orphan score"],
        },
        {
          id: "task:task-active",
          kind: "task",
          title: "Daily Hydration",
          score: 75,
          reasons: ["live task"],
          taskId: "task-active",
        },
      ],
    };

    const sanitized = sanitizePlannerContext(context);

    expect(sanitized.priorityScores).toEqual([
      expect.objectContaining({
        id: "task:task-active",
        title: "Daily Stretching",
      }),
    ]);
    expect(JSON.stringify(sanitized)).not.toContain("Daily Hydration");
  });

  it("drops tombstoned planner entities and excluded task history", () => {
    const context: CompanionPlannerRequest["plannerContext"] = {
      tasks: [
        {
          id: "task-deleted",
          title: "Call the vendor",
          taskDate: "2026-05-03",
          scheduledTime: null,
          estimatedDuration: null,
          recurrencePattern: null,
          epicId: "epic-deleted",
          epicTitle: "Launch Sprint",
        },
        {
          id: "task-excluded",
          title: "Completed old work",
          taskDate: "2026-05-02",
          scheduledTime: null,
          estimatedDuration: null,
          recurrencePattern: null,
          completed: true,
          excludedFromPlannerAt: "2026-05-03T00:00:00Z",
        } as CompanionPlannerRequest["plannerContext"]["tasks"][number],
        {
          id: "task-live",
          title: "Current launch review",
          taskDate: "2026-05-03",
          scheduledTime: null,
          estimatedDuration: null,
          recurrencePattern: null,
          epicId: "epic-live",
          epicTitle: "Launch Sprint",
        },
      ],
      inboxTasks: [],
      recentCompletedTasks: [],
      activeEpics: [
        {
          id: "epic-deleted",
          title: "Launch Sprint",
          endDate: "2026-06-01",
        },
        {
          id: "epic-live",
          title: "Launch Sprint",
          endDate: "2026-06-15",
        },
      ],
      rituals: [],
      calendarEvents: [],
    };

    const sanitized = sanitizePlannerContext(context, [
      {
        entityType: "campaign",
        entityId: "epic-deleted",
        title: "Launch Sprint",
      },
      {
        entityType: "task",
        entityId: "task-deleted",
        title: "Call the vendor",
      },
    ]);

    expect(sanitized.activeEpics.map((epic) => epic.id)).toEqual(["epic-live"]);
    expect(sanitized.tasks.map((task) => task.id)).toEqual(["task-live"]);
    expect(sanitized.tasks[0].epicTitle).toBe("Launch Sprint");
  });
});

describe("sanitizePlannerConversationHistory", () => {
  it("redacts tombstoned titles while preserving active same-title context", () => {
    const history = sanitizePlannerConversationHistory(
      [
        {
          role: "user",
          content: "Please keep Launch Sprint but forget Call the vendor.",
        },
        {
          role: "assistant",
          content: "Call the vendor belonged to task-deleted.",
        },
      ],
      [
        {
          entityType: "campaign",
          entityId: "epic-deleted",
          title: "Launch Sprint",
        },
        {
          entityType: "task",
          entityId: "task-deleted",
          title: "Call the vendor",
        },
      ],
      ["Launch Sprint"],
    );

    expect(history[0].content).toContain("Launch Sprint");
    expect(history[0].content).not.toContain("Call the vendor");
    expect(history[1].content).not.toContain("task-deleted");
  });
});

describe("sanitizePlannerSessionState", () => {
  it("normalizes stale session values into the request-safe shape", () => {
    const sanitized = sanitizePlannerSessionState({
      draft: [] as unknown as CompanionPlannerRequest["sessionState"]["draft"],
      openQuestionIds: ["details", 7, "", null] as unknown as string[],
      preferredTimeOfDay: 9 as unknown as string,
      preferredTimeReason: { why: "later" } as unknown as string,
      reminderPreference: ["15 minutes"] as unknown as string,
      pendingStarterIntent: "unknown_starter" as CompanionPlannerRequest["sessionState"]["pendingStarterIntent"],
      lastClassification: "brain_dump" as CompanionPlannerRequest["sessionState"]["lastClassification"],
    });

    expect(sanitized).toEqual({
      draft: {},
      openQuestionIds: ["details"],
      preferredTimeOfDay: null,
      preferredTimeReason: null,
      reminderPreference: null,
      pendingStarterIntent: undefined,
      lastClassification: "brain-dump",
      planDayEnergy: undefined,
      planningConsent: null,
    });
  });
});

describe("sanitizePlannerParsedInput", () => {
  it("drops malformed parsed-input fields that can trigger request rejection", () => {
    const sanitized = sanitizePlannerParsedInput({
      text: "Plan my day",
      scheduledTime: 900 as unknown as string,
      scheduledDate: null,
      estimatedDuration: Number.NaN,
      recurrencePattern: ["daily"] as unknown as string,
      recurrenceDays: [1, 2, Number.NaN] as unknown as number[],
      recurrenceMonthDays: null as unknown as number[],
      recurrenceCustomPeriod: "quarter" as "week",
      recurrenceEndDate: 123 as unknown as string,
      notes: false as unknown as string,
      category: "mind",
      newTitle: { value: "new" } as unknown as string,
    });

    expect(sanitized).toEqual({
      text: "Plan my day",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [1, 2],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: "mind",
      newTitle: null,
    });
  });
});

const buildValidPlannerRequest = (): CompanionPlannerRequest => ({
  message: "Plan my day",
  currentDate: "2026-04-21",
  currentDateTime: "2026-04-21T11:21:59-07:00",
  timezone: "America/Los_Angeles",
  horizon: "day",
  tonePack: "soft",
  conversationHistory: [],
  sessionState: {
    draft: {},
    openQuestionIds: [],
    preferredTimeOfDay: null,
    preferredTimeReason: null,
    reminderPreference: null,
    pendingStarterIntent: null,
    lastClassification: null,
  },
  parsedInput: {
    text: "",
    scheduledTime: null,
    scheduledDate: null,
    estimatedDuration: null,
    recurrencePattern: null,
    recurrenceDays: [],
    recurrenceMonthDays: [],
    recurrenceCustomPeriod: null,
    recurrenceEndDate: null,
    notes: null,
    category: null,
    newTitle: null,
  },
  classificationHint: null,
  plannerContext: {
    tasks: [{
      id: "task-1",
      title: "Morning reset",
      taskDate: "2026-04-21",
      category: null,
      scheduledTime: null,
      estimatedDuration: 30,
      notes: null,
      recurrencePattern: null,
    }],
    inboxTasks: [],
    activeEpics: [{
      id: "epic-1",
      title: "April focus",
      endDate: "2026-04-30",
      progressPercentage: 50,
      daysRemaining: 9,
      habitCount: 2,
    }],
    rituals: [{
      id: "ritual-1",
      epicId: "epic-1",
      epicTitle: "April focus",
      title: "Daily planning",
      frequency: "daily",
      preferredTime: "09:00",
      currentStreak: 4,
    }],
    calendarEvents: [{
      id: "event-1",
      title: "Standup",
      start: "2026-04-21T09:00:00-07:00",
      end: "2026-04-21T09:15:00-07:00",
      isAllDay: false,
      provider: "google",
      readOnly: true,
    }],
    contactsNeedingAttention: [],
    reflectionSignals: [{
      date: "2026-04-20",
      source: "check_in",
      mood: "steady",
      energy: "medium",
      wins: null,
      tomorrowAdjustment: null,
    }],
    careSignals: {
      overallCare: 0.8,
      hasDormancyWarning: false,
      dialogueTone: "content",
      inactiveDays: 0,
      daysUntilDormancy: null,
    },
    starterIntent: "plan_day",
    priorityScores: [{
      id: "priority-1",
      kind: "task",
      title: "Morning reset",
      score: 10,
      reasons: ["today"],
      taskId: "task-1",
      epicId: null,
      ritualId: null,
      contactId: null,
      targetDate: "2026-04-21",
      suggestedTime: null,
    }],
    scheduleInsights: {
      horizon: "day",
      selectedDate: "2026-04-21",
      dayLoads: [{
        date: "2026-04-21",
        totalMinutes: 30,
        taskCount: 1,
        status: "open",
      }],
      overloadedDates: [],
      emptyDates: [],
      conflicts: [],
      suggestedSlots: [{
        date: "2026-04-21",
        time: "10:00",
        endTime: "10:30",
        score: 0.8,
        reason: "Open window",
      }],
      moveSuggestions: [],
      summary: "Open morning",
    },
    plannerMemory: {
      tonePack: "soft",
      preferredTimeOfDay: null,
      preferredTimeReason: null,
      reminderMinutesBefore: null,
      wakeTime: null,
      windDownTime: null,
      peakProductivityTimes: [],
      preferredWindows: [],
      cadencePatterns: {},
      workloadTolerance: "light",
      contactCadencePatterns: {},
      lastConfirmedAt: null,
    },
    statInterpretation: {
      statProfile: {
        scores: {
          vitality: 1,
          wisdom: 2,
          discipline: 3,
          resolve: 4,
          creativity: 5,
          alignment: 6,
        },
        dominantStat: "alignment",
        secondaryStat: "creativity",
      },
      statNeeds: {
        vitality: { level: "low", reasons: [] },
        wisdom: { level: "medium", reasons: [] },
        discipline: { level: "high", reasons: [] },
        resolve: { level: "medium", reasons: [] },
        creativity: { level: "low", reasons: [] },
        alignment: { level: "medium", reasons: [] },
      },
      momentumState: "coasting",
      recentMissInterpretation: "normal_variance",
      narrativeBrief: "Steady progress.",
      dailyNarrative: "Today has space for one meaningful task.",
      weeklyNarrative: "The week still feels flexible.",
      identityBootstrap: "You are building consistency.",
    },
    aiSignals: {
      preferredDifficulty: "medium",
      preferredHabitFrequency: "daily",
      preferredEpicDuration: 30,
      commonContexts: ["focus"],
      suggestedWorkload: "light",
    },
  },
});

describe("validateCompanionPlannerRequest", () => {
  it("accepts a request that matches the backend schema", () => {
    expect(validateCompanionPlannerRequest(buildValidPlannerRequest())).toEqual({
      success: true,
    });
  });

  it("surfaces exact issue paths when the request is still invalid", () => {
    const request = buildValidPlannerRequest();
    request.sessionState.draft = [] as unknown as CompanionPlannerRequest["sessionState"]["draft"];
    request.plannerContext.calendarEvents[0]!.readOnly = undefined as unknown as boolean;

    expect(validateCompanionPlannerRequest(request)).toEqual({
      success: false,
      issues: [
        {
          path: "sessionState.draft",
          code: "invalid_type",
          message: "Expected object, received array",
        },
        {
          path: "plannerContext.calendarEvents.0.readOnly",
          code: "invalid_type",
          message: "Required",
        },
      ],
    });
  });
});

describe("summarizePlannerRequestForDebug", () => {
  it("includes top-level fields that were missing from the earlier debug logs", () => {
    expect(summarizePlannerRequestForDebug(buildValidPlannerRequest())).toEqual(
      expect.objectContaining({
        currentDateTime: "2026-04-21T11:21:59-07:00",
        timezone: "America/Los_Angeles",
        tonePack: "soft",
        classificationHint: null,
      }),
    );
  });
});
