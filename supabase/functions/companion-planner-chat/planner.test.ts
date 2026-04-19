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

Deno.test("turns a one-off request into a quest without forcing schedule details", () => {
  const result = buildPlannerResponse(baseInput());

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.followUpQuestions.length, 0);
  assertStringIncludes(result.reply, "quest");
});

Deno.test("uses the cleaned workout title for planner-created quest proposals", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Add workout to today's schedule for 3pm",
    parsedInput: {
      text: "workout",
      scheduledTime: "15:00",
      scheduledDate: "2026-04-18",
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: "body",
      newTitle: null,
    },
  }));

  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.proposals[0].title, "Create Workout");
  assertEquals(
    (result.proposals[0].payload as { taskText: string }).taskText,
    "Workout",
  );
});

Deno.test("normalizes conversational scheduled quest titles before building planner proposals", () => {
  const result = buildPlannerResponse(baseInput({
    message: "I'm going to grab lunch with Zach today at 1",
    currentDate: "2026-04-19",
    currentDateTime: "2026-04-19T12:34:00-07:00",
    parsedInput: {
      text: "I'm going to grab lunch with Zach",
      scheduledTime: "13:00",
      scheduledDate: "2026-04-19",
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

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(result.proposals[0].title, "Create Grab Lunch With Zach");
  assertEquals(
    result.proposals[0].summary,
    'Create a quest for "Grab Lunch With Zach" on 2026-04-19 at 13:00.',
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskText: string;
      taskDate: string | null;
      scheduledTime: string | null;
    }).taskText,
    "Grab Lunch With Zach",
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskText: string;
      taskDate: string | null;
      scheduledTime: string | null;
    }).taskDate,
    "2026-04-19",
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskText: string;
      taskDate: string | null;
      scheduledTime: string | null;
    }).scheduledTime,
    "13:00",
  );
});

Deno.test("treats a simple timed utterance as a ready-to-confirm quest draft", () => {
  const result = buildPlannerResponse(baseInput({
    message: "gym at 5pm tomorrow",
    currentDate: "2026-04-19",
    currentDateTime: "2026-04-19T10:30:00-07:00",
    parsedInput: {
      text: "gym",
      scheduledTime: "17:00",
      scheduledDate: "2026-04-20",
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: "body",
      newTitle: null,
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(result.proposals[0].title, "Create Gym");
  assertEquals(
    result.proposals[0].summary,
    'Create a quest for "Gym" on 2026-04-20 at 17:00.',
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskText: string;
      taskDate: string | null;
      scheduledTime: string | null;
    }).taskText,
    "Gym",
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskText: string;
      taskDate: string | null;
      scheduledTime: string | null;
    }).taskDate,
    "2026-04-20",
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskText: string;
      taskDate: string | null;
      scheduledTime: string | null;
    }).scheduledTime,
    "17:00",
  );
});

Deno.test("normalizes parsed input server-side for question-form scheduling requests", () => {
  const result = buildPlannerResponse({
    ...baseInput({
      message: "can you put gym at 5pm tomorrow?",
      currentDate: "2026-04-19",
      currentDateTime: "2026-04-19T10:30:00-07:00",
    }),
    parsedInput: null,
  });

  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(
    (result.proposals[0].payload as {
      taskText: string;
      taskDate: string | null;
      scheduledTime: string | null;
    }).taskText,
    "Gym",
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskText: string;
      taskDate: string | null;
      scheduledTime: string | null;
    }).taskDate,
    "2026-04-20",
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskText: string;
      taskDate: string | null;
      scheduledTime: string | null;
    }).scheduledTime,
    "17:00",
  );
});

Deno.test("uses ranked priorities for plan-my-day style reads", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Plan my day",
    plannerContext: {
      tasks: [
        {
          id: "task-1",
          title: "Ship landing page copy",
          taskDate: "2026-04-18",
          scheduledTime: "09:00",
          estimatedDuration: 60,
          difficulty: "hard",
          recurrencePattern: null,
          completed: false,
          priority: "high",
          epicId: "epic-1",
          epicTitle: "Website relaunch",
        },
      ],
      activeEpics: [
        {
          id: "epic-1",
          title: "Website relaunch",
          endDate: "2026-04-20",
          progressPercentage: 35,
          daysRemaining: 2,
          habitCount: 2,
        },
      ],
      priorityScores: [
        {
          id: "task:task-1",
          kind: "task",
          title: "Ship landing page copy",
          score: 88,
          reasons: ["due today", "supports a deadline-sensitive epic"],
          taskId: "task-1",
          epicId: "epic-1",
          targetDate: "2026-04-18",
          suggestedTime: "09:00",
        },
      ],
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertStringIncludes(result.reply, "Top ranked next moves");
  assertStringIncludes(result.reply, "Ship landing page copy");
});

Deno.test("drafts confirmable moves for free-me-up-after requests", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Free me up after 5",
    currentDate: "2026-04-18",
    plannerContext: {
      tasks: [
        {
          id: "task-1",
          title: "Prep investor update",
          taskDate: "2026-04-18",
          scheduledTime: "17:30",
          estimatedDuration: 45,
          difficulty: "hard",
          recurrencePattern: null,
          completed: false,
          priority: "medium",
        },
      ],
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals.length, 1);
  assertEquals(result.proposals[0].kind, "update_quest");
  assertEquals(
    (result.proposals[0].payload as {
      updates: { task_date: string };
    }).updates.task_date,
    "2026-04-19",
  );
});

Deno.test("drafts a lighter-day adjustment when energy is low", () => {
  const result = buildPlannerResponse(baseInput({
    message: "I'm tired today, make it light",
    currentDate: "2026-04-18",
    plannerContext: {
      tasks: [
        {
          id: "task-1",
          title: "Deep work block",
          taskDate: "2026-04-18",
          scheduledTime: "14:00",
          estimatedDuration: 90,
          difficulty: "hard",
          recurrencePattern: null,
          completed: false,
          priority: "medium",
        },
        {
          id: "task-2",
          title: "Inbox cleanup",
          taskDate: "2026-04-18",
          scheduledTime: "16:00",
          estimatedDuration: 30,
          difficulty: "easy",
          recurrencePattern: null,
          completed: false,
          priority: "low",
        },
      ],
      priorityScores: [
        {
          id: "task:task-1",
          kind: "task",
          title: "Deep work block",
          score: 80,
          reasons: ["due today"],
          taskId: "task-1",
          targetDate: "2026-04-18",
          suggestedTime: "14:00",
        },
        {
          id: "task:task-2",
          kind: "task",
          title: "Inbox cleanup",
          score: 32,
          reasons: ["can move cleanly"],
          taskId: "task-2",
          targetDate: "2026-04-18",
          suggestedTime: "16:00",
        },
      ],
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals[0].kind, "update_quest");
  assertStringIncludes(result.reply, "lighten today");
});

Deno.test("creates a relationship touch proposal with contact context", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Relationship touch",
    plannerContext: {
      contactsNeedingAttention: [
        {
          id: "contact-1",
          name: "Mom",
          daysSinceContact: 9,
          hasOverdueReminder: true,
          reminderReason: "Call back this week",
        },
      ],
      starterIntent: "relationship_touch",
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
            time: "18:00",
            endTime: "18:30",
            score: 88,
            reason: "Open after work",
          },
        ],
        moveSuggestions: [],
        summary: "The evening is pretty open.",
      },
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(
    (result.proposals[0].payload as { contactId: string }).contactId,
    "contact-1",
  );
  assertStringIncludes(result.proposals[0].title, "Mom");
});

Deno.test("keeps timing follow-ups for vague one-off placement requests without a concrete time", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Schedule gym tomorrow",
    currentDate: "2026-04-19",
    currentDateTime: "2026-04-19T10:30:00-07:00",
    parsedInput: {
      text: "gym",
      scheduledTime: null,
      scheduledDate: "2026-04-20",
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: "body",
      newTitle: null,
    },
  }));

  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.proposals[0].readyToConfirm, false);
  assertEquals(result.followUpQuestions.map((question) => question.field), [
    "time_of_day",
    "time_reason",
  ]);
});

Deno.test("treats concrete scheduled actions as quests even when the classifier says epic", () => {
  const result = buildPlannerResponse(baseInput({
    message: "study for the bar at 5 tomorrow",
    currentDate: "2026-04-19",
    currentDateTime: "2026-04-19T10:30:00-07:00",
    parsedInput: {
      text: "study for the bar",
      scheduledTime: "17:00",
      scheduledDate: "2026-04-20",
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
      confidence: 0.95,
      reasoning: "Long-term goal",
      suggestedDeadline: "2026-08-01",
    },
  }));

  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.followUpQuestions.length, 0);
});

Deno.test("recovers the quest title from the raw message when parsed text is scaffold-only", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Add workout to today's schedule for 3pm",
    parsedInput: {
      text: "Add to 's schedule for",
      scheduledTime: "15:00",
      scheduledDate: "2026-04-18",
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: "body",
      newTitle: null,
    },
  }));

  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.proposals[0].title, "Create Workout");
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(
    (result.proposals[0].payload as { taskText: string }).taskText,
    "Workout",
  );
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

Deno.test("uses suggest_reminder for reminder-only tweaks on existing quests", () => {
  const result = buildPlannerResponse(baseInput({
    message: "remind me 30 minutes before workout",
    parsedInput: {
      text: "workout",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: "body",
      newTitle: null,
    },
    plannerContext: {
      tasks: [{
        id: "task-1",
        title: "Workout",
        taskDate: "2026-04-20",
        scheduledTime: "17:00",
        estimatedDuration: 45,
        recurrencePattern: null,
      }],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [],
    },
  }));

  assertEquals(result.proposals[0].kind, "suggest_reminder");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(
    (result.proposals[0].payload as {
      updates: {
        reminder_enabled?: boolean;
        reminder_minutes_before?: number | null;
      };
    }).updates.reminder_enabled,
    true,
  );
  assertEquals(
    (result.proposals[0].payload as {
      updates: {
        reminder_enabled?: boolean;
        reminder_minutes_before?: number | null;
      };
    }).updates.reminder_minutes_before,
    30,
  );
});

Deno.test("uses update_ritual for reminder-only tweaks on existing rituals", () => {
  const result = buildPlannerResponse(baseInput({
    message: "remind me 10 minutes before morning pages",
    parsedInput: {
      text: "morning pages",
      scheduledTime: null,
      scheduledDate: null,
      estimatedDuration: null,
      recurrencePattern: null,
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
      recurrenceEndDate: null,
      notes: null,
      category: "mind",
      newTitle: null,
    },
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      activeEpics: [{
        id: "epic-1",
        title: "Creative Reset",
        endDate: "2026-06-15",
      }],
      rituals: [{
        id: "ritual-1",
        epicId: "epic-1",
        epicTitle: "Creative Reset",
        title: "Morning Pages",
        frequency: "daily",
        preferredTime: "08:00",
      }],
      calendarEvents: [],
    },
  }));

  assertEquals(result.proposals[0].kind, "update_ritual");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(
    (result.proposals[0].payload as {
      reminderEnabled?: boolean | null;
      reminderMinutesBefore?: number | null;
    }).reminderEnabled,
    true,
  );
  assertEquals(
    (result.proposals[0].payload as {
      reminderEnabled?: boolean | null;
      reminderMinutesBefore?: number | null;
    }).reminderMinutesBefore,
    10,
  );
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
  assertEquals(result.followUpQuestions.map((question) => question.field), []);
  assertEquals(result.proposals[0].readyToConfirm, true);
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
  assertEquals(result.followUpQuestions.map((question) => question.field), []);
  assertEquals(result.proposals[0].readyToConfirm, true);
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
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertStringIncludes(result.reply, "Today has room at 09:00");
});

Deno.test("does not jump straight to timing questions for broad day-planning asks", () => {
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

  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(result.proposals[0].readyToConfirm, true);
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

Deno.test("treats an empty route request like an open day with useful options", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Show me today's route.",
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [],
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.followUpQuestions.length, 0);
  assertStringIncludes(result.reply, "Your calendar's clear today.");
  assertStringIncludes(result.reply, "Momentum day");
  assertStringIncludes(result.reply, "Money day");
  assertStringIncludes(result.reply, "Reset day");
  assertEquals(result.reply.includes("time is all you got"), false);
  assertEquals(result.reply.includes("bullshit"), false);
});

Deno.test("reads upcoming named weekdays instead of falling back to today", () => {
  const result = buildPlannerResponse(baseInput({
    message: "How does my upcoming Saturday look?",
    currentDate: "2026-04-19",
    currentDateTime: "2026-04-19T09:30:00-07:00",
    parsedInput: {
      text: "How does my upcoming Saturday look?",
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
          title: "Long run",
          taskDate: "2026-04-25",
          scheduledTime: "09:00",
          estimatedDuration: 90,
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
  assertStringIncludes(result.reply, "Here's the shape of Saturday, April 25.");
  assertStringIncludes(result.reply, "Saturday, April 25:");
  assertStringIncludes(result.reply, "Long run");
  assertEquals(result.reply.includes("Here's the shape of today."), false);
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
  assertStringIncludes(result.reply, "Here's what I would protect first");
  assertStringIncludes(result.reply, "Today:");
  assertStringIncludes(result.reply, "Top ranked next moves");
  assertStringIncludes(result.reply, "Workout");
});

Deno.test("uses witty_sassy voice for empty-day route reads", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Show me today's route.",
    tonePack: "witty_sassy",
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [{
          date: "2026-04-18",
          totalMinutes: 0,
          taskCount: 0,
          status: "open",
        }],
        overloadedDates: [],
        emptyDates: ["2026-04-18"],
        conflicts: [],
        suggestedSlots: [],
        moveSuggestions: [],
        summary: "Today is open.",
      },
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertEquals(result.proposals.length, 0);
  assertStringIncludes(result.reply, "Your calendar is wide open today.");
  assertStringIncludes(result.reply, "time is all you got");
  assertStringIncludes(result.reply, "fake-busy performance");
});

Deno.test("uses witty_sassy voice for make-room reads on light days", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Help me make room for what matters.",
    tonePack: "witty_sassy",
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
        dayLoads: [{
          date: "2026-04-18",
          totalMinutes: 45,
          taskCount: 1,
          status: "balanced",
        }],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [{
          date: "2026-04-18",
          time: "09:00",
          endTime: "11:00",
          score: 90,
          reason: "Plenty of room left.",
        }],
        moveSuggestions: [],
        summary: "Today still has room to flex.",
      },
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertStringIncludes(result.reply, "Here's what I would protect first");
  assertStringIncludes(result.reply, "Top ranked next moves");
  assertStringIncludes(result.reply, "Workout");
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
  assertStringIncludes(result.reply, "Tomorrow");
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

Deno.test("uses witty_sassy voice for conversational planner replies", () => {
  const result = buildPlannerResponse(baseInput({
    message: "I'm feeling behind and I need help thinking clearly.",
    tonePack: "witty_sassy",
    classificationHint: {
      type: "brain-dump",
      confidence: 0.9,
      reasoning: "User is processing emotions, not asking for a saved action.",
    },
  }));

  assertEquals(result.mode, "conversational");
  assertEquals(result.proposals.length, 0);
  assertStringIncludes(result.reply, "I'm with you");
  assertStringIncludes(result.reply, "point at the bullshit");
});

Deno.test("uses witty_sassy voice for proposal replies without implying the draft is already saved", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Call mom",
    tonePack: "witty_sassy",
    plannerContext: {
      tasks: [],
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

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertStringIncludes(result.reply, "spare me the fake ceremony");
  assertEquals(result.reply.includes("already saved"), false);
});
