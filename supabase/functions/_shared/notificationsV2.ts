export type NotificationType =
  | "daily_pep"
  | "daily_quote"
  | "task_start"
  | "task_reminder"
  | "habit_reminder"
  | "contact_reminder"
  | "mentor_nudge"
  | "checkin_morning_reminder"
  | "checkin_evening_reminder";

export type QueueStatus =
  | "queued"
  | "processing"
  | "retry"
  | "sent"
  | "failed_terminal"
  | "shadow"
  | "skipped_rollout"
  | "skipped_budget";

export interface LocalDateTimeParts {
  localDate: string;
  hour: number;
  minute: number;
}

interface DateParts {
  year: number;
  month: number;
  day: number;
}

interface TimeParts {
  hour: number;
  minute: number;
  second: number;
}

const CRITICAL_TYPES: ReadonlySet<NotificationType> = new Set([
  "task_start",
  "task_reminder",
  "habit_reminder",
  "contact_reminder",
]);

const NOTIFICATION_PRIORITY: Record<NotificationType, number> = {
  task_start: 100,
  task_reminder: 95,
  habit_reminder: 90,
  contact_reminder: 85,
  daily_pep: 70,
  daily_quote: 68,
  mentor_nudge: 65,
  checkin_morning_reminder: 50,
  checkin_evening_reminder: 45,
};

const DAILY_WINDOW_TIMES: Record<"morning" | "afternoon" | "evening", string> = {
  morning: "08:00:00",
  afternoon: "14:00:00",
  evening: "19:00:00",
};

const timezoneFormatterCache = new Map<string, Intl.DateTimeFormat>();

export function getNotificationPriority(type: NotificationType): number {
  return NOTIFICATION_PRIORITY[type] ?? 40;
}

export function isCriticalNotification(type: NotificationType): boolean {
  return CRITICAL_TYPES.has(type);
}

export function parseIntEnv(name: string, fallback: number): number {
  const raw = Deno.env.get(name);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeTimezone(timezone: string | null | undefined): string {
  if (!timezone) return "UTC";

  try {
    Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return timezone;
  } catch {
    return "UTC";
  }
}

function parseDateParts(localDate: string | null): DateParts | null {
  if (!localDate) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate.trim());
  if (!match) return null;

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  return { year, month, day };
}

export function parseTimeParts(value: string | null | undefined): TimeParts | null {
  if (!value) return null;
  const [timePart] = value.split(".");
  const pieces = timePart.split(":");
  if (pieces.length < 2) return null;

  const hour = Number.parseInt(pieces[0], 10);
  const minute = Number.parseInt(pieces[1], 10);
  const second = pieces.length > 2 ? Number.parseInt(pieces[2], 10) : 0;

  if (!Number.isFinite(hour) || !Number.isFinite(minute) || !Number.isFinite(second)) {
    return null;
  }
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
    return null;
  }

  return { hour, minute, second };
}

export function getLocalDateTimeParts(now: Date, timezone: string): LocalDateTimeParts {
  const safeTimezone = normalizeTimezone(timezone);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: safeTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(now);
  const map = new Map(parts.map((part) => [part.type, part.value]));

  const year = map.get("year") ?? "1970";
  const month = map.get("month") ?? "01";
  const day = map.get("day") ?? "01";
  const hour = Number.parseInt(map.get("hour") ?? "0", 10);
  const minute = Number.parseInt(map.get("minute") ?? "0", 10);

  return {
    localDate: `${year}-${month}-${day}`,
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
  };
}

export function getLocalWeekdayIndex(now: Date, timezone: string): number {
  const safeTimezone = normalizeTimezone(timezone);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimezone,
    weekday: "short",
  }).format(now);

  const lookup: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return lookup[weekday] ?? 0;
}

function getTimezoneFormatter(timezone: string): Intl.DateTimeFormat {
  let formatter = timezoneFormatterCache.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    timezoneFormatterCache.set(timezone, formatter);
  }
  return formatter;
}

function timezoneOffsetMs(utcGuessMs: number, timezone: string): number | null {
  const formatter = getTimezoneFormatter(timezone);
  const parts = formatter.formatToParts(new Date(utcGuessMs));
  const map = new Map(parts.map((part) => [part.type, part.value]));

  const year = Number.parseInt(map.get("year") ?? "", 10);
  const month = Number.parseInt(map.get("month") ?? "", 10);
  const day = Number.parseInt(map.get("day") ?? "", 10);
  const hour = Number.parseInt(map.get("hour") ?? "", 10);
  const minute = Number.parseInt(map.get("minute") ?? "", 10);
  const second = Number.parseInt(map.get("second") ?? "", 10);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(second)
  ) {
    return null;
  }

  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  return localAsUtc - utcGuessMs;
}

export function toScheduledDateTime(
  localDate: string | null,
  scheduledTime: string | null,
  timezoneRaw: string | null | undefined,
): Date | null {
  const dateParts = parseDateParts(localDate);
  const timeParts = parseTimeParts(scheduledTime);
  if (!dateParts || !timeParts) return null;

  const timezone = normalizeTimezone(timezoneRaw);
  const baselineUtc = Date.UTC(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day,
    timeParts.hour,
    timeParts.minute,
    timeParts.second,
  );

  let utcGuess = baselineUtc;
  for (let i = 0; i < 4; i += 1) {
    const offsetMs = timezoneOffsetMs(utcGuess, timezone);
    if (offsetMs === null) return null;
    const nextGuess = baselineUtc - offsetMs;
    if (Math.abs(nextGuess - utcGuess) < 1000) {
      utcGuess = nextGuess;
      break;
    }
    utcGuess = nextGuess;
  }

  const value = new Date(utcGuess);
  if (Number.isNaN(value.getTime())) return null;

  const local = getLocalDateTimeParts(value, timezone);
  const expectedDate = `${String(dateParts.year).padStart(4, "0")}-${String(dateParts.month).padStart(2, "0")}-${String(dateParts.day).padStart(2, "0")}`;
  if (local.localDate !== expectedDate || local.hour !== timeParts.hour || local.minute !== timeParts.minute) {
    return null;
  }

  return value;
}

export function resolveDailyNotificationTime(
  exactTime: string | null | undefined,
  window: string | null | undefined,
  fallbackWindow: "morning" | "afternoon" | "evening",
): string {
  const explicit = parseTimeParts(exactTime);
  if (explicit) {
    return [
      String(explicit.hour).padStart(2, "0"),
      String(explicit.minute).padStart(2, "0"),
      String(explicit.second).padStart(2, "0"),
    ].join(":");
  }

  if (window === "morning" || window === "afternoon" || window === "evening") {
    return DAILY_WINDOW_TIMES[window];
  }

  return DAILY_WINDOW_TIMES[fallbackWindow];
}

export function toDailyScheduledDateTime(
  localDate: string,
  exactTime: string | null | undefined,
  window: string | null | undefined,
  timezoneRaw: string | null | undefined,
  fallbackWindow: "morning" | "afternoon" | "evening",
): Date | null {
  const scheduledTime = resolveDailyNotificationTime(exactTime, window, fallbackWindow);
  return toScheduledDateTime(localDate, scheduledTime, timezoneRaw);
}

export async function computeDeterministicJitterMinutes(
  userId: string,
  localDate: string,
  reminderType: "morning" | "evening",
  maxAbsMinutes = 60,
): Promise<number> {
  const input = `${userId}:${localDate}:${reminderType}`;
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const digestBytes = new Uint8Array(digest);

  // Deterministic value in range [-maxAbsMinutes, +maxAbsMinutes]
  const spread = maxAbsMinutes * 2 + 1;
  const bucket = digestBytes[0] % spread;
  return bucket - maxAbsMinutes;
}

export async function isUserInRolloutCohort(userId: string, percent: number): Promise<boolean> {
  if (percent >= 100) return true;
  if (percent <= 0) return false;

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(userId));
  const bytes = new Uint8Array(digest);
  const bucket = bytes[0] % 100;
  return bucket < percent;
}

export async function pickDeterministicItem<T extends { id: string }>(
  items: readonly T[],
  key: string,
): Promise<T | null> {
  if (items.length === 0) return null;

  const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  const bytes = new Uint8Array(digest);
  const bucket = bytes.slice(0, 4).reduce((acc, byte) => acc * 256 + byte, 0) % sorted.length;
  return sorted[bucket] ?? null;
}

export async function pickDeterministicDailyQuote<T extends { id: string }>(
  quotes: readonly T[],
  mentorSlug: string,
  localDate: string,
): Promise<T | null> {
  return pickDeterministicItem(quotes, `${mentorSlug}:${localDate}:daily_quote`);
}

export function resolveDispatchMode(rawMode: string | null | undefined): "send" | "shadow" {
  const normalized = rawMode?.trim().toLowerCase() ?? "";
  if (!normalized) return "send";
  if (normalized === "send" || normalized === "shadow") return normalized;
  throw new Error(`Invalid NOTIFICATIONS_V2_MODE: ${rawMode}`);
}

export function getRetryDelayMinutes(attemptCount: number): number {
  const safeAttempt = Math.max(1, attemptCount);
  return Math.min(60, 2 ** safeAttempt);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function minutesBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 60_000);
}
