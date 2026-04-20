import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildOrchestratedPlannerResponse } from "./orchestrator.ts";
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
    guardedFetch: async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
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
  assertEquals(response.reply, "Let's look at the day together and keep it simple.");
});

Deno.test("preserves deterministic proposal state while rewriting the copy", async () => {
  const response = await buildOrchestratedPlannerResponse({
    guardedFetch: async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            reply: "I drafted this as a quest update. Review it and confirm when it looks right.",
            mode: "proposal",
          }),
        },
      }],
    })),
    input: baseInput(),
    baseResult: {
      ...baseResult("proposal"),
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
  assertEquals(response.reply, "I drafted this as a quest update. Review it and confirm when it looks right.");
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
              reply: "Your calendar is wide open today. According to what I see, time is all you got.",
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
      reply: "Your calendar is wide open today. According to what I see, time is all you got.",
    },
    openAIApiKey: "test-openai-key",
    model: "test-model",
  });

  assertEquals(response.mode, "schedule_read");
  assertEquals(response.reply, "Your calendar is wide open today. According to what I see, time is all you got.");

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

  assertStringIncludes(systemMessage, "Voice: bold cheekiness, roasty edge, and a little swagger are allowed.");
  assertStringIncludes(systemMessage, "Schedule facts come before interpretation.");
  assertStringIncludes(systemMessage, "If deterministicContext.availabilityFacts says the day is open");
  assertEquals(promptPayload.tonePack, "witty_sassy");
  assertEquals(promptPayload.deterministicContext.availabilityFacts.targetDate, "2026-04-18");
  assertEquals(promptPayload.deterministicContext.availabilityFacts.dayStatus, "open");
  assertEquals(promptPayload.deterministicContext.availabilityFacts.scheduledItemCount, 0);
  assertEquals(promptPayload.deterministicContext.availabilityFacts.hasOpenings, true);
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
              reply: "Today: Therapy at 14:00 and Workout at 15:00. Tomorrow: Inbox cleanup at 09:30. Tell me what feels most important, and I'll help from there.",
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
      reply: "Today: 14:00-15:00 Therapy; 15:00 Workout.\nTomorrow: 09:30 Inbox cleanup.",
    },
    openAIApiKey: "test-openai-key",
    model: "test-model",
  });

  assertEquals(response.mode, "schedule_read");
  assertEquals(
    response.reply,
    "Today: 14:00-15:00 Therapy; 15:00 Workout.\nTomorrow: 09:30 Inbox cleanup.",
  );
  assertEquals(captured.body, null);
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
