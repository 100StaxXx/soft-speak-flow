import { describe, expect, it } from "vitest";

import type { CompanionPlannerRequest } from "@/types/companionPlanner";
import {
  sanitizePlannerContext,
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
