import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildPlannerResponse, type PlannerBuildInput } from "./planner.ts";

type PlannerBuildInputOverrides =
  & Partial<
    Omit<
      PlannerBuildInput,
      "plannerContext" | "parsedInput" | "sessionState" | "classificationHint"
    >
  >
  & {
    plannerContext?: Partial<PlannerBuildInput["plannerContext"]>;
    parsedInput?: Partial<NonNullable<PlannerBuildInput["parsedInput"]>>;
    sessionState?: Partial<PlannerBuildInput["sessionState"]>;
    classificationHint?: Partial<
      NonNullable<PlannerBuildInput["classificationHint"]>
    >;
  };

const baseInput = (
  overrides: PlannerBuildInputOverrides = {},
): PlannerBuildInput => {
  const defaultSessionState: PlannerBuildInput["sessionState"] = {
    draft: {},
    openQuestionIds: [],
    preferredTimeOfDay: null,
    preferredTimeReason: null,
    reminderPreference: null,
    lastClassification: null,
  };

  const defaultParsedInput: NonNullable<PlannerBuildInput["parsedInput"]> = {
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
  };

  const defaultPlannerContext: PlannerBuildInput["plannerContext"] = {
    tasks: [],
    inboxTasks: [],
    activeEpics: [],
    rituals: [],
    calendarEvents: [],
    aiSignals: {
      preferredDifficulty: "medium",
      preferredHabitFrequency: "daily",
      preferredEpicDuration: 45,
      suggestedWorkload: "normal",
      commonContexts: [],
    },
  };

  return {
    message: overrides.message ?? "Call mom",
    currentDate: overrides.currentDate ?? "2026-04-18",
    currentDateTime: overrides.currentDateTime ?? "2026-04-18T10:30:00-07:00",
    horizon: overrides.horizon ?? "day",
    tonePack: overrides.tonePack ?? "soft",
    conversationHistory: overrides.conversationHistory ?? [],
    sessionState: {
      ...defaultSessionState,
      ...(overrides.sessionState ?? {}),
    },
    parsedInput: {
      ...defaultParsedInput,
      ...(overrides.parsedInput ?? {}),
    },
    classificationHint: {
      type: "quest",
      confidence: 0.92,
      reasoning: "One-off task",
      ...(overrides.classificationHint ?? {}),
    },
    plannerContext: {
      ...defaultPlannerContext,
      ...(overrides.plannerContext ?? {}),
    },
  };
};

Deno.test("turns a one-off request into a quest and asks for time and reason", () => {
  const result = buildPlannerResponse(baseInput());

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.proposals[0].readyToConfirm, false);
  assertEquals(result.followUpQuestions.map((question) => question.field), [
    "time_of_day",
    "time_reason",
  ]);
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
      activeEpics: [{
        id: "epic-1",
        title: "Launch Sprint",
        endDate: "2026-06-15",
      }],
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
  assertStringIncludes(
    result.memoryUpdates.preferredTimeReason ?? "",
    "sharper",
  );
});

Deno.test("treats a bare clock reply as answering the open time question", () => {
  const result = buildPlannerResponse(baseInput({
    message: "08:00",
    sessionState: {
      draft: {
        title: "Write for my newsletter",
        draftKind: "create_quest",
      },
      openQuestionIds: ["time_of_day", "time_reason"],
      preferredTimeOfDay: null,
      preferredTimeReason: null,
      reminderPreference: null,
      lastClassification: "quest",
    },
    parsedInput: {
      text: "08:00",
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
      confidence: 0.7,
      reasoning: "Answer to timing question",
    },
  }));

  assertEquals(result.sessionState.draft.scheduledTime, "08:00");
  assertEquals(result.followUpQuestions.map((question) => question.field), [
    "time_reason",
  ]);
  assertEquals(
    result.proposals[0].missingFields?.includes("time of day") ?? false,
    false,
  );
});

Deno.test("treats a dated slot reply as answering both the day and time question", () => {
  const result = buildPlannerResponse(baseInput({
    message: "2026-04-19 08:00",
    sessionState: {
      draft: {
        title: "Write for my newsletter",
        draftKind: "create_quest",
      },
      openQuestionIds: ["time_of_day", "time_reason"],
      preferredTimeOfDay: null,
      preferredTimeReason: null,
      reminderPreference: null,
      lastClassification: "quest",
    },
    parsedInput: {
      text: "2026-04-19 08:00",
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
      confidence: 0.7,
      reasoning: "Answer to timing question",
    },
  }));

  assertEquals(result.sessionState.draft.scheduledDate, "2026-04-19");
  assertEquals(result.sessionState.draft.scheduledTime, "08:00");
  assertEquals(result.followUpQuestions.map((question) => question.field), [
    "time_reason",
  ]);
});

Deno.test("asks what the user wants to get done before checking openings for vague planning prompts", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Help me plan today.",
    parsedInput: {
      text: "Help me plan today.",
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
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [],
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
        ],
        moveSuggestions: [],
        summary: "Today has room at 09:00.",
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

  assertEquals(result.mode, "conversational");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.followUpQuestions.map((question) => question.field), [
    "details",
  ]);
  assertStringIncludes(result.reply, "what you want to get done");
  assertStringIncludes(
    result.followUpQuestions[0]?.prompt ?? "",
    "What do you want to get done",
  );
  assertEquals(result.reply.includes("open windows"), false);
});

Deno.test("uses the answer to the intent-first question to resume the normal proposal flow", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Write my launch notes",
    parsedInput: {
      text: "Write my launch notes",
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
    sessionState: {
      draft: {},
      openQuestionIds: ["details"],
      preferredTimeOfDay: null,
      preferredTimeReason: null,
      reminderPreference: null,
      lastClassification: "quest",
    },
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [],
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
        ],
        moveSuggestions: [],
        summary: "Today has room at 09:00.",
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

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.followUpQuestions.map((question) => question.field), [
    "time_of_day",
    "time_reason",
  ]);
  assertStringIncludes(result.followUpQuestions[0]?.prompt ?? "", "09:00");
  assertStringIncludes(result.reply, "Today has room at 09:00");
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
        summary:
          "1 week day is overloaded. Write my launch notes could move to 2026-04-19 at 10:00.",
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

  assertEquals(
    result.followUpQuestions.some((question) => question.field === "details"),
    true,
  );
  assertStringIncludes(
    result.followUpQuestions.find((question) => question.field === "details")
      ?.prompt ?? "",
    "2026-04-19",
  );
});

Deno.test("answers schedule questions with quests and connected calendar events without creating proposals", () => {
  const result = buildPlannerResponse(baseInput({
    message: "What do I have scheduled today?",
    plannerContext: {
      tasks: [
        {
          id: "task-1",
          title: "Workout",
          taskDate: "2026-04-18",
          scheduledTime: "09:00",
          estimatedDuration: 45,
          recurrencePattern: null,
        },
      ],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [
        {
          id: "event-1",
          title: "Therapy",
          start: "2026-04-18T21:00:00.000Z",
          end: "2026-04-18T22:00:00.000Z",
          isAllDay: false,
          provider: "google",
          readOnly: true,
        },
      ],
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.followUpQuestions.length, 0);
  assertStringIncludes(result.reply, "Here's the shape of today.");
  assertStringIncludes(result.reply, "Today:");
  assertStringIncludes(result.reply, "Workout");
  assertStringIncludes(result.reply, "Therapy");
  assertStringIncludes(result.reply, "Tell me what feels most important");
});

Deno.test("treats the route starter like a schedule overview instead of a quest draft", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Show me today's route.",
    plannerContext: {
      tasks: [
        {
          id: "task-1",
          title: "Workout",
          taskDate: "2026-04-18",
          scheduledTime: "12:00",
          estimatedDuration: 45,
          recurrencePattern: null,
        },
      ],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [],
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.followUpQuestions.length, 0);
  assertStringIncludes(result.reply, "Here's the shape of today.");
  assertStringIncludes(result.reply, "Today:");
  assertStringIncludes(result.reply, "Workout");
  assertStringIncludes(result.reply, "Tell me what feels most important");
});

Deno.test("asks for the actual goal instead of drafting the break-big-goal starter", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Help me break a big goal into steps.",
    parsedInput: {
      text: "Help me break a big goal into steps.",
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
  }));

  assertEquals(result.mode, "conversational");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.followUpQuestions.map((question) => question.field), [
    "details",
  ]);
  assertEquals(result.sessionState.draft.title ?? null, null);
  assertStringIncludes(result.reply, "goal");
});

Deno.test("uses the follow-up goal after the starter instead of reusing starter copy as the title", () => {
  const intake = buildPlannerResponse(baseInput({
    message: "Help me break a big goal into steps.",
    parsedInput: {
      text: "Help me break a big goal into steps.",
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
  }));

  const result = buildPlannerResponse(baseInput({
    message: "Get my real estate license by August",
    sessionState: intake.sessionState,
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
  assertEquals(result.proposals[0].title, "Create Get my real estate license");
  assertEquals(result.sessionState.draft.title, "Get my real estate license");
});

Deno.test("treats the make-room starter like a read-only prioritization view", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Help me make room for what matters.",
    parsedInput: {
      text: "Help me make room for what matters.",
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
    plannerContext: {
      tasks: [
        {
          id: "task-1",
          title: "Workout",
          taskDate: "2026-04-18",
          scheduledTime: "12:00",
          estimatedDuration: 45,
          recurrencePattern: null,
        },
      ],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [],
        moveSuggestions: [],
        summary: "Today still has room to flex.",
      },
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.followUpQuestions.length, 0);
  assertStringIncludes(result.reply, "Here's the room I see right now.");
  assertStringIncludes(result.reply, "Today:");
  assertStringIncludes(result.reply, "Week ahead:");
  assertStringIncludes(result.reply, "Tell me what matters most");
});

Deno.test("answers the coming-up starter prompt with a schedule summary", () => {
  const result = buildPlannerResponse(baseInput({
    message: "What do I have coming up?",
    currentDateTime: "2026-04-18T12:30:00-07:00",
    plannerContext: {
      tasks: [
        {
          id: "task-1",
          title: "Workout",
          taskDate: "2026-04-18",
          scheduledTime: "15:00",
          estimatedDuration: 45,
          recurrencePattern: null,
        },
        {
          id: "task-2",
          title: "Inbox cleanup",
          taskDate: "2026-04-19",
          scheduledTime: "09:30",
          estimatedDuration: 30,
          recurrencePattern: null,
        },
      ],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [
        {
          id: "event-1",
          title: "Therapy",
          start: "2026-04-18T14:00:00.000Z",
          end: "2026-04-18T15:00:00.000Z",
          isAllDay: false,
          provider: "google",
          readOnly: true,
        },
      ],
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.followUpQuestions.length, 0);
  assertStringIncludes(result.reply, "Here's the shape of what's coming up.");
  assertStringIncludes(result.reply, "Today:");
  assertStringIncludes(result.reply, "Tomorrow:");
  assertStringIncludes(result.reply, "Week ahead:");
  assertStringIncludes(result.reply, "Tell me what feels most important");
});

Deno.test("answers availability questions using both quests and calendar events", () => {
  const result = buildPlannerResponse(baseInput({
    message: "When am I free tomorrow afternoon?",
    plannerContext: {
      tasks: [
        {
          id: "task-1",
          title: "Deep work",
          taskDate: "2026-04-19",
          scheduledTime: "13:00",
          estimatedDuration: 60,
          recurrencePattern: null,
        },
      ],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [
        {
          id: "event-1",
          title: "Doctor",
          start: "2026-04-19T22:00:00.000Z",
          end: "2026-04-19T23:00:00.000Z",
          isAllDay: false,
          provider: "google",
          readOnly: true,
        },
      ],
      plannerMemory: {
        wakeTime: "08:00",
        windDownTime: "21:00",
      },
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertEquals(result.proposals.length, 0);
  assertStringIncludes(result.reply, "2026-04-19");
  assertStringIncludes(result.reply, "afternoon");
});

Deno.test("prepares a direct quest move without asking for a time reason when the time is explicit", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Move my workout quest to 6 pm",
    parsedInput: {
      text: "Move my workout quest",
      scheduledTime: "18:00",
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
    plannerContext: {
      tasks: [
        {
          id: "task-1",
          title: "Workout quest",
          taskDate: "2026-04-18",
          scheduledTime: "09:00",
          estimatedDuration: 45,
          recurrencePattern: null,
        },
      ],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [],
    },
  }));

  assertEquals(result.proposals[0].kind, "update_quest");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.followUpQuestions.length, 0);
});

Deno.test("creates one proposal per quest for batch rescheduling", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Move the rest of my quests to tomorrow",
    plannerContext: {
      tasks: [
        {
          id: "task-1",
          title: "Workout",
          taskDate: "2026-04-18",
          scheduledTime: "09:00",
          estimatedDuration: 45,
          recurrencePattern: null,
        },
        {
          id: "task-2",
          title: "Newsletter",
          taskDate: "2026-04-18",
          scheduledTime: "14:00",
          estimatedDuration: 60,
          recurrencePattern: null,
        },
      ],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [],
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals.length, 2);
  assertEquals(
    result.proposals.every((proposal) => proposal.kind === "update_quest"),
    true,
  );
  assertEquals(
    result.proposals.every((proposal) => proposal.readyToConfirm),
    true,
  );
});

Deno.test("returns an adjust campaign proposal for complex campaign changes", () => {
  const result = buildPlannerResponse(baseInput({
    message:
      "Push Campaign Aurora by two weeks and remove the least important ritual",
    classificationHint: {
      type: "epic",
      confidence: 0.95,
      reasoning: "Campaign adjustment",
    },
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      activeEpics: [{
        id: "epic-1",
        title: "Campaign Aurora",
        endDate: "2026-06-01",
      }],
      rituals: [
        {
          id: "ritual-1",
          epicId: "epic-1",
          epicTitle: "Campaign Aurora",
          title: "Practice",
          frequency: "daily",
          preferredTime: "09:00",
        },
      ],
      calendarEvents: [],
    },
  }));

  assertEquals(result.proposals[0].kind, "adjust_campaign_plan");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertStringIncludes(result.proposals[0].summary, "Campaign Aurora");
});

Deno.test("explains that external calendar events are read-only when asked to edit one", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Move my dentist appointment to 4 pm",
    parsedInput: {
      text: "Move my dentist appointment",
      scheduledTime: "16:00",
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
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [
        {
          id: "event-1",
          title: "Dentist appointment",
          start: "2026-04-18T22:00:00.000Z",
          end: "2026-04-18T23:00:00.000Z",
          isAllDay: false,
          provider: "google",
          readOnly: true,
        },
      ],
    },
  }));

  assertEquals(result.mode, "conversational");
  assertEquals(result.proposals.length, 0);
  assertStringIncludes(result.reply, "read-only");
});

Deno.test("handles non-planning conversation without creating proposals", () => {
  const result = buildPlannerResponse(baseInput({
    message: "I'm feeling behind and I need help thinking clearly.",
    classificationHint: {
      type: "brain-dump",
      confidence: 0.9,
      reasoning: "User is processing emotions, not asking for a saved action.",
    },
  }));

  assertEquals(result.mode, "conversational");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.followUpQuestions.length, 0);
  assertStringIncludes(result.reply, "I'm here with you");
});
