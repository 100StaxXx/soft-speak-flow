import { addDays, format, parseISO } from "https://esm.sh/date-fns@3.6.0";

import { computePlannerPriorityScores } from "../../../src/shared/companionPlannerPriority.ts";
import { getCompanionModeConfig } from "../../../src/shared/companionModes.ts";
import {
  buildPlannerResponse,
  type PlannerBuildInput,
  type PlannerContextCalendarEvent,
  type PlannerContextEpic,
  type PlannerContextRitual,
  type PlannerContextTask,
  type PlannerDayLoad,
  type PlannerHorizon,
  type PlannerBriefingContext,
  type PlannerMemoryProfile,
  type PlannerMoveSuggestion,
  type PlannerOpenSlot,
  type PlannerQuestion,
  type PlannerScheduleConflict,
  type PlannerScheduleInsights,
  type PlannerSessionState,
  type PlannerStarterIntent,
  type PlanningLauncherConsentKind,
} from "../companion-planner-chat/planner.ts";
import type { CompanionStructuredResponse } from "../../../src/shared/companionStructuredOutput.ts";
import type {
  CompanionAgentFollowUp,
  LoadedCompanionAgentContext,
} from "./types.ts";

const DEFAULT_DURATION_MINUTES = 30;
const DEFAULT_WAKE_TIME = "08:00";
const DEFAULT_WIND_DOWN_TIME = "21:00";
const DAY_SLOT_LIMIT = 2;
const TOTAL_SLOT_LIMIT = 6;

type ScheduleWorkloadTolerance = "light" | "normal" | "heavy";

type ScheduleArchetypeDefaults = {
  label: string;
  plannerHint: string;
  defaultWorkloadTolerance: ScheduleWorkloadTolerance;
  defaultPreferredTimeOfDay: string | null;
  defaultPreferredTimeReason: string | null;
  defaultPreferredTime: string | null;
};

const SCHEDULE_ARCHETYPE_DEFAULTS: Record<string, ScheduleArchetypeDefaults> = {
  nine_to_five: {
    label: "9-5 schedule",
    plannerHint:
      "Assume daytime work hours are constrained; favor morning, lunch, evening, or clearly open windows.",
    defaultWorkloadTolerance: "normal",
    defaultPreferredTimeOfDay: "evening",
    defaultPreferredTimeReason:
      "You said we are planning around a 9-5, so after-work windows may be more realistic.",
    defaultPreferredTime: "18:00",
  },
  business_owner: {
    label: "business owner",
    plannerHint:
      "Favor leverage, revenue, follow-ups, admin batching, and protected deep-work blocks.",
    defaultWorkloadTolerance: "normal",
    defaultPreferredTimeOfDay: "morning",
    defaultPreferredTimeReason:
      "Business owner planning usually benefits from protecting early deep-work momentum.",
    defaultPreferredTime: "09:00",
  },
  after_work_builder: {
    label: "after-work builder",
    plannerHint:
      "Keep daily plans small and energy-aware; favor one meaningful evening momentum task over overload.",
    defaultWorkloadTolerance: "light",
    defaultPreferredTimeOfDay: "evening",
    defaultPreferredTimeReason:
      "You said you are building after work, so evening plans should stay focused and realistic.",
    defaultPreferredTime: "19:00",
  },
  student: {
    label: "student",
    plannerHint:
      "Weight classes, assignments, exams, due dates, study blocks, and recovery between academic demands.",
    defaultWorkloadTolerance: "normal",
    defaultPreferredTimeOfDay: "afternoon",
    defaultPreferredTimeReason:
      "Student schedules often work best when study blocks fit around class and deadline pressure.",
    defaultPreferredTime: "15:00",
  },
  variable_schedule: {
    label: "variable schedule",
    plannerHint:
      "Avoid rigid assumptions; prefer lighter plans, flexible ordering, and easy recovery paths.",
    defaultWorkloadTolerance: "light",
    defaultPreferredTimeOfDay: null,
    defaultPreferredTimeReason: null,
    defaultPreferredTime: null,
  },
  flexible_transition: {
    label: "flexible or transition season",
    plannerHint:
      "Create gentle anchors and clear next actions without assuming a fixed routine or overloading the day.",
    defaultWorkloadTolerance: "light",
    defaultPreferredTimeOfDay: "morning",
    defaultPreferredTimeReason:
      "A flexible season benefits from a simple morning anchor before the day diffuses.",
    defaultPreferredTime: "09:00",
  },
};

const getScheduleArchetypeDefaults = (
  value: unknown,
): (ScheduleArchetypeDefaults & { id: string }) | null => {
  const key = asString(value);
  const defaults = key ? SCHEDULE_ARCHETYPE_DEFAULTS[key] : null;
  return key && defaults ? { id: key, ...defaults } : null;
};

type TimelineInterval = {
  id: string;
  title: string;
  startMinutes: number;
  endMinutes: number;
};

type PreferredWindow = {
  timeOfDay: string;
  time: string | null;
  reason: string | null;
  sourceCount: number;
};

export interface PlannerAssistResult {
  mode: "conversational" | "schedule_read" | "proposal";
  reply: string;
  questions: PlannerQuestion[];
  scheduleInsights: PlannerScheduleInsights;
  structuredResponse: CompanionStructuredResponse | null;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

const asNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];

const asNumberArray = (value: unknown): number[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is number =>
      typeof entry === "number" && Number.isFinite(entry)
    )
    : [];

const parseTimeToMinutes = (
  value: string | null | undefined,
): number | null => {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const hour = Number.parseInt(match[1] ?? "", 10);
  const minute = Number.parseInt(match[2] ?? "", 10);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;

  return (hour * 60) + minute;
};

const formatMinutesAsTime = (minutes: number): string => {
  const normalized = Math.min(Math.max(minutes, 0), (23 * 60) + 59);
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const getTaskDuration = (task: PlannerContextTask): number =>
  Number.isFinite(task.estimatedDuration) && (task.estimatedDuration ?? 0) > 0
    ? Number(task.estimatedDuration)
    : DEFAULT_DURATION_MINUTES;

const getRangeDates = (
  selectedDate: string,
  horizon: PlannerHorizon,
): string[] => {
  const start = parseISO(selectedDate);
  const totalDays = horizon === "day" ? 1 : horizon === "week" ? 7 : 30;
  return Array.from(
    { length: totalDays },
    (_, index) => format(addDays(start, index), "yyyy-MM-dd"),
  );
};

const addDaysToDateKey = (dateKey: string, days: number): string =>
  format(addDays(parseISO(dateKey), days), "yyyy-MM-dd");

const toTimeOfDay = (time: string | null | undefined): string | null => {
  const minutes = parseTimeToMinutes(time);
  if (minutes === null) return null;
  const hour = Math.floor(minutes / 60);
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
};

const getPreferredWindows = (
  plannerMemory?: Record<string, unknown> | null,
): PreferredWindow[] => {
  const rawWindows = Array.isArray(plannerMemory?.preferredWindows)
    ? plannerMemory?.preferredWindows
    : [];
  const windows = rawWindows
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => ({
      timeOfDay: asString(entry.timeOfDay) ?? "morning",
      time: asString(entry.time),
      reason: asString(entry.reason),
      sourceCount: asNumber(entry.sourceCount) ?? 1,
    }));

  if (windows.length > 0) return windows;

  const preferredTimeOfDay = asString(plannerMemory?.preferredTimeOfDay);
  if (!preferredTimeOfDay) return [];

  return [{
    timeOfDay: preferredTimeOfDay,
    time: null,
    reason: asString(plannerMemory?.preferredTimeReason),
    sourceCount: 1,
  }];
};

const getWakeMinutes = (plannerMemory?: Record<string, unknown> | null) =>
  parseTimeToMinutes(asString(plannerMemory?.wakeTime) ?? DEFAULT_WAKE_TIME) ??
    8 * 60;

const getWindDownMinutes = (plannerMemory?: Record<string, unknown> | null) =>
  parseTimeToMinutes(
    asString(plannerMemory?.windDownTime) ?? DEFAULT_WIND_DOWN_TIME,
  ) ?? 21 * 60;

const getLocalDateKeyFromDateTime = (value: string): string => {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T/);
  return match?.[1] ?? value.slice(0, 10);
};

const getLocalMinutesFromDateTime = (value: string): number | null => {
  const match = value.match(/T(\d{2}):(\d{2})/);
  if (!match) return null;

  const hour = Number.parseInt(match[1] ?? "", 10);
  const minute = Number.parseInt(match[2] ?? "", 10);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return (hour * 60) + minute;
};

const getDateTimeOffset = (value: string): string => {
  const match = value.match(/([+-]\d{2}:\d{2}|Z)$/);
  return match?.[1] ?? "Z";
};

const buildOffsetDateTime = (
  dateKey: string,
  clockTime: string,
  offset: string,
): string => `${dateKey}T${clockTime}:00${offset}`;

const buildOffsetDateWindow = (
  currentDateTime: string,
  dateKey: string,
): { start: Date; end: Date } => {
  const offset = getDateTimeOffset(currentDateTime);
  return {
    start: new Date(buildOffsetDateTime(dateKey, "00:00", offset)),
    end: new Date(
      buildOffsetDateTime(addDaysToDateKey(dateKey, 1), "00:00", offset),
    ),
  };
};

const normalizeScheduleReadMessage = (message: string): string => {
  const trimmed = message.trim();
  const normalized = trimmed.toLowerCase();
  const match = normalized.match(
    /^what(?:'s| is)\s+on\s+(today|tomorrow|the day after tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\??$/,
  );

  if (!match?.[1]) {
    return trimmed;
  }

  return `what do i have ${match[1]}`;
};

const buildTaskIntervals = (tasks: PlannerContextTask[]): TimelineInterval[] =>
  tasks
    .filter((task) =>
      task.completed !== true && task.taskDate && task.scheduledTime
    )
    .map((task) => {
      const startMinutes = parseTimeToMinutes(task.scheduledTime);
      if (startMinutes === null) return null;

      return {
        id: task.id,
        title: task.title,
        startMinutes,
        endMinutes: startMinutes + getTaskDuration(task),
      };
    })
    .filter((interval): interval is TimelineInterval => Boolean(interval))
    .sort((left, right) => left.startMinutes - right.startMinutes);

const buildCalendarIntervals = (
  date: string,
  events: PlannerContextCalendarEvent[],
  currentDateTime: string,
  wakeMinutes: number,
  windDownMinutes: number,
): TimelineInterval[] => {
  const { start: dayStart, end: dayEnd } = buildOffsetDateWindow(
    currentDateTime,
    date,
  );

  return events
    .map((event) => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);

      if (eventEnd <= dayStart || eventStart >= dayEnd) return null;

      if (event.isAllDay) {
        return {
          id: event.id,
          title: event.title,
          startMinutes: wakeMinutes,
          endMinutes: windDownMinutes,
        };
      }

      const localStart = eventStart < dayStart ? dayStart : eventStart;
      const localEnd = eventEnd > dayEnd ? dayEnd : eventEnd;
      const startMinutes = Math.round(
        (localStart.getTime() - dayStart.getTime()) / 60_000,
      );
      const endMinutes = Math.round(
        (localEnd.getTime() - dayStart.getTime()) / 60_000,
      );
      if (endMinutes <= startMinutes) return null;

      return {
        id: event.id,
        title: event.title,
        startMinutes,
        endMinutes,
      };
    })
    .filter((interval): interval is TimelineInterval => Boolean(interval))
    .sort((left, right) => left.startMinutes - right.startMinutes);
};

const buildIntervalsForDate = (params: {
  date: string;
  tasks: PlannerContextTask[];
  calendarEvents: PlannerContextCalendarEvent[];
  currentDateTime: string;
  wakeMinutes: number;
  windDownMinutes: number;
}) =>
  [
    ...buildTaskIntervals(params.tasks),
    ...buildCalendarIntervals(
      params.date,
      params.calendarEvents,
      params.currentDateTime,
      params.wakeMinutes,
      params.windDownMinutes,
    ),
  ].sort((left, right) => left.startMinutes - right.startMinutes);

const getDayLoadStatus = (
  totalMinutes: number,
  taskCount: number,
): PlannerDayLoad["status"] => {
  if (taskCount === 0 || totalMinutes === 0) return "open";
  if (totalMinutes > 300 || taskCount >= 6) return "overloaded";
  if (totalMinutes > 180 || taskCount >= 4) return "busy";
  return "balanced";
};

const scoreSlot = (params: {
  slotStart: number;
  selectedDate: string;
  date: string;
  load: PlannerDayLoad;
  preferredWindows: PreferredWindow[];
  peakHours: number[];
}): { score: number; reason: string } => {
  const slotTime = formatMinutesAsTime(params.slotStart);
  const slotTimeOfDay = toTimeOfDay(slotTime);
  const exactMatch = params.preferredWindows.find((window) =>
    window.time === slotTime
  );
  const windowMatch = params.preferredWindows.find((window) =>
    window.timeOfDay === slotTimeOfDay
  );
  const peakMatch = params.peakHours.some((hour) =>
    Math.abs((hour * 60) - params.slotStart) <= 60
  );

  let score = 50;
  let reason = "Open time in your schedule.";

  if (params.date === params.selectedDate) score += 14;
  if (params.load.status === "open") score += 16;
  else if (params.load.status === "balanced") score += 10;
  else if (params.load.status === "busy") score -= 4;
  else score -= 18;

  if (exactMatch) {
    score += 28 + (exactMatch.sourceCount * 2);
    reason = exactMatch.reason
      ? `Matches your usual ${exactMatch.timeOfDay} rhythm: ${exactMatch.reason}.`
      : `Matches your usual ${exactMatch.timeOfDay} planning rhythm.`;
  } else if (windowMatch) {
    score += 18 + windowMatch.sourceCount;
    reason = windowMatch.reason
      ? `Fits your usual ${windowMatch.timeOfDay} window: ${windowMatch.reason}.`
      : `Lines up with your usual ${windowMatch.timeOfDay} window.`;
  } else if (peakMatch) {
    score += 12;
    reason = "Near one of your stronger focus hours.";
  } else if (params.load.status === "open") {
    reason =
      "This day is light, so it has room without crowding anything else.";
  } else if (params.load.status === "balanced") {
    reason = "This window keeps the day balanced without creating a pileup.";
  }

  return {
    score,
    reason,
  };
};

const buildSuggestedSlots = (params: {
  rangeDates: string[];
  tasksByDate: Map<string, PlannerContextTask[]>;
  calendarEvents: PlannerContextCalendarEvent[];
  selectedDate: string;
  currentDateTime: string;
  dayLoads: PlannerDayLoad[];
  plannerMemory?: Record<string, unknown> | null;
}): PlannerOpenSlot[] => {
  const preferredWindows = getPreferredWindows(params.plannerMemory);
  const peakHours = asStringArray(params.plannerMemory?.peakProductivityTimes)
    .map((value) =>
      value.includes(":")
        ? parseTimeToMinutes(value)
        : parseTimeToMinutes(`${value.padStart(2, "0")}:00`)
    )
    .filter((minutes): minutes is number => minutes !== null)
    .map((minutes) => Math.floor(minutes / 60));
  const wakeMinutes = getWakeMinutes(params.plannerMemory);
  const windDownMinutes = getWindDownMinutes(params.plannerMemory);
  const currentDateKey = getLocalDateKeyFromDateTime(params.currentDateTime);
  const currentMinutes = getLocalMinutesFromDateTime(params.currentDateTime);
  const slots: PlannerOpenSlot[] = [];

  params.rangeDates.forEach((date) => {
    const intervals = buildIntervalsForDate({
      date,
      tasks: params.tasksByDate.get(date) ?? [],
      calendarEvents: params.calendarEvents,
      currentDateTime: params.currentDateTime,
      wakeMinutes,
      windDownMinutes,
    });
    const dayLoad = params.dayLoads.find((entry) => entry.date === date) ?? {
      date,
      totalMinutes: 0,
      taskCount: 0,
      status: "open" as const,
    };

    let cursor = wakeMinutes;
    if (date === currentDateKey && currentMinutes !== null) {
      cursor = Math.max(cursor, currentMinutes);
    }

    const localSlots: PlannerOpenSlot[] = [];
    const pushSlot = (slotStart: number, slotEnd: number) => {
      const duration = slotEnd - slotStart;
      if (duration < 30) return;

      const preferredStart = preferredWindows
        .map((window) => parseTimeToMinutes(window.time))
        .find((minutes) =>
          minutes !== null &&
          minutes >= slotStart &&
          minutes + 30 <= slotEnd
        );
      const chosenStart = preferredStart ?? slotStart;
      const chosenEnd = Math.min(
        slotEnd,
        chosenStart + Math.max(30, Math.min(duration, 90)),
      );
      const scored = scoreSlot({
        slotStart: chosenStart,
        selectedDate: params.selectedDate,
        date,
        load: dayLoad,
        preferredWindows,
        peakHours,
      });

      localSlots.push({
        date,
        time: formatMinutesAsTime(chosenStart),
        endTime: formatMinutesAsTime(chosenEnd),
        score: scored.score,
        reason: scored.reason,
      });
    };

    for (const interval of intervals) {
      pushSlot(cursor, interval.startMinutes);
      cursor = Math.max(cursor, interval.endMinutes);
    }

    pushSlot(cursor, windDownMinutes);

    localSlots
      .sort((left, right) => right.score - left.score)
      .slice(0, DAY_SLOT_LIMIT)
      .forEach((slot) => slots.push(slot));
  });

  return slots
    .sort((left, right) => right.score - left.score)
    .slice(0, TOTAL_SLOT_LIMIT);
};

const buildMoveSuggestions = (params: {
  rangeDates: string[];
  tasksByDate: Map<string, PlannerContextTask[]>;
  dayLoads: PlannerDayLoad[];
  suggestedSlots: PlannerOpenSlot[];
}): PlannerMoveSuggestion[] => {
  const openTargets = params.dayLoads.filter((load) =>
    load.status === "open" || load.status === "balanced"
  );
  const overloadedLoads = params.dayLoads.filter((load) =>
    load.status === "overloaded"
  );
  const suggestions: PlannerMoveSuggestion[] = [];

  overloadedLoads.forEach((load) => {
    const tasks = (params.tasksByDate.get(load.date) ?? [])
      .filter((task) => task.completed !== true)
      .slice()
      .sort((left, right) => getTaskDuration(right) - getTaskDuration(left));

    const moveTask = tasks[0];
    const targetDay = openTargets.find((candidate) =>
      candidate.date !== load.date
    );
    if (!moveTask || !targetDay) return;

    const targetSlot = params.suggestedSlots.find((slot) =>
      slot.date === targetDay.date
    );
    suggestions.push({
      fromDate: load.date,
      toDate: targetDay.date,
      taskId: moveTask.id,
      taskTitle: moveTask.title,
      suggestedTime: targetSlot?.time ?? null,
      reason: targetSlot
        ? `${targetDay.date} has room at ${targetSlot.time}, which should ease the load from ${load.date}.`
        : `${targetDay.date} looks lighter than ${load.date}, so it can absorb one more block cleanly.`,
    });
  });

  return suggestions.slice(0, Math.min(params.rangeDates.length, 3));
};

const buildConflicts = (
  intervals: TimelineInterval[],
): PlannerScheduleConflict[] => {
  if (intervals.length < 2) return [];

  const conflicts: PlannerScheduleConflict[] = [];
  for (let index = 0; index < intervals.length - 1; index += 1) {
    const current = intervals[index];
    for (
      let nextIndex = index + 1;
      nextIndex < intervals.length;
      nextIndex += 1
    ) {
      const next = intervals[nextIndex];
      if (next.startMinutes >= current.endMinutes) break;

      const overlapMinutes = Math.min(current.endMinutes, next.endMinutes) -
        next.startMinutes;
      if (overlapMinutes <= 0) continue;

      conflicts.push({
        date: "",
        taskAId: current.id,
        taskATitle: current.title,
        taskBId: next.id,
        taskBTitle: next.title,
        overlapMinutes,
      });
    }
  }

  return conflicts;
};

const buildScheduleInsights = (params: {
  tasks: PlannerContextTask[];
  calendarEvents: PlannerContextCalendarEvent[];
  horizon: PlannerHorizon;
  selectedDate: string;
  currentDateTime: string;
  plannerMemory?: Record<string, unknown> | null;
}): PlannerScheduleInsights => {
  const rangeDates = getRangeDates(params.selectedDate, params.horizon);
  const tasksByDate = new Map<string, PlannerContextTask[]>();
  const wakeMinutes = getWakeMinutes(params.plannerMemory);
  const windDownMinutes = getWindDownMinutes(params.plannerMemory);

  params.tasks.forEach((task) => {
    if (!task.taskDate || !rangeDates.includes(task.taskDate)) return;
    if (!tasksByDate.has(task.taskDate)) {
      tasksByDate.set(task.taskDate, []);
    }
    tasksByDate.get(task.taskDate)?.push(task);
  });

  const dayLoads = rangeDates.map((date) => {
    const intervals = buildIntervalsForDate({
      date,
      tasks: (tasksByDate.get(date) ?? []).filter((task) =>
        task.completed !== true
      ),
      calendarEvents: params.calendarEvents,
      currentDateTime: params.currentDateTime,
      wakeMinutes,
      windDownMinutes,
    });
    const totalMinutes = intervals.reduce(
      (sum, interval) =>
        sum + Math.max(0, interval.endMinutes - interval.startMinutes),
      0,
    );

    return {
      date,
      totalMinutes,
      taskCount: intervals.length,
      status: getDayLoadStatus(totalMinutes, intervals.length),
    } satisfies PlannerDayLoad;
  });

  const conflicts = rangeDates.flatMap((date) =>
    buildConflicts(buildIntervalsForDate({
      date,
      tasks: tasksByDate.get(date) ?? [],
      calendarEvents: params.calendarEvents,
      currentDateTime: params.currentDateTime,
      wakeMinutes,
      windDownMinutes,
    })).map((conflict) => ({
      ...conflict,
      date,
    }))
  );

  const suggestedSlots = buildSuggestedSlots({
    rangeDates,
    tasksByDate,
    calendarEvents: params.calendarEvents,
    selectedDate: params.selectedDate,
    currentDateTime: params.currentDateTime,
    dayLoads,
    plannerMemory: params.plannerMemory,
  });

  return {
    horizon: params.horizon,
    selectedDate: params.selectedDate,
    dayLoads,
    overloadedDates: dayLoads.filter((load) => load.status === "overloaded")
      .map((load) => load.date),
    emptyDates: dayLoads.filter((load) => load.status === "open").map((load) =>
      load.date
    ),
    conflicts,
    suggestedSlots,
    moveSuggestions: buildMoveSuggestions({
      rangeDates,
      tasksByDate,
      dayLoads,
      suggestedSlots,
    }),
  };
};

const mapTask = (task: Record<string, unknown>): PlannerContextTask => ({
  id: String(task.id),
  title: asString(task.task_text) ?? "Untitled task",
  taskDate: asString(task.task_date),
  category: asString(task.category),
  scheduledTime: asString(task.scheduled_time),
  estimatedDuration: asNumber(task.estimated_duration),
  actualDurationMinutes: asNumber(task.actual_duration_minutes),
  actualTimeSpent: asNumber(task.actual_time_spent),
  notes: asString(task.notes),
  recurrencePattern: asString(task.recurrence_pattern),
  recurrenceEndDate: asString(task.recurrence_end_date),
  completed: task.completed === true,
  completedAt: asString(task.completed_at),
  priority: asString(task.priority),
  source: asString(task.source),
  habitSourceId: asString(task.habit_source_id),
  epicId: asString(task.epic_id),
  epicTitle: asString(task.epic_title),
});

const mapCampaign = (
  campaign: Record<string, unknown>,
): PlannerContextEpic => ({
  id: String(campaign.id),
  title: asString(campaign.title) ?? "Untitled campaign",
  endDate: asString(campaign.end_date),
  progressPercentage: asNumber(campaign.progress_percentage),
});

const isActiveCampaignContextRow = (
  campaign: Record<string, unknown>,
): boolean => {
  const status = asString(campaign.status);
  return !status || status === "active";
};

const detachInactiveCampaignTaskLink = (
  task: PlannerContextTask,
  activeCampaignById: Map<string, PlannerContextEpic>,
): PlannerContextTask => {
  if (!task.epicId) return task;

  const activeCampaign = activeCampaignById.get(task.epicId);
  if (!activeCampaign) {
    return {
      ...task,
      epicId: null,
      epicTitle: null,
      habitSourceId: null,
    };
  }

  return {
    ...task,
    epicTitle: task.epicTitle ?? activeCampaign.title,
  };
};

const mapRitual = (ritual: Record<string, unknown>): PlannerContextRitual => ({
  id: String(ritual.id),
  epicId: asString(ritual.epic_id) ?? "general",
  epicTitle: asString(ritual.epic_title) ?? "your goals",
  title: asString(ritual.title) ?? "Untitled ritual",
  frequency: asString(ritual.frequency),
  preferredTime: asString(ritual.preferred_time),
  customDays: asNumberArray(ritual.custom_days),
  customMonthDays: asNumberArray(ritual.custom_month_days),
  customPeriod:
    ritual.custom_period === "week" || ritual.custom_period === "month"
      ? ritual.custom_period
      : null,
  estimatedMinutes: asNumber(ritual.estimated_minutes),
  actualDurationMinutes: asNumber(ritual.actual_duration_minutes),
});

const mapCalendarEvent = (
  event: Record<string, unknown>,
): PlannerContextCalendarEvent => ({
  id: String(event.id),
  title: asString(event.title) ?? "Calendar event",
  start: asString(event.start_time) ?? "",
  end: asString(event.end_time) ?? "",
  isAllDay: event.is_all_day === true,
  provider: asString(event.source) ?? "calendar",
  readOnly: true,
});

const buildPlannerMemory = (
  context: LoadedCompanionAgentContext,
): Record<string, unknown> | null => {
  const plannerPreferences = asRecord(context.recentMemory.planner_preferences);
  const profileOnboarding = asRecord(context.recentMemory.profile_onboarding);
  const preferredWorkBlocks = asRecord(
    plannerPreferences?.preferred_work_blocks,
  );
  const profile = asRecord(preferredWorkBlocks?.planner_profile) ?? {};
  const rawScheduleArchetype = asString(profile.scheduleArchetype) ??
    asString(profileOnboarding?.scheduleArchetype);
  const scheduleDefaults = getScheduleArchetypeDefaults(rawScheduleArchetype);
  const scheduleArchetype = scheduleDefaults?.id ?? null;
  const scheduleArchetypePlanningHint =
    asString(profile.scheduleArchetypePlanningHint) ??
      asString(profileOnboarding?.scheduleArchetypePlanningHint) ??
      scheduleDefaults?.plannerHint ??
      null;
  const preferredTimeOfDay = asString(profile.preferredTimeOfDay) ??
    scheduleDefaults?.defaultPreferredTimeOfDay ??
    null;
  const preferredTimeReason = asString(profile.preferredTimeReason) ??
    scheduleDefaults?.defaultPreferredTimeReason ??
    null;
  const preferredWindows = Array.isArray(profile.preferredWindows)
    ? profile.preferredWindows
    : preferredTimeOfDay
    ? [{
      timeOfDay: preferredTimeOfDay,
      time: scheduleDefaults?.defaultPreferredTime ?? null,
      reason: preferredTimeReason,
      sourceCount: 1,
    }]
    : [];

  return {
    ...profile,
    scheduleArchetype,
    scheduleArchetypeLabel: asString(profile.scheduleArchetypeLabel) ??
      asString(profileOnboarding?.scheduleArchetypeLabel) ??
      scheduleDefaults?.label ??
      null,
    scheduleArchetypePlanningHint,
    preferredTimeOfDay,
    preferredTimeReason,
    preferredWindows,
    workloadTolerance: asString(profile.workloadTolerance) ??
      scheduleDefaults?.defaultWorkloadTolerance ??
      null,
    wakeTime: asString(plannerPreferences?.wake_time) ??
      asString(profile.wakeTime),
    windDownTime: asString(plannerPreferences?.wind_down_time) ??
      asString(profile.windDownTime),
    peakProductivityTimes: asStringArray(
      profile.peakProductivityTimes ??
        context.recentMemory.ai_learning_peak_productivity_times,
    ),
  };
};

const normalizePlannerStarterIntent = (
  starterIntent: string | null | undefined,
): PlannerStarterIntent | null => {
  switch (starterIntent) {
    case "general":
    case "plan_day":
    case "plan_week":
    case "advance_campaign_start":
    case "make_room":
    case "what_matters":
    case "relationship_touch":
    case "low_energy_adjust":
    case "briefing_followup":
    case "goal_breakdown":
    case "free_talk_start":
    case "upcoming_start":
    case "goal_breakdown_start":
      return starterIntent;
    default:
      return null;
  }
};

const normalizePlanningConsentKind = (
  value: unknown,
): PlanningLauncherConsentKind | null => {
  switch (value) {
    case "schedule_changes":
    case "campaign_adjustment":
    case "planner_changes":
      return value;
    default:
      return null;
  }
};

const getFollowUpMetadata = (
  followUp: CompanionAgentFollowUp | null | undefined,
): Record<string, unknown> | null => asRecord(followUp?.metadata);

const buildPlanningConsentFromFollowUp = (
  followUp: CompanionAgentFollowUp | null | undefined,
): PlannerSessionState["planningConsent"] => {
  const metadata = getFollowUpMetadata(followUp);
  if (!metadata || metadata.planningLauncherConsent !== true) return null;

  const sourceStarterIntent = normalizePlannerStarterIntent(
    asString(metadata.sourceStarterIntent),
  );
  const kind = normalizePlanningConsentKind(metadata.consentKind);
  const sourceMessage = asString(metadata.sourceMessage);

  if (!sourceStarterIntent || !kind || !sourceMessage) return null;

  return {
    kind,
    sourceStarterIntent,
    sourceMessage,
  };
};

const getQuestionIdFromFollowUp = (
  followUp: CompanionAgentFollowUp | null | undefined,
): string | null => asString(getFollowUpMetadata(followUp)?.questionId);

const isPlanDayStarterText = (value: string): boolean =>
  /\b(plan my day|help me plan(?: my day| today)|plan today)\b/i.test(value);

const isLikelyPlanDayClarificationReply = (value: string): boolean => {
  const normalized = value.toLowerCase();
  return normalized.includes("?") &&
    (
      normalized.includes("what kind of day") ||
      normalized.includes("what type of day") ||
      normalized.includes("feeling like focusing") ||
      normalized.includes("focus, recovery, or catching up") ||
      normalized.includes("should today lean focus") ||
      normalized.includes("energy") ||
      normalized.includes("what are we making") ||
      normalized.includes("focus")
    );
};

const hasPendingPlanDayClarification = (
  context: LoadedCompanionAgentContext,
): boolean => {
  const lastAssistantIndex = [...context.messages]
    .map((message, index) => ({ message, index }))
    .reverse()
    .find(({ message }) => message.role === "assistant")?.index;
  if (lastAssistantIndex === undefined) return false;

  const assistantMessage = context.messages[lastAssistantIndex];
  if (!isLikelyPlanDayClarificationReply(assistantMessage.content)) {
    return false;
  }

  return context.messages
    .slice(Math.max(0, lastAssistantIndex - 4), lastAssistantIndex)
    .some((message) =>
      message.role === "user" && isPlanDayStarterText(message.content)
    );
};

export function consultPlannerForAgent(params: {
  message: string;
  currentDateTime: string;
  selectedDate?: string | null;
  briefingContext?: PlannerBriefingContext | null;
  surface: "companion" | "journeys";
  horizon?: PlannerHorizon;
  starterIntent?: string | null;
  forcePlanDayFollowUp?: boolean;
  activeFollowUp?: CompanionAgentFollowUp | null;
  context: LoadedCompanionAgentContext;
}): PlannerAssistResult {
  const normalizedMessage = normalizeScheduleReadMessage(params.message);
  const currentDate = params.selectedDate ?? params.currentDateTime.slice(0, 10);
  const plannerMemory = buildPlannerMemory(params.context);
  const plannerStarterIntent = normalizePlannerStarterIntent(
    params.starterIntent,
  );
  const plannerMemoryForPlanning: Record<string, unknown> = {
    ...(plannerMemory ?? {}),
    workloadTolerance: asString(plannerMemory?.workloadTolerance),
  };
  const activeEpics = params.context.campaigns
    .filter(isActiveCampaignContextRow)
    .map(mapCampaign);
  const activeCampaignById = new Map(
    activeEpics.map((campaign) => [campaign.id, campaign]),
  );
  const tasks = params.context.tasks
    .map(mapTask)
    .map((task) => detachInactiveCampaignTaskLink(task, activeCampaignById));
  const recentCompletedTasks = params.context.recentCompletedTasks
    .map(mapTask)
    .map((task) => detachInactiveCampaignTaskLink(task, activeCampaignById));
  const scheduledTasks = tasks.filter((task) => task.taskDate !== null);
  const inboxTasks = tasks.filter((task) => task.taskDate === null);
  const rituals = params.context.rituals.map(mapRitual);
  const calendarEvents = params.context.calendarEvents.map(mapCalendarEvent);
  const horizon = params.horizon ??
    (params.context.visibleDateEnd > currentDate ? "week" : "day");
  const scheduleInsights = buildScheduleInsights({
    tasks: scheduledTasks,
    calendarEvents,
    horizon,
    selectedDate: currentDate,
    currentDateTime: params.currentDateTime,
    plannerMemory: plannerMemoryForPlanning,
  });
  const priorityScores = computePlannerPriorityScores({
    currentDate,
    tasks: scheduledTasks,
    inboxTasks,
    activeEpics,
    rituals,
    calendarEvents,
    scheduleInsights,
    briefingContext: params.briefingContext ?? null,
    plannerMemory: {
      preferredTimeOfDay: asString(
        plannerMemoryForPlanning?.preferredTimeOfDay,
      ),
      wakeTime: asString(plannerMemoryForPlanning?.wakeTime),
      windDownTime: asString(plannerMemoryForPlanning?.windDownTime),
      peakProductivityTimes: asStringArray(
        plannerMemoryForPlanning?.peakProductivityTimes,
      ),
      preferredWindows:
        Array.isArray(plannerMemoryForPlanning?.preferredWindows)
          ? plannerMemoryForPlanning.preferredWindows as Array<{
            timeOfDay: string;
            time?: string | null;
            reason?: string | null;
            sourceCount?: number;
          }>
          : [],
      workloadTolerance: asString(
        plannerMemoryForPlanning?.workloadTolerance,
      ) as
        | "light"
        | "normal"
        | "heavy"
        | null,
    },
    aiSignals: {
      suggestedWorkload: asString(
        asRecord(params.context.recentMemory.ai_learning)?.suggested_workload,
      ) as
        | "light"
        | "normal"
        | "heavy"
        | undefined,
    },
  });

  const modeConfig = getCompanionModeConfig(params.context.companionMode);
  const pendingPlanDayClarification = params.forcePlanDayFollowUp === true ||
    (!plannerStarterIntent && hasPendingPlanDayClarification(params.context));
  const activeQuestionId = getQuestionIdFromFollowUp(params.activeFollowUp);
  const planningConsent = buildPlanningConsentFromFollowUp(
    params.activeFollowUp,
  );
  const isPlanDayQuestConsentAnswer =
    activeQuestionId === "plan_day_quest_consent";
  const isPlanningLauncherConsentAnswer =
    activeQuestionId === "planning_launcher_consent" && planningConsent;
  const sessionState: PlannerSessionState = {
    draft: {},
    openQuestionIds: isPlanDayQuestConsentAnswer
      ? ["plan_day_quest_consent"]
      : isPlanningLauncherConsentAnswer
      ? ["planning_launcher_consent"]
      : pendingPlanDayClarification
      ? ["details"]
      : [],
    preferredTimeOfDay: asString(plannerMemory?.preferredTimeOfDay),
    preferredTimeReason: asString(plannerMemory?.preferredTimeReason),
    reminderPreference: asNumber(plannerMemory?.reminderMinutesBefore)
      ? `${plannerMemory?.reminderMinutesBefore} minutes`
      : null,
    pendingStarterIntent: pendingPlanDayClarification
      ? "plan_day"
      : null,
    lastClassification: null,
    planningConsent,
  };

  const plannerInput: PlannerBuildInput = {
    message: normalizedMessage,
    horizon,
    tonePack: modeConfig.tonePack,
    conversationHistory: params.context.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    sessionState,
    plannerContext: {
      tasks: scheduledTasks,
      inboxTasks,
      recentCompletedTasks,
      activeEpics,
      activeHabitIds: Array.from(new Set(rituals.map((ritual) => ritual.id))),
      rituals,
      calendarEvents,
      briefingContext: params.briefingContext ?? null,
      starterIntent: plannerStarterIntent ?? undefined,
      priorityScores,
      scheduleInsights,
      plannerMemory: {
        tonePack: modeConfig.tonePack,
        scheduleArchetype: asString(
          plannerMemoryForPlanning?.scheduleArchetype,
        ) as PlannerMemoryProfile["scheduleArchetype"],
        scheduleArchetypeLabel: asString(
          plannerMemoryForPlanning?.scheduleArchetypeLabel,
        ),
        scheduleArchetypePlanningHint: asString(
          plannerMemoryForPlanning?.scheduleArchetypePlanningHint,
        ),
        preferredTimeOfDay: asString(
          plannerMemoryForPlanning?.preferredTimeOfDay,
        ),
        preferredTimeReason: asString(
          plannerMemoryForPlanning?.preferredTimeReason,
        ),
        reminderMinutesBefore: asNumber(
          plannerMemoryForPlanning?.reminderMinutesBefore,
        ),
        wakeTime: asString(plannerMemoryForPlanning?.wakeTime),
        windDownTime: asString(plannerMemoryForPlanning?.windDownTime),
        peakProductivityTimes: asStringArray(
          plannerMemoryForPlanning?.peakProductivityTimes,
        ),
        preferredWindows:
          Array.isArray(plannerMemoryForPlanning?.preferredWindows)
            ? plannerMemoryForPlanning.preferredWindows as Array<{
              timeOfDay: string;
              time?: string | null;
              reason?: string | null;
              sourceCount?: number;
            }>
            : [],
        workloadTolerance: asString(
          plannerMemoryForPlanning?.workloadTolerance,
        ) as
          | "light"
          | "normal"
          | "heavy"
          | null,
      },
      aiSignals: {
        commonContexts: asStringArray(
          asRecord(params.context.recentMemory.ai_learning)?.common_contexts,
        ),
      },
    },
    currentDate,
    currentDateTime: params.currentDateTime,
    timezone: params.context.timezone,
  };

  const plannerResult = buildPlannerResponse(plannerInput);

  return {
    mode: plannerResult.mode,
    reply: plannerResult.reply,
    questions: plannerResult.followUpQuestions,
    scheduleInsights,
    structuredResponse: plannerResult.structuredResponse ?? null,
  };
}
