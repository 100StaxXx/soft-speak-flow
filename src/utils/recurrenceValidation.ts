export const RECURRENCE_REQUIRES_SCHEDULED_TIME_ERROR = 'RECURRENCE_REQUIRES_SCHEDULED_TIME';

export const RECURRENCE_REQUIRES_SCHEDULED_TIME_MESSAGE = 'Set a time before enabling recurrence.';

export const hasRecurrencePattern = (pattern: string | null | undefined): boolean => {
  if (typeof pattern !== 'string') return false;
  return pattern.trim().length > 0;
};

export const hasScheduledTimeValue = (scheduledTime: string | null | undefined): boolean => {
  if (typeof scheduledTime !== 'string') return false;
  return scheduledTime.trim().length > 0;
};

export const recurrenceRequiresScheduledTime = (
  recurrencePattern: string | null | undefined,
  scheduledTime: string | null | undefined,
): boolean => {
  return hasRecurrencePattern(recurrencePattern) && !hasScheduledTimeValue(scheduledTime);
};
