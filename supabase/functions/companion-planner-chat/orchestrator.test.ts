import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildOrchestratedPlannerResponse,
  DEFAULT_COMPANION_PLANNER_MODEL,
  resolveCompanionPlannerModel,
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

Deno.test("resolveCompanionPlannerModel uses default unless an override is set", () => {
  assertEquals(
    resolveCompanionPlannerModel(() => null),
    DEFAULT_COMPANION_PLANNER_MODEL,
  );
  assertEquals(
    resolveCompanionPlannerModel((name) =>
      name === "OPENAI_COMPANION_PLANNER_MODEL" ? "gpt-5" : null
    ),
    "gpt-5",
  );
});

Deno.test("planner orchestration request body uses the resolved default model", async () => {
  const requestBodies: Array<Record<string, unknown>> = [];

  await buildOrchestratedPlannerResponse({
    guardedFetch: async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestBodies.push(
        JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
      );
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              reply: "Let's keep today simple.",
              mode: "conversational",
            }),
          },
        }],
      }));
    },
    input: baseInput(),
    baseResult: baseResult("conversational"),
    openAIApiKey: "test-openai-key",
  });

  assertEquals(requestBodies[0]?.model, DEFAULT_COMPANION_PLANNER_MODEL);
  assertEquals(requestBodies[0]?.reasoning_effort, "none");
  assertEquals(requestBodies[0]?.max_completion_tokens, 260);
  assertEquals("temperature" in requestBodies[0], false);
  assertEquals("max_tokens" in requestBodies[0], false);
  assertEquals(
    (requestBodies[0]?.messages as Array<{ role?: string }>)[0]?.role,
    "developer",
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
      reply:
        "I prepared this quest update. Review it and confirm when it looks right.",
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
    "I prepared this quest update. Review it and confirm when it looks right.",
  );
});

Deno.test("skips orchestration for reflection bridge starter schedule reads", async () => {
  let fetchCalled = false;
  const response = await buildOrchestratedPlannerResponse({
    guardedFetch: async (_input: RequestInfo | URL, _init?: RequestInit) => {
      fetchCalled = true;
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              reply: "Tomorrow needs a whole new plan.",
              mode: "schedule_read",
            }),
          },
        }],
      }));
    },
    input: {
      ...baseInput(),
      message: "Prepare me for tomorrow",
      plannerContext: {
        ...baseInput().plannerContext,
        starterIntent: "briefing_followup",
      },
    },
    baseResult: {
      ...baseResult("schedule_read"),
      reply:
        "You wanted to carry this into tomorrow: Take a short walk before jumping back into messages. Tomorrow has some room, so the goal is starting with the right move instead of adding more noise. First move: Finalize launch checklist.",
      structuredResponse: {
        intent: {
          intentType: "conversation",
          timeHorizon: "short_term",
          isRecurring: false,
          shouldCreateQuest: false,
          shouldPromptCampaign: false,
        },
        planDay: null,
        weeklyPlan: null,
        reflectionBridge: {
          message:
            "You wanted to carry this into tomorrow: Take a short walk before jumping back into messages. Tomorrow has some room, so the goal is starting with the right move instead of adding more noise. First move: Finalize launch checklist.",
          carryForward: "Take a short walk before jumping back into messages.",
          tomorrowSummary: "light",
          firstAction: null,
          tomorrowSchedule: [],
        },
        comingUp: null,
      },
    },
    openAIApiKey: "test-openai-key",
    model: "test-model",
  });

  assertEquals(fetchCalled, false);
  assertStringIncludes(
    response.reply,
    "Take a short walk before jumping back into messages.",
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

Deno.test("skips orchestration for advance-campaign starter responses", async () => {
  let fetchCalled = false;
  const response = await buildOrchestratedPlannerResponse({
    guardedFetch: async (_input: RequestInfo | URL, _init?: RequestInit) => {
      fetchCalled = true;
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              reply: "Push the campaign harder.",
              mode: "proposal",
            }),
          },
        }],
      }));
    },
    input: {
      ...baseInput(),
      message: "Advance my campaign",
      plannerContext: {
        ...baseInput().plannerContext,
        starterIntent: "advance_campaign_start",
      },
    },
    baseResult: {
      ...baseResult("proposal"),
      reply:
        "Launch prep looks stalled. I drafted the cleanest next step so you can confirm it without overthinking it.",
      proposals: [{
        id: "proposal-1",
        kind: "create_quest",
        title: "Create Progress Launch prep",
        summary: "Create a quest for progress.",
        payload: { taskText: "Progress Launch prep", epicId: "epic-1" },
        status: "pending",
        readyToConfirm: true,
        missingFields: [],
      }],
      structuredResponse: {
        intent: {
          intentType: "campaign",
          timeHorizon: "long_term",
          isRecurring: false,
          shouldCreateQuest: true,
          shouldPromptCampaign: false,
        },
        planDay: null,
        comingUp: null,
        campaignMomentum: {
          message:
            "Launch prep looks stalled. I drafted the cleanest next step so you can confirm it without overthinking it.",
          campaignId: "epic-1",
          campaignTitle: "Launch prep",
          status: "stalled",
          interventionLevel: "protect",
          statusReason:
            "There is no concrete next step tied to this campaign right now.",
          healthSnapshot: null,
          pressureSignals: [
            "No concrete next quest is linked yet.",
          ],
          nextStep: null,
          supportActions: [],
        },
      },
    },
    openAIApiKey: "test-openai-key",
    model: "test-model",
  });

  assertEquals(fetchCalled, false);
  assertEquals(
    response.reply,
    "Launch prep looks stalled. I drafted the cleanest next step so you can confirm it without overthinking it.",
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

Deno.test("preserves context-protected unquoted dashed titles while sanitizing", () => {
  const response = sanitizeReadyQuestProposalResponse(
    {
      ...baseResult("schedule_read"),
      reply: "Got it. Let's lean into Budget - review.",
    },
    { protectedDataText: ["Budget - review"] },
  );

  assertStringIncludes(response.reply, "Budget - review");
  assertEquals(response.reply.includes("Budget. Review"), false);
});

Deno.test("orchestration preserves context-protected dashed titles in fallback replies", async () => {
  const response = await buildOrchestratedPlannerResponse({
    guardedFetch: async () => {
      throw new Error("unexpected fetch");
    },
    input: {
      ...baseInput(),
      plannerContext: {
        ...baseInput().plannerContext,
        tasks: [{
          id: "task-budget-review",
          title: "Budget - review",
          taskDate: "2026-04-18",
          scheduledTime: null,
          estimatedDuration: 20,
          recurrencePattern: null,
        }],
        priorityScores: [{
          id: "task:task-budget-review",
          kind: "task",
          title: "Budget - review",
          score: 92,
          reasons: ["This is the clearest focus item."],
          taskId: "task-budget-review",
        }],
      },
    },
    baseResult: {
      ...baseResult("conversational"),
      reply: "Got it. Let's lean into Budget - review.",
    },
    openAIApiKey: "",
  });

  assertStringIncludes(response.reply, "Budget - review");
  assertEquals(response.reply.includes("Budget. Review"), false);
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
    "Today: 2:00 pm-3:00 pm Therapy; 3:00 pm Workout.\nTomorrow: 9:30 am Inbox cleanup.",
  );
  assertEquals(captured.body, null);
});

Deno.test("does not rewrite deterministic plan-day starter proposals", async () => {
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
  assertStringIncludes(response.reply, "I drafted 3 quests for today");
  assertEquals(captured.called, false);
});

Deno.test("does not rewrite the initial deterministic plan-day clarification turn", async () => {
  let called = false;

  const response = await buildOrchestratedPlannerResponse({
    guardedFetch: async (_input: RequestInfo | URL, _init?: RequestInit) => {
      called = true;
      return new Response("unexpected");
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
  assertEquals(called, false);
});

Deno.test("does not rewrite inferred plan-day clarification turns", async () => {
  let called = false;

  const response = await buildOrchestratedPlannerResponse({
    guardedFetch: async (_input: RequestInfo | URL, _init?: RequestInit) => {
      called = true;
      return new Response("unexpected");
    },
    input: {
      ...baseInput(),
      message: "Plan my day",
    },
    baseResult: {
      ...baseResult("conversational"),
      reply: "What kind of day are we making?",
      followUpQuestions: [{
        id: "details",
        prompt: "What kind of day are we making?",
        required: true,
        field: "details",
        options: ["Focused", "Light", "Catch-up"],
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
  assertEquals(response.reply, "What kind of day are we making?");
  assertEquals(response.followUpQuestions.length, 1);
  assertEquals(called, false);
});

Deno.test("does not rewrite deterministic no-room plan-day replies", async () => {
  const captured = {
    called: false,
  };
  const reply =
    "Today already has 3 quests lined up. Let's lean into what's there before stacking more on.";

  const response = await buildOrchestratedPlannerResponse({
    guardedFetch: async (_input: RequestInfo | URL, _init?: RequestInit) => {
      captured.called = true;
      return new Response("unexpected");
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
      reply,
      structuredResponse: {
        intent: {
          intentType: "conversation",
          timeHorizon: "today",
          isRecurring: false,
          shouldCreateQuest: false,
          shouldPromptCampaign: false,
        },
        planDay: {
          message: reply,
          dayAssessment: "busy",
          suggestedQuests: [],
          campaignFocus: null,
        },
        comingUp: null,
      },
      sessionState: {
        ...baseResult("conversational").sessionState,
      },
    },
    openAIApiKey: "test-openai-key",
    model: "test-model",
  });

  assertEquals(response.mode, "conversational");
  assertEquals(response.reply, reply);
  assertEquals(response.proposals.length, 0);
  assertEquals(captured.called, false);
});

Deno.test("ordinary plan-day turns do not enter the tool loop", async () => {
  let called = false;

  const response = await buildOrchestratedPlannerResponse({
    guardedFetch: async (_input: RequestInfo | URL, _init?: RequestInit) => {
      called = true;
      return new Response("unexpected");
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
      reply: "Today is open — let's draft a few quests.",
    },
    openAIApiKey: "test-openai-key",
    model: "test-model",
  });

  assertEquals(response.mode, "conversational");
  assertEquals(response.reply, "Today is open. Let's draft a few quests.");
  assertEquals(response.proposals.length, 0);
  assertEquals(called, false);
});

Deno.test("plan-day clarification turns bypass tool loop and polish", async () => {
  let toolsSent = false;
  let polishCalled = false;

  const response = await buildOrchestratedPlannerResponse({
    guardedFetch: async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      if (Array.isArray(body?.tools) && body.tools.length > 0) {
        toolsSent = true;
      } else {
        polishCalled = true;
      }
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              reply: "What kind of energy are we working with?",
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
      reply: "What are you feeling like focusing on this morning?",
      followUpQuestions: [{
        id: "details",
        field: "details",
        prompt: "What are you feeling like focusing on this morning?",
        reason: "Once I know the direction, I can shape the rest.",
        required: true,
        options: ["Focused", "Light", "Catch-up"],
      }],
    },
    openAIApiKey: "test-openai-key",
    model: "test-model",
  });

  assertEquals(toolsSent, false);
  assertEquals(polishCalled, false);
  assertEquals(response.followUpQuestions.length, 1);
  assertEquals(
    response.reply,
    "What are you feeling like focusing on this morning?",
  );
});

Deno.test("refinement turn seeds tool loop from activeDayPlan and applies move_quest", async () => {
  const captured: { userPrompt: string; isRefining: boolean | null } = {
    userPrompt: "",
    isRefining: null,
  };

  const response = await buildOrchestratedPlannerResponse({
    guardedFetch: async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      const userMessage = body?.messages?.find(
        (m: { role: string }) => m.role === "user",
      );
      const userContent = userMessage?.content ?? "";
      if (!captured.userPrompt) {
        captured.userPrompt = userContent;
        try {
          const parsed = JSON.parse(userContent);
          captured.isRefining = parsed.refinementMode ?? null;
        } catch {
          captured.isRefining = null;
        }
      }
      const isFirst = body?.messages?.length === 2;
      if (isFirst) {
        return new Response(JSON.stringify({
          choices: [{
            message: {
              role: "assistant",
              content: null,
              tool_calls: [{
                id: "call_move",
                type: "function",
                function: {
                  name: "move_quest",
                  arguments: JSON.stringify({
                    proposalId: "block-existing-1",
                    startTime: "19:00",
                  }),
                },
              }],
            },
            finish_reason: "tool_calls",
          }],
        }));
      }
      return new Response(JSON.stringify({
        choices: [{
          message: {
            role: "assistant",
            content: "Pushed Workout to 7 PM.",
          },
          finish_reason: "stop",
        }],
      }));
    },
    input: {
      ...baseInput(),
      message: "push the workout to 7",
      activeDayPlan: {
        id: "plan-1",
        date: "2026-04-18",
        status: "draft",
        updatedAt: "2026-04-18T09:00:00.000Z",
        blocks: [
          {
            id: "block-existing-1",
            proposalId: "block-existing-1",
            questId: null,
            title: "Workout",
            startTime: "17:00",
            durationMinutes: 45,
            energyType: "physical",
            source: "optimization",
            reasoning: "Recovery block.",
          },
        ],
      },
    },
    baseResult: {
      ...baseResult("conversational"),
      reply: "Anything else to adjust?",
    },
    openAIApiKey: "test-openai-key",
    model: "test-model",
  });

  assertEquals(captured.isRefining, true);
  assertEquals(response.mode, "proposal");
  assertEquals(response.proposals.length, 1);
  assertEquals(
    (response.proposals[0]?.payload as { scheduledTime?: string | null })
      .scheduledTime,
    "19:00",
  );
  assertEquals(response.dayPlan?.blocks.length, 1);
  assertEquals(response.dayPlan?.blocks[0]?.startTime, "19:00");
});

Deno.test("refinement turn drops a block via drop_quest while keeping the rest", async () => {
  const response = await buildOrchestratedPlannerResponse({
    guardedFetch: async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      if (body?.messages?.length === 2) {
        return new Response(JSON.stringify({
          choices: [{
            message: {
              role: "assistant",
              content: null,
              tool_calls: [{
                id: "call_drop",
                type: "function",
                function: {
                  name: "drop_quest",
                  arguments: JSON.stringify({
                    proposalId: "block-2",
                    reason: "User asked to skip emails today.",
                  }),
                },
              }],
            },
            finish_reason: "tool_calls",
          }],
        }));
      }
      return new Response(JSON.stringify({
        choices: [{
          message: {
            role: "assistant",
            content: "Dropped the email block. Two quests left.",
          },
          finish_reason: "stop",
        }],
      }));
    },
    input: {
      ...baseInput(),
      message: "drop the email block",
      activeDayPlan: {
        id: "plan-1",
        date: "2026-04-18",
        status: "draft",
        updatedAt: "2026-04-18T09:00:00.000Z",
        blocks: [
          {
            id: "block-1",
            proposalId: "block-1",
            questId: null,
            title: "Outline launch email",
            startTime: "10:00",
            durationMinutes: 45,
            energyType: "deep",
            source: "optimization",
            reasoning: "Open mid-morning slot.",
          },
          {
            id: "block-2",
            proposalId: "block-2",
            questId: null,
            title: "Reply to inbox",
            startTime: "13:00",
            durationMinutes: 20,
            energyType: "admin",
            source: "optimization",
            reasoning: "Quick admin sweep.",
          },
        ],
      },
    },
    baseResult: {
      ...baseResult("conversational"),
      reply: "Anything else to adjust?",
    },
    openAIApiKey: "test-openai-key",
    model: "test-model",
  });

  assertEquals(response.mode, "proposal");
  assertEquals(response.proposals.length, 1);
  assertEquals(response.dayPlan?.blocks.length, 1);
  assertEquals(response.dayPlan?.blocks[0]?.id, "block-1");
});

Deno.test("logs plan_day_tool_fallback with reason=openai_error when OpenAI returns 500", async () => {
  const captured: { reason: string | null; payload: unknown } = {
    reason: null,
    payload: null,
  };
  const originalWarn = console.warn;
  console.warn = ((message: unknown, payload?: unknown) => {
    if (
      typeof message === "string" &&
      message.includes("plan_day_tool_fallback")
    ) {
      captured.payload = payload;
      const reason =
        typeof payload === "object" && payload !== null && "reason" in payload
          ? (payload as { reason?: unknown }).reason
          : null;
      captured.reason = typeof reason === "string" ? reason : null;
    }
  }) as typeof console.warn;

  try {
    await buildOrchestratedPlannerResponse({
      guardedFetch: async () => new Response("server error", { status: 500 }),
      input: {
        ...baseInput(),
        message: "push the workout later",
        activeDayPlan: {
          id: "plan-1",
          date: "2026-04-18",
          status: "draft",
          updatedAt: "2026-04-18T09:00:00.000Z",
          blocks: [
            {
              id: "block-existing-1",
              proposalId: "block-existing-1",
              questId: null,
              title: "Workout",
              startTime: "17:00",
              durationMinutes: 45,
              energyType: "physical",
              source: "optimization",
              reasoning: "Recovery block.",
            },
          ],
        },
      },
      baseResult: {
        ...baseResult("conversational"),
        reply: "Today is open.",
      },
      openAIApiKey: "test-openai-key",
      model: "test-model",
    });
  } finally {
    console.warn = originalWarn;
  }

  assertEquals(captured.reason, "openai_error");
  assertEquals(
    typeof captured.payload === "object" && captured.payload !== null &&
      (captured.payload as { model?: unknown }).model,
    "test-model",
  );
});

Deno.test("logs plan_day_tool_fallback with reason=exception when tool execution throws", async () => {
  const captured: { reasons: string[] } = { reasons: [] };
  const originalWarn = console.warn;
  console.warn = ((message: unknown, payload?: unknown) => {
    if (
      typeof message === "string" &&
      message.includes("plan_day_tool_fallback") &&
      typeof payload === "object" &&
      payload !== null &&
      "reason" in payload
    ) {
      const reason = (payload as { reason?: unknown }).reason;
      if (typeof reason === "string") captured.reasons.push(reason);
    }
  }) as typeof console.warn;

  try {
    await buildOrchestratedPlannerResponse({
      guardedFetch: () => {
        throw new Error("network kaboom");
      },
      input: {
        ...baseInput(),
        message: "push the workout later",
        activeDayPlan: {
          id: "plan-1",
          date: "2026-04-18",
          status: "draft",
          updatedAt: "2026-04-18T09:00:00.000Z",
          blocks: [
            {
              id: "block-existing-1",
              proposalId: "block-existing-1",
              questId: null,
              title: "Workout",
              startTime: "17:00",
              durationMinutes: 45,
              energyType: "physical",
              source: "optimization",
              reasoning: "Recovery block.",
            },
          ],
        },
      },
      baseResult: {
        ...baseResult("conversational"),
        reply: "Today is open.",
      },
      openAIApiKey: "test-openai-key",
      model: "test-model",
    });
  } finally {
    console.warn = originalWarn;
  }

  assertEquals(captured.reasons.includes("exception"), true);
});

Deno.test("committed plans are not seeded for refinement", async () => {
  let toolsSent = false;

  const response = await buildOrchestratedPlannerResponse({
    guardedFetch: async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      if (Array.isArray(body?.tools) && body.tools.length > 0) {
        toolsSent = true;
      }
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              reply: "Sounds good!",
              mode: "conversational",
            }),
          },
        }],
      }));
    },
    input: {
      ...baseInput(),
      message: "thanks",
      activeDayPlan: {
        id: "plan-1",
        date: "2026-04-18",
        status: "committed",
        updatedAt: "2026-04-18T09:00:00.000Z",
        blocks: [
          {
            id: "block-1",
            proposalId: null,
            questId: "task-1",
            title: "Outline launch email",
            startTime: "10:00",
            durationMinutes: 45,
            energyType: "deep",
            source: "optimization",
            reasoning: "Open mid-morning slot.",
          },
        ],
      },
    },
    baseResult: {
      ...baseResult("conversational"),
      reply: "Sounds good!",
    },
    openAIApiKey: "test-openai-key",
    model: "test-model",
  });

  assertEquals(toolsSent, false);
  assertEquals(response.dayPlan ?? null, null);
});
