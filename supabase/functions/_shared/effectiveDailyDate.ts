const DEFAULT_RESET_HOUR = 2;

type DateParts = {
  year: number;
  month: number;
  day: number;
};

function assertValidResetHour(resetHour: number): number {
  if (!Number.isFinite(resetHour) || resetHour < 0 || resetHour > 23) {
    return DEFAULT_RESET_HOUR;
  }

  return Math.floor(resetHour);
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

export function formatDateInTimezone(date: Date, timezoneRaw: string | null | undefined): string {
  const timezone = normalizeTimezone(timezoneRaw);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));

  return `${map.get("year") ?? "1970"}-${map.get("month") ?? "01"}-${map.get("day") ?? "01"}`;
}

function getLocalHour(date: Date, timezoneRaw: string | null | undefined): number {
  const timezone = normalizeTimezone(timezoneRaw);
  const hour = Number.parseInt(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: timezone,
    }).format(date),
    10,
  );

  return Number.isFinite(hour) ? hour : 0;
}

function parseIsoDate(date: string): DateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    throw new Error(`Invalid ISO date: ${date}`);
  }

  return {
    year: Number.parseInt(match[1], 10),
    month: Number.parseInt(match[2], 10),
    day: Number.parseInt(match[3], 10),
  };
}

export function getEffectiveDailyDate(
  timezoneRaw: string | null | undefined,
  resetHour = DEFAULT_RESET_HOUR,
  now = new Date(),
): string {
  const timezone = normalizeTimezone(timezoneRaw);
  const safeResetHour = assertValidResetHour(resetHour);
  const localHour = getLocalHour(now, timezone);

  if (localHour < safeResetHour) {
    const yesterday = new Date(now);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    return formatDateInTimezone(yesterday, timezone);
  }

  return formatDateInTimezone(now, timezone);
}

export function getDateAnchorForIsoDate(isoDate: string): Date {
  const { year, month, day } = parseIsoDate(isoDate);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

export function getEffectiveDailyDateAnchor(
  timezoneRaw: string | null | undefined,
  resetHour = DEFAULT_RESET_HOUR,
  now = new Date(),
): { effectiveDate: string; anchorDate: Date; timezone: string } {
  const timezone = normalizeTimezone(timezoneRaw);
  const effectiveDate = getEffectiveDailyDate(timezone, resetHour, now);

  return {
    effectiveDate,
    anchorDate: getDateAnchorForIsoDate(effectiveDate),
    timezone,
  };
}

export function getUtcIsoDate(date = new Date(), dayOffset = 0): string {
  const value = new Date(date);
  value.setUTCDate(value.getUTCDate() + dayOffset);
  return value.toISOString().slice(0, 10);
}
