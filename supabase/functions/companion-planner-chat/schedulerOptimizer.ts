import type {
  PlannerOptimizerDraft,
  PlannerOptimizerHabit,
  PlannerOptimizerRequest,
  PlannerOptimizerResponse,
  PlannerOptimizerTaskToSchedule,
  PlannerTaskEnergyType,
} from "../../../src/shared/plannerOptimizer.ts";
import type {
  PlannerBuildInput,
  PlannerBuildResult,
  PlannerProposal,
} from "./planner.ts";

const DEFAULT_WAKE_TIME = "08:00";
const DEFAULT_WIND_DOWN_TIME = "21:00";

const parseClockMinutes = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const match = value.match(/^(\d{2}):(\d{2})/);
  if (!match) return null;

  const hour = Number.parseInt(match[1] ?? "", 10);
  const minute = Number.parseInt(match[2] ?? "", 10);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;

  return (hour * 60) + minute;
};

const formatClockMinutes = (value: number): string => {
  const normalized = ((value % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${
    String(minutes).padStart(2, "0")
  }`;
};

const buildDateTime = (
  dateKey: string,
  clock: string,
  offset: string,
): string => `${dateKey}T${clock}:00${offset}`;

const getOffsetFromCurrentDateTime = (value: string): string => {
  const match = value.match(/([+-]\d{2}:\d{2}|Z)$/);
  return match?.[1] ?? "Z";
};

const getDateKey = (value: string): string => {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T/);
  return match?.[1] ?? value.slice(0, 10);
};

const addDaysToDateKey = (dateKey: string, dayCount: number): string => {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + dayCount);
  return date.toISOString().slice(0, 10);
};

const listDateKeys = (startDateKey: string, endDateKey: string): string[] => {
  const start = new Date(`${startDateKey}T00:00:00Z`).getTime();
  const end = new Date(`${endDateKey}T00:00:00Z`).getTime();
  const totalDays = Math.max(0, Math.round((end - start) / 86_400_000));

  return Array.from(
    { length: totalDays + 1 },
    (_, index) => addDaysToDateKey(startDateKey, index),
  );
};

const normalizeCategoryValue = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0
    ? value.trim().toLowerCase()
    : null;

const PHYSICAL_TITLE_PATTERN =
  /\b(workout|exercise|lift|run|walk|stretch|gym)\b/i;
const ERRAND_TITLE_PATTERN =
  /\b(clean|vacuum|laundry|dishes|organize|tidy|house)\b/i;
const ADMIN_TITLE_PATTERN =
  /\b(reply|email|pay|book|schedule|review|plan)\b/i;

const inferPlannerEnergyType = (input: {
  title: string;
  category?: unknown;
  contactId?: unknown;
}): PlannerTaskEnergyType => {
  if (typeof input.contactId === "string" && input.contactId.trim().length > 0) {
    return "social";
  }

  const category = normalizeCategoryValue(input.category);
  if (category === "social" || category === "relationship") {
    return "social";
  }
  if (category === "body") {
    return "physical";
  }
  if (category === "errand" || category === "errands" || category === "home") {
    return "errand";
  }
  if (category === "admin") {
    return "admin";
  }

  if (PHYSICAL_TITLE_PATTERN.test(input.title)) return "physical";
  if (ERRAND_TITLE_PATTERN.test(input.title)) return "errand";
  if (ADMIN_TITLE_PATTERN.test(input.title)) return "admin";

  return "deep";
};

const getEstimatedDuration = (
  payload: Record<string, unknown>,
  fallbackMinutes: number,
): number =>
  typeof payload.estimatedDuration === "number" &&
      Number.isFinite(payload.estimatedDuration) &&
      payload.estimatedDuration > 0
    ? payload.estimatedDuration
    : fallbackMinutes;

const getOptimizerEnabled = (): boolean => {
  try {
    const raw = Deno.env.get("PLANNER_OPTIMIZER_ENABLED");
    if (!raw) return false;
    return raw === "1" || raw.toLowerCase() === "true";
  } catch {
    return false;
  }
};

const getOptimizerUrl = (): string | null => {
  if (!getOptimizerEnabled()) return null;
  try {
    return Deno.env.get("PLANNER_OPTIMIZER_URL") ?? null;
  } catch {
    return null;
  }
};

export const maybeRunRemotePlannerOptimizer = async (params: {
  request: PlannerOptimizerRequest;
  fetchImpl: typeof fetch;
  optimizerEnabled?: boolean;
  optimizerUrl?: string | null;
  optimizerSecret?: string;
}): Promise<PlannerOptimizerResponse | null> => {
  const url = params.optimizerUrl ?? getOptimizerUrl();
  const optimizerEnabled = params.optimizerEnabled ?? getOptimizerEnabled();
  if (!optimizerEnabled || !url) return null;

  const secret = params.optimizerSecret ??
    (Deno.env.get("PLANNER_OPTIMIZER_SECRET") ?? "");
  try {
    const response = await params.fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify(params.request),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.warn(
        "[schedulerOptimizer] remote optimizer failed",
        response.status,
        await response.text(),
      );
      return null;
    }

    return await response.json() as PlannerOptimizerResponse;
  } catch (error) {
    console.warn("[schedulerOptimizer] remote optimizer request failed", error);
    return null;
  }
};

const buildPlannerMemoryWindow = (time: string | null | undefined): string[] =>
  time
    ? [`${time}-${formatClockMinutes((parseClockMinutes(time) ?? 0) + 60)}`]
    : [];

const buildPlanningWindowForInput = (
  input: PlannerBuildInput,
  targetDate: string,
): PlannerOptimizerRequest["planning_window"] => {
  const hasExplicitDatePin = Boolean(input.parsedInput?.scheduledDate) ||
    targetDate !== input.currentDate;
  if (input.horizon === "week") {
    return {
      start_date: targetDate,
      end_date: addDaysToDateKey(targetDate, 6),
    };
  }

  if (input.horizon === "day" && !hasExplicitDatePin) {
    return {
      start_date: targetDate,
      end_date: addDaysToDateKey(targetDate, 1),
    };
  }

  return {
    start_date: targetDate,
    end_date: targetDate,
  };
};

const toPlannerOptimizerRequest = (
  input: PlannerBuildInput,
  result: PlannerBuildResult,
): PlannerOptimizerRequest | null => {
  const optimizerProposals = result.proposals.filter((proposal) => {
    if (proposal.kind !== "create_quest" || proposal.status !== "pending") {
      return false;
    }
    const payload = proposal.payload as Record<string, unknown>;
    return payload.source === "optimizer";
  });
  if (optimizerProposals.length === 0) return null;

  const offset = getOffsetFromCurrentDateTime(input.currentDateTime);
  const targetDate = (
    optimizerProposals
      .map((proposal) => (proposal.payload as Record<string, unknown>).taskDate)
      .find((value): value is string =>
        typeof value === "string" && value.length > 0
      )
  ) ?? input.plannerContext.scheduleInsights?.selectedDate ??
    getDateKey(input.currentDateTime);
  const planningWindow = buildPlanningWindowForInput(input, targetDate);
  const windowDates = listDateKeys(
    planningWindow.start_date,
    planningWindow.end_date,
  );
  const maxScheduledMinutesPerDay = optimizerProposals.reduce(
    (total, proposal) => {
      const payload = proposal.payload as Record<string, unknown>;
      return total + getEstimatedDuration(payload, 60);
    },
    0,
  );

  const tasksToSchedule: PlannerOptimizerTaskToSchedule[] = optimizerProposals
    .map((proposal, index) => {
      const payload = proposal.payload as Record<string, unknown>;
      const taskDate = typeof payload.taskDate === "string"
        ? payload.taskDate
        : null;
      const scheduledTime = typeof payload.scheduledTime === "string"
        ? payload.scheduledTime
        : null;
      const durationMinutes = getEstimatedDuration(payload, 45);
      const taskTitle = typeof payload.taskText === "string"
        ? payload.taskText
        : proposal.title;
      return {
        id: proposal.id,
        title: taskTitle,
        category: typeof payload.category === "string"
          ? payload.category
          : null,
        duration_min: durationMinutes,
        timing_preference: scheduledTime && taskDate
          ? {
            earliest_start: buildDateTime(taskDate, scheduledTime, offset),
            latest_end: buildDateTime(
              taskDate,
              formatClockMinutes(
                (parseClockMinutes(scheduledTime) ?? 0) + durationMinutes,
              ),
              offset,
            ),
          }
          : undefined,
        energy_type: inferPlannerEnergyType({
          title: taskTitle,
          category: payload.category,
          contactId: payload.contactId,
        }),
        priority: index < 1 ? 5 : index < 2 ? 4 : index < 4 ? 3 : 2,
        confidence: scheduledTime ? 0.9 : 0.72,
        derived_from_message: typeof payload.derivedFromMessage === "string"
          ? payload.derivedFromMessage
          : input.message,
        notes: typeof payload.notes === "string" ? payload.notes : null,
      };
    });

  const existingTasks = [
    ...input.plannerContext.tasks,
    ...input.plannerContext.inboxTasks,
  ]
    .filter((task) =>
      task.completed !== true &&
      task.taskDate !== null &&
      windowDates.includes(task.taskDate) &&
      Boolean(task.scheduledTime)
    )
    .map((task) => {
      const startTime = task.scheduledTime ?? "09:00";
      const taskDate = task.taskDate ?? targetDate;
      const duration = task.estimatedDuration ?? 30;
      return {
        id: task.id,
        start: buildDateTime(taskDate, startTime, offset),
        end: buildDateTime(
          taskDate,
          formatClockMinutes((parseClockMinutes(startTime) ?? 0) + duration),
          offset,
        ),
        energy_type: inferPlannerEnergyType({
          title: task.title,
          category: task.category,
          contactId: task.contactId,
        }),
        status: task.completed === true ? "completed" : "active",
      };
    });

  const habits: PlannerOptimizerHabit[] = input.plannerContext.rituals.map((
    ritual,
  ) => ({
    id: ritual.id,
    title: ritual.title,
    preferred_windows: ritual.preferredTime
      ? buildPlannerMemoryWindow(ritual.preferredTime)
      : [],
    duration_min: 30,
  }));

  return {
    current_datetime: input.currentDateTime,
    timezone: input.timezone ?? "UTC",
    planning_window: planningWindow,
    scheduling_mode: tasksToSchedule.length >= 2 ? "aggressive" : "light",
    tasks_to_schedule: tasksToSchedule,
    existing_tasks: existingTasks,
    calendar_events: input.plannerContext.calendarEvents.map((event) => ({
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      source: event.provider === "google" || event.provider === "outlook"
        ? event.provider
        : "internal",
      hard_block: true,
    })),
    habits,
    planner_memory: {
      wake_time: input.plannerContext.plannerMemory?.wakeTime ??
        DEFAULT_WAKE_TIME,
      wind_down_time: input.plannerContext.plannerMemory?.windDownTime ??
        DEFAULT_WIND_DOWN_TIME,
      work_hours: {
        start: "09:00",
        end: "17:00",
      },
      preferred_workout_windows: buildPlannerMemoryWindow(
        input.plannerContext.plannerMemory?.preferredTimeOfDay === "evening"
          ? "18:00"
          : null,
      ),
      preferred_deep_work_windows: buildPlannerMemoryWindow(
        input.plannerContext.plannerMemory?.preferredTimeOfDay === "morning"
          ? "09:00"
          : null,
      ),
    },
    constraints: {
      slot_granularity_min: 15,
      min_buffer_min: 15,
      max_scheduled_minutes_per_day: maxScheduledMinutesPerDay,
      max_deep_work_blocks_per_day: 2,
      suggested_slots: (
        input.plannerContext.scheduleInsights?.suggestedSlots ?? []
      )
        .filter((slot) => windowDates.includes(slot.date))
        .map((slot) => ({
          date: slot.date,
          time: slot.time,
          end_time: slot.endTime,
          score: slot.score,
          reason: slot.reason,
        })),
    },
  };
};

const applyRemoteDraftToProposal = (
  proposal: PlannerProposal,
  draft: PlannerOptimizerDraft | undefined,
): PlannerProposal => {
  if (!draft || proposal.kind !== "create_quest") return proposal;

  const payload = proposal.payload as Record<string, unknown>;
  const nextTaskDate = draft.start ? getDateKey(draft.start) : null;
  const nextScheduledTime = draft.start ? draft.start.slice(11, 16) : null;
  const reminderMinutesBefore = nextScheduledTime
    ? typeof payload.reminderMinutesBefore === "number"
      ? payload.reminderMinutesBefore
      : 15
    : null;
  const nextSummary = draft.fallback_to_inbox
    ? `Create an inbox quest for "${
      payload.taskText ?? proposal.title
    }" because the scheduler could not find a safe slot yet.`
    : nextScheduledTime && nextTaskDate
    ? `Create a quest for "${
      payload.taskText ?? proposal.title
    }" on ${nextTaskDate} at ${nextScheduledTime}.`
    : proposal.summary;

  return {
    ...proposal,
    summary: nextSummary,
    payload: {
      ...payload,
      taskDate: draft.fallback_to_inbox ? null : nextTaskDate,
      scheduledTime: draft.fallback_to_inbox ? null : nextScheduledTime,
      reminderEnabled: reminderMinutesBefore !== null,
      reminderMinutesBefore: reminderMinutesBefore ?? payload.reminderMinutesBefore,
      questSource: draft.fallback_to_inbox ? "inbox" : "manual",
      optimizerSource: "remote",
      usedFallback: draft.fallback_to_inbox ?? false,
      slotScore: draft.slot_score,
      hardConflict: draft.hard_conflict,
      softConflicts: draft.soft_conflicts,
      reasonCodes: draft.reason_codes,
      reasonSummary: draft.reason_summary,
      fallbackToInbox: draft.fallback_to_inbox,
      draftStatus: draft.status,
      schedulingConfidence: draft.status === "scheduled_draft"
        ? "high"
        : draft.status === "tentative_time"
        ? "medium"
        : "low",
    },
  };
};

const buildInboxFallbackResult = (
  result: PlannerBuildResult,
): PlannerBuildResult => ({
  ...result,
  proposals: result.proposals.map((proposal) => {
    if (
      proposal.kind !== "create_quest" ||
      proposal.status !== "pending" ||
      (proposal.payload as Record<string, unknown>).source !== "optimizer"
    ) {
      return proposal;
    }
    const payload = proposal.payload as Record<string, unknown>;
    return {
      ...proposal,
      payload: {
        ...payload,
        taskDate: null,
        scheduledTime: null,
        questSource: "inbox",
        optimizerSource: "fallback",
        usedFallback: true,
        fallbackToInbox: true,
      },
    };
  }),
});

export const maybeApplyRemotePlannerOptimizer = async (params: {
  input: PlannerBuildInput;
  result: PlannerBuildResult;
  fetchImpl: typeof fetch;
  optimizerEnabled?: boolean;
  optimizerUrl?: string | null;
  optimizerSecret?: string;
}): Promise<PlannerBuildResult> => {
  const request = toPlannerOptimizerRequest(params.input, params.result);
  if (!request) return params.result;

  const url = params.optimizerUrl ?? getOptimizerUrl();
  const optimizerEnabled = params.optimizerEnabled ?? getOptimizerEnabled();
  if (!optimizerEnabled || !url) return params.result;

  const remote = await maybeRunRemotePlannerOptimizer({
    request,
    fetchImpl: params.fetchImpl,
    optimizerEnabled,
    optimizerUrl: url,
    optimizerSecret: params.optimizerSecret,
  });
  if (!remote) return buildInboxFallbackResult(params.result);

  return {
    ...params.result,
    proposals: params.result.proposals.map((proposal) =>
      applyRemoteDraftToProposal(
        proposal,
        remote.drafts.find((draft) => draft.task_id === proposal.id),
      )
    ),
  };
};
