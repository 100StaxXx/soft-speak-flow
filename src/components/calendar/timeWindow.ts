import { getScheduledTimeParts } from "@/utils/scheduledTime";

const DAY_MINUTES = 24 * 60;
const HALF_HOUR = 30;
const MIN_WINDOW = 4 * 60;
const DEFAULT_DURATION = 30;
const MIN_DURATION = 5;
const TASK_BUFFER = 30;

export interface DynamicWindowTask {
  scheduled_time?: string | null;
  estimated_duration?: number | null;
}

export interface DynamicWindowResult {
  startMinute: number;
  endMinute: number;
}

const floorToStep = (value: number, step: number) => Math.floor(value / step) * step;
const ceilToStep = (value: number, step: number) => Math.ceil(value / step) * step;

const normalizeWindowWithinDay = (
  startMinute: number,
  endMinute: number,
  minSpanMinutes: number,
): DynamicWindowResult => {
  let start = startMinute;
  let end = endMinute;

  if (end <= start) {
    end = start + HALF_HOUR;
  }

  if (end - start < minSpanMinutes) {
    const missing = minSpanMinutes - (end - start);
    const totalStepsToAdd = Math.ceil(missing / HALF_HOUR);
    const addBeforeSteps = Math.floor(totalStepsToAdd / 2);
    const addAfterSteps = totalStepsToAdd - addBeforeSteps;
    start -= addBeforeSteps * HALF_HOUR;
    end += addAfterSteps * HALF_HOUR;
  }

  if (start < 0) {
    end += -start;
    start = 0;
  }

  if (end > DAY_MINUTES) {
    start -= end - DAY_MINUTES;
    end = DAY_MINUTES;
  }

  start = Math.max(0, start);
  end = Math.min(DAY_MINUTES, end);

  if (end - start < minSpanMinutes) {
    if (start === 0) {
      end = Math.min(DAY_MINUTES, minSpanMinutes);
    } else if (end === DAY_MINUTES) {
      start = Math.max(0, DAY_MINUTES - minSpanMinutes);
    }
  }

  return { startMinute: start, endMinute: end };
};

/**
 * Computes a dynamic half-hour-aligned timeline window.
 */
export const computeDynamicWindow = (
  tasks: DynamicWindowTask[],
  now: Date = new Date(),
): DynamicWindowResult => {
  const scheduled = tasks
    .map((task) => {
      const parts = getScheduledTimeParts(task.scheduled_time);
      if (!parts) return null;
      const startMinute = parts.hour * 60 + parts.minute;
      const duration = Math.max(task.estimated_duration ?? DEFAULT_DURATION, MIN_DURATION);
      return {
        startMinute,
        endMinute: startMinute + duration,
      };
    })
    .filter((item): item is { startMinute: number; endMinute: number } => item !== null);

  if (scheduled.length === 0) {
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const centerMinute = floorToStep(nowMinutes, HALF_HOUR);
    const start = centerMinute - MIN_WINDOW / 2;
    const end = centerMinute + MIN_WINDOW / 2;
    return normalizeWindowWithinDay(start, end, MIN_WINDOW);
  }

  let earliest = Number.POSITIVE_INFINITY;
  let latest = Number.NEGATIVE_INFINITY;

  for (const entry of scheduled) {
    earliest = Math.min(earliest, entry.startMinute);
    latest = Math.max(latest, entry.endMinute);
  }

  const bufferedStart = floorToStep(earliest - TASK_BUFFER, HALF_HOUR);
  const bufferedEnd = ceilToStep(latest + TASK_BUFFER, HALF_HOUR);

  return normalizeWindowWithinDay(bufferedStart, bufferedEnd, MIN_WINDOW);
};

/**
 * Buckets a scheduled time to the start of its 30-minute slot.
 */
export const bucketTaskToHalfHourSlot = (time: string | null | undefined): number | null => {
  const parts = getScheduledTimeParts(time);
  if (!parts) return null;
  const totalMinutes = parts.hour * 60 + parts.minute;
  return floorToStep(totalMinutes, HALF_HOUR);
};

/**
 * Converts a pointer Y offset within a 30-minute row into a snapped 5-minute offset (0-25).
 */
export const snapPointerToFiveMinuteOffset = (
  offsetY: number,
  rowHeightPx: number = 60,
): number => {
  if (rowHeightPx <= 0) return 0;

  const clampedY = Math.max(0, Math.min(rowHeightPx - 0.0001, offsetY));
  const sliceHeight = rowHeightPx / 6;
  const slice = Math.floor(clampedY / sliceHeight);
  return Math.max(0, Math.min(5, slice)) * 5;
};
