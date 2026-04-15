export const DEFAULT_TIMED_TASK_DURATION_FALLBACK_MINUTES = 30;

interface ResolveTimedTaskDurationOptions {
  fallbackMinutes?: number;
}

interface DurationHeightOptions extends ResolveTimedTaskDurationOptions {
  pxPerMinute: number;
  minHeightPx: number;
}

export const resolveTimedTaskDurationMinutes = (
  durationMinutes: number | null | undefined,
  options: ResolveTimedTaskDurationOptions = {},
): number => {
  const fallbackMinutes = options.fallbackMinutes ?? DEFAULT_TIMED_TASK_DURATION_FALLBACK_MINUTES;
  if (!Number.isFinite(durationMinutes) || (durationMinutes ?? 0) <= 0) {
    return fallbackMinutes;
  }
  return Number(durationMinutes);
};

export const durationMinutesToPixels = (
  durationMinutes: number | null | undefined,
  options: DurationHeightOptions,
): number => {
  const resolvedMinutes = resolveTimedTaskDurationMinutes(durationMinutes, options);
  return Math.max(options.minHeightPx, resolvedMinutes * options.pxPerMinute);
};
