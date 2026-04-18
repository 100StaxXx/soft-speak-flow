import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildPlannerResponse, type PlannerBuildInput } from "./planner.ts";

const baseInput = (overrides: Partial<PlannerBuildInput> = {}): PlannerBuildInput => ({
  message: "Call mom",
  currentDate: "2026-04-18",
  horizon: "day",
  tonePack: "soft",
  sessionState: {
    draft: {},
    openQuestionIds: [],
    preferredTimeOfDay: null,
    preferredTimeReason: null,
    reminderPreference: null,
    lastClassification: null,
  },
  parsedInput: {
    text: "Call mom",
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
  classificationHint: {
    type: "quest",
    confidence: 0.92,
    reasoning: "One-off task",
  },
  plannerContext: {
    tasks: [],
    inboxTasks: [],
    activeEpics: [],
    rituals: [],
    aiSignals: {
      preferredDifficulty: "medium",
      preferredHabitFrequency: "daily",
      preferredEpicDuration: 45,
      suggestedWorkload: "normal",
      commonContexts: [],
    },
  },
  ...overrides,
});

Deno.test("turns a one-off request into a quest and asks for time and reason", () => {
  const result = buildPlannerResponse(baseInput());

  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.proposals[0].readyToConfirm, false);
  assertEquals(result.followUpQuestions.map((question) => question.field), ["time_of_day", "time_reason"]);
  assertStringIncludes(result.reply, "quest");
});

Deno.test("defaults repeated standalone work to a recurring quest", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Write for my newsletter every weekday",
    parsedInput: {
      text: "Write for my newsletter",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: 30,
      recurrencePattern: "weekdays",
      recurrenceDays: [0, 1, 2, 3, 4],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: "mind",
      newTitle: null,
    },
    classificationHint: {
      type: "habit",
      confidence: 0.88,
      reasoning: "Repeated task",
    },
  }));

  assertEquals(result.proposals[0].kind, "create_quest");
  assertStringIncludes(result.proposals[0].summary, "recurring quest");
  assertEquals(
    result.followUpQuestions.map((question) => question.field),
    ["time_of_day", "time_reason", "end_date"],
  );
});

Deno.test("promotes multi-step goals to campaigns", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Get my real estate license by August",
    parsedInput: {
      text: "Get my real estate license",
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
    classificationHint: {
      type: "epic",
      confidence: 0.94,
      reasoning: "Long-term goal",
      suggestedDeadline: "2026-08-01",
    },
  }));

  assertEquals(result.proposals[0].kind, "create_campaign");
  assertEquals(result.sessionState.lastClassification, "epic");
});

Deno.test("ties repeated campaign work to a ritual when an active campaign is referenced", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Practice interview answers every weekday for Launch Sprint",
    parsedInput: {
      text: "Practice interview answers",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: 25,
      recurrencePattern: "weekdays",
      recurrenceDays: [0, 1, 2, 3, 4],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: "mind",
      newTitle: null,
    },
    classificationHint: {
      type: "habit",
      confidence: 0.86,
      reasoning: "Repeated work",
    },
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      activeEpics: [{ id: "epic-1", title: "Launch Sprint", endDate: "2026-06-15" }],
      rituals: [],
      aiSignals: {
        preferredDifficulty: "medium",
        preferredHabitFrequency: "daily",
        preferredEpicDuration: 60,
        suggestedWorkload: "normal",
        commonContexts: [],
      },
    },
  }));

  assertEquals(result.proposals[0].kind, "create_ritual");
  assertStringIncludes(result.proposals[0].summary, "Launch Sprint");
});

Deno.test("uses follow-up answers to preserve the existing draft and learn time preferences", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Morning because I'm sharper before email",
    sessionState: {
      draft: {
        title: "Write for my newsletter",
        draftKind: "create_quest",
        cadence: "weekdays",
      },
      openQuestionIds: ["time_of_day", "time_reason", "end_date"],
      preferredTimeOfDay: null,
      preferredTimeReason: null,
      reminderPreference: null,
      lastClassification: "habit",
    },
    parsedInput: {
      text: "Morning because I'm sharper before email",
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
    classificationHint: {
      type: "habit",
      confidence: 0.7,
      reasoning: "Answer to cadence questions",
    },
  }));

  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.sessionState.draft.title, "Write for my newsletter");
  assertEquals(result.memoryUpdates.preferredTimeOfDay, "morning");
  assertStringIncludes(result.memoryUpdates.preferredTimeReason ?? "", "sharper");
});

Deno.test("uses concrete open slots and remembered rhythms in the time question", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Plan my writing session",
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [
          {
            date: "2026-04-18",
            totalMinutes: 120,
            taskCount: 2,
            status: "balanced",
          },
        ],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-18",
            time: "09:00",
            endTime: "10:00",
            score: 92,
            reason: "Fits your usual morning rhythm.",
          },
          {
            date: "2026-04-18",
            time: "13:30",
            endTime: "14:30",
            score: 81,
            reason: "Keeps the day balanced.",
          },
        ],
        moveSuggestions: [],
        summary: "Today has room at 09:00.",
      },
      plannerMemory: {
        preferredTimeOfDay: "morning",
        preferredTimeReason: "you're sharp before email",
      },
      aiSignals: {
        preferredDifficulty: "medium",
        preferredHabitFrequency: "daily",
        preferredEpicDuration: 45,
        suggestedWorkload: "normal",
        commonContexts: [],
      },
    },
  }));

  assertStringIncludes(result.followUpQuestions[0]?.prompt ?? "", "09:00");
  assertStringIncludes(result.followUpQuestions[0]?.prompt ?? "", "morning");
  assertStringIncludes(result.reply, "Today has room at 09:00");
});

Deno.test("adds a balancing question when the selected window is overloaded", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Write my launch notes",
    horizon: "week",
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      scheduleInsights: {
        horizon: "week",
        selectedDate: "2026-04-18",
        dayLoads: [
          {
            date: "2026-04-18",
            totalMinutes: 360,
            taskCount: 6,
            status: "overloaded",
          },
          {
            date: "2026-04-19",
            totalMinutes: 0,
            taskCount: 0,
            status: "open",
          },
        ],
        overloadedDates: ["2026-04-18"],
        emptyDates: ["2026-04-19"],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-19",
            time: "10:00",
            endTime: "11:00",
            score: 88,
            reason: "This day is light.",
          },
        ],
        moveSuggestions: [
          {
            fromDate: "2026-04-18",
            toDate: "2026-04-19",
            taskId: "task-1",
            taskTitle: "Write my launch notes",
            suggestedTime: "10:00",
            reason: "Sunday has room at 10:00.",
          },
        ],
        summary: "1 week day is overloaded. Write my launch notes could move to 2026-04-19 at 10:00.",
      },
      aiSignals: {
        preferredDifficulty: "medium",
        preferredHabitFrequency: "daily",
        preferredEpicDuration: 45,
        suggestedWorkload: "normal",
        commonContexts: [],
      },
    },
  }));

  assertEquals(result.followUpQuestions.some((question) => question.field === "details"), true);
  assertStringIncludes(result.followUpQuestions.find((question) => question.field === "details")?.prompt ?? "", "2026-04-19");
});
