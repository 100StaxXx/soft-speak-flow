import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import type { ClassificationHint, PlannerBuildInput } from "./planner.ts";
import { buildPlannerResponse } from "./planner.ts";
import { enrichQuestPlannerResult } from "./questEnrichment.ts";
import { buildOrchestratedPlannerResponse } from "./orchestrator.ts";
import { maybeApplyRemotePlannerOptimizer } from "./schedulerOptimizer.ts";

const OPTIMIZER_URL = "http://127.0.0.1:8010/optimize";

const QUEST_HINT: ClassificationHint = {
  type: "quest",
  confidence: 0.96,
  reasoning: "Actionable scheduling request",
};

const buildInput = (
  overrides: Partial<PlannerBuildInput> = {},
): PlannerBuildInput => ({
  message: "clean the house, work on the app, and workout later",
  currentDate: "2026-04-20",
  currentDateTime: "2026-04-20T15:50:00-07:00",
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
    text: "clean the house, work on the app, and workout later",
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
  classificationHint: QUEST_HINT,
  plannerContext: {
    tasks: [],
    inboxTasks: [],
    activeEpics: [],
    rituals: [],
    calendarEvents: [],
    contactsNeedingAttention: [],
    reflectionSignals: [],
    careSignals: null,
    briefingContext: null,
    starterIntent: "general",
    priorityScores: [],
    scheduleInsights: {
      horizon: "day",
      selectedDate: "2026-04-20",
      dayLoads: [
        {
          date: "2026-04-20",
          totalMinutes: 120,
          taskCount: 2,
          status: "balanced",
        },
        {
          date: "2026-04-21",
          totalMinutes: 45,
          taskCount: 1,
          status: "open",
        },
      ],
      overloadedDates: [],
      emptyDates: ["2026-04-21"],
      conflicts: [],
      suggestedSlots: [
        {
          date: "2026-04-20",
          time: "17:15",
          endTime: "18:15",
          score: 88,
          reason: "Strong after-work opening",
        },
        {
          date: "2026-04-21",
          time: "18:00",
          endTime: "20:00",
          score: 80,
          reason: "Backup evening window",
        },
      ],
      moveSuggestions: [],
      summary: "Today has room after work.",
    },
    plannerMemory: {
      tonePack: "soft",
      preferredTimeOfDay: "evening",
      preferredTimeReason: "After work is easiest.",
      reminderMinutesBefore: 15,
      wakeTime: "07:00",
      windDownTime: "22:00",
      peakProductivityTimes: ["09:00-11:00"],
      preferredWindows: [],
    },
  },
  ...overrides,
});

const runPlannerStack = async (
  input: PlannerBuildInput,
) => {
  const local = buildPlannerResponse(input);
  const remote = await maybeApplyRemotePlannerOptimizer({
    input,
    result: local,
    optimizerEnabled: true,
    optimizerUrl: OPTIMIZER_URL,
    optimizerSecret: "",
    fetchImpl: fetch,
  });
  const enriched = await enrichQuestPlannerResult({
    fetchImpl: fetch,
    input,
    baseResult: remote,
  });
  return buildOrchestratedPlannerResponse({
    guardedFetch: fetch,
    input,
    baseResult: enriched,
    openAIApiKey: "",
  });
};

Deno.test("rollout smoke: easy same-day bundle returns scheduled drafts", async () => {
  const input = buildInput({
    message: "clean the house and workout later",
    parsedInput: {
      text: "clean the house and workout later",
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
      ...buildInput().plannerContext,
      calendarEvents: [],
    },
  });

  const result = await runPlannerStack(input);

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals.length, 2);
  for (const proposal of result.proposals) {
    const payload = proposal.payload as Record<string, unknown>;
    assertEquals(payload.optimizerSource, "remote");
    assertEquals(payload.optimizerMode, "day");
    assertEquals(payload.usedFallback, false);
    assertEquals(payload.draftStatus, "scheduled_draft");
    assert(typeof payload.reasonSummary === "string");
    assertEquals(typeof payload.taskDate, "string");
    assertEquals(typeof payload.scheduledTime, "string");
    assert(proposal.readyToConfirm);
  }
});

Deno.test("rollout smoke: crowded day bundle can spill into tomorrow", async () => {
  const input = buildInput({
    plannerContext: {
      ...buildInput().plannerContext,
      calendarEvents: [
        {
          id: "sales-meeting",
          title: "Sales Meeting",
          start: "2026-04-20T16:00:00-07:00",
          end: "2026-04-20T17:00:00-07:00",
          isAllDay: false,
          provider: "google",
          readOnly: true,
        },
        {
          id: "dinner",
          title: "Dinner",
          start: "2026-04-20T19:00:00-07:00",
          end: "2026-04-20T20:30:00-07:00",
          isAllDay: false,
          provider: "google",
          readOnly: true,
        },
      ],
    },
  });

  const result = await runPlannerStack(input);
  const taskDates = result.proposals.map((proposal) => {
    const payload = proposal.payload as Record<string, unknown>;
    return payload.taskDate;
  });

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals.length, 3);
  assert(taskDates.includes("2026-04-21"));
});

Deno.test("rollout smoke: explicit date requests stay pinned and degrade safely on conflict", async () => {
  const input = buildInput({
    message: "Workout on April 23, 2026 at 6:00 pm",
    currentDateTime: "2026-04-20T15:50:00-07:00",
    horizon: "week",
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
      category: null,
      newTitle: null,
    },
    plannerContext: {
      ...buildInput().plannerContext,
      scheduleInsights: {
        ...buildInput().plannerContext.scheduleInsights!,
        horizon: "week",
        selectedDate: "2026-04-23",
        dayLoads: [
          {
            date: "2026-04-23",
            totalMinutes: 240,
            taskCount: 4,
            status: "busy",
          },
        ],
        emptyDates: [],
        suggestedSlots: [],
      },
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

  const result = await runPlannerStack(input);
  const proposal = result.proposals[0];
  const payload = proposal.payload as Record<string, unknown>;

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals.length, 1);
  assertEquals(payload.taskDate, "2026-04-23");
  assertEquals(payload.scheduledTime, "18:00");
  assert(result.reply.toLowerCase().includes("saved calendar event"));
});
