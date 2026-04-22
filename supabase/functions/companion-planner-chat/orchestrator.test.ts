import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildOrchestratedPlannerResponse,
  sanitizeReadyQuestProposalResponse,
} from "./orchestrator.ts";
import type { PlannerBuildInput, PlannerBuildResult } from "./planner.ts";

const baseInput = (): PlannerBuildInput => ({
  message: "What do I have coming up?",
  currentDate: "2026-04-18",
  currentDateTime: "2026-04-18T10:30:00-07:00",
  horizon: "day",
  tonePack: "soft",
  conversationHistory: [],
  sessionState: {
    draft: {},
    openQuestionIds: [],
    preferredTimeOfDay: null,
    preferredTimeReason: null,
    reminderPreference: null,
    lastClassification: null,
  },
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
  classificationHint: {
    type: "quest",
    confidence: 0.85,
    reasoning: "Schedule question",
  },
  plannerContext: {
    tasks: [],
    inboxTasks: [],
    activeEpics: [],
    rituals: [],
    calendarEvents: [],
  },
});

const baseResult = (mode: PlannerBuildResult["mode"]): PlannerBuildResult => ({
  mode,
  reply: "Fallback reply.",
  followUpQuestions: [],
  proposals: [],
  suggestedReminders: [],
  memoryUpdates: {},
  sessionState: {
    draft: {},
    openQuestionIds: [],
    preferredTimeOfDay: null,
    preferredTimeReason: null,
    reminderPreference: null,
    lastClassification: null,
  },
});

Deno.test("uses the model-authored conversational reply when orchestration succeeds", async () => {
  const response = await buildOrchestratedPlannerResponse({
    guardedFetch: async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              reply: "Let's look at the day together and keep it simple.",
              mode: "conversational",
            }),
          },
        }],
      })),
    input: baseInput(),
    baseResult: baseResult("conversational"),
    openAIApiKey: "test-openai-key",
    model: "test-model",
  });

  assertEquals(response.mode, "conversational");
  assertEquals(
    response.reply,
    "Let's look at the day together and keep it simple.",
  );
});

Deno.test("normalizes 24-hour times in model-authored planner replies", async () => {
  const response = await buildOrchestratedPlannerResponse({
    guardedFetch: async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              reply:
                "Today stays open until 18:00, and your cleanest backup window is 21:15.",
              mode: "conversational",
            }),
          },
        }],
      })),
    input: baseInput(),
    baseResult: baseResult("conversational"),
    openAIApiKey: "test-openai-key",
    model: "test-model",
  });

  assertEquals(response.mode, "conversational");
  assertEquals(
    response.reply,
    "Today stays open until 6:00 pm, and your cleanest backup window is 9:15 pm.",
  );
});

Deno.test("skips orchestration for confirm-ready proposal responses", async () => {
  let fetchCalled = false;
  const response = await buildOrchestratedPlannerResponse({
    guardedFetch: async (_input: RequestInfo | URL, _init?: RequestInit) => {
      fetchCalled = true;
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              reply:
                "What makes this timing the right fit today?",
              mode: "proposal",
            }),
          },
        }],
      }));
    },
    input: baseInput(),
    baseResult: {
      ...baseResult("proposal"),
      reply: "I drafted this as a quest update. Review it and confirm when it looks right.",
      proposals: [{
        id: "proposal-1",
        kind: "update_quest",
        title: "Move Workout",
        summary: "Move Workout to 18:00.",
        payload: { taskId: "task-1" },
        status: "pending",
        readyToConfirm: true,
        missingFields: [],
      }],
    },
    openAIApiKey: "test-openai-key",
    model: "test-model",
  });

  assertEquals(response.mode, "proposal");
  assertEquals(response.proposals.length, 1);
  assertEquals(fetchCalled, false);
  assertEquals(
    response.reply,
    "I drafted this as a quest update. Review it and confirm when it looks right.",
  );
});

Deno.test("skips orchestration when a ready quest proposal is present in a mixed proposal turn", async () => {
  let fetchCalled = false;
  const response = await buildOrchestratedPlannerResponse({
    guardedFetch: async (_input: RequestInfo | URL, _init?: RequestInit) => {
      fetchCalled = true;
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              reply: "What makes this timing the right fit today?",
              mode: "proposal",
            }),
          },
        }],
      }));
    },
    input: baseInput(),
    baseResult: {
      ...baseResult("proposal"),
      reply: "I drafted this quest for you. Review it and confirm if it fits.",
      followUpQuestions: [{
        id: "time_reason",
        prompt: "What makes this timing the right fit today?",
        required: true,
        field: "time_reason",
      }],
      proposals: [
        {
          id: "proposal-1",
          kind: "create_quest",
          title: "Create Workout",
          summary: "Create Workout at 15:00.",
          payload: { taskText: "Workout" },
          status: "pending",
          readyToConfirm: true,
          missingFields: [],
        },
        {
          id: "proposal-2",
          kind: "update_campaign",
          title: "Update Campaign",
          summary: "Update Campaign Aurora.",
          payload: {},
          status: "pending",
          readyToConfirm: false,
          missingFields: ["campaign details"],
        },
      ],
      sessionState: {
        ...baseResult("proposal").sessionState,
        openQuestionIds: ["time_reason"],
      },
    },
    openAIApiKey: "test-openai-key",
    model: "test-model",
  });

  assertEquals(fetchCalled, false);
  assertEquals(response.followUpQuestions, []);
  assertEquals(response.sessionState.openQuestionIds, []);
  assertEquals(
    response.reply,
    "I drafted this quest for you. Review it and confirm if it fits.",
  );
});

Deno.test("sanitizes leaked follow-up state when a ready quest proposal already exists", () => {
  const response = sanitizeReadyQuestProposalResponse({
    ...baseResult("proposal"),
    reply: "Just to check: Do you prefer to work out right after your workday?",
    followUpQuestions: [{
      id: "time_of_day",
      prompt: "Do you prefer to work out right after your workday?",
      required: true,
      field: "time_of_day",
    }],
    proposals: [{
      id: "proposal-1",
      kind: "create_quest",
      title: "Create Workout",
      summary: "Create Workout at 15:00.",
      payload: { taskText: "Workout" },
      status: "pending",
      readyToConfirm: true,
      missingFields: [],
    }],
    sessionState: {
      ...baseResult("proposal").sessionState,
      openQuestionIds: ["time_of_day"],
    },
  });

  assertEquals(response.followUpQuestions, []);
  assertEquals(response.sessionState.openQuestionIds, []);
  assertEquals(
    response.reply,
    "I drafted this quest for you. Review it and confirm if it fits.",
  );
});

Deno.test("preserves calendar conflict notes when sanitizing ready quest proposals", () => {
  const response = sanitizeReadyQuestProposalResponse({
    ...baseResult("proposal"),
    reply: [
      "Just to check: Do you want to keep this time?",
      'Heads up: this overlaps with your saved calendar event "Dinner Reservation" on Thursday from 6:15 pm-7:00 pm.',
    ].join("\n\n"),
    followUpQuestions: [{
      id: "time_of_day",
      prompt: "Do you want to keep this time?",
      required: true,
      field: "time_of_day",
    }],
    proposals: [{
      id: "proposal-1",
      kind: "create_quest",
      title: "Create Workout",
      summary: "Create Workout at 18:00.",
      payload: { taskText: "Workout" },
      status: "pending",
      readyToConfirm: true,
      missingFields: [],
    }],
    sessionState: {
      ...baseResult("proposal").sessionState,
      openQuestionIds: ["time_of_day"],
    },
  });

  assertEquals(response.followUpQuestions, []);
  assertEquals(response.sessionState.openQuestionIds, []);
  assertEquals(
    response.reply,
    [
      "I drafted this quest for you. Review it and confirm if it fits.",
      'Heads up: this overlaps with your saved calendar event "Dinner Reservation" on Thursday from 6:15 pm-7:00 pm.',
    ].join("\n\n"),
  );
});

Deno.test("sends tone and availability grounding to the model for witty_sassy planner replies", async () => {
  const captured = {
    body: null as {
      messages?: Array<Record<string, string>>;
    } | null,
  };

  const response = await buildOrchestratedPlannerResponse({
    guardedFetch: async (_input: RequestInfo | URL, init?: RequestInit) => {
      captured.body = JSON.parse(String(init?.body ?? "{}")) as {
        messages?: Array<Record<string, string>>;
      };
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              reply:
                "Your calendar is wide open today. According to what I see, time is all you got.",
              mode: "schedule_read",
            }),
          },
        }],
      }));
    },
    input: {
      ...baseInput(),
      message: "Show me today's route.",
      tonePack: "witty_sassy",
      plannerContext: {
        ...baseInput().plannerContext,
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
    },
    baseResult: {
      ...baseResult("schedule_read"),
      reply:
        "Your calendar is wide open today. According to what I see, time is all you got.",
    },
    openAIApiKey: "test-openai-key",
    model: "test-model",
  });

  assertEquals(response.mode, "schedule_read");
  assertEquals(
    response.reply,
    "Your calendar is wide open today. According to what I see, time is all you got.",
  );

  const messages = captured.body?.messages ?? [];
  const systemMessage = messages[0]?.content ?? "";
  const userMessage = messages[1]?.content ?? "";
  const promptPayload = JSON.parse(userMessage) as {
    tonePack: string;
    deterministicContext: {
      availabilityFacts: {
        targetDate: string;
        dayStatus: string | null;
        scheduledItemCount: number;
        hasOpenings: boolean;
      };
    };
  };

  assertStringIncludes(
    systemMessage,
    "Voice: bold cheekiness, roasty edge, and a little swagger are allowed.",
  );
  assertStringIncludes(
    systemMessage,
    "Schedule facts come before interpretation.",
  );
  assertStringIncludes(
    systemMessage,
    "If deterministicContext.availabilityFacts says the day is open",
  );
  assertEquals(promptPayload.tonePack, "witty_sassy");
  assertEquals(
    promptPayload.deterministicContext.availabilityFacts.targetDate,
    "2026-04-18",
  );
  assertEquals(
    promptPayload.deterministicContext.availabilityFacts.dayStatus,
    "open",
  );
  assertEquals(
    promptPayload.deterministicContext.availabilityFacts.scheduledItemCount,
    0,
  );
  assertEquals(
    promptPayload.deterministicContext.availabilityFacts.hasOpenings,
    true,
  );
});

Deno.test("keeps upcoming-digest orchestration scoped to today and tomorrow", async () => {
  const captured = {
    body: null as {
      messages?: Array<Record<string, string>>;
    } | null,
  };

  const response = await buildOrchestratedPlannerResponse({
    guardedFetch: async (_input: RequestInfo | URL, init?: RequestInit) => {
      captured.body = JSON.parse(String(init?.body ?? "{}")) as {
        messages?: Array<Record<string, string>>;
      };
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              reply:
                "Today: Therapy at 14:00 and Workout at 15:00. Tomorrow: Inbox cleanup at 09:30. Tell me what feels most important, and I'll help from there.",
              mode: "schedule_read",
            }),
          },
        }],
      }));
    },
    input: {
      ...baseInput(),
      plannerContext: {
        ...baseInput().plannerContext,
        starterIntent: "upcoming_start",
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
    },
    baseResult: {
      ...baseResult("schedule_read"),
      reply:
        "Today: 14:00-15:00 Therapy; 15:00 Workout.\nTomorrow: 09:30 Inbox cleanup.",
    },
    openAIApiKey: "test-openai-key",
    model: "test-model",
  });

  assertEquals(response.mode, "schedule_read");
  assertEquals(
    response.reply,
    "Today: Therapy at 2:00 pm and Workout at 3:00 pm. Tomorrow: Inbox cleanup at 9:30 am. Tell me what feels most important, and I'll help from there.",
  );
  assertEquals(Boolean(captured.body), true);
});

Deno.test("does not rewrite the quest-capture starter prompt", async () => {
  const captured = {
    called: false,
  };

  const response = await buildOrchestratedPlannerResponse({
    guardedFetch: async (_input: RequestInfo | URL, _init?: RequestInit) => {
      captured.called = true;
      return new Response("unexpected");
    },
    input: {
      ...baseInput(),
      message: "Quest?",
      plannerContext: {
        ...baseInput().plannerContext,
        starterIntent: "quest_capture",
      },
    },
    baseResult: {
      ...baseResult("conversational"),
      reply: "Quest?",
      sessionState: {
        ...baseResult("conversational").sessionState,
        draft: {
          draftKind: "create_quest",
        },
        pendingStarterIntent: "quest_capture",
      },
    },
    openAIApiKey: "test-openai-key",
    model: "test-model",
  });

  assertEquals(response.mode, "conversational");
  assertEquals(response.reply, "Quest?");
  assertEquals(captured.called, false);
});

Deno.test("rewrites deterministic plan-day starter proposals when OpenAI is available", async () => {
  const captured = {
    called: false,
  };

  const response = await buildOrchestratedPlannerResponse({
    guardedFetch: async (_input: RequestInfo | URL, _init?: RequestInit) => {
      captured.called = true;
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              reply:
                "I mapped three draft quests around your fixed blocks. Review them and confirm what fits.",
              mode: "proposal",
            }),
          },
        }],
      }));
    },
    input: {
      ...baseInput(),
      message: "Plan my day",
      plannerContext: {
        ...baseInput().plannerContext,
        starterIntent: "plan_day",
      },
    },
    baseResult: {
      ...baseResult("proposal"),
      reply:
        "Today still has room around your fixed commitments. I drafted 3 quests for today to build the day out without crowding your fixed blocks. Review them and confirm what fits.",
      proposals: [{
        id: "proposal-1",
        kind: "create_quest",
        title: "Create Keep Morning review",
        summary:
          'Create a quest for "Keep Morning review" on 2026-04-18 at 10:30 am.',
        payload: {
          taskText: "Keep Morning review",
          taskDate: "2026-04-18",
          scheduledTime: "10:30",
        },
        status: "pending",
        readyToConfirm: true,
        missingFields: [],
      }],
      sessionState: {
        ...baseResult("proposal").sessionState,
      },
    },
    openAIApiKey: "test-openai-key",
    model: "test-model",
  });

  assertEquals(response.mode, "proposal");
  assertEquals(
    response.reply,
    "I mapped three draft quests around your fixed blocks. Review them and confirm what fits.",
  );
  assertEquals(captured.called, true);
});

Deno.test("rewrites the initial plan-day clarification turn with the focus prompt", async () => {
  let capturedSystemPrompt = "";

  const response = await buildOrchestratedPlannerResponse({
    guardedFetch: async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      capturedSystemPrompt = body.messages?.[0]?.content ?? "";
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              reply: "What are you feeling like focusing on right now?",
              mode: "conversational",
            }),
          },
        }],
      }));
    },
    input: {
      ...baseInput(),
      message: "Plan my day",
      plannerContext: {
        ...baseInput().plannerContext,
        starterIntent: "plan_day",
      },
    },
    baseResult: {
      ...baseResult("conversational"),
      reply: "What are you feeling like focusing on right now?",
      followUpQuestions: [{
        id: "details",
        prompt: "What are you feeling like focusing on right now?",
        required: true,
        field: "details",
        options: ["Website relaunch", "Something active", "Mom"],
      }],
      sessionState: {
        ...baseResult("conversational").sessionState,
        openQuestionIds: ["details"],
        pendingStarterIntent: "plan_day",
      },
    },
    openAIApiKey: "test-openai-key",
    model: "test-model",
  });

  assertEquals(response.mode, "conversational");
  assertEquals(
    response.reply,
    "What are you feeling like focusing on right now?",
  );
  assertStringIncludes(
    capturedSystemPrompt,
    "You are an intelligent companion whose only job in this step is to understand what the user wants to focus on.",
  );
});

Deno.test("rewrites deterministic no-room plan-day replies when OpenAI is available", async () => {
  const captured = {
    called: false,
  };

  const response = await buildOrchestratedPlannerResponse({
    guardedFetch: async (_input: RequestInfo | URL, _init?: RequestInit) => {
      captured.called = true;
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              reply:
                "Today is already pretty full, so I wouldn't stack more on top unless something changes.",
              mode: "conversational",
            }),
          },
        }],
      }));
    },
    input: {
      ...baseInput(),
      message: "Plan my day",
      sessionState: {
        ...baseInput().sessionState,
        pendingStarterIntent: "plan_day",
      },
    },
    baseResult: {
      ...baseResult("conversational"),
      reply:
        "Today is already carrying about as much quest load as I want to give it.",
      sessionState: {
        ...baseResult("conversational").sessionState,
      },
    },
    openAIApiKey: "test-openai-key",
    model: "test-model",
  });

  assertEquals(response.mode, "conversational");
  assertEquals(
    response.reply,
    "Today is already pretty full, so I wouldn't stack more on top unless something changes.",
  );
  assertEquals(response.proposals.length, 0);
  assertEquals(captured.called, true);
});
