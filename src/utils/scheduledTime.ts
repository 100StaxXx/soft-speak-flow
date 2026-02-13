import { format, isValid, parse } from "date-fns";

const HH_MM_REGEX = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const HH_MM_SS_REGEX = /^([01]?\d|2[0-3]):([0-5]\d):([0-5]\d)$/;

export interface ScheduledTimeParts {
  hour: number;
  minute: number;
  normalized: string;
}

export const getScheduledTimeParts = (value: string | null | undefined): ScheduledTimeParts | null => {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;

  const hhmm = normalized.match(HH_MM_REGEX);
  if (hhmm) {
    const hour = Number(hhmm[1]);
    const minute = Number(hhmm[2]);
    return {
      hour,
      minute,
      normalized: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    };
  }

  const hhmmss = normalized.match(HH_MM_SS_REGEX);
  if (hhmmss) {
    const hour = Number(hhmmss[1]);
    const minute = Number(hhmmss[2]);
    return {
      hour,
      minute,
      normalized: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    };
  }

  const parsed12Hour = parse(normalized, "h:mm a", new Date());
  if (isValid(parsed12Hour)) {
    const hour = parsed12Hour.getHours();
    const minute = parsed12Hour.getMinutes();
    return {
      hour,
      minute,
      normalized: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    };
  }

  const parsedDate = new Date(normalized);
  if (isValid(parsedDate)) {
    const hour = parsedDate.getHours();
    const minute = parsedDate.getMinutes();
    return {
      hour,
      minute,
      normalized: format(parsedDate, "HH:mm"),
    };
  }

  return null;
};

export const normalizeScheduledTime = (value: string | null | undefined): string | null => {
  return getScheduledTimeParts(value)?.normalized ?? null;
};

export const parseScheduledTime = (
  value: string | null | undefined,
  baseDate: Date = new Date(),
): Date | null => {
  const parts = getScheduledTimeParts(value);
  if (!parts) return null;

  const parsed = new Date(baseDate);
  parsed.setHours(parts.hour, parts.minute, 0, 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
