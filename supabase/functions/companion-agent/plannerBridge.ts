import { addDays, format, parseISO } from "https://esm.sh/date-fns@3.6.0";

import { computePlannerPriorityScores } from "../../../src/shared/companionPlannerPriority.ts";
import { getCompanionModeConfig } from "../../../src/shared/companionModes.ts";
import {
  mapPlanningModeToWorkloadTolerance,
  type CompanionPlanningMode,
} from "../../../src/shared/companionPlanningMode.ts";
import {
  buildPlannerResponse,
  type PlannerBuildInput,
  type PlannerContextCalendarEvent,
  type PlannerContextEpic,
  type PlannerContextRitual,
  type PlannerContextTask,
  type PlannerDayLoad,
  type PlannerHorizon,
  type PlannerMoveSuggestion,
  type PlannerOpenSlot,
  type PlannerProposal,
  type PlannerQuestion,
  type PlannerScheduleConflict,
  type PlannerScheduleInsights,
  type PlannerSessionState,
  type PlannerStarterIntent,
} from "../companion-planner-chat/planner.ts";
import type { CompanionStructuredResponse } from "../../../src/shared/companionStructuredOutput.ts";
import type {
  CompanionAgentIntent,
  CompanionPendingActionType,
  LoadedCompanionAgentContext,
} from "./types.ts";

const DEFAULT_DURATION_MINUTES = 30;
const DEFAULT_WAKE_TIME = "08:00";
const DEFAULT_WIND_DOWN_TIME = "21:00";
const DAY_SLOT_LIMIT = 2;
const TOTAL_SLOT_LIMIT = 6;

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

type PlannerActionHint = {
  proposalId: string;
  title: string;
  summary: string;
  actionType: CompanionPendingActionType | null;
  intent: CompanionAgentIntent;
  normalizedPayload: Record<string, unknown> | null;
  unsupportedReason?: string;
};

export interface PlannerAssistResult {
  mode: "conversational" | "schedule_read" | "proposal";
  reply: string;
  questions: PlannerQuestion[];
  actionHints: PlannerActionHint[];
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

const isReminderEnabled = (value: unknown) => value === true;

const parseTimeToMinutes = (value: string | null | undefined): number | null => {
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

const getRangeDates = (selectedDate: string, horizon: PlannerHorizon): string[] => {
  const start = parseISO(selectedDate);
  const totalDays = horizon === "day" ? 1 : horizon === "week" ? 7 : 30;
  return Array.from(
    { length: totalDays },
    (_, index) => format(addDays(start, index), "yyyy-MM-dd"),
  );
};

const toTimeOfDay = (time: string | null | undefined): string | null => {
  const minutes = parseTimeToMinutes(time);
  if (minutes === null) return null;
  const hour = Math.floor(minutes / 60);
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
};

const getPreferredWindows = (plannerMemory?: Record<string, unknown> | null): PreferredWindow[] => {
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
  parseTimeToMinutes(asString(plannerMemory?.wakeTime) ?? DEFAULT_WAKE_TIME) ?? 8 * 60;

const getWindDownMinutes = (plannerMemory?: Record<string, unknown> | null) =>
  parseTimeToMinutes(asString(plannerMemory?.windDownTime) ?? DEFAULT_WIND_DOWN_TIME) ?? 21 * 60;

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
    .filter((task) => task.completed !== true && task.taskDate && task.scheduledTime)
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
  wakeMinutes: number,
  windDownMinutes: number,
): TimelineInterval[] => {
  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(`${date}T23:59:59`);

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
      const startMinutes = (localStart.getHours() * 60) + localStart.getMinutes();
      const endMinutes = (localEnd.getHours() * 60) + localEnd.getMinutes();
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
  wakeMinutes: number;
  windDownMinutes: number;
}) => [
  ...buildTaskIntervals(params.tasks),
  ...buildCalendarIntervals(
    params.date,
    params.calendarEvents,
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
  const exactMatch = params.preferredWindows.find((window) => window.time === slotTime);
  const windowMatch = params.preferredWindows.find((window) => window.timeOfDay === slotTimeOfDay);
  const peakMatch = params.peakHours.some((hour) => Math.abs((hour * 60) - params.slotStart) <= 60);

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
    reason = "This day is light, so it has room without crowding anything else.";
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
    .map((value) => value.includes(":") ? parseTimeToMinutes(value) : parseTimeToMinutes(`${value.padStart(2, "0")}:00`))
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
      const chosenEnd = Math.min(slotEnd, chosenStart + Math.max(30, Math.min(duration, 90)));
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
  const openTargets = params.dayLoads.filter((load) => load.status === "open" || load.status === "balanced");
  const overloadedLoads = params.dayLoads.filter((load) => load.status === "overloaded");
  const suggestions: PlannerMoveSuggestion[] = [];

  overloadedLoads.forEach((load) => {
    const tasks = (params.tasksByDate.get(load.date) ?? [])
      .filter((task) => task.completed !== true)
      .slice()
      .sort((left, right) => getTaskDuration(right) - getTaskDuration(left));

    const moveTask = tasks[0];
    const targetDay = openTargets.find((candidate) => candidate.date !== load.date);
    if (!moveTask || !targetDay) return;

    const targetSlot = params.suggestedSlots.find((slot) => slot.date === targetDay.date);
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

const buildConflicts = (intervals: TimelineInterval[]): PlannerScheduleConflict[] => {
  if (intervals.length < 2) return [];

  const conflicts: PlannerScheduleConflict[] = [];
  for (let index = 0; index < intervals.length - 1; index += 1) {
    const current = intervals[index];
    for (let nextIndex = index + 1; nextIndex < intervals.length; nextIndex += 1) {
      const next = intervals[nextIndex];
      if (next.startMinutes >= current.endMinutes) break;

      const overlapMinutes = Math.min(current.endMinutes, next.endMinutes) - next.startMinutes;
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
      tasks: (tasksByDate.get(date) ?? []).filter((task) => task.completed !== true),
      calendarEvents: params.calendarEvents,
      wakeMinutes,
      windDownMinutes,
    });
    const totalMinutes = intervals.reduce(
      (sum, interval) => sum + Math.max(0, interval.endMinutes - interval.startMinutes),
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
    overloadedDates: dayLoads.filter((load) => load.status === "overloaded").map((load) => load.date),
    emptyDates: dayLoads.filter((load) => load.status === "open").map((load) => load.date),
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
  scheduledTime: asString(task.scheduled_time),
  estimatedDuration: asNumber(task.estimated_duration),
  notes: asString(task.notes),
  recurrencePattern: asString(task.recurrence_pattern),
  recurrenceEndDate: asString(task.recurrence_end_date),
  completed: task.completed === true,
  priority: asString(task.priority),
  source: asString(task.source),
  epicId: asString(task.epic_id),
  epicTitle: asString(task.epic_title),
});

const mapCampaign = (campaign: Record<string, unknown>): PlannerContextEpic => ({
  id: String(campaign.id),
  title: asString(campaign.title) ?? "Untitled campaign",
  endDate: asString(campaign.end_date),
  progressPercentage: asNumber(campaign.progress_percentage),
});

const mapRitual = (ritual: Record<string, unknown>): PlannerContextRitual => ({
  id: String(ritual.id),
  epicId: asString(ritual.epic_id) ?? "general",
  epicTitle: asString(ritual.epic_title) ?? "your goals",
  title: asString(ritual.title) ?? "Untitled ritual",
  frequency: asString(ritual.frequency),
  preferredTime: asString(ritual.preferred_time),
});

const mapCalendarEvent = (event: Record<string, unknown>): PlannerContextCalendarEvent => ({
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
  const preferredWorkBlocks = asRecord(plannerPreferences?.preferred_work_blocks);
  const profile = asRecord(preferredWorkBlocks?.planner_profile) ?? {};

  return {
    ...profile,
    wakeTime: asString(plannerPreferences?.wake_time) ?? asString(profile.wakeTime),
    windDownTime: asString(plannerPreferences?.wind_down_time) ?? asString(profile.windDownTime),
    peakProductivityTimes: asStringArray(
      profile.peakProductivityTimes ?? context.recentMemory.ai_learning_peak_productivity_times,
    ),
  };
};

const mapPlannerProposal = (
  proposal: PlannerProposal,
): PlannerActionHint => {
  const payload = asRecord(proposal.payload) ?? {};

  switch (proposal.kind) {
    case "create_quest":
      return {
        proposalId: proposal.id,
        title: proposal.title,
        summary: proposal.summary,
        actionType: "task_create",
        intent: "schedule_task",
        normalizedPayload: {
          title: asString(payload.taskText) ?? proposal.title.replace(/^Create\s+/i, ""),
          task_date: asString(payload.taskDate),
          scheduled_time: asString(payload.scheduledTime),
          estimated_duration: asNumber(payload.estimatedDuration),
          notes: asString(payload.notes),
          priority: asString(payload.priority),
          reminder_enabled: isReminderEnabled(payload.reminderEnabled),
          reminder_minutes_before: asNumber(payload.reminderMinutesBefore),
          epic_id: asString(payload.epicId),
        },
      };
    case "update_quest": {
      const updates = asRecord(payload.updates) ?? {};
      return {
        proposalId: proposal.id,
        title: proposal.title,
        summary: proposal.summary,
        actionType: "task_update",
        intent: "update_existing_plan",
        normalizedPayload: {
          task_id: asString(payload.taskId),
          title: asString(updates.task_text),
          task_date: asString(updates.task_date),
          scheduled_time: asString(updates.scheduled_time),
          estimated_duration: asNumber(updates.estimated_duration),
          notes: asString(updates.notes),
          priority: asString(updates.priority),
          completed: updates.completed === true ? true : updates.completed === false ? false : undefined,
          reminder_enabled: updates.reminder_enabled === true
            ? true
            : updates.reminder_enabled === false
            ? false
            : undefined,
          reminder_minutes_before: asNumber(updates.reminder_minutes_before),
        },
      };
    }
    case "create_ritual":
      return {
        proposalId: proposal.id,
        title: proposal.title,
        summary: proposal.summary,
        actionType: "ritual_create",
        intent: "goal_setting",
        normalizedPayload: {
          title: asString(payload.title) ?? proposal.title.replace(/^Add\s+/i, ""),
          frequency: asString(payload.frequency) ?? "daily",
          preferred_time: asString(payload.preferredTime),
          estimated_minutes: asNumber(payload.estimatedMinutes),
          description: asString(payload.description),
          category: asString(payload.category),
          reminder_enabled: isReminderEnabled(payload.reminderEnabled),
          reminder_minutes_before: asNumber(payload.reminderMinutesBefore),
        },
      };
    case "suggest_reminder": {
      const updates = asRecord(payload.updates) ?? {};
      return {
        proposalId: proposal.id,
        title: proposal.title,
        summary: proposal.summary,
        actionType: "reminder_create",
        intent: "update_existing_plan",
        normalizedPayload: {
          target_type: "task",
          target_id: asString(payload.taskId),
          reminder_enabled: updates.reminder_enabled !== false,
          reminder_minutes_before: asNumber(updates.reminder_minutes_before),
        },
      };
    }
    case "update_campaign":
      return {
        proposalId: proposal.id,
        title: proposal.title,
        summary: proposal.summary,
        actionType: "campaign_update",
        intent: "goal_setting",
        normalizedPayload: {
          campaign_id: asString(payload.epicId),
          title: asString(payload.title),
        },
      };
    case "adjust_campaign_plan":
      return {
        proposalId: proposal.id,
        title: proposal.title,
        summary: proposal.summary,
        actionType: "campaign_update",
        intent: "goal_setting",
        normalizedPayload: {
          campaign_id: asString(payload.epicId),
          description: asString(payload.reason) ?? asString(payload.requestedSummary),
          status: "needs_adjustment",
        },
      };
    case "create_campaign":
      return {
        proposalId: proposal.id,
        title: proposal.title,
        summary: proposal.summary,
        actionType: null,
        intent: "goal_setting",
        normalizedPayload: null,
        unsupportedReason: "Campaign creation stays conversational in v1.",
      };
    case "update_ritual":
      return {
        proposalId: proposal.id,
        title: proposal.title,
        summary: proposal.summary,
        actionType: null,
        intent: "update_existing_plan",
        normalizedPayload: null,
        unsupportedReason: "Ritual updates are not exposed as direct writes in v1.",
      };
  }
};

const normalizePlannerStarterIntent = (
  starterIntent: string | null | undefined,
): PlannerStarterIntent | null => {
  switch (starterIntent) {
    case "general":
    case "plan_day":
    case "plan_week":
    case "advance_campaign_start":
    case "right_now_start":
    case "make_room":
    case "what_matters":
    case "relationship_touch":
    case "adjust_today":
    case "low_energy_adjust":
    case "briefing_followup":
    case "goal_breakdown":
    case "free_talk_start":
    case "upcoming_start":
    case "quest_capture":
    case "goal_breakdown_start":
      return starterIntent;
    default:
      return null;
  }
};

export function consultPlannerForAgent(params: {
  message: string;
  currentDateTime: string;
  surface: "companion" | "journeys";
  horizon?: PlannerHorizon;
  starterIntent?: string | null;
  planningMode?: CompanionPlanningMode | null;
  context: LoadedCompanionAgentContext;
}): PlannerAssistResult {
  const normalizedMessage = normalizeScheduleReadMessage(params.message);
  const currentDate = params.currentDateTime.slice(0, 10);
  const plannerMemory = buildPlannerMemory(params.context);
  const plannerStarterIntent = normalizePlannerStarterIntent(
    params.starterIntent,
  );
  const plannerMemoryForPlanning: Record<string, unknown> = {
    ...(plannerMemory ?? {}),
    workloadTolerance: params.planningMode
      ? mapPlanningModeToWorkloadTolerance(params.planningMode)
      : asString(plannerMemory?.workloadTolerance),
  };
  const tasks = params.context.tasks.map(mapTask);
  const scheduledTasks = tasks.filter((task) => task.taskDate !== null);
  const inboxTasks = tasks.filter((task) => task.taskDate === null);
  const activeEpics = params.context.campaigns.map(mapCampaign);
  const rituals = params.context.rituals.map(mapRitual);
  const calendarEvents = params.context.calendarEvents.map(mapCalendarEvent);
  const horizon = params.horizon ?? (params.context.visibleDateEnd > currentDate ? "week" : "day");
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
    plannerMemory: {
      preferredTimeOfDay: asString(plannerMemoryForPlanning?.preferredTimeOfDay),
      wakeTime: asString(plannerMemoryForPlanning?.wakeTime),
      windDownTime: asString(plannerMemoryForPlanning?.windDownTime),
      peakProductivityTimes: asStringArray(plannerMemoryForPlanning?.peakProductivityTimes),
      preferredWindows: Array.isArray(plannerMemoryForPlanning?.preferredWindows)
        ? plannerMemoryForPlanning.preferredWindows as Array<{
          timeOfDay: string;
          time?: string | null;
          reason?: string | null;
          sourceCount?: number;
        }>
        : [],
      workloadTolerance: asString(plannerMemoryForPlanning?.workloadTolerance) as
        | "light"
        | "normal"
        | "heavy"
        | null,
    },
    aiSignals: {
      suggestedWorkload: asString(asRecord(params.context.recentMemory.ai_learning)?.suggested_workload) as
        | "light"
        | "normal"
        | "heavy"
        | undefined,
    },
  });

  const modeConfig = getCompanionModeConfig(params.context.companionMode);
  const sessionState: PlannerSessionState = {
    draft: {},
    openQuestionIds: [],
    preferredTimeOfDay: asString(plannerMemory?.preferredTimeOfDay),
    preferredTimeReason: asString(plannerMemory?.preferredTimeReason),
    reminderPreference: asNumber(plannerMemory?.reminderMinutesBefore)
      ? `${plannerMemory?.reminderMinutesBefore} minutes`
      : null,
    pendingStarterIntent: null,
    lastClassification: null,
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
      activeEpics,
      rituals,
      calendarEvents,
      starterIntent: plannerStarterIntent ?? undefined,
      priorityScores,
      scheduleInsights,
      plannerMemory: {
        tonePack: modeConfig.tonePack,
        preferredTimeOfDay: asString(plannerMemoryForPlanning?.preferredTimeOfDay),
        preferredTimeReason: asString(plannerMemoryForPlanning?.preferredTimeReason),
        reminderMinutesBefore: asNumber(plannerMemoryForPlanning?.reminderMinutesBefore),
        wakeTime: asString(plannerMemoryForPlanning?.wakeTime),
        windDownTime: asString(plannerMemoryForPlanning?.windDownTime),
        peakProductivityTimes: asStringArray(plannerMemoryForPlanning?.peakProductivityTimes),
        preferredWindows: Array.isArray(plannerMemoryForPlanning?.preferredWindows)
          ? plannerMemoryForPlanning.preferredWindows as Array<{
            timeOfDay: string;
            time?: string | null;
            reason?: string | null;
            sourceCount?: number;
          }>
          : [],
        workloadTolerance: asString(plannerMemoryForPlanning?.workloadTolerance) as
          | "light"
          | "normal"
          | "heavy"
          | null,
      },
      aiSignals: {
        commonContexts: asStringArray(asRecord(params.context.recentMemory.ai_learning)?.common_contexts),
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
    actionHints: plannerResult.proposals.map(mapPlannerProposal),
    scheduleInsights,
    structuredResponse: plannerResult.structuredResponse ?? null,
  };
}
