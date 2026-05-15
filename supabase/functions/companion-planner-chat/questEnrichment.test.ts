import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { enrichQuestPlannerResult } from "./questEnrichment.ts";
import type {
  PlannerBuildInput,
  PlannerBuildResult,
  PlannerProposal,
  PlannerSessionState,
} from "./planner.ts";

const baseSessionState = (
  overrides: Partial<PlannerSessionState> = {},
): PlannerSessionState => ({
  draft: {},
  openQuestionIds: [],
  preferredTimeOfDay: null,
  preferredTimeReason: null,
  reminderPreference: null,
  lastClassification: "quest",
  ...overrides,
});

const baseInput = (
  overrides: Partial<PlannerBuildInput> = {},
): PlannerBuildInput => ({
  message: "Workout",
  currentDate: "2026-04-19",
  currentDateTime: "2026-04-19T10:30:00-07:00",
  horizon: "day",
  tonePack: "soft",
  conversationHistory: [],
  sessionState: baseSessionState(),
  parsedInput: {
    text: "Workout",
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
  classificationHint: {
    type: "quest",
    confidence: 0.92,
    reasoning: "Quest request",
  },
  plannerContext: {
    tasks: [],
    inboxTasks: [],
    activeEpics: [],
    rituals: [],
    calendarEvents: [],
  },
  ...overrides,
});

const baseProposal = (
  overrides: Partial<PlannerProposal> = {},
): PlannerProposal => ({
  id: "proposal-1",
  kind: "create_quest",
  title: "Create Workout",
  summary: 'Create a quest for "Workout".',
  payload: {
    taskText: "Workout",
    difficulty: "medium",
  },
  status: "pending",
  readyToConfirm: true,
  missingFields: [],
  ...overrides,
});

const baseResult = (
  proposal: PlannerProposal,
  sessionState: PlannerSessionState,
): PlannerBuildResult => ({
  mode: "proposal",
  reply: "I drafted a quest for you.",
  followUpQuestions: [],
  proposals: [proposal],
  suggestedReminders: [],
  memoryUpdates: {},
  sessionState,
});

const buildBreakdownFetch = (titles: string[]) =>
  async (_input: RequestInfo | URL, _init?: RequestInit) =>
    new Response(JSON.stringify({
      choices: [{
        message: {
          tool_calls: [{
            function: {
              name: "decompose_task",
              arguments: JSON.stringify({
                subtasks: titles.map((title) => ({
                  title,
                  durationMinutes: 30,
                })),
              }),
            },
          }],
        },
      }],
    }));

Deno.test("keeps an under-specified quest_capture quest ready to confirm by default", async () => {
  const input = baseInput({
    sessionState: baseSessionState({
      pendingStarterIntent: "quest_capture",
    }),
  });
  const result = await enrichQuestPlannerResult({
    fetchImpl: async () => new Response("unused"),
    input,
    baseResult: baseResult(baseProposal(), input.sessionState),
  });

  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(result.proposals[0]?.readyToConfirm, true);
});

Deno.test("keeps simple timed quests ready to confirm without extra enrichment questions", async () => {
  const input = baseInput({
    message: "Gym at 5pm tomorrow",
    parsedInput: {
      text: "Gym",
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
  });

  const proposal = baseProposal({
    title: "Create Gym",
    summary: 'Create a quest for "Gym" on 2026-04-20 at 17:00.',
    payload: {
      taskText: "Gym",
      taskDate: "2026-04-20",
      scheduledTime: "17:00",
      difficulty: "medium",
    },
  });
  const result = await enrichQuestPlannerResult({
    fetchImpl: async () => new Response("unused"),
    input,
    baseResult: baseResult(proposal, input.sessionState),
  });

  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(result.proposals[0]?.readyToConfirm, true);
  assertEquals(result.proposals[0]?.payload, proposal.payload);
});

Deno.test("preserves planner calendar conflict notes when enrichment rewrites the reply", async () => {
  const input = baseInput({
    message: "Add notes: bring water",
    currentDateTime: "2026-04-20T15:50:00-07:00",
    horizon: "week",
    sessionState: baseSessionState({
      openQuestionIds: ["quest_enrichment_preference"],
    }),
    parsedInput: {
      text: "Workout on April 23, 2026 at 6:00 pm",
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
      ...baseInput().plannerContext,
      calendarEvents: [
        {
          id: "conflict-event",
          title: "Dinner Reservation",
          start: "2026-04-23T18:15:00-07:00",
          end: "2026-04-23T19:00:00-07:00",
          isAllDay: false,
          provider: "google",
          readOnly: true,
        },
      ],
    },
  });
  const proposal = baseProposal({
    title: "Create Workout",
    summary: 'Create a quest for "Workout" on 2026-04-23 at 18:00.',
    payload: {
      taskText: "Workout",
      taskDate: "2026-04-23",
      scheduledTime: "18:00",
      estimatedDuration: 45,
      difficulty: "medium",
    },
  });
  const result = await enrichQuestPlannerResult({
    fetchImpl: async () => new Response("unused"),
    input,
    baseResult: {
      ...baseResult(proposal, input.sessionState),
      reply:
        'I can talk this through with you, but I won\'t create or schedule a quest from this chat. Tell me what you want to compare or refine.\n\nHeads up: this overlaps with your saved calendar event "Dinner Reservation" on Thursday, April 23 from 6:15 pm-7:00 pm.',
    },
  });

  assertEquals(
    (result.proposals[0]?.payload as { notes?: string }).notes,
    "bring water",
  );
  assertEquals(
    result.reply.includes('saved calendar event "Dinner Reservation"'),
    true,
  );
});

Deno.test("keeps plain quest drafts ready to confirm without proactive enrichment questions", async () => {
  const input = baseInput();
  const result = await enrichQuestPlannerResult({
    fetchImpl: async () => new Response("unused"),
    input,
    baseResult: baseResult(baseProposal(), input.sessionState),
  });

  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(result.proposals[0]?.readyToConfirm, true);
});

Deno.test("turns a note-focused follow-up reply into quest notes", async () => {
  const input = baseInput({
    message: "Add notes: upper body focus and 10 minutes of cardio",
    sessionState: baseSessionState({
      openQuestionIds: ["quest_enrichment_preference"],
    }),
  });
  const result = await enrichQuestPlannerResult({
    fetchImpl: async () => new Response("unused"),
    input,
    baseResult: baseResult(baseProposal(), input.sessionState),
  });

  assertEquals(
    (result.proposals[0]?.payload as { notes?: string }).notes,
    "upper body focus and 10 minutes of cardio",
  );
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(result.sessionState.draft.questNotes, "upper body focus and 10 minutes of cardio");
});

Deno.test("turns an explicit add-notes request into quest notes without a proactive preference question", async () => {
  const input = baseInput({
    message: "Add notes: upper body focus and 10 minutes of cardio",
    sessionState: baseSessionState({
      pendingStarterIntent: "quest_capture",
    }),
  });
  const result = await enrichQuestPlannerResult({
    fetchImpl: async () => new Response("unused"),
    input,
    baseResult: baseResult(baseProposal(), input.sessionState),
  });

  assertEquals(
    (result.proposals[0]?.payload as { notes?: string }).notes,
    "upper body focus and 10 minutes of cardio",
  );
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(result.proposals[0]?.readyToConfirm, true);
});

Deno.test("turns a breakdown follow-up reply into create quest subtasks", async () => {
  const input = baseInput({
    message: "Break it into steps: upper body with a cooldown walk",
    sessionState: baseSessionState({
      openQuestionIds: ["quest_enrichment_preference"],
    }),
  });
  const result = await enrichQuestPlannerResult({
    fetchImpl: buildBreakdownFetch(["Warm up", "Lift upper body", "Cooldown walk"]),
    input,
    baseResult: baseResult(baseProposal(), input.sessionState),
    openAIApiKey: "test-key",
  });

  assertEquals(
    (result.proposals[0]?.payload as { subtasks?: string[] }).subtasks,
    ["Warm up", "Lift upper body", "Cooldown walk"],
  );
  assertEquals(result.sessionState.draft.questSubtasks, [
    "Warm up",
    "Lift upper body",
    "Cooldown walk",
  ]);
});

Deno.test("turns an explicit breakdown request into quest subtasks without a proactive preference question", async () => {
  const input = baseInput({
    message: "Break it into steps: upper body with a cooldown walk",
    sessionState: baseSessionState({
      pendingStarterIntent: "quest_capture",
    }),
  });
  const result = await enrichQuestPlannerResult({
    fetchImpl: buildBreakdownFetch(["Warm up", "Lift upper body", "Cooldown walk"]),
    input,
    baseResult: baseResult(baseProposal(), input.sessionState),
    openAIApiKey: "test-key",
  });

  assertEquals(
    (result.proposals[0]?.payload as { subtasks?: string[] }).subtasks,
    ["Warm up", "Lift upper body", "Cooldown walk"],
  );
  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(result.proposals[0]?.readyToConfirm, true);
});

Deno.test("keeps a ready quest confirmable when the user requests notes without usable detail", async () => {
  const input = baseInput({
    message: "Add notes",
    sessionState: baseSessionState({
      pendingStarterIntent: "quest_capture",
    }),
  });
  const result = await enrichQuestPlannerResult({
    fetchImpl: async () => new Response("unused"),
    input,
    baseResult: baseResult(baseProposal(), input.sessionState),
  });

  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(result.proposals[0]?.readyToConfirm, true);
  assertEquals(result.reply, "I drafted a quest for you.");
});

Deno.test("keeps a ready quest confirmable when the user requests a breakdown without usable detail", async () => {
  const input = baseInput({
    message: "Break it into steps",
    sessionState: baseSessionState({
      pendingStarterIntent: "quest_capture",
    }),
  });
  const result = await enrichQuestPlannerResult({
    fetchImpl: async () => new Response("unused"),
    input,
    baseResult: baseResult(baseProposal(), input.sessionState),
  });

  assertEquals(result.followUpQuestions.length, 0);
  assertEquals(result.proposals[0]?.readyToConfirm, true);
  assertEquals(result.reply, "I drafted a quest for you.");
});

Deno.test("defaults existing quest breakdown edits to append mode", async () => {
  const input = baseInput({
    message: "Break it into steps: add a warm up and cooldown",
    sessionState: baseSessionState({
      openQuestionIds: ["quest_enrichment_preference"],
      draft: {
        taskId: "task-1",
        draftKind: "update_quest",
      },
    }),
    plannerContext: {
      tasks: [{
        id: "task-1",
        title: "Workout",
        taskDate: "2026-04-19",
        scheduledTime: null,
        estimatedDuration: 45,
        notes: "Old note",
        subtaskTitles: ["Existing step"],
        difficulty: "medium",
        recurrencePattern: null,
      }],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [],
    },
  });
  const proposal = baseProposal({
    kind: "update_quest",
    title: "Update Workout",
    summary: 'Update "Workout".',
    payload: {
      taskId: "task-1",
      updates: {},
    },
  });
  const result = await enrichQuestPlannerResult({
    fetchImpl: buildBreakdownFetch(["Warm up", "Cooldown walk"]),
    input,
    baseResult: baseResult(proposal, input.sessionState),
    openAIApiKey: "test-key",
  });

  const subtaskPlan = (result.proposals[0]?.payload as {
    subtaskPlan?: { mode?: string; titles?: string[] };
  }).subtaskPlan;
  assertExists(subtaskPlan);
  assertEquals(subtaskPlan?.mode, "append");
  assertEquals(subtaskPlan?.titles, ["Warm up", "Cooldown walk"]);
});

Deno.test("switches existing quest breakdown edits to replace mode when explicitly requested", async () => {
  const input = baseInput({
    message: "Replace the steps: lighter warm up and cooldown",
    sessionState: baseSessionState({
      openQuestionIds: ["quest_enrichment_preference"],
      draft: {
        taskId: "task-1",
        draftKind: "update_quest",
      },
    }),
    plannerContext: {
      tasks: [{
        id: "task-1",
        title: "Workout",
        taskDate: "2026-04-19",
        scheduledTime: null,
        estimatedDuration: 45,
        notes: "Old note",
        subtaskTitles: ["Existing step"],
        difficulty: "medium",
        recurrencePattern: null,
      }],
      inboxTasks: [],
      activeEpics: [],
      rituals: [],
      calendarEvents: [],
    },
  });
  const proposal = baseProposal({
    kind: "update_quest",
    title: "Update Workout",
    summary: 'Update "Workout".',
    payload: {
      taskId: "task-1",
      updates: {},
    },
  });
  const result = await enrichQuestPlannerResult({
    fetchImpl: buildBreakdownFetch(["Warm up", "Cooldown walk"]),
    input,
    baseResult: baseResult(proposal, input.sessionState),
    openAIApiKey: "test-key",
  });

  const subtaskPlan = (result.proposals[0]?.payload as {
    subtaskPlan?: { mode?: string; titles?: string[] };
  }).subtaskPlan;
  assertExists(subtaskPlan);
  assertEquals(subtaskPlan?.mode, "replace");
  assertEquals(result.sessionState.draft.questSubtaskPlanMode, "replace");
});
