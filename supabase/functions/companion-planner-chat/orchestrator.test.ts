import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
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
