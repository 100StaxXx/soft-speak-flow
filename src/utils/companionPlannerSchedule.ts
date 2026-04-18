import { addDays, format, parseISO } from "date-fns";

import type {
  PlannerContextCalendarEvent,
  PlannerContextTask,
  PlannerDayLoad,
  PlannerHorizon,
  PlannerMemoryProfile,
  PlannerMoveSuggestion,
  PlannerOpenSlot,
  PlannerScheduleConflict,
  PlannerScheduleInsights,
} from "@/types/companionPlanner";

const DEFAULT_DURATION_MINUTES = 30;
const DEFAULT_WAKE_TIME = "08:00";
const DEFAULT_WIND_DOWN_TIME = "21:00";
const DAY_SLOT_LIMIT = 2;
const TOTAL_SLOT_LIMIT = 6;

type BuildScheduleInsightsInput = {
  tasks: PlannerContextTask[];
  calendarEvents?: PlannerContextCalendarEvent[];
  horizon: PlannerHorizon;
  selectedDate: string;
  plannerMemory?: PlannerMemoryProfile | null;
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

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

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
  const normalized = clamp(minutes, 0, (23 * 60) + 59);
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

  return Array.from({ length: totalDays }, (_, index) => format(addDays(start, index), "yyyy-MM-dd"));
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

const getPreferredWindows = (plannerMemory?: PlannerMemoryProfile | null): PreferredWindow[] => {
  const windows = plannerMemory?.preferredWindows?.map((window) => ({
    timeOfDay: window.timeOfDay,
    time: window.time ?? null,
    reason: window.reason ?? null,
    sourceCount: window.sourceCount ?? 1,
  })) ?? [];

  if (windows.length > 0) return windows;
  if (!plannerMemory?.preferredTimeOfDay) return [];

  return [
    {
      timeOfDay: plannerMemory.preferredTimeOfDay,
      time: null,
      reason: plannerMemory.preferredTimeReason ?? null,
      sourceCount: 1,
    },
  ];
};

const getWakeMinutes = (plannerMemory?: PlannerMemoryProfile | null) =>
  parseTimeToMinutes(plannerMemory?.wakeTime ?? DEFAULT_WAKE_TIME) ?? 8 * 60;

const getWindDownMinutes = (plannerMemory?: PlannerMemoryProfile | null) =>
  parseTimeToMinutes(plannerMemory?.windDownTime ?? DEFAULT_WIND_DOWN_TIME) ?? 21 * 60;

const getDayBounds = (date: string) => {
  const start = parseISO(`${date}T00:00:00`);
  const end = parseISO(`${date}T23:59:59`);
  return { start, end };
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
  const { start: dayStart, end: dayEnd } = getDayBounds(date);

  return events
    .map((event) => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);

      if (eventEnd <= dayStart || eventStart >= dayEnd) {
        return null;
      }

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

const buildIntervalsForDate = ({
  date,
  tasks,
  calendarEvents,
  wakeMinutes,
  windDownMinutes,
}: {
  date: string;
  tasks: PlannerContextTask[];
  calendarEvents: PlannerContextCalendarEvent[];
  wakeMinutes: number;
  windDownMinutes: number;
}) => [
  ...buildTaskIntervals(tasks),
  ...buildCalendarIntervals(date, calendarEvents, wakeMinutes, windDownMinutes),
].sort((left, right) => left.startMinutes - right.startMinutes);

const getDayLoadStatus = (totalMinutes: number, taskCount: number): PlannerDayLoad["status"] => {
  if (taskCount === 0 || totalMinutes === 0) return "open";
  if (totalMinutes > 300 || taskCount >= 6) return "overloaded";
  if (totalMinutes > 180 || taskCount >= 4) return "busy";
  return "balanced";
};

const scoreSlot = ({
  slotStart,
  selectedDate,
  date,
  load,
  preferredWindows,
  peakHours,
}: {
  slotStart: number;
  selectedDate: string;
  date: string;
  load: PlannerDayLoad;
  preferredWindows: PreferredWindow[];
  peakHours: number[];
}): { score: number; reason: string } => {
  const slotTime = formatMinutesAsTime(slotStart);
  const slotTimeOfDay = toTimeOfDay(slotTime);
  const exactMatch = preferredWindows.find((window) => window.time === slotTime);
  const windowMatch = preferredWindows.find((window) => window.timeOfDay === slotTimeOfDay);
  const peakMatch = peakHours.some((hour) => Math.abs((hour * 60) - slotStart) <= 60);

  let score = 50;
  let reason = "Open time in your schedule.";

  if (date === selectedDate) {
    score += 14;
  }

  if (load.status === "open") {
    score += 16;
  } else if (load.status === "balanced") {
    score += 10;
  } else if (load.status === "busy") {
    score -= 4;
  } else {
    score -= 18;
  }

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
  } else if (load.status === "open") {
    reason = "This day is light, so it has room without crowding anything else.";
  } else if (load.status === "balanced") {
    reason = "This window keeps the day balanced without creating a pileup.";
  }

  return {
    score,
    reason,
  };
};

const buildSuggestedSlots = ({
  rangeDates,
  tasksByDate,
  calendarEvents,
  selectedDate,
  dayLoads,
  plannerMemory,
}: {
  rangeDates: string[];
  tasksByDate: Map<string, PlannerContextTask[]>;
  calendarEvents: PlannerContextCalendarEvent[];
  selectedDate: string;
  dayLoads: PlannerDayLoad[];
  plannerMemory?: PlannerMemoryProfile | null;
}): PlannerOpenSlot[] => {
  const preferredWindows = getPreferredWindows(plannerMemory);
  const peakHours = (plannerMemory?.peakProductivityTimes ?? [])
    .map((value) => value.includes(":") ? parseTimeToMinutes(value) : parseTimeToMinutes(`${value.padStart(2, "0")}:00`))
    .filter((minutes): minutes is number => minutes !== null)
    .map((minutes) => Math.floor(minutes / 60));
  const fallbackPeakHours = (plannerMemory?.preferredWindows ?? [])
    .map((window) => parseTimeToMinutes(window.time))
    .filter((minutes): minutes is number => minutes !== null)
    .map((minutes) => Math.floor(minutes / 60));
  const learnedPeakHours = peakHours.length > 0 ? peakHours : fallbackPeakHours;
  const wakeMinutes = getWakeMinutes(plannerMemory);
  const windDownMinutes = getWindDownMinutes(plannerMemory);
  const minimumSlotMinutes = 30;

  const slots: PlannerOpenSlot[] = [];

  rangeDates.forEach((date) => {
    const dayTasks = tasksByDate.get(date) ?? [];
    const intervals = buildIntervalsForDate({
      date,
      tasks: dayTasks,
      calendarEvents,
      wakeMinutes,
      windDownMinutes,
    });
    const dayLoad = dayLoads.find((candidate) => candidate.date === date) ?? {
      date,
      totalMinutes: 0,
      taskCount: 0,
      status: "open" as const,
    };

    let cursor = wakeMinutes;
    const localSlots: PlannerOpenSlot[] = [];

    const pushSlot = (slotStart: number, slotEnd: number) => {
      const duration = slotEnd - slotStart;
      if (duration < minimumSlotMinutes) return;

      const preferredStart = preferredWindows
        .map((window) => parseTimeToMinutes(window.time))
        .find((minutes) => minutes !== null && minutes >= slotStart && minutes + minimumSlotMinutes <= slotEnd);

      const chosenStart = preferredStart ?? slotStart;
      const chosenEnd = Math.min(slotEnd, chosenStart + Math.max(minimumSlotMinutes, Math.min(duration, 90)));
      const { score, reason } = scoreSlot({
        slotStart: chosenStart,
        selectedDate,
        date,
        load: dayLoad,
        preferredWindows,
        peakHours: learnedPeakHours,
      });

      localSlots.push({
        date,
        time: formatMinutesAsTime(chosenStart),
        endTime: formatMinutesAsTime(chosenEnd),
        score,
        reason,
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

const buildMoveSuggestions = ({
  rangeDates,
  tasksByDate,
  dayLoads,
  suggestedSlots,
}: {
  rangeDates: string[];
  tasksByDate: Map<string, PlannerContextTask[]>;
  dayLoads: PlannerDayLoad[];
  suggestedSlots: PlannerOpenSlot[];
}): PlannerMoveSuggestion[] => {
  const openTargets = dayLoads.filter((load) => load.status === "open" || load.status === "balanced");
  const overloadedLoads = dayLoads.filter((load) => load.status === "overloaded");
  const suggestions: PlannerMoveSuggestion[] = [];

  overloadedLoads.forEach((load) => {
    const tasks = (tasksByDate.get(load.date) ?? [])
      .filter((task) => task.completed !== true)
      .slice()
      .sort((left, right) => getTaskDuration(right) - getTaskDuration(left));

    const moveTask = tasks[0];
    const targetDay = openTargets.find((candidate) => candidate.date !== load.date);
    if (!moveTask || !targetDay) return;

    const targetSlot = suggestedSlots.find((slot) => slot.date === targetDay.date);
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

  return suggestions.slice(0, Math.min(rangeDates.length, 3));
};

const buildSummary = ({
  horizon,
  selectedDate,
  dayLoads,
  conflicts,
  suggestedSlots,
  moveSuggestions,
}: {
  horizon: PlannerHorizon;
  selectedDate: string;
  dayLoads: PlannerDayLoad[];
  conflicts: PlannerScheduleConflict[];
  suggestedSlots: PlannerOpenSlot[];
  moveSuggestions: PlannerMoveSuggestion[];
}): string => {
  const selectedLoad = dayLoads.find((load) => load.date === selectedDate);
  const firstSlot = suggestedSlots[0];

  if (horizon === "day") {
    if (conflicts.length > 0) {
      return `${conflicts.length} time overlap${conflicts.length === 1 ? "" : "s"} today. Best opening: ${firstSlot?.time ?? "later in the day"}.`;
    }

    if (selectedLoad?.status === "overloaded") {
      return `Today is running heavy with ${selectedLoad.totalMinutes} planned minutes. ${firstSlot ? `${firstSlot.time} is your cleanest opening.` : "A lighter day may work better."}`;
    }

    return firstSlot
      ? `Today has room at ${firstSlot.time}. ${firstSlot.reason}`
      : "Today is already pretty packed, so any new block will need a careful reshuffle.";
  }

  const overloadedCount = dayLoads.filter((load) => load.status === "overloaded").length;
  const openCount = dayLoads.filter((load) => load.status === "open").length;

  if (moveSuggestions.length > 0) {
    return `${overloadedCount} ${horizon} day${overloadedCount === 1 ? " is" : "s are"} overloaded. ${moveSuggestions[0]?.taskTitle ?? "One task"} could move to ${moveSuggestions[0]?.toDate}${moveSuggestions[0]?.suggestedTime ? ` at ${moveSuggestions[0].suggestedTime}` : ""}.`;
  }

  if (conflicts.length > 0) {
    return `${conflicts.length} conflict${conflicts.length === 1 ? "" : "s"} spotted across this ${horizon}. ${firstSlot ? `${firstSlot.date} at ${firstSlot.time} is the best open window.` : ""}`.trim();
  }

  return `${openCount} lighter day${openCount === 1 ? "" : "s"} and ${overloadedCount} overloaded day${overloadedCount === 1 ? "" : "s"} in view.${firstSlot ? ` Best opening: ${firstSlot.date} at ${firstSlot.time}.` : ""}`;
};

const buildConflicts = (intervals: TimelineInterval[]): PlannerScheduleConflict[] => {
  if (intervals.length < 2) return [];

  const conflicts: PlannerScheduleConflict[] = [];

  for (let i = 0; i < intervals.length - 1; i += 1) {
    const current = intervals[i];
    for (let j = i + 1; j < intervals.length; j += 1) {
      const next = intervals[j];
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

export const buildCompanionPlannerScheduleInsights = ({
  tasks,
  calendarEvents = [],
  horizon,
  selectedDate,
  plannerMemory,
}: BuildScheduleInsightsInput): PlannerScheduleInsights => {
  const rangeDates = getRangeDates(selectedDate, horizon);
  const tasksByDate = new Map<string, PlannerContextTask[]>();
  const wakeMinutes = getWakeMinutes(plannerMemory);
  const windDownMinutes = getWindDownMinutes(plannerMemory);

  tasks.forEach((task) => {
    if (!task.taskDate || !rangeDates.includes(task.taskDate)) return;

    if (!tasksByDate.has(task.taskDate)) {
      tasksByDate.set(task.taskDate, []);
    }

    tasksByDate.get(task.taskDate)?.push(task);
  });

  const dayLoads = rangeDates.map((date) => {
    const dateTasks = (tasksByDate.get(date) ?? []).filter((task) => task.completed !== true);
    const intervals = buildIntervalsForDate({
      date,
      tasks: dateTasks,
      calendarEvents,
      wakeMinutes,
      windDownMinutes,
    });
    const totalMinutes = intervals.reduce((sum, interval) => sum + Math.max(0, interval.endMinutes - interval.startMinutes), 0);

    return {
      date,
      totalMinutes,
      taskCount: intervals.length,
      status: getDayLoadStatus(totalMinutes, intervals.length),
    } satisfies PlannerDayLoad;
  });

  const conflicts = rangeDates.flatMap((date) =>
    buildConflicts(
      buildIntervalsForDate({
        date,
        tasks: tasksByDate.get(date) ?? [],
        calendarEvents,
        wakeMinutes,
        windDownMinutes,
      }),
    ).map((conflict) => ({
      ...conflict,
      date,
    })),
  );

  const suggestedSlots = buildSuggestedSlots({
    rangeDates,
    tasksByDate,
    calendarEvents,
    selectedDate,
    dayLoads,
    plannerMemory,
  });

  const moveSuggestions = buildMoveSuggestions({
    rangeDates,
    tasksByDate,
    dayLoads,
    suggestedSlots,
  });

  return {
    horizon,
    selectedDate,
    dayLoads,
    overloadedDates: dayLoads.filter((load) => load.status === "overloaded").map((load) => load.date),
    emptyDates: dayLoads.filter((load) => load.status === "open").map((load) => load.date),
    conflicts,
    suggestedSlots,
    moveSuggestions,
    summary: buildSummary({
      horizon,
      selectedDate,
      dayLoads,
      conflicts,
      suggestedSlots,
      moveSuggestions,
    }),
  };
};
