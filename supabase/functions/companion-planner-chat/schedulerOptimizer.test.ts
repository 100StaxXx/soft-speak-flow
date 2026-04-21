import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { PLANNER_SCORING_POLICY } from "../../../src/shared/plannerScoringPolicy.ts";
import type {
  PlannerOptimizerRequest,
} from "../../../src/shared/plannerOptimizer.ts";
import type { PlannerBuildInput, PlannerBuildResult } from "./planner.ts";
import {
  maybeApplyRemotePlannerOptimizer,
  runLocalPlannerOptimizer,
} from "./schedulerOptimizer.ts";

const baseRequest = (
  overrides: Partial<PlannerOptimizerRequest> = {},
): PlannerOptimizerRequest => ({
  current_datetime: "2026-04-20T15:50:00-07:00",
  timezone: "America/Los_Angeles",
  planning_window: {
    start_date: "2026-04-20",
    end_date: "2026-04-20",
  },
  scheduling_mode: "aggressive",
  tasks_to_schedule: [{
    id: "task-1",
    title: "Workout",
    duration_min: 45,
    timing_preference: {
      label: "after_work",
    },
    energy_type: "physical",
    priority: 5,
    confidence: 0.9,
    derived_from_message: "workout later",
    notes: null,
  }],
  existing_tasks: [],
  calendar_events: [],
  habits: [],
  planner_memory: {
    wake_time: "07:00",
    wind_down_time: "22:00",
    work_hours: {
      start: "09:00",
      end: "17:00",
    },
    preferred_workout_windows: ["17:30-19:00"],
    preferred_deep_work_windows: ["09:00-11:00"],
  },
  constraints: {
    slot_granularity_min: 15,
    min_buffer_min: 15,
    max_scheduled_minutes_per_day: 180,
    max_deep_work_blocks_per_day: 2,
    suggested_slots: [],
  },
  ...overrides,
});

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
      summary: 'Create a quest for "Clean The House" on 2026-04-20 at 17:30.',
      reasoning: null,
      payload: {
        taskText: "Clean The House",
        taskDate: "2026-04-20",
        scheduledTime: "17:30",
        estimatedDuration: 60,
        source: "optimizer",
        optimizerSource: "local",
        optimizerMode: "day",
        usedFallback: true,
        slotScore: 70,
        reasonCodes: ["after_work_window"],
        reasonSummary:
          "Scheduled after work to match your availability. and keeps this moving today.",
        draftStatus: "scheduled_draft",
        schedulingConfidence: "high",
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
    scheduledTime: input.scheduledTime ?? "17:30",
    estimatedDuration: input.estimatedDuration ?? 60,
    category: input.category ?? null,
    contactId: input.contactId ?? null,
    source: "optimizer",
    optimizerSource: "local",
    optimizerMode: "day",
    usedFallback: true,
  },
  status: "pending",
  readyToConfirm: true,
  missingFields: [],
});

Deno.test("planner scoring policy stays locked to the shared artifact", () => {
  assertEquals(PLANNER_SCORING_POLICY.base_score, 45);
  assertEquals(PLANNER_SCORING_POLICY.preferred_window_bonus, 22);
  assertEquals(PLANNER_SCORING_POLICY.unscheduled_penalty_base, -40);
  assertEquals(PLANNER_SCORING_POLICY.day_index_penalty, 8);
  assertEquals(PLANNER_SCORING_POLICY.scheduled_threshold, 58);
  assertEquals(PLANNER_SCORING_POLICY.tentative_threshold_aggressive, 40);
  assertEquals(PLANNER_SCORING_POLICY.tentative_threshold_default, 46);
});

Deno.test("local optimizer avoids hard calendar blocks", () => {
  const result = runLocalPlannerOptimizer(baseRequest({
    calendar_events: [{
      id: "event-1",
      title: "Commute",
      start: "2026-04-20T17:30:00-07:00",
      end: "2026-04-20T18:30:00-07:00",
      source: "google",
      hard_block: true,
    }],
  }));

  assertEquals(result.drafts.length, 1);
  assertEquals(result.drafts[0]?.start?.slice(11, 16), "18:45");
  assertEquals(result.drafts[0]?.hard_conflict, false);
  assertEquals(
    result.drafts[0]?.reason_codes.includes("avoids_calendar_conflict"),
    true,
  );
});

Deno.test("local optimizer emits deterministic reason summaries", () => {
  const result = runLocalPlannerOptimizer(baseRequest());

  assertEquals(result.drafts.length, 1);
  assertEquals(
    result.drafts[0]?.reason_summary,
    "Scheduled after work to match your availability. Placed where it best matches your energy rhythm. and keeps this moving today.",
  );
});

Deno.test("local optimizer degrades crowded days to needs_scheduling drafts", () => {
  const result = runLocalPlannerOptimizer(baseRequest({
    tasks_to_schedule: [{
      id: "task-1",
      title: "Work On The App",
      duration_min: 120,
      timing_preference: {
        label: "after_work",
      },
      energy_type: "deep",
      priority: 5,
      confidence: 0.88,
      derived_from_message: "work on the app later",
      notes: null,
    }],
    constraints: {
      slot_granularity_min: 15,
      min_buffer_min: 15,
      max_scheduled_minutes_per_day: 60,
      max_deep_work_blocks_per_day: 1,
      suggested_slots: [],
    },
    calendar_events: [{
      id: "event-1",
      title: "Dinner",
      start: "2026-04-20T17:30:00-07:00",
      end: "2026-04-20T19:30:00-07:00",
      source: "google",
      hard_block: true,
    }],
  }));

  assertEquals(result.drafts.length, 1);
  assertEquals(result.drafts[0]?.status, "needs_scheduling");
  assertEquals(result.drafts[0]?.fallback_to_inbox, true);
  assertStringIncludes(
    result.drafts[0]?.reason_codes.join(","),
    "needs_manual_scheduling",
  );
});

Deno.test("local optimizer spills into tomorrow when today is crowded", () => {
  const result = runLocalPlannerOptimizer(baseRequest({
    planning_window: {
      start_date: "2026-04-20",
      end_date: "2026-04-21",
    },
    calendar_events: [
      {
        id: "event-1",
        title: "Commute",
        start: "2026-04-20T17:15:00-07:00",
        end: "2026-04-20T18:15:00-07:00",
        source: "google",
        hard_block: true,
      },
      {
        id: "event-2",
        title: "Dinner",
        start: "2026-04-20T18:30:00-07:00",
        end: "2026-04-20T20:30:00-07:00",
        source: "google",
        hard_block: true,
      },
    ],
  }));

  assertEquals(result.drafts.length, 1);
  assertEquals(result.drafts[0]?.start?.slice(0, 10), "2026-04-21");
});

Deno.test("local optimizer prefers today over equally good later days", () => {
  const result = runLocalPlannerOptimizer(baseRequest({
    planning_window: {
      start_date: "2026-04-20",
      end_date: "2026-04-26",
    },
    scheduling_mode: "balanced",
  }));

  assertEquals(result.drafts.length, 1);
  assertEquals(result.drafts[0]?.start?.slice(0, 10), "2026-04-20");
});

Deno.test("local optimizer keeps explicit future dates pinned", () => {
  const result = runLocalPlannerOptimizer(baseRequest({
    planning_window: {
      start_date: "2026-04-20",
      end_date: "2026-04-26",
    },
    tasks_to_schedule: [{
      id: "task-1",
      title: "Workout",
      duration_min: 45,
      timing_preference: {
        earliest_start: "2026-04-23T18:00:00-07:00",
        latest_end: "2026-04-23T18:45:00-07:00",
      },
      energy_type: "physical",
      priority: 4,
      confidence: 0.9,
      derived_from_message: "workout thursday at 6",
      notes: null,
    }],
  }));

  assertEquals(result.drafts.length, 1);
  assertEquals(result.drafts[0]?.start?.slice(0, 10), "2026-04-23");
  assertEquals(result.drafts[0]?.start?.slice(11, 16), "18:00");
});

Deno.test("remote optimizer success overwrites local optimizer metadata", async () => {
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
  assertEquals(payload.draftStatus, "tentative_time");
  assertEquals(payload.optimizerSource, "remote");
  assertEquals(payload.optimizerMode, "day");
  assertEquals(payload.usedFallback, false);
  assertEquals(
    payload.reasonSummary,
    "Scheduled after work to match your availability. It uses a tighter gap than ideal. consider moving it earlier if the day tightens.",
  );
});

Deno.test("remote optimizer inbox fallbacks preserve fallback telemetry", async () => {
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
});

Deno.test("remote optimizer failure preserves local proposals unchanged", async () => {
  const original = basePlannerResult();
  const result = await maybeApplyRemotePlannerOptimizer({
    input: basePlannerInput(),
    result: original,
    optimizerEnabled: true,
    optimizerUrl: "https://optimizer.test/optimize",
    optimizerSecret: "",
    fetchImpl: async () => new Response("nope", { status: 503 }),
  });

  const payload = result.proposals[0]?.payload as Record<string, unknown>;
  assertEquals(payload.scheduledTime, "17:30");
  assertEquals(payload.optimizerSource, "local");
  assertEquals(payload.optimizerMode, "day");
  assertEquals(payload.usedFallback, true);
  assertEquals(
    payload.reasonSummary,
    "Scheduled after work to match your availability. and keeps this moving today.",
  );
});

Deno.test("remote optimizer thrown fetch errors preserve local proposals unchanged", async () => {
  const original = basePlannerResult();
  const result = await maybeApplyRemotePlannerOptimizer({
    input: basePlannerInput(),
    result: original,
    optimizerEnabled: true,
    optimizerUrl: "https://optimizer.test/optimize",
    optimizerSecret: "",
    fetchImpl: async () => {
      throw new Error("socket hang up");
    },
  });

  const payload = result.proposals[0]?.payload as Record<string, unknown>;
  assertEquals(payload.optimizerSource, "local");
  assertEquals(payload.usedFallback, true);
  assertEquals(payload.scheduledTime, "17:30");
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
