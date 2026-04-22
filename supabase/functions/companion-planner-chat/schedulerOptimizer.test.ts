import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import type {
  PlannerOptimizerRequest,
} from "../../../src/shared/plannerOptimizer.ts";
import type { PlannerBuildInput, PlannerBuildResult } from "./planner.ts";
import {
  maybeApplyRemotePlannerOptimizer,
} from "./schedulerOptimizer.ts";

const basePlannerInput = (): PlannerBuildInput => ({
  message: "clean the house and workout later",
  currentDate: "2026-04-20",
  currentDateTime: "2026-04-20T15:50:00-07:00",
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
  classificationHint: {
    type: "quest",
    confidence: 0.9,
    reasoning: "Action bundle",
  },
  plannerContext: {
    tasks: [],
    inboxTasks: [],
    activeEpics: [],
    rituals: [],
    calendarEvents: [],
    scheduleInsights: {
      horizon: "day",
      selectedDate: "2026-04-20",
      dayLoads: [],
      overloadedDates: [],
      emptyDates: [],
      conflicts: [],
      suggestedSlots: [],
      moveSuggestions: [],
      summary: "Today has room after work.",
    },
    plannerMemory: {
      wakeTime: "07:00",
      windDownTime: "22:00",
      preferredTimeOfDay: "evening",
      preferredTimeReason: null,
    },
  },
  timezone: "America/Los_Angeles",
});

const basePlannerResult = (): PlannerBuildResult => ({
  mode: "proposal",
  reply: "I drafted two quests for today.",
  followUpQuestions: [],
  proposals: [
    {
      id: "proposal-1",
      kind: "create_quest",
      title: "Create Clean The House",
      summary: 'Create a quest for "Clean The House".',
      reasoning: null,
      payload: {
        taskText: "Clean The House",
        taskDate: "2026-04-20",
        scheduledTime: null,
        estimatedDuration: 60,
        source: "optimizer",
        optimizerMode: "day",
        derivedFromMessage: "clean the house",
      },
      status: "pending",
      readyToConfirm: true,
      missingFields: [],
    },
  ],
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

const buildOptimizerProposal = (input: {
  id: string;
  title: string;
  taskText?: string;
  taskDate?: string | null;
  scheduledTime?: string | null;
  estimatedDuration?: number | null;
  category?: string | null;
  contactId?: string | null;
}): PlannerBuildResult["proposals"][number] => ({
  id: input.id,
  kind: "create_quest",
  title: input.title,
  summary: `Create a quest for "${input.taskText ?? input.title}".`,
  reasoning: null,
  payload: {
    taskText: input.taskText ?? input.title,
    taskDate: input.taskDate ?? "2026-04-20",
    scheduledTime: input.scheduledTime ?? null,
    estimatedDuration: input.estimatedDuration ?? 60,
    category: input.category ?? null,
    contactId: input.contactId ?? null,
    source: "optimizer",
    optimizerMode: "day",
    derivedFromMessage: input.taskText ?? input.title,
  },
  status: "pending",
  readyToConfirm: true,
  missingFields: [],
});

Deno.test("remote optimizer success enriches proposals with remote scheduling metadata", async () => {
  const result = await maybeApplyRemotePlannerOptimizer({
    input: basePlannerInput(),
    result: basePlannerResult(),
    optimizerEnabled: true,
    optimizerUrl: "https://optimizer.test/optimize",
    optimizerSecret: "",
    fetchImpl: async () =>
      new Response(JSON.stringify({
        drafts: [{
          task_id: "proposal-1",
          title: "Clean The House",
          start: "2026-04-21T18:15:00-07:00",
          end: "2026-04-21T19:15:00-07:00",
          status: "tentative_time",
          slot_score: 49,
          hard_conflict: false,
          soft_conflicts: ["late_day_pressure"],
          reason_codes: ["after_work_window", "fragmented_slot"],
          reason_summary:
            "Scheduled after work to match your availability. It uses a tighter gap than ideal. consider moving it earlier if the day tightens.",
          fallback_to_inbox: false,
        }],
        unscheduled: [],
      })),
  });

  const payload = result.proposals[0]?.payload as Record<string, unknown>;
  assertEquals(payload.scheduledTime, "18:15");
  assertEquals(payload.taskDate, "2026-04-21");
  assertEquals(payload.optimizerSource, "remote");
  assertEquals(payload.optimizerMode, "day");
  assertEquals(payload.usedFallback, false);
  assertEquals(payload.draftStatus, "tentative_time");
  assertEquals(payload.schedulingConfidence, "medium");
  assertEquals(payload.reasonSummary,
    "Scheduled after work to match your availability. It uses a tighter gap than ideal. consider moving it earlier if the day tightens.");
  assertEquals(payload.reminderEnabled, true);
  assertEquals(payload.reminderMinutesBefore, 15);
});

Deno.test("remote optimizer inbox fallbacks preserve remote fallback telemetry", async () => {
  const result = await maybeApplyRemotePlannerOptimizer({
    input: basePlannerInput(),
    result: basePlannerResult(),
    optimizerEnabled: true,
    optimizerUrl: "https://optimizer.test/optimize",
    optimizerSecret: "",
    fetchImpl: async () =>
      new Response(JSON.stringify({
        drafts: [{
          task_id: "proposal-1",
          title: "Clean The House",
          status: "needs_scheduling",
          slot_score: 0,
          hard_conflict: false,
          soft_conflicts: ["no_safe_slot_found"],
          reason_codes: ["needs_manual_scheduling"],
          reason_summary:
            "I kept this as a draft because I couldn't find a clean slot yet. approve it later or place it manually.",
          fallback_to_inbox: true,
        }],
        unscheduled: [{
          task_id: "proposal-1",
          title: "Clean The House",
          estimated_duration: 60,
          reason_codes: ["needs_manual_scheduling"],
        }],
      })),
  });

  const payload = result.proposals[0]?.payload as Record<string, unknown>;
  assertEquals(payload.taskDate, null);
  assertEquals(payload.scheduledTime, null);
  assertEquals(payload.optimizerSource, "remote");
  assertEquals(payload.usedFallback, true);
  assertEquals(payload.fallbackToInbox, true);
  assertEquals(payload.questSource, "inbox");
});

Deno.test("remote optimizer failure falls back to inbox", async () => {
  const result = await maybeApplyRemotePlannerOptimizer({
    input: basePlannerInput(),
    result: basePlannerResult(),
    optimizerEnabled: true,
    optimizerUrl: "https://optimizer.test/optimize",
    optimizerSecret: "",
    fetchImpl: async () => new Response("nope", { status: 503 }),
  });

  assertEquals(result.mode, "proposal");
  assertEquals(result.reply, "I drafted 1 quest for your inbox. Review and confirm what fits.");
  assertEquals(result.proposals.length, 1);
  const payload = result.proposals[0]?.payload as Record<string, unknown>;
  assertEquals(payload.taskDate, null);
  assertEquals(payload.scheduledTime, null);
  assertEquals(payload.questSource, "inbox");
  assertEquals(payload.optimizerSource, "fallback");
  assertEquals(payload.usedFallback, true);
  assertEquals(payload.fallbackToInbox, true);
});

Deno.test("remote optimizer thrown fetch errors fall back to inbox", async () => {
  const result = await maybeApplyRemotePlannerOptimizer({
    input: basePlannerInput(),
    result: basePlannerResult(),
    optimizerEnabled: true,
    optimizerUrl: "https://optimizer.test/optimize",
    optimizerSecret: "",
    fetchImpl: async () => {
      throw new Error("socket hang up");
    },
  });

  assertEquals(result.mode, "proposal");
  assertEquals(result.reply, "I drafted 1 quest for your inbox. Review and confirm what fits.");
  assertEquals(result.proposals.length, 1);
  const payload = result.proposals[0]?.payload as Record<string, unknown>;
  assertEquals(payload.questSource, "inbox");
  assertEquals(payload.optimizerSource, "fallback");
});

Deno.test("remote optimizer disabled passes through local result unchanged", async () => {
  const base = basePlannerResult();
  const result = await maybeApplyRemotePlannerOptimizer({
    input: basePlannerInput(),
    result: base,
    optimizerEnabled: false,
    fetchImpl: async () => {
      throw new Error("should not be called");
    },
  });

  assertEquals(result.mode, "proposal");
  assertEquals(result.proposals.length, 1);
  const payload = result.proposals[0]?.payload as Record<string, unknown>;
  assertEquals(payload.taskDate, "2026-04-20");
});

Deno.test("remote optimizer request shaping uses actual durations and mapped energy types", async () => {
  let capturedRequest: PlannerOptimizerRequest | null = null;
  let capturedSignal: unknown = null;
  const result: PlannerBuildResult = {
    ...basePlannerResult(),
    proposals: [
      buildOptimizerProposal({
        id: "proposal-physical",
        title: "Create Workout",
        taskText: "Workout",
        estimatedDuration: 30,
        category: "body",
      }),
      buildOptimizerProposal({
        id: "proposal-errand",
        title: "Create Clean The House",
        taskText: "Clean The House",
        estimatedDuration: 45,
        category: "home",
      }),
      buildOptimizerProposal({
        id: "proposal-admin",
        title: "Create Reply To Email",
        taskText: "Reply To Email",
        estimatedDuration: 20,
        category: null,
      }),
      buildOptimizerProposal({
        id: "proposal-social",
        title: "Create Reach Out To Maya",
        taskText: "Reach Out To Maya",
        estimatedDuration: 15,
        contactId: "contact-123",
      }),
      buildOptimizerProposal({
        id: "proposal-deep",
        title: "Create Work On The App",
        taskText: "Work On The App",
        estimatedDuration: 120,
        category: "work",
      }),
    ],
  };
  const input: PlannerBuildInput = {
    ...basePlannerInput(),
    plannerContext: {
      ...basePlannerInput().plannerContext,
      tasks: [
        {
          id: "task-physical",
          title: "Gym Session",
          taskDate: "2026-04-20",
          category: "body",
          scheduledTime: "08:00",
          estimatedDuration: 45,
          recurrencePattern: null,
          completed: false,
        },
        {
          id: "task-errand",
          title: "Clean Kitchen",
          taskDate: "2026-04-20",
          category: "home",
          scheduledTime: "10:00",
          estimatedDuration: 30,
          recurrencePattern: null,
          completed: false,
        },
        {
          id: "task-admin",
          title: "Reply To Email",
          taskDate: "2026-04-20",
          category: null,
          scheduledTime: "11:00",
          estimatedDuration: 20,
          recurrencePattern: null,
          completed: false,
        },
      ],
      inboxTasks: [
        {
          id: "task-social",
          title: "Reach Out To Maya",
          taskDate: "2026-04-20",
          category: null,
          scheduledTime: "13:00",
          estimatedDuration: 15,
          recurrencePattern: null,
          completed: false,
          contactId: "contact-123",
        },
        {
          id: "task-deep",
          title: "Work On The App",
          taskDate: "2026-04-20",
          category: "work",
          scheduledTime: "14:00",
          estimatedDuration: 90,
          recurrencePattern: null,
          completed: false,
        },
      ],
    },
  };

  await maybeApplyRemotePlannerOptimizer({
    input,
    result,
    optimizerEnabled: true,
    optimizerUrl: "https://optimizer.test/optimize",
    optimizerSecret: "",
    fetchImpl: async (_url, init) => {
      const requestInit = (init ?? {}) as Record<string, unknown>;
      capturedRequest = JSON.parse(
        String(requestInit.body ?? "{}"),
      ) as PlannerOptimizerRequest;
      capturedSignal = requestInit.signal instanceof AbortSignal
        ? requestInit.signal
        : null;
      return new Response(JSON.stringify({ drafts: [], unscheduled: [] }));
    },
  });

  if (capturedRequest === null) {
    throw new Error("Expected a remote optimizer request to be captured.");
  }
  if (!(capturedSignal instanceof AbortSignal)) {
    throw new Error("Expected the remote request to include an AbortSignal.");
  }

  const request: PlannerOptimizerRequest = capturedRequest;
  assertEquals(request.constraints.max_scheduled_minutes_per_day, 230);
  assertEquals(
    request.tasks_to_schedule.map((task) => task.energy_type),
    ["physical", "errand", "admin", "social", "deep"],
  );
  assertEquals(
    request.existing_tasks.map((task) => task.energy_type),
    ["physical", "errand", "admin", "social", "deep"],
  );
});
