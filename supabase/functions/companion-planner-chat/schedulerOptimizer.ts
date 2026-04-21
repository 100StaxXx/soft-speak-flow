import {
  buildPlannerReasonSummary,
} from "../../../src/shared/plannerReasonSummary.ts";
import {
  clampPlannerOptimizerPriority,
  getDraftStatusForScore,
  getEffectiveConfidence,
  getUnscheduledPenalty,
  normalizeBundlePriority,
  PLANNER_SCORING_POLICY,
} from "../../../src/shared/plannerScoringPolicy.ts";
import type {
  PlannerDraftStatus,
  PlannerOptimizerCalendarEvent,
  PlannerOptimizerDraft,
  PlannerOptimizerExistingTask,
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
const DEFAULT_WORK_START = "09:00";
const DEFAULT_WORK_END = "17:00";

type TimeWindow = {
  start: number;
  end: number;
};

type SlotCandidate = {
  dateKey: string;
  dayIndex: number;
  start: number;
  end: number;
  score: number;
  status: PlannerDraftStatus;
  reasonCodes: string[];
  softConflicts: string[];
  hardConflict: boolean;
  reasonSummary: string;
};

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

  if (PHYSICAL_TITLE_PATTERN.test(input.title)) {
    return "physical";
  }
  if (ERRAND_TITLE_PATTERN.test(input.title)) {
    return "errand";
  }
  if (ADMIN_TITLE_PATTERN.test(input.title)) {
    return "admin";
  }

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

const minutesFromIso = (value: string): number | null => {
  const match = value.match(/T(\d{2}):(\d{2})/);
  if (!match) return null;
  const hour = Number.parseInt(match[1] ?? "", 10);
  const minute = Number.parseInt(match[2] ?? "", 10);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return (hour * 60) + minute;
};

const parseDateKeyToUtc = (dateKey: string): Date => {
  const [year, month, day] = dateKey.split("-").map((part) =>
    Number.parseInt(part, 10)
  );
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1));
};

const addDaysToDateKey = (dateKey: string, dayCount: number): string => {
  const date = parseDateKeyToUtc(dateKey);
  date.setUTCDate(date.getUTCDate() + dayCount);
  return date.toISOString().slice(0, 10);
};

const differenceInDays = (startDateKey: string, endDateKey: string): number =>
  Math.max(
    0,
    Math.round(
      (parseDateKeyToUtc(endDateKey).getTime() -
        parseDateKeyToUtc(startDateKey).getTime()) /
        86_400_000,
    ),
  );

const listDateKeys = (startDateKey: string, endDateKey: string): string[] => {
  const totalDays = differenceInDays(startDateKey, endDateKey);
  return Array.from(
    { length: totalDays + 1 },
    (_, index) => addDaysToDateKey(startDateKey, index),
  );
};

const getTimeWindowForRangeOnDate = (
  startValue: string,
  endValue: string,
  targetDate: string,
): TimeWindow | null => {
  const startDate = getDateKey(startValue);
  const endDate = getDateKey(endValue);
  if (targetDate < startDate || targetDate > endDate) return null;

  const startMinutes = minutesFromIso(startValue);
  const endMinutes = minutesFromIso(endValue);
  if (startMinutes === null || endMinutes === null) return null;

  if (startDate === endDate) {
    if (endMinutes <= startMinutes) return null;
    return { start: startMinutes, end: endMinutes };
  }

  if (targetDate === startDate) {
    return { start: startMinutes, end: 24 * 60 };
  }
  if (targetDate === endDate) {
    return { start: 0, end: endMinutes };
  }

  return { start: 0, end: 24 * 60 };
};

const buildBlockedWindows = (
  targetDate: string,
  existingTasks: PlannerOptimizerExistingTask[],
  calendarEvents: PlannerOptimizerCalendarEvent[],
): TimeWindow[] => {
  const windows: TimeWindow[] = [];

  for (const task of existingTasks) {
    const window = getTimeWindowForRangeOnDate(
      task.start,
      task.end,
      targetDate,
    );
    if (!window || window.end <= window.start) continue;
    windows.push(window);
  }

  for (const event of calendarEvents) {
    if (!event.hard_block) continue;
    const window = getTimeWindowForRangeOnDate(
      event.start,
      event.end,
      targetDate,
    );
    if (!window || window.end <= window.start) continue;
    windows.push(window);
  }

  return windows
    .sort((left, right) => left.start - right.start)
    .reduce<TimeWindow[]>((merged, window) => {
      const last = merged.at(-1);
      if (!last || window.start > last.end) {
        merged.push({ ...window });
        return merged;
      }

      last.end = Math.max(last.end, window.end);
      return merged;
    }, []);
};

const buildFreeWindows = (
  request: PlannerOptimizerRequest,
  targetDate: string,
): TimeWindow[] => {
  const wakeMinutes = parseClockMinutes(
    request.planner_memory.wake_time ?? DEFAULT_WAKE_TIME,
  ) ?? (8 * 60);
  const windDownMinutes = parseClockMinutes(
    request.planner_memory.wind_down_time ?? DEFAULT_WIND_DOWN_TIME,
  ) ?? (21 * 60);
  const minBuffer = request.constraints.min_buffer_min;
  const blocked = buildBlockedWindows(
    targetDate,
    request.existing_tasks,
    request.calendar_events,
  );

  if (blocked.length === 0) {
    return [{ start: wakeMinutes, end: windDownMinutes }];
  }

  const free: TimeWindow[] = [];
  let cursor = wakeMinutes;

  for (const block of blocked) {
    const blockStart = Math.max(wakeMinutes, block.start - minBuffer);
    const blockEnd = Math.min(windDownMinutes, block.end + minBuffer);
    if (blockStart > cursor) {
      free.push({ start: cursor, end: blockStart });
    }
    cursor = Math.max(cursor, blockEnd);
  }

  if (cursor < windDownMinutes) {
    free.push({ start: cursor, end: windDownMinutes });
  }

  return free.filter((window) =>
    window.end - window.start >= request.constraints.slot_granularity_min
  );
};

const preferredWorkRange = (request: PlannerOptimizerRequest): TimeWindow => ({
  start: parseClockMinutes(
    request.planner_memory.work_hours?.start ?? DEFAULT_WORK_START,
  ) ?? (9 * 60),
  end: parseClockMinutes(
    request.planner_memory.work_hours?.end ?? DEFAULT_WORK_END,
  ) ?? (17 * 60),
});

const preferredRangeForTask = (
  request: PlannerOptimizerRequest,
  task: PlannerOptimizerTaskToSchedule,
): TimeWindow | null => {
  const workRange = preferredWorkRange(request);
  const label = task.timing_preference?.label;
  switch (label) {
    case "morning":
      return { start: 8 * 60, end: 12 * 60 };
    case "afternoon":
      return { start: 12 * 60, end: 17 * 60 };
    case "evening":
      return { start: 17 * 60, end: 21 * 60 };
    case "tonight":
      return { start: 18 * 60, end: 22 * 60 };
    case "later":
      return {
        start: Math.max(
          minutesFromIso(request.current_datetime) ?? workRange.end,
          workRange.end,
        ),
        end: 22 * 60,
      };
    case "after_work":
      return { start: workRange.end, end: 22 * 60 };
    default:
      return null;
  }
};

const getEnergyAlignedWindow = (
  request: PlannerOptimizerRequest,
  task: PlannerOptimizerTaskToSchedule,
): TimeWindow | null => {
  const windows = task.energy_type === "physical"
    ? request.planner_memory.preferred_workout_windows
    : task.energy_type === "deep"
    ? request.planner_memory.preferred_deep_work_windows
    : null;
  const window = windows?.[0] ?? null;
  if (!window) return null;

  const [startClock, endClock] = window.split("-");
  const start = parseClockMinutes(startClock ?? null);
  const end = parseClockMinutes(endClock ?? null);
  if (start === null || end === null || end <= start) return null;
  return { start, end };
};

const getSuggestedSlotsForDate = (
  request: PlannerOptimizerRequest,
  dateKey: string,
): TimeWindow[] =>
  request.constraints.suggested_slots
    ?.filter((slot) => slot.date === dateKey)
    .map((slot) => {
      const start = parseClockMinutes(slot.time);
      const end = parseClockMinutes(slot.end_time);
      return start !== null && end !== null && end > start
        ? { start, end }
        : null;
    })
    .filter((slot): slot is TimeWindow => slot !== null) ?? [];

const buildCandidateStarts = (
  request: PlannerOptimizerRequest,
  dateKey: string,
  freeWindows: TimeWindow[],
  task: PlannerOptimizerTaskToSchedule,
  duration: number,
): number[] => {
  const starts = new Set<number>();
  const step = request.constraints.slot_granularity_min;
  const preferredRange = preferredRangeForTask(request, task);
  const alignedWindow = getEnergyAlignedWindow(request, task);
  const explicitStart = task.timing_preference?.earliest_start
    ? minutesFromIso(task.timing_preference.earliest_start)
    : null;
  const explicitDate = task.timing_preference?.earliest_start
    ? getDateKey(task.timing_preference.earliest_start)
    : null;

  for (const window of freeWindows) {
    const alignedWindowStart = Math.ceil(window.start / step) * step;
    for (
      let minute = alignedWindowStart;
      minute + duration <= window.end;
      minute += step
    ) {
      starts.add(minute);
    }

    starts.add(window.start);
    starts.add(alignedWindowStart);

    if (preferredRange) {
      if (
        preferredRange.start >= window.start &&
        preferredRange.start + duration <= window.end
      ) {
        starts.add(preferredRange.start);
      }
      const preferredEndAligned = preferredRange.end - duration;
      if (
        preferredEndAligned >= window.start &&
        preferredEndAligned + duration <= window.end
      ) {
        starts.add(preferredEndAligned);
      }
    }

    if (alignedWindow) {
      if (
        alignedWindow.start >= window.start &&
        alignedWindow.start + duration <= window.end
      ) {
        starts.add(alignedWindow.start);
      }
      const alignedEnd = alignedWindow.end - duration;
      if (alignedEnd >= window.start && alignedEnd + duration <= window.end) {
        starts.add(alignedEnd);
      }
    }
  }

  for (const suggestedSlot of getSuggestedSlotsForDate(request, dateKey)) {
    if (suggestedSlot.start + duration <= suggestedSlot.end) {
      starts.add(suggestedSlot.start);
    }
  }

  if (explicitStart !== null && explicitDate === dateKey) {
    starts.add(explicitStart);
  }

  return [...starts]
    .filter((minute) => minute >= 0 && minute + duration <= 24 * 60)
    .sort((left, right) => left - right);
};

const isWithinWindow = (
  start: number,
  end: number,
  window: TimeWindow | null,
): boolean => window !== null && start >= window.start && end <= window.end;

const getDailyLimit = (
  request: PlannerOptimizerRequest,
): number | null =>
  typeof request.constraints.max_scheduled_minutes_per_day === "number"
    ? request.constraints.max_scheduled_minutes_per_day
    : null;

const getDeepWorkLimit = (
  request: PlannerOptimizerRequest,
): number | null =>
  typeof request.constraints.max_deep_work_blocks_per_day === "number"
    ? request.constraints.max_deep_work_blocks_per_day
    : null;

const getHardConflictTitles = (
  request: PlannerOptimizerRequest,
  dateKey: string,
  start: number,
  end: number,
): string[] => {
  const conflicts: string[] = [];

  for (const event of request.calendar_events) {
    if (!event.hard_block) continue;
    const window = getTimeWindowForRangeOnDate(event.start, event.end, dateKey);
    if (!window) continue;
    if (start < window.end && end > window.start) {
      conflicts.push(event.title?.trim() || "calendar event");
    }
  }

  return conflicts;
};

const scoreCandidateStart = (
  request: PlannerOptimizerRequest,
  task: PlannerOptimizerTaskToSchedule,
  params: {
    dateKey: string;
    dayIndex: number;
    start: number;
    duration: number;
    scheduledMinutes: number;
    scheduledDeepBlocks: number;
    freeWindows: TimeWindow[];
  },
): SlotCandidate => {
  const {
    dateKey,
    dayIndex,
    start,
    duration,
    scheduledMinutes,
    scheduledDeepBlocks,
    freeWindows,
  } = params;
  const end = start + duration;
  let score = PLANNER_SCORING_POLICY.base_score;
  const reasonCodes = ["avoids_calendar_conflict", "sufficient_duration"];
  const softConflicts: string[] = [];
  const preferredRange = preferredRangeForTask(request, task);
  const alignedWindow = getEnergyAlignedWindow(request, task);
  const dailyLimit = getDailyLimit(request);
  const deepWorkLimit = getDeepWorkLimit(request);
  const windDownMinutes = parseClockMinutes(
    request.planner_memory.wind_down_time ?? DEFAULT_WIND_DOWN_TIME,
  ) ?? (21 * 60);
  const step = request.constraints.slot_granularity_min;
  const priority = clampPlannerOptimizerPriority(task.priority);

  if (preferredRange) {
    if (isWithinWindow(start, end, preferredRange)) {
      score += PLANNER_SCORING_POLICY.preferred_window_bonus;
      const label = task.timing_preference?.label;
      if (label) reasonCodes.push(`${label}_window`);
    } else {
      score += PLANNER_SCORING_POLICY.outside_window_penalty;
      softConflicts.push("outside_preferred_window");
    }
  }

  if (task.energy_type === "physical") {
    score += PLANNER_SCORING_POLICY.physical_bonus;
    reasonCodes.push("matches_physical_energy");
  } else if (task.energy_type === "deep") {
    score += PLANNER_SCORING_POLICY.deep_work_bonus;
    reasonCodes.push("matches_deep_work_energy");
  }

  if (dailyLimit !== null) {
    if (scheduledMinutes + duration <= dailyLimit) {
      score += PLANNER_SCORING_POLICY.daily_load_bonus;
      reasonCodes.push("respects_daily_load_cap");
    } else {
      score += PLANNER_SCORING_POLICY.daily_load_penalty;
      softConflicts.push("daily_load_cap_pressure");
    }
  }

  if (deepWorkLimit !== null && task.energy_type === "deep") {
    if (scheduledDeepBlocks >= deepWorkLimit) {
      score += PLANNER_SCORING_POLICY.deep_block_penalty;
      softConflicts.push("deep_work_block_limit");
    } else {
      reasonCodes.push("deep_work_block_available");
    }
  }

  if (isWithinWindow(start, end, alignedWindow)) {
    score += PLANNER_SCORING_POLICY.energy_match_bonus;
    reasonCodes.push("matches_energy_window");
  } else if (alignedWindow) {
    score += PLANNER_SCORING_POLICY.missed_energy_penalty;
    softConflicts.push("misses_energy_window");
  }

  const containingWindow =
    freeWindows.find((window) => start >= window.start && end <= window.end) ??
      null;
  if (containingWindow) {
    const gapBefore = start - containingWindow.start;
    const gapAfter = containingWindow.end - end;
    if ((gapBefore > 0 && gapBefore < 20) || (gapAfter > 0 && gapAfter < 20)) {
      score += PLANNER_SCORING_POLICY.fragmentation_penalty;
      softConflicts.push("fragmented_slot");
    } else {
      reasonCodes.push("minimizes_fragmentation");
    }
  }

  if (start >= 19 * 60) {
    score += PLANNER_SCORING_POLICY.late_day_penalty;
    softConflicts.push("late_day_pressure");
  } else {
    reasonCodes.push("minimizes_late_day_overload");
  }

  if (
    getSuggestedSlotsForDate(request, dateKey).some((slot) =>
      isWithinWindow(start, end, slot)
    )
  ) {
    score += PLANNER_SCORING_POLICY.suggested_slot_bonus;
    reasonCodes.push("suggested_slot_bias");
  }

  if (priority >= 4 && dayIndex === 0) {
    reasonCodes.push("high_priority_fit");
  }

  score -= dayIndex * PLANNER_SCORING_POLICY.day_index_penalty;
  score -= Math.round(
    (task.confidence - getEffectiveConfidence(task.confidence, dayIndex)) * 20,
  );
  score += Math.round(
    ((windDownMinutes - start) / step) *
      PLANNER_SCORING_POLICY.early_bias_multiplier,
  );

  const status = getDraftStatusForScore(score, request.scheduling_mode);
  const reasonSummary = buildPlannerReasonSummary({
    status,
    reasonCodes,
    softConflicts,
  });

  return {
    dateKey,
    dayIndex,
    start,
    end,
    score,
    status,
    reasonCodes,
    softConflicts,
    hardConflict: false,
    reasonSummary,
  };
};

const adjustedDurationForTask = (
  request: PlannerOptimizerRequest,
  task: PlannerOptimizerTaskToSchedule,
): number =>
  task.confidence < 0.6
    ? Math.max(
      request.constraints.slot_granularity_min,
      Math.round(task.duration_min * 0.75),
    )
    : task.duration_min;

const buildExplicitTimeCandidate = (
  request: PlannerOptimizerRequest,
  task: PlannerOptimizerTaskToSchedule,
  targetDate: string,
  dayIndex: number,
): SlotCandidate | null => {
  const explicitStart = task.timing_preference?.earliest_start
    ? minutesFromIso(task.timing_preference.earliest_start)
    : null;
  const explicitEnd = task.timing_preference?.latest_end
    ? minutesFromIso(task.timing_preference.latest_end)
    : null;
  const explicitDate = task.timing_preference?.earliest_start
    ? getDateKey(task.timing_preference.earliest_start)
    : null;

  if (
    explicitStart === null ||
    explicitEnd === null ||
    explicitEnd <= explicitStart ||
    explicitDate !== targetDate
  ) {
    return null;
  }

  const hardConflicts = getHardConflictTitles(
    request,
    targetDate,
    explicitStart,
    explicitEnd,
  );
  const baseScore = hardConflicts.length > 0
    ? PLANNER_SCORING_POLICY.tentative_threshold_aggressive - 2
    : PLANNER_SCORING_POLICY.scheduled_threshold + 14;
  const score = baseScore -
    (dayIndex * PLANNER_SCORING_POLICY.day_index_penalty);
  const status = hardConflicts.length > 0
    ? "tentative_time"
    : "scheduled_draft";
  const reasonCodes = [
    "respects_user_requested_time",
    "explicit_time_request",
    ...(hardConflicts.length === 0 ? ["avoids_calendar_conflict"] : []),
  ];
  const softConflicts = hardConflicts.length > 0 ? ["calendar_conflict"] : [];

  return {
    dateKey: targetDate,
    dayIndex,
    start: explicitStart,
    end: explicitEnd,
    score,
    status,
    reasonCodes,
    softConflicts,
    hardConflict: hardConflicts.length > 0,
    reasonSummary: buildPlannerReasonSummary({
      status,
      reasonCodes,
      softConflicts,
    }),
  };
};

const toNeedsSchedulingDraft = (
  task: PlannerOptimizerTaskToSchedule,
  reasonCodes: string[],
  softConflicts: string[],
): PlannerOptimizerDraft => {
  const status: PlannerDraftStatus = "needs_scheduling";
  return {
    task_id: task.id,
    title: task.title,
    status,
    slot_score: 0,
    hard_conflict: false,
    soft_conflicts: softConflicts,
    reason_codes: reasonCodes,
    reason_summary: buildPlannerReasonSummary({
      status,
      reasonCodes,
      softConflicts,
    }),
    fallback_to_inbox: true,
    category: task.category ?? null,
    notes: task.notes ?? null,
  };
};

const addDraftBlock = (
  freeWindows: TimeWindow[],
  start: number,
  end: number,
): TimeWindow[] =>
  freeWindows.flatMap((window) => {
    if (end <= window.start || start >= window.end) return [window];
    const next: TimeWindow[] = [];
    if (start > window.start) next.push({ start: window.start, end: start });
    if (end < window.end) next.push({ start: end, end: window.end });
    return next;
  });

const sortTasksForScheduling = (
  tasks: PlannerOptimizerTaskToSchedule[],
): PlannerOptimizerTaskToSchedule[] =>
  tasks
    .slice()
    .sort((left, right) => {
      const priorityDiff = clampPlannerOptimizerPriority(right.priority) -
        clampPlannerOptimizerPriority(left.priority);
      if (priorityDiff !== 0) return priorityDiff;
      const confidenceDiff = right.confidence - left.confidence;
      if (confidenceDiff !== 0) return confidenceDiff;
      return right.duration_min - left.duration_min;
    });

const resolvePlanningWindow = (
  request: PlannerOptimizerRequest,
): { startDate: string; endDate: string; dateKeys: string[] } => {
  const startDate = request.planning_window?.start_date ??
    getDateKey(request.current_datetime);
  const endDate = request.planning_window?.end_date ?? startDate;
  return {
    startDate,
    endDate,
    dateKeys: listDateKeys(startDate, endDate),
  };
};

export const runLocalPlannerOptimizer = (
  request: PlannerOptimizerRequest,
): PlannerOptimizerResponse => {
  const offset = getOffsetFromCurrentDateTime(request.current_datetime);
  const planningWindow = resolvePlanningWindow(request);
  const freeWindowsByDate = new Map<string, TimeWindow[]>(
    planningWindow.dateKeys.map((
      dateKey,
    ) => [dateKey, buildFreeWindows(request, dateKey)]),
  );
  const scheduledMinutesByDate = new Map<string, number>();
  const scheduledDeepBlocksByDate = new Map<string, number>();
  const drafts: PlannerOptimizerDraft[] = [];
  const unscheduled: PlannerOptimizerResponse["unscheduled"] = [];

  for (const task of sortTasksForScheduling(request.tasks_to_schedule)) {
    const adjustedDuration = adjustedDurationForTask(request, task);
    const hasExplicitTimePin = Boolean(
      task.timing_preference?.earliest_start &&
        task.timing_preference?.latest_end,
    );
    const dailyLimit = getDailyLimit(request);
    if (dailyLimit !== null && adjustedDuration > dailyLimit) {
      const draft = toNeedsSchedulingDraft(
        task,
        ["needs_manual_scheduling", "exceeds_daily_load_cap"],
        ["daily_load_cap_pressure"],
      );
      drafts.push(draft);
      unscheduled.push({
        task_id: task.id,
        title: task.title,
        estimated_duration: task.duration_min,
        reason_codes: draft.reason_codes,
      });
      continue;
    }

    const candidates: SlotCandidate[] = [];
    for (const dateKey of planningWindow.dateKeys) {
      const dayIndex = differenceInDays(planningWindow.startDate, dateKey);
      const explicitCandidate = buildExplicitTimeCandidate(
        request,
        task,
        dateKey,
        dayIndex,
      );
      if (explicitCandidate) {
        candidates.push(explicitCandidate);
        continue;
      }
      if (hasExplicitTimePin) continue;

      const freeWindows = freeWindowsByDate.get(dateKey) ?? [];
      if (freeWindows.length === 0) continue;
      const candidateStarts = buildCandidateStarts(
        request,
        dateKey,
        freeWindows,
        task,
        adjustedDuration,
      );

      const scheduledMinutes = scheduledMinutesByDate.get(dateKey) ?? 0;
      const scheduledDeepBlocks = scheduledDeepBlocksByDate.get(dateKey) ?? 0;

      for (const start of candidateStarts) {
        const end = start + adjustedDuration;
        if (
          !freeWindows.some((window) =>
            start >= window.start && end <= window.end
          )
        ) continue;
        candidates.push(
          scoreCandidateStart(request, task, {
            dateKey,
            dayIndex,
            start,
            duration: adjustedDuration,
            scheduledMinutes,
            scheduledDeepBlocks,
            freeWindows,
          }),
        );
      }
    }

    candidates.sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (left.dayIndex !== right.dayIndex) {
        return left.dayIndex - right.dayIndex;
      }
      return left.start - right.start;
    });

    const best = candidates[0] ?? null;
    if (!best) {
      const draft = toNeedsSchedulingDraft(
        task,
        ["needs_manual_scheduling"],
        ["no_safe_slot_found"],
      );
      drafts.push(draft);
      unscheduled.push({
        task_id: task.id,
        title: task.title,
        estimated_duration: task.duration_min,
        reason_codes: draft.reason_codes,
      });
      continue;
    }

    const fallbackToInbox = best.status === "needs_scheduling";
    const draft: PlannerOptimizerDraft = {
      task_id: task.id,
      title: task.title,
      start: fallbackToInbox
        ? undefined
        : buildDateTime(best.dateKey, formatClockMinutes(best.start), offset),
      end: fallbackToInbox
        ? undefined
        : buildDateTime(best.dateKey, formatClockMinutes(best.end), offset),
      status: best.status,
      slot_score: best.score,
      hard_conflict: best.hardConflict,
      soft_conflicts: best.softConflicts,
      reason_codes: best.reasonCodes,
      reason_summary: best.reasonSummary,
      fallback_to_inbox: fallbackToInbox,
      category: task.category ?? null,
      notes: task.notes ?? null,
    };
    drafts.push(draft);

    if (fallbackToInbox) {
      unscheduled.push({
        task_id: task.id,
        title: task.title,
        estimated_duration: task.duration_min,
        reason_codes: draft.reason_codes,
      });
      continue;
    }

    const previousFreeWindows = freeWindowsByDate.get(best.dateKey) ?? [];
    freeWindowsByDate.set(
      best.dateKey,
      addDraftBlock(previousFreeWindows, best.start, best.end),
    );
    scheduledMinutesByDate.set(
      best.dateKey,
      (scheduledMinutesByDate.get(best.dateKey) ?? 0) + adjustedDuration,
    );
    if (task.energy_type === "deep") {
      scheduledDeepBlocksByDate.set(
        best.dateKey,
        (scheduledDeepBlocksByDate.get(best.dateKey) ?? 0) + 1,
      );
    }
  }

  return {
    drafts,
    unscheduled,
  };
};

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
  if (!optimizerEnabled) return null;
  if (!url) return null;

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
        priority: normalizeBundlePriority(index),
        confidence: payload.schedulingConfidence === "low"
          ? 0.55
          : payload.schedulingConfidence === "medium"
          ? 0.72
          : 0.9,
        derived_from_message: typeof payload.derivedFromMessage === "string"
          ? payload.derivedFromMessage
          : input.message,
        notes: typeof payload.notes === "string" ? payload.notes : null,
      };
    });

  return {
    current_datetime: input.currentDateTime,
    timezone: input.timezone ?? "UTC",
    planning_window: planningWindow,
    scheduling_mode: tasksToSchedule.length >= 2 ? "aggressive" : "light",
    tasks_to_schedule: tasksToSchedule,
    existing_tasks: [
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
      }),
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
    habits: input.plannerContext.rituals.map((ritual) => ({
      id: ritual.id,
      title: ritual.title,
      preferred_windows: ritual.preferredTime
        ? [
          `${ritual.preferredTime}-${
            formatClockMinutes(
              (parseClockMinutes(ritual.preferredTime) ?? 0) + 30,
            )
          }`,
        ]
        : [],
      duration_min: 30,
    })),
    planner_memory: {
      wake_time: input.plannerContext.plannerMemory?.wakeTime ?? null,
      wind_down_time: input.plannerContext.plannerMemory?.windDownTime ?? null,
      work_hours: {
        start: "09:00",
        end: "17:00",
      },
      preferred_workout_windows: [],
      preferred_deep_work_windows: [],
    },
    constraints: {
      slot_granularity_min: 15,
      min_buffer_min: 15,
      max_scheduled_minutes_per_day: maxScheduledMinutesPerDay,
      max_deep_work_blocks_per_day: 2,
      suggested_slots: input.plannerContext.scheduleInsights?.suggestedSlots
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

  const remote = await maybeRunRemotePlannerOptimizer({
    request,
    fetchImpl: params.fetchImpl,
    optimizerEnabled: params.optimizerEnabled,
    optimizerUrl: params.optimizerUrl,
    optimizerSecret: params.optimizerSecret,
  });
  if (!remote) return params.result;

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
