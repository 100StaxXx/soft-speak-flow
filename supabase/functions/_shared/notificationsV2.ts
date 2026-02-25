export type NotificationType =
  | "daily_pep"
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
  mentor_nudge: 65,
  checkin_morning_reminder: 50,
  checkin_evening_reminder: 45,
};

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
