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
    pendingStarterIntent: null,
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
    'Create a quest for "Grab Lunch With Zach" on 2026-04-19 at 1:00 pm.',
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

Deno.test("prefers the timed clause over later untimed asks for scheduled quest drafts", () => {
  const result = buildPlannerResponse(baseInput({
    message:
      "I have a sales meeting at 4 today. This rest of my 9-5 I want to fill with other outside sales fitting tasks. I also want to get in a workout and work on coding the app later - you'd be able to do that?",
    currentDate: "2026-04-20",
    currentDateTime: "2026-04-20T08:37:00-07:00",
    parsedInput: {
      text:
        "I have a sales meeting . This rest of my I want to fill with other outside sales fitting tasks. I also want to get in a workout and work on coding the app later - you'd be able to do that",
      scheduledTime: "16:00",
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
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.proposals[0].title, "Create Sales Meeting");
  assertEquals(
    (result.proposals[0].payload as {
      taskText: string;
      scheduledTime: string | null;
      category?: string | null;
    }).taskText,
    "Sales Meeting",
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskText: string;
      scheduledTime: string | null;
      category?: string | null;
    }).scheduledTime,
    "16:00",
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskText: string;
      scheduledTime: string | null;
      category?: string | null;
    }).category,
    undefined,
  );
});

Deno.test("lets a fresh task title override an unsaved draft instead of reusing it", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Workout",
    currentDate: "2026-04-20",
    currentDateTime: "2026-04-20T09:00:00-07:00",
    sessionState: {
      draft: {
        title: "Write for my newsletter",
        scheduledTime: "08:00",
        draftKind: "create_quest",
      },
      openQuestionIds: ["time_of_day", "time_reason"],
      preferredTimeOfDay: null,
      preferredTimeReason: null,
      reminderPreference: null,
      lastClassification: "quest",
    },
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
  }));

  assertEquals(result.proposals[0].title, "Create workout");
  assertEquals(
    (result.proposals[0].payload as { taskText: string }).taskText,
    "workout",
  );
  assertEquals(result.reply.includes("saved calendar event"), false);
});

Deno.test("lets a fresh scheduled request override an unsaved draft instead of merging into it", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Workout at 5 today",
    currentDate: "2026-04-20",
    currentDateTime: "2026-04-20T09:00:00-07:00",
    sessionState: {
      draft: {
        title: "Write for my newsletter",
        scheduledTime: "08:00",
        draftKind: "create_quest",
      },
      openQuestionIds: ["time_of_day", "time_reason"],
      preferredTimeOfDay: null,
      preferredTimeReason: null,
      reminderPreference: null,
      lastClassification: "quest",
    },
    parsedInput: {
      text: "workout",
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

  assertEquals(result.proposals[0].title, "Create Workout");
  assertEquals(
    (result.proposals[0].payload as {
      taskText: string;
      scheduledTime: string | null;
    }).taskText,
    "Workout",
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskText: string;
      scheduledTime: string | null;
    }).scheduledTime,
    "17:00",
  );
  assertEquals(result.reply.includes("saved calendar event"), false);
});

Deno.test("calls out saved calendar conflicts for scheduled quest drafts", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Sales meeting at 4 today",
    currentDate: "2026-04-20",
    currentDateTime: "2026-04-20T08:37:00-07:00",
    parsedInput: {
      text: "sales meeting",
      scheduledTime: "16:00",
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
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [{
        id: "event-1",
        title: "Client Call",
        start: "2026-04-20T16:00:00-07:00",
        end: "2026-04-20T17:00:00-07:00",
        isAllDay: false,
        provider: "google",
        readOnly: true,
      }],
    },
  }));

  assertEquals(result.proposals[0].title, "Create Sales Meeting");
  assertStringIncludes(result.reply, 'saved calendar event "Client Call"');
  assertStringIncludes(result.reply, "4:00 pm");
});

Deno.test("calls out saved calendar conflicts for explicit future drafts using the user's offset", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Workout on April 23, 2026 at 6:00 pm",
    currentDate: "2026-04-20",
    currentDateTime: "2026-04-20T08:37:00-07:00",
    horizon: "week",
    parsedInput: {
      text: "workout",
      scheduledTime: "18:00",
      scheduledDate: "2026-04-23",
      estimatedDuration: 45,
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
      tasks: [],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [{
        id: "event-1",
        title: "Dinner Reservation",
        start: "2026-04-23T18:15:00-07:00",
        end: "2026-04-23T19:00:00-07:00",
        isAllDay: false,
        provider: "google",
        readOnly: true,
      }],
      scheduleInsights: {
        horizon: "week",
        selectedDate: "2026-04-23",
        dayLoads: [{
          date: "2026-04-23",
          totalMinutes: 240,
          taskCount: 4,
          status: "busy",
        }],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [],
        moveSuggestions: [],
        summary: "Thursday is fairly busy.",
      },
    },
  }));

  assertEquals(result.proposals[0].title, "Create Workout");
  assertStringIncludes(
    result.reply,
    'saved calendar event "Dinner Reservation"',
  );
  assertStringIncludes(result.reply, "6:15 pm-7:00 pm");
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
    'Create a quest for "Gym" on 2026-04-20 at 5:00 pm.',
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

Deno.test("plan_day starter returns direct quest drafts with structured output", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Plan my day",
    parsedInput: {
      text: "Plan my day",
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
      starterIntent: "plan_day",
      tasks: [
        {
          id: "task-scheduled-1",
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
      rituals: [
        {
          id: "ritual-1",
          epicId: "epic-1",
          epicTitle: "Website relaunch",
          title: "Morning review",
          frequency: "daily",
          preferredTime: "10:30",
          currentStreak: 3,
        },
      ],
      contactsNeedingAttention: [
        {
          id: "contact-1",
          name: "Mom",
          daysSinceContact: 9,
          hasOverdueReminder: true,
          reminderReason: "Check in this week",
        },
      ],
      priorityScores: [
        {
          id: "ritual:ritual-1",
          kind: "ritual",
          title: "Morning review",
          score: 88,
          reasons: ["Keeps the relaunch moving early."],
          ritualId: "ritual-1",
          epicId: "epic-1",
          targetDate: "2026-04-18",
          suggestedTime: "10:30",
        },
        {
          id: "epic:epic-1",
          kind: "epic",
          title: "Website relaunch",
          score: 84,
          reasons: ["Deadline-sensitive progress still matters today."],
          epicId: "epic-1",
          targetDate: "2026-04-18",
          suggestedTime: "13:00",
        },
        {
          id: "contact:contact-1",
          kind: "contact",
          title: "Mom",
          score: 68,
          reasons: ["A quick touch keeps an overdue relationship warm."],
          contactId: "contact-1",
          targetDate: "2026-04-18",
          suggestedTime: "17:00",
        },
      ],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [
          {
            date: "2026-04-18",
            totalMinutes: 120,
            taskCount: 1,
            status: "balanced",
          },
        ],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-18",
            time: "10:30",
            endTime: "11:00",
            score: 86,
            reason: "Open mid-morning slot",
          },
          {
            date: "2026-04-18",
            time: "13:00",
            endTime: "13:45",
            score: 82,
            reason: "Open early afternoon slot",
          },
          {
            date: "2026-04-18",
            time: "17:00",
            endTime: "17:15",
            score: 76,
            reason: "Quick open check-in window",
          },
        ],
        moveSuggestions: [],
        summary: "Today still has room around your fixed commitments.",
      },
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals.length > 0, true);
  assertEquals(result.proposals[0]?.kind, "create_quest");
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(result.sessionState.pendingStarterIntent ?? null, null);
  assertEquals(result.sessionState.openQuestionIds, []);
  assertEquals(result.structuredResponse?.planDay !== null, true);
  assertEquals(
    result.structuredResponse?.planDay?.suggestedQuests.length ===
      result.proposals.length,
    true,
  );
  assertEquals(
    (result.structuredResponse?.planDay?.suggestedQuests.length ?? 0) <= 5,
    true,
  );
  assertStringIncludes(result.reply, "I drafted");
});

Deno.test("plan_day trims draft count in recovery mode when the day has room", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Plan my day",
    parsedInput: {
      text: "Plan my day",
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
      starterIntent: "plan_day",
      plannerMemory: {
        workloadTolerance: "light",
      },
      tasks: [
        {
          id: "task-1",
          title: "Outline launch email",
          taskDate: null,
          scheduledTime: null,
          estimatedDuration: 45,
          difficulty: "medium",
          recurrencePattern: null,
          completed: false,
          priority: "high",
        },
        {
          id: "task-2",
          title: "Reply to support queue",
          taskDate: null,
          scheduledTime: null,
          estimatedDuration: 20,
          difficulty: "easy",
          recurrencePattern: null,
          completed: false,
          priority: "medium",
        },
        {
          id: "task-3",
          title: "Update roadmap notes",
          taskDate: null,
          scheduledTime: null,
          estimatedDuration: 30,
          difficulty: "medium",
          recurrencePattern: null,
          completed: false,
          priority: "medium",
        },
        {
          id: "task-4",
          title: "Book haircut",
          taskDate: null,
          scheduledTime: null,
          estimatedDuration: 15,
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
          title: "Outline launch email",
          score: 86,
          reasons: ["Moves launch prep forward."],
          taskId: "task-1",
          targetDate: "2026-04-18",
          suggestedTime: "10:00",
        },
        {
          id: "task:task-2",
          kind: "task",
          title: "Reply to support queue",
          score: 74,
          reasons: ["A quick admin win keeps momentum steady."],
          taskId: "task-2",
          targetDate: "2026-04-18",
          suggestedTime: "11:30",
        },
        {
          id: "task:task-3",
          kind: "task",
          title: "Update roadmap notes",
          score: 70,
          reasons: ["Keeps current projects connected."],
          taskId: "task-3",
          targetDate: "2026-04-18",
          suggestedTime: "13:00",
        },
        {
          id: "task:task-4",
          kind: "task",
          title: "Book haircut",
          score: 62,
          reasons: ["Low effort and easy to clear."],
          taskId: "task-4",
          targetDate: "2026-04-18",
          suggestedTime: "16:00",
        },
      ],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [
          {
            date: "2026-04-18",
            totalMinutes: 0,
            taskCount: 0,
            status: "open",
          },
        ],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-18",
            time: "10:00",
            endTime: "10:45",
            score: 88,
            reason: "Plenty of room for a focused start.",
          },
        ],
        moveSuggestions: [],
        summary: "Today is open enough to stay selective.",
      },
    },
  }));

  assertEquals(result.proposals.length, 3);
  assertEquals(result.structuredResponse?.planDay?.suggestedQuests.length, 3);
});

Deno.test("plan_day turns campaign pressure into a linked concrete quest draft", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Plan my day",
    parsedInput: {
      text: "Plan my day",
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
      starterIntent: "plan_day",
      activeEpics: [
        {
          id: "epic-plan-1",
          title: "Founder relaunch",
          endDate: "2026-04-24",
          progressPercentage: 30,
          daysRemaining: 6,
        },
      ],
      tasks: [
        {
          id: "task-plan-1",
          title: "Rewrite relaunch offer",
          taskDate: null,
          scheduledTime: null,
          estimatedDuration: 60,
          recurrencePattern: null,
          completed: false,
          priority: "high",
          epicId: "epic-plan-1",
          epicTitle: "Founder relaunch",
        },
      ],
      priorityScores: [
        {
          id: "epic:epic-plan-1",
          kind: "epic",
          title: "Founder relaunch",
          score: 91,
          reasons: ["This campaign needs a concrete push before the deadline tightens."],
          epicId: "epic-plan-1",
        },
      ],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [
          {
            date: "2026-04-18",
            totalMinutes: 0,
            taskCount: 0,
            status: "open",
          },
        ],
        overloadedDates: [],
        emptyDates: ["2026-04-18"],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-18",
            time: "10:30",
            endTime: "11:30",
            score: 90,
            reason: "Open focus slot for campaign work.",
          },
        ],
        moveSuggestions: [],
        summary: "You have room for real work today.",
      },
    },
  }));

  assertEquals(result.mode, "proposal");
  assertStringIncludes(result.proposals[0].title, "Rewrite relaunch offer");
  assertEquals(
    (result.proposals[0].payload as { epicId?: string | null }).epicId,
    "epic-plan-1",
  );
});

Deno.test("plan_day expands draft count in lock-in mode when there is room to add more", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Plan my day",
    parsedInput: {
      text: "Plan my day",
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
      starterIntent: "plan_day",
      plannerMemory: {
        workloadTolerance: "heavy",
      },
      tasks: [
        {
          id: "task-scheduled-1",
          title: "Standup prep",
          taskDate: "2026-04-18",
          scheduledTime: "09:00",
          estimatedDuration: 30,
          difficulty: "medium",
          recurrencePattern: null,
          completed: false,
          priority: "medium",
        },
        {
          id: "task-1",
          title: "Outline launch email",
          taskDate: null,
          scheduledTime: null,
          estimatedDuration: 45,
          difficulty: "medium",
          recurrencePattern: null,
          completed: false,
          priority: "high",
        },
        {
          id: "task-2",
          title: "Reply to support queue",
          taskDate: null,
          scheduledTime: null,
          estimatedDuration: 20,
          difficulty: "easy",
          recurrencePattern: null,
          completed: false,
          priority: "medium",
        },
        {
          id: "task-3",
          title: "Update roadmap notes",
          taskDate: null,
          scheduledTime: null,
          estimatedDuration: 30,
          difficulty: "medium",
          recurrencePattern: null,
          completed: false,
          priority: "medium",
        },
        {
          id: "task-4",
          title: "Refine onboarding copy",
          taskDate: null,
          scheduledTime: null,
          estimatedDuration: 45,
          difficulty: "hard",
          recurrencePattern: null,
          completed: false,
          priority: "high",
        },
      ],
      priorityScores: [
        {
          id: "task:task-1",
          kind: "task",
          title: "Outline launch email",
          score: 86,
          reasons: ["Moves launch prep forward."],
          taskId: "task-1",
          targetDate: "2026-04-18",
          suggestedTime: "10:00",
        },
        {
          id: "task:task-2",
          kind: "task",
          title: "Reply to support queue",
          score: 74,
          reasons: ["A quick admin win keeps momentum steady."],
          taskId: "task-2",
          targetDate: "2026-04-18",
          suggestedTime: "11:30",
        },
        {
          id: "task:task-3",
          kind: "task",
          title: "Update roadmap notes",
          score: 70,
          reasons: ["Keeps current projects connected."],
          taskId: "task-3",
          targetDate: "2026-04-18",
          suggestedTime: "13:00",
        },
        {
          id: "task:task-4",
          kind: "task",
          title: "Refine onboarding copy",
          score: 68,
          reasons: ["Fits a stronger focus window."],
          taskId: "task-4",
          targetDate: "2026-04-18",
          suggestedTime: "15:00",
        },
      ],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [
          {
            date: "2026-04-18",
            totalMinutes: 30,
            taskCount: 1,
            status: "open",
          },
        ],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-18",
            time: "10:00",
            endTime: "10:45",
            score: 88,
            reason: "Plenty of room for another strong block.",
          },
        ],
        moveSuggestions: [],
        summary: "Today still has capacity for a heavier push.",
      },
    },
  }));

  assertEquals(result.proposals.length, 4);
  assertEquals(result.structuredResponse?.planDay?.suggestedQuests.length, 4);
});

Deno.test("turns a clear plan-day focus reply into confirmable quest drafts", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Work on my app",
    parsedInput: {
      text: "Work on my app",
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
      pendingStarterIntent: "plan_day",
      openQuestionIds: ["details"],
    },
    plannerContext: {
      tasks: [
        {
          id: "task-scheduled-1",
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
      rituals: [
        {
          id: "ritual-1",
          epicId: "epic-1",
          epicTitle: "Website relaunch",
          title: "Morning review",
          frequency: "daily",
          preferredTime: "10:30",
          currentStreak: 3,
        },
      ],
      contactsNeedingAttention: [
        {
          id: "contact-1",
          name: "Mom",
          daysSinceContact: 9,
          hasOverdueReminder: true,
          reminderReason: "Check in this week",
        },
      ],
      priorityScores: [
        {
          id: "ritual:ritual-1",
          kind: "ritual",
          title: "Morning review",
          score: 88,
          reasons: ["Keeps the relaunch moving early."],
          ritualId: "ritual-1",
          epicId: "epic-1",
          targetDate: "2026-04-18",
          suggestedTime: "10:30",
        },
        {
          id: "epic:epic-1",
          kind: "epic",
          title: "Website relaunch",
          score: 84,
          reasons: ["Deadline-sensitive progress still matters today."],
          epicId: "epic-1",
          targetDate: "2026-04-18",
          suggestedTime: "13:00",
        },
        {
          id: "contact:contact-1",
          kind: "contact",
          title: "Mom",
          score: 68,
          reasons: ["A quick touch keeps an overdue relationship warm."],
          contactId: "contact-1",
          targetDate: "2026-04-18",
          suggestedTime: "17:00",
        },
      ],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [
          {
            date: "2026-04-18",
            totalMinutes: 120,
            taskCount: 1,
            status: "balanced",
          },
        ],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-18",
            time: "10:30",
            endTime: "11:00",
            score: 86,
            reason: "Open mid-morning slot",
          },
          {
            date: "2026-04-18",
            time: "13:00",
            endTime: "13:45",
            score: 82,
            reason: "Open early afternoon slot",
          },
          {
            date: "2026-04-18",
            time: "17:00",
            endTime: "17:15",
            score: 76,
            reason: "Quick open check-in window",
          },
        ],
        moveSuggestions: [],
        summary: "Today still has room around your fixed commitments.",
      },
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(result.proposals.length, 3);
  assertEquals(
    result.proposals.every((proposal) =>
      proposal.kind === "create_quest" && proposal.readyToConfirm
    ),
    true,
  );
  assertEquals(result.sessionState.pendingStarterIntent, null);
  assertStringIncludes(result.reply, "Got it");
  assertStringIncludes(result.reply, "I drafted 3 quests for today");
  assertEquals(
    (result.proposals[0]?.payload as {
      taskText: string;
    }).taskText,
    "Work On My App",
  );
});

Deno.test("drafts from a vague directional plan-day reply without asking a second question", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Something active",
    parsedInput: {
      text: "Something active",
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
      pendingStarterIntent: "plan_day",
      openQuestionIds: ["details"],
    },
    plannerContext: {
      tasks: [],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      priorityScores: [
        {
          id: "recovery:reset",
          kind: "recovery",
          title: "Recovery reset",
          score: 72,
          reasons: ["A movement block would help today."],
          targetDate: "2026-04-18",
          suggestedTime: "18:00",
        },
      ],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [
          {
            date: "2026-04-18",
            totalMinutes: 0,
            taskCount: 0,
            status: "open",
          },
        ],
        overloadedDates: [],
        emptyDates: ["2026-04-18"],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-18",
            time: "18:00",
            endTime: "18:30",
            score: 80,
            reason: "Open evening movement block",
          },
        ],
        moveSuggestions: [],
        summary: "Today is open.",
      },
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(result.proposals.length, 1);
  assertStringIncludes(result.reply, "Got it");
  assertEquals(
    (result.proposals[0]?.payload as {
      taskText: string;
    }).taskText,
    "Recovery reset",
  );
});

Deno.test("raises the plan-day target for coasting users on a normal day", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Plan my day",
    parsedInput: {
      text: "Plan my day",
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
    currentDateTime: "2026-04-18T08:15:00-07:00",
    sessionState: {
      pendingStarterIntent: "plan_day",
    },
    plannerContext: {
      tasks: [
        {
          id: "task-scheduled-1",
          title: "Investor review",
          taskDate: "2026-04-18",
          scheduledTime: "09:00",
          estimatedDuration: 60,
          difficulty: "hard",
          recurrencePattern: null,
          completed: false,
          priority: "high",
        },
        {
          id: "task-scheduled-2",
          title: "Team sync prep",
          taskDate: "2026-04-18",
          scheduledTime: "11:00",
          estimatedDuration: 30,
          difficulty: "medium",
          recurrencePattern: null,
          completed: false,
          priority: "medium",
        },
      ],
      activeEpics: [
        {
          id: "epic-1",
          title: "Website relaunch",
          endDate: "2026-04-20",
        },
      ],
      rituals: [
        {
          id: "ritual-1",
          epicId: "epic-1",
          epicTitle: "Website relaunch",
          title: "Morning review",
          frequency: "daily",
          preferredTime: "12:30",
        },
      ],
      contactsNeedingAttention: [
        {
          id: "contact-1",
          name: "Mom",
          daysSinceContact: 9,
          hasOverdueReminder: true,
        },
      ],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [
          {
            date: "2026-04-18",
            totalMinutes: 150,
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
            time: "12:30",
            endTime: "13:00",
            score: 80,
            reason: "Open lunch edge",
          },
          {
            date: "2026-04-18",
            time: "14:00",
            endTime: "14:45",
            score: 84,
            reason: "Clear afternoon block",
          },
          {
            date: "2026-04-18",
            time: "17:30",
            endTime: "18:00",
            score: 77,
            reason: "Open evening check-in slot",
          },
        ],
        moveSuggestions: [],
        summary: "Today still has room around your fixed commitments.",
      },
      statInterpretation: {
        statProfile: {
          scores: {
            vitality: 450,
            wisdom: 480,
            discipline: 520,
            resolve: 470,
            creativity: 410,
            alignment: 465,
          },
          dominantStat: "discipline",
          secondaryStat: "wisdom",
        },
        statNeeds: {
          vitality: { level: "low", reasons: [] },
          wisdom: { level: "low", reasons: [] },
          discipline: { level: "low", reasons: [] },
          resolve: { level: "low", reasons: [] },
          creativity: { level: "low", reasons: [] },
          alignment: { level: "low", reasons: [] },
        },
        momentumState: "coasting",
        recentMissInterpretation: "normal_variance",
        narrativeBrief: "You're holding the line.",
        dailyNarrative: "Steady day",
      },
      priorityScores: [
        {
          id: "ritual:ritual-1",
          kind: "ritual",
          title: "Morning review",
          score: 88,
          reasons: ["Keeps the relaunch moving."],
          ritualId: "ritual-1",
          epicId: "epic-1",
          targetDate: "2026-04-18",
          suggestedTime: "12:30",
        },
        {
          id: "epic:epic-1",
          kind: "epic",
          title: "Website relaunch",
          score: 82,
          reasons: ["A progress block will keep momentum steady."],
          epicId: "epic-1",
          targetDate: "2026-04-18",
          suggestedTime: "14:00",
        },
        {
          id: "contact:contact-1",
          kind: "contact",
          title: "Mom",
          score: 70,
          reasons: ["Quick relationship maintenance fits today."],
          contactId: "contact-1",
          targetDate: "2026-04-18",
          suggestedTime: "17:30",
        },
      ],
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals.length, 3);
});

Deno.test("raises the plan-day target to six for locked-in users without exceeding four new quests", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Plan my day",
    parsedInput: {
      text: "Plan my day",
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
      pendingStarterIntent: "plan_day",
    },
    plannerContext: {
      tasks: [
        {
          id: "task-scheduled-1",
          title: "Investor review",
          taskDate: "2026-04-18",
          scheduledTime: "09:00",
          estimatedDuration: 60,
          difficulty: "hard",
          recurrencePattern: null,
          completed: false,
          priority: "high",
        },
        {
          id: "task-scheduled-2",
          title: "Team sync prep",
          taskDate: "2026-04-18",
          scheduledTime: "11:00",
          estimatedDuration: 30,
          difficulty: "medium",
          recurrencePattern: null,
          completed: false,
          priority: "medium",
        },
      ],
      activeEpics: [
        {
          id: "epic-1",
          title: "Website relaunch",
          endDate: "2026-04-20",
        },
      ],
      rituals: [
        {
          id: "ritual-1",
          epicId: "epic-1",
          epicTitle: "Website relaunch",
          title: "Morning review",
          frequency: "daily",
          preferredTime: "12:30",
        },
      ],
      contactsNeedingAttention: [
        {
          id: "contact-1",
          name: "Mom",
          daysSinceContact: 9,
          hasOverdueReminder: true,
        },
      ],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [
          {
            date: "2026-04-18",
            totalMinutes: 150,
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
            time: "12:30",
            endTime: "13:00",
            score: 80,
            reason: "Open lunch edge",
          },
          {
            date: "2026-04-18",
            time: "14:00",
            endTime: "14:45",
            score: 84,
            reason: "Clear afternoon block",
          },
          {
            date: "2026-04-18",
            time: "17:30",
            endTime: "18:00",
            score: 77,
            reason: "Open evening check-in slot",
          },
          {
            date: "2026-04-18",
            time: "19:00",
            endTime: "19:30",
            score: 72,
            reason: "Open evening reset block",
          },
        ],
        moveSuggestions: [],
        summary: "Today still has room around your fixed commitments.",
      },
      statInterpretation: {
        statProfile: {
          scores: {
            vitality: 450,
            wisdom: 480,
            discipline: 520,
            resolve: 470,
            creativity: 410,
            alignment: 465,
          },
          dominantStat: "discipline",
          secondaryStat: "wisdom",
        },
        statNeeds: {
          vitality: { level: "low", reasons: [] },
          wisdom: { level: "low", reasons: [] },
          discipline: { level: "low", reasons: [] },
          resolve: { level: "low", reasons: [] },
          creativity: { level: "low", reasons: [] },
          alignment: { level: "low", reasons: [] },
        },
        momentumState: "locked_in",
        recentMissInterpretation: "normal_variance",
        narrativeBrief: "You're in a solid rhythm.",
        dailyNarrative: "Locked-in day",
      },
      priorityScores: [
        {
          id: "ritual:ritual-1",
          kind: "ritual",
          title: "Morning review",
          score: 88,
          reasons: ["Keeps the relaunch moving."],
          ritualId: "ritual-1",
          epicId: "epic-1",
          targetDate: "2026-04-18",
          suggestedTime: "12:30",
        },
        {
          id: "epic:epic-1",
          kind: "epic",
          title: "Website relaunch",
          score: 82,
          reasons: ["A progress block will keep momentum steady."],
          epicId: "epic-1",
          targetDate: "2026-04-18",
          suggestedTime: "14:00",
        },
        {
          id: "contact:contact-1",
          kind: "contact",
          title: "Mom",
          score: 70,
          reasons: ["Quick relationship maintenance fits today."],
          contactId: "contact-1",
          targetDate: "2026-04-18",
          suggestedTime: "17:30",
        },
        {
          id: "recovery:reset",
          kind: "recovery",
          title: "Recovery reset",
          score: 64,
          reasons: ["A recovery block keeps the streak sustainable."],
          targetDate: "2026-04-18",
          suggestedTime: "19:00",
        },
      ],
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals.length, 4);
});

Deno.test("does not ramp the plan-day target on overloaded days", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Plan my day",
    parsedInput: {
      text: "Plan my day",
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
      pendingStarterIntent: "plan_day",
    },
    plannerContext: {
      tasks: [
        {
          id: "task-scheduled-1",
          title: "Investor review",
          taskDate: "2026-04-18",
          scheduledTime: "09:00",
          estimatedDuration: 60,
          difficulty: "hard",
          recurrencePattern: null,
          completed: false,
          priority: "high",
        },
        {
          id: "task-scheduled-2",
          title: "Team sync prep",
          taskDate: "2026-04-18",
          scheduledTime: "11:00",
          estimatedDuration: 30,
          difficulty: "medium",
          recurrencePattern: null,
          completed: false,
          priority: "medium",
        },
      ],
      activeEpics: [
        {
          id: "epic-1",
          title: "Website relaunch",
          endDate: "2026-04-20",
        },
      ],
      rituals: [
        {
          id: "ritual-1",
          epicId: "epic-1",
          epicTitle: "Website relaunch",
          title: "Morning review",
          frequency: "daily",
          preferredTime: "12:30",
        },
      ],
      contactsNeedingAttention: [
        {
          id: "contact-1",
          name: "Mom",
          daysSinceContact: 9,
          hasOverdueReminder: true,
        },
      ],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [
          {
            date: "2026-04-18",
            totalMinutes: 330,
            taskCount: 6,
            status: "overloaded",
          },
        ],
        overloadedDates: ["2026-04-18"],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-18",
            time: "12:30",
            endTime: "13:00",
            score: 80,
            reason: "One narrow lunch edge",
          },
          {
            date: "2026-04-18",
            time: "17:30",
            endTime: "18:00",
            score: 77,
            reason: "One evening slot",
          },
          {
            date: "2026-04-18",
            time: "19:00",
            endTime: "19:30",
            score: 72,
            reason: "Short recovery slot",
          },
          {
            date: "2026-04-18",
            time: "20:00",
            endTime: "20:30",
            score: 68,
            reason: "Late catch-up slot",
          },
        ],
        moveSuggestions: [],
        summary: "Today is already pretty packed.",
      },
      statInterpretation: {
        statProfile: {
          scores: {
            vitality: 450,
            wisdom: 480,
            discipline: 520,
            resolve: 470,
            creativity: 410,
            alignment: 465,
          },
          dominantStat: "discipline",
          secondaryStat: "wisdom",
        },
        statNeeds: {
          vitality: { level: "low", reasons: [] },
          wisdom: { level: "low", reasons: [] },
          discipline: { level: "low", reasons: [] },
          resolve: { level: "low", reasons: [] },
          creativity: { level: "low", reasons: [] },
          alignment: { level: "low", reasons: [] },
        },
        momentumState: "locked_in",
        recentMissInterpretation: "normal_variance",
        narrativeBrief: "You're in a solid rhythm.",
        dailyNarrative: "Locked-in day",
      },
      priorityScores: [
        {
          id: "ritual:ritual-1",
          kind: "ritual",
          title: "Morning review",
          score: 88,
          reasons: ["Keeps the relaunch moving."],
          ritualId: "ritual-1",
          epicId: "epic-1",
          targetDate: "2026-04-18",
          suggestedTime: "12:30",
        },
        {
          id: "epic:epic-1",
          kind: "epic",
          title: "Website relaunch",
          score: 82,
          reasons: ["A progress block will keep momentum steady."],
          epicId: "epic-1",
          targetDate: "2026-04-18",
          suggestedTime: "17:30",
        },
        {
          id: "contact:contact-1",
          kind: "contact",
          title: "Mom",
          score: 70,
          reasons: ["Quick relationship maintenance fits today."],
          contactId: "contact-1",
          targetDate: "2026-04-18",
          suggestedTime: "19:00",
        },
        {
          id: "recovery:reset",
          kind: "recovery",
          title: "Recovery reset",
          score: 64,
          reasons: ["A recovery block keeps the streak sustainable."],
          targetDate: "2026-04-18",
          suggestedTime: "20:00",
        },
      ],
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals.length, 2);
});

Deno.test("drafts fewer plan-day quests when clean slots run out", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Write newsletter",
    sessionState: {
      pendingStarterIntent: "plan_day",
    },
    parsedInput: {
      text: "Write newsletter",
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
      activeEpics: [
        {
          id: "epic-1",
          title: "Website relaunch",
          endDate: "2026-04-20",
        },
      ],
      contactsNeedingAttention: [
        {
          id: "contact-1",
          name: "Mom",
          daysSinceContact: 9,
          hasOverdueReminder: true,
        },
      ],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [
          {
            date: "2026-04-18",
            totalMinutes: 30,
            taskCount: 0,
            status: "open",
          },
        ],
        overloadedDates: [],
        emptyDates: ["2026-04-18"],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-18",
            time: "11:00",
            endTime: "11:30",
            score: 86,
            reason: "One clean opening before noon",
          },
        ],
        moveSuggestions: [],
        summary: "Today has one clean opening before noon.",
      },
      priorityScores: [
        {
          id: "epic:epic-1",
          kind: "epic",
          title: "Website relaunch",
          score: 82,
          reasons: ["A progress block would help."],
          epicId: "epic-1",
          targetDate: "2026-04-18",
          suggestedTime: "13:00",
        },
        {
          id: "contact:contact-1",
          kind: "contact",
          title: "Mom",
          score: 70,
          reasons: ["A quick relationship touch fits later."],
          contactId: "contact-1",
          targetDate: "2026-04-18",
          suggestedTime: "17:00",
        },
      ],
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals.length, 3);
  assertEquals(result.proposals[0].title, "Create Write Newsletter");
  assertEquals(
    (result.proposals[1]?.payload as {
      taskDate?: string | null;
    }).taskDate,
    "2026-04-18",
  );
  assertEquals(
    (result.proposals[2]?.payload as {
      taskDate?: string | null;
    }).taskDate,
    "2026-04-18",
  );
  assertEquals(result.sessionState.pendingStarterIntent, null);
  assertStringIncludes(result.reply, "I drafted 3 quests");
});

Deno.test("drafts one proposal per extracted action in aggressive bundle mode", () => {
  const result = buildPlannerResponse(baseInput({
    message:
      "I want to clean my house, work on building the app, and workout later",
    parsedInput: {
      text:
        "I want to clean my house, work on building the app, and workout later",
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
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [{
          date: "2026-04-18",
          totalMinutes: 60,
          taskCount: 1,
          status: "balanced",
        }],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-18",
            time: "17:30",
            endTime: "18:30",
            score: 80,
            reason: "Open after-work slot",
          },
          {
            date: "2026-04-18",
            time: "18:45",
            endTime: "20:15",
            score: 78,
            reason: "Focus block after dinner",
          },
          {
            date: "2026-04-18",
            time: "20:15",
            endTime: "21:15",
            score: 72,
            reason: "Late workout window",
          },
        ],
        moveSuggestions: [],
        summary: "Today still has room around your fixed commitments.",
      },
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals.length, 3);
  assertEquals(
    result.proposals.every((proposal) => proposal.kind === "create_quest"),
    true,
  );
  assertStringIncludes(result.reply, "I drafted 3 quests");
  assertEquals(
    result.proposals.map((proposal) => proposal.title),
    [
      "Create Clean My House",
      "Create Work On Building The App",
      "Create Workout",
    ],
  );
});

Deno.test("keeps calendar conflict notes on plan-day quest drafts", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Sales meeting at 4 today",
    currentDate: "2026-04-20",
    currentDateTime: "2026-04-20T08:37:00-07:00",
    sessionState: {
      pendingStarterIntent: "plan_day",
    },
    parsedInput: {
      text: "sales meeting",
      scheduledTime: "16:00",
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
    plannerContext: {
      calendarEvents: [{
        id: "event-1",
        title: "Client Call",
        start: "2026-04-20T16:00:00-07:00",
        end: "2026-04-20T17:00:00-07:00",
        isAllDay: false,
        provider: "google",
        readOnly: true,
      }],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-20",
        dayLoads: [],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [],
        moveSuggestions: [],
        summary: "Today still has room around your fixed commitments.",
      },
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals.length, 1);
  assertEquals(result.proposals[0].title, "Create Sales Meeting");
  assertEquals(result.sessionState.pendingStarterIntent, null);
  assertStringIncludes(result.reply, 'saved calendar event "Client Call"');
  assertStringIncludes(result.reply, "4:00 pm");
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
  assertStringIncludes(result.reply, "lightening today");
  assertEquals(result.structuredResponse?.dayAdjust !== null, true);
  assertEquals(
    (result.structuredResponse?.dayAdjust?.move.length ?? 0) > 0,
    true,
  );
});

Deno.test("right_now_start returns one structured next action for the current window", () => {
  const result = buildPlannerResponse(baseInput({
    message: "What should I do right now?",
    currentDate: "2026-04-18",
    currentDateTime: "2026-04-18T10:30:00-07:00",
    plannerContext: {
      starterIntent: "right_now_start",
      tasks: [
        {
          id: "task-1",
          title: "Outline launch email",
          taskDate: "2026-04-18",
          scheduledTime: null,
          estimatedDuration: 30,
          difficulty: "medium",
          recurrencePattern: null,
          completed: false,
          priority: "high",
          epicId: "epic-1",
          epicTitle: "Launch prep",
        },
        {
          id: "task-2",
          title: "Team sync",
          taskDate: "2026-04-18",
          scheduledTime: "11:30",
          estimatedDuration: 30,
          difficulty: "easy",
          recurrencePattern: null,
          completed: false,
          priority: "medium",
        },
      ],
      priorityScores: [
        {
          id: "task:task-1",
          kind: "task",
          title: "Outline launch email",
          score: 84,
          reasons: [
            "Fits the current open window and moves launch prep forward.",
          ],
          taskId: "task-1",
          targetDate: "2026-04-18",
          suggestedTime: null,
        },
        {
          id: "task:task-2",
          kind: "task",
          title: "Team sync",
          score: 58,
          reasons: ["Scheduled soon, but less leverage than the draft work."],
          taskId: "task-2",
          targetDate: "2026-04-18",
          suggestedTime: "11:30",
        },
      ],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [
          {
            date: "2026-04-18",
            totalMinutes: 60,
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
            time: "10:30",
            endTime: "11:00",
            score: 90,
            reason: "Open focus slot before the team sync.",
          },
        ],
        moveSuggestions: [],
        summary: "You have a clean half hour before your next fixed item.",
      },
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.structuredResponse?.rightNow !== null, true);
  assertEquals(
    result.structuredResponse?.rightNow?.recommendedAction?.title,
    "Team sync",
  );
  assertEquals(
    result.structuredResponse?.rightNow?.fallbackAction ?? null,
    null,
  );
});

Deno.test("right_now_start shifts between lighter and deeper work based on day mode", () => {
  const recoveryResult = buildPlannerResponse(baseInput({
    message: "What should I do right now?",
    currentDate: "2026-04-18",
    currentDateTime: "2026-04-18T10:30:00-07:00",
    plannerContext: {
      starterIntent: "right_now_start",
      plannerMemory: {
        workloadTolerance: "light",
      },
      tasks: [
        {
          id: "task-hard",
          title: "Finish architecture brief",
          taskDate: "2026-04-18",
          scheduledTime: null,
          estimatedDuration: 30,
          difficulty: "hard",
          recurrencePattern: null,
          completed: false,
          priority: "medium",
        },
        {
          id: "task-light",
          title: "Reply to landlord email",
          taskDate: "2026-04-18",
          scheduledTime: null,
          estimatedDuration: 20,
          difficulty: "easy",
          recurrencePattern: null,
          completed: false,
          priority: "medium",
        },
      ],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [
          {
            date: "2026-04-18",
            totalMinutes: 50,
            taskCount: 2,
            status: "open",
          },
        ],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-18",
            time: "10:30",
            endTime: "11:00",
            score: 90,
            reason: "Open focus slot before lunch.",
          },
        ],
        moveSuggestions: [],
        summary: "You have a clean half hour to use.",
      },
    },
  }));
  const lockInResult = buildPlannerResponse(baseInput({
    message: "What should I do right now?",
    currentDate: "2026-04-18",
    currentDateTime: "2026-04-18T10:30:00-07:00",
    plannerContext: {
      starterIntent: "right_now_start",
      plannerMemory: {
        workloadTolerance: "heavy",
      },
      tasks: [
        {
          id: "task-hard",
          title: "Finish architecture brief",
          taskDate: "2026-04-18",
          scheduledTime: null,
          estimatedDuration: 30,
          difficulty: "hard",
          recurrencePattern: null,
          completed: false,
          priority: "medium",
        },
        {
          id: "task-light",
          title: "Reply to landlord email",
          taskDate: "2026-04-18",
          scheduledTime: null,
          estimatedDuration: 20,
          difficulty: "easy",
          recurrencePattern: null,
          completed: false,
          priority: "medium",
        },
      ],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [
          {
            date: "2026-04-18",
            totalMinutes: 50,
            taskCount: 2,
            status: "open",
          },
        ],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-18",
            time: "10:30",
            endTime: "11:00",
            score: 90,
            reason: "Open focus slot before lunch.",
          },
        ],
        moveSuggestions: [],
        summary: "You have a clean half hour to use.",
      },
    },
  }));

  assertEquals(
    recoveryResult.structuredResponse?.rightNow?.recommendedAction?.title,
    "Reply to landlord email",
  );
  assertEquals(
    lockInResult.structuredResponse?.rightNow?.recommendedAction?.title,
    "Finish architecture brief",
  );
});

Deno.test("adjust_today returns structured keep-move-trim guidance", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Adjust my day",
    currentDate: "2026-04-18",
    plannerContext: {
      starterIntent: "adjust_today",
      tasks: [
        {
          id: "task-1",
          title: "Finish investor memo",
          taskDate: "2026-04-18",
          scheduledTime: "13:00",
          estimatedDuration: 90,
          difficulty: "hard",
          recurrencePattern: null,
          completed: false,
          priority: "high",
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
        {
          id: "task-3",
          title: "Polish deck notes",
          taskDate: "2026-04-18",
          scheduledTime: "17:00",
          estimatedDuration: 60,
          difficulty: "medium",
          recurrencePattern: null,
          completed: false,
          priority: "medium",
        },
      ],
      priorityScores: [
        {
          id: "task:task-1",
          kind: "task",
          title: "Finish investor memo",
          score: 88,
          reasons: ["This is the strongest leverage move left today."],
          taskId: "task-1",
          targetDate: "2026-04-18",
          suggestedTime: "13:00",
        },
        {
          id: "task:task-2",
          kind: "task",
          title: "Inbox cleanup",
          score: 28,
          reasons: ["This can move cleanly without hurting momentum."],
          taskId: "task-2",
          targetDate: "2026-04-18",
          suggestedTime: "16:00",
        },
        {
          id: "task:task-3",
          kind: "task",
          title: "Polish deck notes",
          score: 52,
          reasons: [
            "Useful, but not worth forcing if the day is breaking down.",
          ],
          taskId: "task-3",
          targetDate: "2026-04-18",
          suggestedTime: "17:00",
        },
      ],
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals.length > 0, true);
  assertEquals(result.proposals[0]?.kind, "update_quest");
  assertEquals(result.structuredResponse?.dayAdjust !== null, true);
  assertEquals(
    (result.structuredResponse?.dayAdjust?.keep.length ?? 0) > 0,
    true,
  );
  assertEquals(
    (result.structuredResponse?.dayAdjust?.move.length ?? 0) > 0,
    true,
  );
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

Deno.test("turns high vitality need into a confirmable recovery block", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Please lighten today",
    plannerContext: {
      starterIntent: "low_energy_adjust",
      statInterpretation: {
        statProfile: {
          scores: {
            vitality: 320,
            wisdom: 510,
            discipline: 560,
            resolve: 430,
            creativity: 380,
            alignment: 470,
          },
          dominantStat: "discipline",
          secondaryStat: "wisdom",
        },
        statNeeds: {
          vitality: {
            level: "high",
            reasons: ["You've been pushing output harder than recovery."],
          },
          wisdom: { level: "low", reasons: [] },
          discipline: { level: "low", reasons: [] },
          resolve: { level: "low", reasons: [] },
          creativity: { level: "low", reasons: [] },
          alignment: { level: "low", reasons: [] },
        },
        momentumState: "slipping",
        recentMissInterpretation: "low_energy",
        narrativeBrief:
          "This looks more strained than lazy. I'm protecting the essentials and rebuilding vitality first.",
        dailyNarrative: "Vitality protection day",
      },
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [
          {
            date: "2026-04-18",
            totalMinutes: 240,
            taskCount: 4,
            status: "overloaded",
          },
        ],
        overloadedDates: ["2026-04-18"],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-18",
            time: "15:00",
            endTime: "15:30",
            score: 82,
            reason: "Open afternoon space",
          },
        ],
        moveSuggestions: [],
        summary: "Today is overloaded.",
      },
      tasks: [],
      inboxTasks: [],
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals[0].kind, "create_quest");
  assertStringIncludes(result.reply, "rebuilding vitality first");
  assertStringIncludes(
    result.proposals[0]?.summary ?? "",
    "Create a 30-minute recovery reset at 3:00 pm.",
  );
  assertEquals(
    (result.proposals[0].payload as { taskText: string }).taskText,
    "Recovery reset",
  );
});

Deno.test("keeps vague one-off placement requests confirmable without a concrete time", () => {
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
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(
    (result.proposals[0].payload as {
      taskDate: string | null;
      scheduledTime: string | null;
    }).taskDate,
    "2026-04-20",
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskDate: string | null;
      scheduledTime: string | null;
    }).scheduledTime,
    null,
  );
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
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.followUpQuestions.length, 0);
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
  assertStringIncludes(result.reply, "I drafted this as a quest");
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
  assertStringIncludes(result.reply, "I drafted this as a quest");
});

Deno.test("keeps overloaded-day guidance in the reply without blocking confirmation", () => {
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

  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.followUpQuestions.length, 0);
  assertStringIncludes(result.reply, "I drafted this as a quest");
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
  assertStringIncludes(result.reply, "Today:");
  assertStringIncludes(result.reply, "Workout (was at 9:00 am)");
  assertStringIncludes(result.reply, "Therapy");
  assertEquals(
    result.reply.includes("Tell me what feels most important"),
    false,
  );
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
  assertStringIncludes(result.reply, "Today:");
  assertStringIncludes(result.reply, "Workout (at 12:00 pm)");
  assertEquals(
    result.reply.includes("Tell me what feels most important"),
    false,
  );
});

Deno.test("treats an empty route request like a short empty schedule summary", () => {
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
  assertEquals(result.reply, "Today: nothing scheduled.");
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
  assertStringIncludes(result.reply, "Saturday, April 25:");
  assertStringIncludes(result.reply, "Long run (at 9:00 am)");
  assertEquals(result.reply.includes("Here's the shape of today."), false);
});

Deno.test("goal_breakdown_start opens with one assistant-led goal prompt", () => {
  const result = buildPlannerResponse(baseInput({
    message: "What goal do you want to break down?",
    parsedInput: {
      text: "What goal do you want to break down?",
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
      starterIntent: "goal_breakdown_start",
    },
  }));

  assertEquals(result.mode, "conversational");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(result.sessionState.draft.title ?? null, null);
  assertEquals(
    result.sessionState.pendingStarterIntent,
    "goal_breakdown_start",
  );
  assertStringIncludes(result.reply, "goal");
});

Deno.test("uses the follow-up goal after the launcher starter instead of reusing starter copy as the title", () => {
  const intake = buildPlannerResponse(baseInput({
    message: "What goal do you want to break down?",
    parsedInput: {
      text: "What goal do you want to break down?",
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
      starterIntent: "goal_breakdown_start",
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
  assertEquals(result.sessionState.pendingStarterIntent ?? null, null);
});

Deno.test("quest_capture asks for the quest and timing before drafting", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Quest?",
    parsedInput: {
      text: "Quest?",
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
      starterIntent: "quest_capture",
    },
  }));

  assertEquals(result.mode, "conversational");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(result.sessionState.pendingStarterIntent, "quest_capture");
  assertEquals(result.sessionState.draft.draftKind, "create_quest");
  assertEquals(result.reply, "Quest?");
});

Deno.test("quest_capture turns a complete follow-up answer into a ready quest draft", () => {
  const intake = buildPlannerResponse(baseInput({
    message: "Quest?",
    parsedInput: {
      text: "Quest?",
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
      starterIntent: "quest_capture",
    },
  }));

  const result = buildPlannerResponse(baseInput({
    message: "Write my newsletter tomorrow at 18:00",
    sessionState: intake.sessionState,
    parsedInput: {
      text: "Write my newsletter",
      scheduledTime: "18:00",
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

  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(
    (result.proposals[0].payload as { taskText: string }).taskText,
    "Write My Newsletter",
  );
  assertEquals(
    (result.proposals[0].payload as { scheduledTime: string | null })
      .scheduledTime,
    "18:00",
  );
  assertEquals(result.sessionState.pendingStarterIntent ?? null, null);
});

Deno.test("quest_capture gives explicit follow-up timing precedence over schedule summaries and learned patterns", () => {
  const intake = buildPlannerResponse(baseInput({
    message: "Quest?",
    parsedInput: {
      text: "Quest?",
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
      starterIntent: "quest_capture",
    },
  }));

  const result = buildPlannerResponse(baseInput({
    message: "Workout at 5",
    currentDate: "2026-04-20",
    currentDateTime: "2026-04-20T11:33:00-07:00",
    sessionState: {
      ...intake.sessionState,
      preferredTimeOfDay: "afternoon",
      preferredTimeReason: "usual afternoon rhythm",
    },
    parsedInput: {
      text: "workout",
      scheduledTime: "17:00",
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
      plannerMemory: {
        preferredTimeOfDay: "afternoon",
        preferredTimeReason: "usual afternoon rhythm",
      },
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-20",
        dayLoads: [],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [{
          date: "2026-04-20",
          time: "13:00",
          endTime: "13:30",
          score: 92,
          reason: "Matches your usual afternoon rhythm",
        }],
        moveSuggestions: [],
        summary:
          "Today has room at 13:00. Matches your usual afternoon rhythm.",
      },
    },
  }));

  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(
    (result.proposals[0].payload as {
      scheduledTime: string | null;
      taskDate: string | null;
    }).scheduledTime,
    "17:00",
  );
  assertEquals(
    (result.proposals[0].payload as {
      scheduledTime: string | null;
      taskDate: string | null;
    }).taskDate,
    "2026-04-20",
  );
  assertStringIncludes(
    result.proposals[0].summary,
    'Create a quest for "Workout" at 5:00 pm.',
  );
  assertStringIncludes(result.reply, "today at 5:00 pm");
  assertEquals(result.reply.includes("1:00 pm"), false);
  assertEquals(result.reply.includes("usual afternoon rhythm"), false);
  assertEquals(result.reply.includes("assuming"), false);
  assertEquals(result.memoryUpdates.preferredTimeOfDay, "evening");
  assertEquals(result.memoryUpdates.preferredTimeReason ?? null, null);
  assertEquals(result.sessionState.preferredTimeOfDay, "evening");
  assertEquals(result.sessionState.preferredTimeReason ?? null, null);
  assertEquals(result.sessionState.draft.timeReason ?? null, null);
});

Deno.test("quest_capture turns a bare quest title into a ready inbox draft", () => {
  const intake = buildPlannerResponse(baseInput({
    message: "Quest?",
    parsedInput: {
      text: "Quest?",
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
      starterIntent: "quest_capture",
    },
  }));

  const result = buildPlannerResponse(baseInput({
    message: "Write my newsletter",
    sessionState: intake.sessionState,
    parsedInput: {
      text: "Write my newsletter",
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

  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(
    result.proposals[0].summary,
    'Capture "Write my newsletter" in Inbox so you can schedule it later.',
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskDate: string | null;
      scheduledTime: string | null;
      source: string | null;
    }).taskDate,
    null,
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskDate: string | null;
      scheduledTime: string | null;
      source: string | null;
    }).scheduledTime,
    null,
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskDate: string | null;
      scheduledTime: string | null;
      source: string | null;
    }).source,
    "inbox",
  );
});

Deno.test("quest_capture uses the selected day's best open slot for a bare quest title", () => {
  const intake = buildPlannerResponse(baseInput({
    message: "Quest?",
    parsedInput: {
      text: "Quest?",
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
      starterIntent: "quest_capture",
    },
  }));

  const result = buildPlannerResponse(baseInput({
    currentDate: "2026-04-20",
    currentDateTime: "2026-04-20T10:30:00-07:00",
    message: "Write my newsletter",
    sessionState: intake.sessionState,
    parsedInput: {
      text: "Write my newsletter",
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
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-20",
        dayLoads: [],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-20",
            time: "18:00",
            endTime: "18:30",
            score: 92,
            reason: "Open evening window",
          },
        ],
        moveSuggestions: [],
        summary: "Today has room in the evening.",
      },
    },
  }));

  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(
    (result.proposals[0].payload as {
      taskDate: string | null;
      scheduledTime: string | null;
    }).taskDate,
    "2026-04-20",
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskDate: string | null;
      scheduledTime: string | null;
    }).scheduledTime,
    "18:00",
  );
  assertStringIncludes(
    result.proposals[0].summary,
    "assuming that slot based on your open window",
  );
});

Deno.test("quest_capture uses the preferred time window for a bare quest title when no slot is available", () => {
  const intake = buildPlannerResponse(baseInput({
    message: "Quest?",
    parsedInput: {
      text: "Quest?",
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
      starterIntent: "quest_capture",
    },
  }));

  const result = buildPlannerResponse(baseInput({
    currentDate: "2026-04-20",
    currentDateTime: "2026-04-20T10:30:00-07:00",
    message: "Write my newsletter",
    sessionState: intake.sessionState,
    parsedInput: {
      text: "Write my newsletter",
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
      plannerMemory: {
        preferredTimeOfDay: "evening",
      },
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-20",
        dayLoads: [],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [],
        moveSuggestions: [],
        summary: "Today still has flexibility.",
      },
    },
  }));

  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(
    (result.proposals[0].payload as {
      taskDate: string | null;
      scheduledTime: string | null;
    }).taskDate,
    "2026-04-20",
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskDate: string | null;
      scheduledTime: string | null;
    }).scheduledTime,
    "18:00",
  );
  assertStringIncludes(
    result.proposals[0].summary,
    "assuming your usual evening pattern",
  );
});

Deno.test("quest_capture uses a matching suggested slot for date-only replies", () => {
  const intake = buildPlannerResponse(baseInput({
    message: "Quest?",
    parsedInput: {
      text: "Quest?",
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
      starterIntent: "quest_capture",
    },
  }));

  const result = buildPlannerResponse(baseInput({
    currentDate: "2026-04-18",
    currentDateTime: "2026-04-18T10:30:00-07:00",
    message: "Write my newsletter tomorrow",
    sessionState: intake.sessionState,
    parsedInput: {
      text: "Write my newsletter",
      scheduledTime: null,
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
    plannerContext: {
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-19",
        dayLoads: [],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-19",
            time: "18:00",
            endTime: "18:30",
            score: 92,
            reason: "Open evening window",
          },
        ],
        moveSuggestions: [],
        summary: "Tomorrow has room in the evening.",
      },
    },
  }));

  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.followUpQuestions.length, 0);
  assertStringIncludes(
    result.proposals[0].summary,
    "assuming that slot based on your open window",
  );
  assertStringIncludes(
    result.reply,
    "assuming 2026-04-19 at 6:00 pm based on your open slot",
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskDate: string | null;
      scheduledTime: string | null;
    }).taskDate,
    "2026-04-19",
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskDate: string | null;
      scheduledTime: string | null;
    }).scheduledTime,
    "18:00",
  );
});

Deno.test("quest_capture uses planner memory when a date-only reply has no matching slot", () => {
  const intake = buildPlannerResponse(baseInput({
    message: "Quest?",
    parsedInput: {
      text: "Quest?",
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
      starterIntent: "quest_capture",
    },
  }));

  const result = buildPlannerResponse(baseInput({
    currentDate: "2026-04-18",
    currentDateTime: "2026-04-18T10:30:00-07:00",
    message: "Write my newsletter tomorrow",
    sessionState: intake.sessionState,
    parsedInput: {
      text: "Write my newsletter",
      scheduledTime: null,
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
    plannerContext: {
      plannerMemory: {
        preferredTimeOfDay: "evening",
      },
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-19",
        dayLoads: [],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [],
        moveSuggestions: [],
        summary: "Tomorrow still has some flexibility.",
      },
    },
  }));

  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.followUpQuestions.length, 0);
  assertStringIncludes(
    result.proposals[0].summary,
    "assuming your usual evening pattern",
  );
  assertStringIncludes(
    result.reply,
    "assuming 2026-04-19 at 6:00 pm based on your usual evening pattern",
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskDate: string | null;
      scheduledTime: string | null;
    }).taskDate,
    "2026-04-19",
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskDate: string | null;
      scheduledTime: string | null;
    }).scheduledTime,
    "18:00",
  );
});

Deno.test("quest_capture keeps a date-only reply confirmable when no safe time assumption exists", () => {
  const intake = buildPlannerResponse(baseInput({
    message: "Quest?",
    parsedInput: {
      text: "Quest?",
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
      starterIntent: "quest_capture",
    },
  }));

  const result = buildPlannerResponse(baseInput({
    currentDate: "2026-04-18",
    currentDateTime: "2026-04-18T10:30:00-07:00",
    message: "Write my newsletter tomorrow",
    sessionState: intake.sessionState,
    parsedInput: {
      text: "Write my newsletter",
      scheduledTime: null,
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
    plannerContext: {
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-19",
        dayLoads: [],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [],
        moveSuggestions: [],
        summary: "Tomorrow is unscheduled so far.",
      },
    },
  }));

  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(
    (result.proposals[0].payload as {
      taskDate: string | null;
      scheduledTime: string | null;
    }).taskDate,
    "2026-04-19",
  );
  assertEquals(
    (result.proposals[0].payload as {
      taskDate: string | null;
      scheduledTime: string | null;
    }).scheduledTime,
    null,
  );
});

Deno.test("quest_capture asks only for the quest details when the user replies with timing first", () => {
  const intake = buildPlannerResponse(baseInput({
    message: "Quest?",
    parsedInput: {
      text: "Quest?",
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
      starterIntent: "quest_capture",
    },
  }));

  const timingOnly = buildPlannerResponse(baseInput({
    message: "Tomorrow at 18:00",
    sessionState: intake.sessionState,
    parsedInput: {
      text: "Tomorrow at 18:00",
      scheduledTime: "18:00",
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

  assertEquals(timingOnly.followUpQuestions.map((question) => question.field), [
    "details",
  ]);

  const result = buildPlannerResponse(baseInput({
    message: "Write my newsletter",
    sessionState: timingOnly.sessionState,
    parsedInput: {
      text: "Write my newsletter",
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

  assertEquals(result.proposals[0].kind, "create_quest");
  assertEquals(result.proposals[0].readyToConfirm, true);
  assertEquals(
    (result.proposals[0].payload as { scheduledTime: string | null })
      .scheduledTime,
    "18:00",
  );
});

Deno.test("upcoming_start returns the today-and-tomorrow digest immediately", () => {
  const result = buildPlannerResponse(baseInput({
    message: "What do I have coming up?",
    parsedInput: {
      text: "What do I have coming up?",
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
        {
          id: "task-3",
          title: "Prep therapy notes",
          taskDate: "2026-04-18",
          scheduledTime: null,
          estimatedDuration: 20,
          recurrencePattern: null,
          priority: "high",
        },
      ],
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
      starterIntent: "upcoming_start",
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(result.sessionState.pendingStarterIntent ?? null, null);
  assertStringIncludes(result.reply, "Today:");
  assertStringIncludes(result.reply, "Therapy");
  assertStringIncludes(result.reply, "Tomorrow:");
  assertStringIncludes(result.reply, "Inbox cleanup (at 9:30 am)");
  assertEquals(result.structuredResponse?.comingUp !== null, true);
  assertEquals(result.structuredResponse?.comingUp?.remainingToday.length, 3);
  assertEquals(
    result.structuredResponse?.comingUp?.nextEvent?.title,
    "Therapy",
  );
  assertEquals(
    result.structuredResponse?.comingUp?.nextBestAction?.title,
    "Prep therapy notes",
  );
});

Deno.test("upcoming_start can surface a campaign move before the next event", () => {
  const result = buildPlannerResponse(baseInput({
    message: "What do I have coming up?",
    currentDateTime: "2026-04-18T09:00:00-07:00",
    parsedInput: {
      text: "What do I have coming up?",
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
          id: "task-campaign-next",
          title: "Outline webinar promise",
          taskDate: null,
          scheduledTime: null,
          estimatedDuration: 45,
          recurrencePattern: null,
          completed: false,
          priority: "medium",
          epicId: "epic-a",
          epicTitle: "Course launch",
        },
      ],
      inboxTasks: [],
      activeEpics: [
        {
          id: "epic-a",
          title: "Course launch",
          endDate: "2026-05-12",
          progressPercentage: 32,
          daysRemaining: 24,
        },
      ],
      rituals: [],
      calendarEvents: [
        {
          id: "event-1",
          title: "Therapy",
          start: "2026-04-18T18:00:00.000Z",
          end: "2026-04-18T19:00:00.000Z",
          isAllDay: false,
          provider: "google",
          readOnly: true,
        },
      ],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [],
        overloadedDates: [],
        emptyDates: [],
        conflicts: [],
        suggestedSlots: [],
        moveSuggestions: [],
        summary: "Today has room before the afternoon.",
      },
      priorityScores: [
        {
          id: "epic:epic-a",
          kind: "epic",
          title: "Course launch",
          score: 88,
          reasons: ["This campaign is starting to slip."],
          epicId: "epic-a",
        },
      ],
      starterIntent: "upcoming_start",
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertEquals(
    result.structuredResponse?.comingUp?.nextBestAction?.title,
    "Outline webinar promise",
  );
  assertStringIncludes(
    result.structuredResponse?.comingUp?.nextBestAction?.reason ?? "",
    "before Therapy",
  );
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

Deno.test("make_room surfaces campaign pressure when too many campaigns are competing", () => {
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
          id: "task-compete-1",
          title: "Outline webinar promise",
          taskDate: null,
          scheduledTime: null,
          estimatedDuration: 45,
          recurrencePattern: null,
          completed: false,
          priority: "medium",
          epicId: "epic-a",
          epicTitle: "Course launch",
        },
      ],
      inboxTasks: [],
      activeEpics: [
        {
          id: "epic-a",
          title: "Course launch",
          endDate: "2026-05-12",
          progressPercentage: 38,
          daysRemaining: 24,
        },
        {
          id: "epic-b",
          title: "Podcast relaunch",
          endDate: "2026-05-20",
          progressPercentage: 44,
          daysRemaining: 32,
        },
        {
          id: "epic-c",
          title: "Client pipeline",
          endDate: "2026-05-01",
          progressPercentage: 52,
          daysRemaining: 13,
        },
        {
          id: "epic-d",
          title: "Personal brand",
          endDate: "2026-06-01",
          progressPercentage: 18,
          daysRemaining: 44,
        },
      ],
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
      priorityScores: [
        {
          id: "epic:epic-a",
          kind: "epic",
          title: "Course launch",
          score: 80,
          reasons: ["This campaign matters, but your attention is split too many ways."],
          epicId: "epic-a",
        },
      ],
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertStringIncludes(result.reply, "Campaign pressure: Course launch is");
  assertStringIncludes(
    result.reply,
    "Too many active campaigns are competing right now",
  );
  assertStringIncludes(result.reply, "Outline webinar promise");
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
  assertEquals(result.reply, "Today: nothing scheduled.");
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
  assertStringIncludes(result.reply, "Today:");
  assertStringIncludes(result.reply, "Tomorrow:");
  assertEquals(
    result.reply.includes("Tell me what feels most important"),
    false,
  );
  assertEquals(result.reply.includes("Week ahead:"), false);
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
  assertStringIncludes(result.reply, "pm");
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

Deno.test("advance_campaign_start surfaces the clearest existing campaign step when momentum is already moving", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Advance my campaign",
    plannerContext: {
      starterIntent: "advance_campaign_start",
      activeEpics: [
        {
          id: "epic-1",
          title: "Launch prep",
          endDate: "2026-05-05",
          progressPercentage: 62,
          daysRemaining: 17,
        },
      ],
      tasks: [
        {
          id: "task-1",
          title: "Finalize launch checklist",
          taskDate: "2026-04-18",
          scheduledTime: "14:00",
          estimatedDuration: 45,
          recurrencePattern: null,
          completed: false,
          priority: "high",
          epicId: "epic-1",
          epicTitle: "Launch prep",
        },
      ],
      priorityScores: [
        {
          id: "epic:epic-1",
          kind: "epic",
          title: "Launch prep",
          score: 88,
          reasons: ["Launch prep has real leverage this week."],
          epicId: "epic-1",
        },
        {
          id: "task:task-1",
          kind: "task",
          title: "Finalize launch checklist",
          score: 82,
          reasons: ["It's already lined up for today and moves the campaign."],
          taskId: "task-1",
          epicId: "epic-1",
          targetDate: "2026-04-18",
          suggestedTime: "14:00",
        },
      ],
    },
  }));

  assertEquals(result.mode, "schedule_read");
  assertEquals(result.proposals.length, 0);
  assertEquals(result.structuredResponse?.campaignMomentum?.campaignTitle, "Launch prep");
  assertEquals(result.structuredResponse?.campaignMomentum?.status, "moving");
  assertEquals(
    result.structuredResponse?.campaignMomentum?.nextStep?.title,
    "Finalize launch checklist",
  );
});

Deno.test("advance_campaign_start drafts a next quest when a campaign is stalled", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Advance my campaign",
    plannerContext: {
      starterIntent: "advance_campaign_start",
      activeEpics: [
        {
          id: "epic-2",
          title: "Summer cut",
          endDate: "2026-05-02",
          progressPercentage: 18,
          daysRemaining: 14,
        },
      ],
      rituals: [
        {
          id: "ritual-1",
          epicId: "epic-2",
          epicTitle: "Summer cut",
          title: "Morning weigh-in",
          frequency: "daily",
          preferredTime: "08:00",
        },
      ],
      priorityScores: [
        {
          id: "epic:epic-2",
          kind: "epic",
          title: "Summer cut",
          score: 79,
          reasons: ["This campaign has slipped and needs one clean move."],
          epicId: "epic-2",
        },
      ],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [
          {
            date: "2026-04-18",
            totalMinutes: 0,
            taskCount: 0,
            status: "open",
          },
        ],
        overloadedDates: [],
        emptyDates: ["2026-04-18"],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-18",
            time: "11:00",
            endTime: "11:30",
            score: 91,
            reason: "Open slot for a clean next move.",
          },
        ],
        moveSuggestions: [],
        summary: "Today is open enough for one focused campaign step.",
      },
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals.length, 1);
  assertEquals(result.structuredResponse?.campaignMomentum?.campaignTitle, "Summer cut");
  assertEquals(result.structuredResponse?.campaignMomentum?.status, "stalled");
  assertStringIncludes(result.proposals[0].title, "Summer cut");
  assertEquals(
    (result.proposals[0].payload as { epicId?: string | null }).epicId,
    "epic-2",
  );
  assertEquals(
    result.structuredResponse?.campaignMomentum?.supportActions[0]?.title,
    "Keep Morning weigh-in",
  );
});

Deno.test("advance_campaign_start drafts a campaign adjustment when pressure is severe", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Advance my campaign",
    plannerContext: {
      starterIntent: "advance_campaign_start",
      activeEpics: [
        {
          id: "epic-3",
          title: "Founder relaunch",
          endDate: "2026-04-21",
          progressPercentage: 22,
          daysRemaining: 3,
        },
      ],
      tasks: [
        {
          id: "task-risk-1",
          title: "Rewrite relaunch offer",
          taskDate: "2026-04-16",
          scheduledTime: null,
          estimatedDuration: 60,
          recurrencePattern: null,
          completed: false,
          priority: "high",
          epicId: "epic-3",
          epicTitle: "Founder relaunch",
        },
        {
          id: "task-risk-2",
          title: "Tighten launch CTA",
          taskDate: "2026-04-17",
          scheduledTime: null,
          estimatedDuration: 45,
          recurrencePattern: null,
          completed: false,
          priority: "medium",
          epicId: "epic-3",
          epicTitle: "Founder relaunch",
        },
      ],
      rituals: [
        {
          id: "ritual-risk-1",
          epicId: "epic-3",
          epicTitle: "Founder relaunch",
          title: "Daily metrics check",
          frequency: "daily",
          preferredTime: "09:00",
        },
      ],
      priorityScores: [
        {
          id: "epic:epic-3",
          kind: "epic",
          title: "Founder relaunch",
          score: 93,
          reasons: ["The deadline is extremely close and this campaign is slipping."],
          epicId: "epic-3",
        },
        {
          id: "task:task-risk-1",
          kind: "task",
          title: "Rewrite relaunch offer",
          score: 84,
          reasons: ["This is the highest leverage campaign task left."],
          taskId: "task-risk-1",
          epicId: "epic-3",
          targetDate: "2026-04-16",
        },
      ],
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals[0].kind, "adjust_campaign_plan");
  assertEquals(result.structuredResponse?.campaignMomentum?.status, "at_risk");
  assertStringIncludes(
    result.structuredResponse?.campaignMomentum?.nextStep?.title ?? "",
    "Adjust Founder relaunch",
  );
  assertEquals(
    result.structuredResponse?.campaignMomentum?.supportActions[0]?.title,
    "Rewrite relaunch offer",
  );
});

Deno.test("advance_campaign_start shrinks oversized campaign work into a smaller first move", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Advance my campaign",
    plannerContext: {
      starterIntent: "advance_campaign_start",
      activeEpics: [
        {
          id: "epic-4",
          title: "Course launch",
          endDate: "2026-05-12",
          progressPercentage: 34,
          daysRemaining: 24,
        },
      ],
      tasks: [
        {
          id: "task-big-1",
          title: "Build full course sales page",
          taskDate: null,
          scheduledTime: null,
          estimatedDuration: 150,
          recurrencePattern: null,
          completed: false,
          priority: "high",
          epicId: "epic-4",
          epicTitle: "Course launch",
          subtaskTitles: [],
        },
      ],
      priorityScores: [
        {
          id: "epic:epic-4",
          kind: "epic",
          title: "Course launch",
          score: 76,
          reasons: ["This campaign needs a smaller concrete move."],
          epicId: "epic-4",
        },
      ],
      scheduleInsights: {
        horizon: "day",
        selectedDate: "2026-04-18",
        dayLoads: [
          {
            date: "2026-04-18",
            totalMinutes: 0,
            taskCount: 0,
            status: "open",
          },
        ],
        overloadedDates: [],
        emptyDates: ["2026-04-18"],
        conflicts: [],
        suggestedSlots: [
          {
            date: "2026-04-18",
            time: "13:00",
            endTime: "13:30",
            score: 88,
            reason: "Open slot for a first-pass breakdown.",
          },
        ],
        moveSuggestions: [],
        summary: "Today has room for a smaller campaign move.",
      },
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.structuredResponse?.campaignMomentum?.status, "stalled");
  assertStringIncludes(result.proposals[0].title, "Break down Build full course sales page");
});

Deno.test("advance_campaign_start can recommend a campaign adjustment when too many campaigns are competing", () => {
  const result = buildPlannerResponse(baseInput({
    message: "Advance my campaign",
    plannerContext: {
      starterIntent: "advance_campaign_start",
      activeEpics: [
        {
          id: "epic-a",
          title: "Course launch",
          endDate: "2026-05-12",
          progressPercentage: 38,
          daysRemaining: 24,
        },
        {
          id: "epic-b",
          title: "Podcast relaunch",
          endDate: "2026-05-20",
          progressPercentage: 44,
          daysRemaining: 32,
        },
        {
          id: "epic-c",
          title: "Client pipeline",
          endDate: "2026-05-01",
          progressPercentage: 52,
          daysRemaining: 13,
        },
        {
          id: "epic-d",
          title: "Personal brand",
          endDate: "2026-06-01",
          progressPercentage: 18,
          daysRemaining: 44,
        },
      ],
      tasks: [
        {
          id: "task-compete-1",
          title: "Outline webinar promise",
          taskDate: null,
          scheduledTime: null,
          estimatedDuration: 45,
          recurrencePattern: null,
          completed: false,
          priority: "medium",
          epicId: "epic-a",
          epicTitle: "Course launch",
        },
      ],
      priorityScores: [
        {
          id: "epic:epic-a",
          kind: "epic",
          title: "Course launch",
          score: 80,
          reasons: ["This campaign matters, but your attention is split too many ways."],
          epicId: "epic-a",
        },
      ],
    },
  }));

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals[0].kind, "adjust_campaign_plan");
  assertStringIncludes(
    (result.proposals[0].payload as { reason?: string }).reason ?? "",
    "too many active campaigns",
  );
});
