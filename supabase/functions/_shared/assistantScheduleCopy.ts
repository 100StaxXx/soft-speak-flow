export type AssistantScheduleTemporalStatus =
  | "past"
  | "in_progress"
  | "upcoming";

const DEFAULT_TASK_DURATION_MINUTES = 30;

export const parseClockTimeToMinutes = (
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

export const formatAssistantTime = (
  value: string | null | undefined,
): string | null => {
  const minutes = parseClockTimeToMinutes(value);
  if (minutes === null) return null;

  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const suffix = hour24 >= 12 ? "pm" : "am";
  const hour12 = hour24 % 12 || 12;

  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
};

export const formatAssistantTimeRange = (
  start: string | null | undefined,
  end: string | null | undefined,
): string | null => {
  const startLabel = formatAssistantTime(start);
  const endLabel = formatAssistantTime(end);
  if (!startLabel || !endLabel) return startLabel ?? endLabel ?? null;

  return `${startLabel}-${endLabel}`;
};

export const normalizeAssistantTimeText = (value: string): string =>
  value.replace(
    /\b([01]?\d|2[0-3]):([0-5]\d)\b(?!\s?(?:am|pm)\b)/gi,
    (match) => formatAssistantTime(match) ?? match,
  );

export const getLocalDateFromDateTime = (
  value: string | null | undefined,
): string | null => {
  if (!value) return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T/);
  return match?.[1] ?? null;
};

export const getLocalMinutesFromDateTime = (
  value: string | null | undefined,
): number | null => {
  if (!value) return null;

  const match = value.match(/^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})/);
  if (!match) return null;

  const hour = Number.parseInt(match[1] ?? "", 10);
  const minute = Number.parseInt(match[2] ?? "", 10);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;

  return (hour * 60) + minute;
};

const getOffsetMinutesFromDateTime = (
  value: string | null | undefined,
): number => {
  const match = value?.match(/([+-])(\d{2}):(\d{2})$/);
  if (!match) return 0;

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number.parseInt(match[2] ?? "", 10);
  const minutes = Number.parseInt(match[3] ?? "", 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;

  return sign * ((hours * 60) + minutes);
};

const getClockTimeInReferenceOffset = (
  timestamp: string,
  referenceDateTime: string | null | undefined,
): string | null => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;

  const offsetMinutes = getOffsetMinutesFromDateTime(referenceDateTime);
  const shifted = new Date(date.getTime() + (offsetMinutes * 60_000));
  return `${String(shifted.getUTCHours()).padStart(2, "0")}:${
    String(shifted.getUTCMinutes()).padStart(2, "0")
  }`;
};

const compareDateKeys = (left: string, right: string) =>
  left.localeCompare(right);

export const classifyTaskTemporalStatus = (input: {
  taskDate: string | null;
  scheduledTime: string | null;
  estimatedDuration?: number | null;
  currentDate?: string | null;
  currentDateTime?: string | null;
}): AssistantScheduleTemporalStatus => {
  const referenceDate = getLocalDateFromDateTime(input.currentDateTime) ??
    input.currentDate ?? null;
  if (!referenceDate || !input.taskDate) return "upcoming";

  if (compareDateKeys(input.taskDate, referenceDate) < 0) return "past";
  if (compareDateKeys(input.taskDate, referenceDate) > 0) return "upcoming";

  const scheduledMinutes = parseClockTimeToMinutes(input.scheduledTime);
  const currentMinutes = getLocalMinutesFromDateTime(input.currentDateTime);
  if (scheduledMinutes === null || currentMinutes === null) return "upcoming";

  const estimatedDuration = Number.isFinite(input.estimatedDuration) &&
      (input.estimatedDuration ?? 0) > 0
    ? Number(input.estimatedDuration)
    : DEFAULT_TASK_DURATION_MINUTES;
  const endMinutes = scheduledMinutes + estimatedDuration;

  if (currentMinutes >= endMinutes) return "past";
  if (currentMinutes >= scheduledMinutes) return "in_progress";
  return "upcoming";
};

export const classifyEventTemporalStatus = (input: {
  start: string;
  end: string;
  currentDate?: string | null;
  currentDateTime?: string | null;
}): AssistantScheduleTemporalStatus => {
  const start = new Date(input.start);
  const end = new Date(input.end);

  if (input.currentDateTime) {
    const now = new Date(input.currentDateTime);
    if (!Number.isNaN(now.getTime())) {
      if (now >= end) return "past";
      if (now >= start) return "in_progress";
      return "upcoming";
    }
  }

  const referenceDate = input.currentDate ??
    getLocalDateFromDateTime(input.currentDateTime);
  if (!referenceDate) return "upcoming";

  const startDate = input.start.slice(0, 10);
  const endDate = input.end.slice(0, 10);
  if (compareDateKeys(referenceDate, endDate) > 0) return "past";
  if (compareDateKeys(referenceDate, startDate) < 0) return "upcoming";
  return "in_progress";
};

export const buildAssistantTaskScheduleLabel = (input: {
  title: string;
  taskDate: string | null;
  scheduledTime: string | null;
  estimatedDuration?: number | null;
  currentDate?: string | null;
  currentDateTime?: string | null;
}): string => {
  const status = classifyTaskTemporalStatus(input);
  const displayTime = formatAssistantTime(input.scheduledTime);

  if (!displayTime) {
    if (status === "past") return `${input.title} (was unscheduled)`;
    if (status === "in_progress") return `${input.title} (in progress)`;
    return `Unscheduled ${input.title}`;
  }

  if (status === "past") return `${input.title} (was at ${displayTime})`;
  if (status === "in_progress") {
    return `${input.title} (started at ${displayTime})`;
  }
  return `${input.title} (at ${displayTime})`;
};

export const buildAssistantEventScheduleLabel = (input: {
  title: string;
  start: string;
  end: string;
  isAllDay: boolean;
  currentDate?: string | null;
  currentDateTime?: string | null;
}): string => {
  const status = classifyEventTemporalStatus(input);

  if (input.isAllDay) {
    if (status === "past") return `${input.title} (was all day)`;
    if (status === "in_progress") {
      return `${input.title} (all day, in progress)`;
    }
    return `${input.title} (all day)`;
  }

  const startTime = getClockTimeInReferenceOffset(
    input.start,
    input.currentDateTime,
  );
  const endTime = getClockTimeInReferenceOffset(
    input.end,
    input.currentDateTime,
  );
  const rangeLabel = formatAssistantTimeRange(
    startTime ?? "",
    endTime ?? "",
  ) ?? "scheduled";

  if (status === "past") return `${input.title} (was ${rangeLabel})`;
  if (status === "in_progress") {
    return `${input.title} (${rangeLabel}, in progress)`;
  }
  return `${input.title} (${rangeLabel})`;
};
