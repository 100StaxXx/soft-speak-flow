/**
 * Timezone utilities for consistent 2 AM daily reset across the app
 */

const RESET_HOUR = 2; // Reset at 2 AM local time

type DateParts = {
  year: string;
  month: string;
  day: string;
};

function resolveTimezone(userTimezone?: string, fallbackTimezone = resolveDeviceTimezone()): string {
  if (!userTimezone) {
    return fallbackTimezone;
  }

  try {
    Intl.DateTimeFormat("en-US", { timeZone: userTimezone });
    return userTimezone;
  } catch {
    return fallbackTimezone;
  }
}

function resolveDeviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function getHourForTimezone(date: Date, timezone: string): number {
  const hour = parseInt(
    new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      hourCycle: 'h23',
      timeZone: timezone
    }).format(date),
    10
  );

  return Number.isFinite(hour) ? hour : 0;
}

function shiftIsoDate(isoDate: string, dayOffset: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const anchorDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
  anchorDate.setUTCDate(anchorDate.getUTCDate() + dayOffset);

  return anchorDate.toISOString().slice(0, 10);
}

function getDayOfWeekForIsoDate(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0)).getUTCDay();
}

function getEffectiveDailyDateForNow(
  now: Date,
  timezone: string,
  resetHour: number,
): string {
  const localHour = getHourForTimezone(now, timezone);
  const localDate = formatDateForTimezone(now, timezone);

  if (localHour < resetHour) {
    return shiftIsoDate(localDate, -1);
  }

  return localDate;
}

/**
 * Get the effective daily date based on user timezone.
 * If current time is before the reset hour, returns yesterday's date.
 */
export function getEffectiveDailyDate(
  userTimezone?: string,
  resetHour = RESET_HOUR,
): string {
  const now = new Date();
  const tz = resolveTimezone(userTimezone);

  return getEffectiveDailyDateForNow(now, tz, resetHour);
}

/**
 * Get the user's calendar date in their current or explicitly supplied timezone.
 */
export function getLocalCalendarDate(
  userTimezone?: string,
  date = new Date(),
): string {
  return formatDateForTimezone(date, resolveTimezone(userTimezone));
}

/**
 * Get the current hour (0-23) in the user's local or explicitly supplied timezone.
 */
export function getLocalHour(
  userTimezone?: string,
  date = new Date(),
): number {
  return getHourForTimezone(date, resolveTimezone(userTimezone));
}

/**
 * Get the effective mission date based on user timezone.
 * If current time is before 2 AM, returns yesterday's date.
 * This allows users who stay up past midnight to still see the same missions.
 */
export function getEffectiveMissionDate(userTimezone?: string): string {
  return getEffectiveDailyDate(userTimezone || getUserTimezone(), RESET_HOUR);
}

/**
 * Get the effective day of week (0=Sunday, 1=Monday, etc.) based on user timezone.
 * Respects the 2 AM reset rule.
 */
export function getEffectiveDayOfWeek(userTimezone?: string): number {
  const now = new Date();
  const tz = resolveTimezone(userTimezone || getUserTimezone());
  const effectiveDate = getEffectiveDailyDateForNow(now, tz, RESET_HOUR);

  return getDayOfWeekForIsoDate(effectiveDate);
}

/**
 * Format a date as YYYY-MM-DD in the specified timezone
 */
function formatDateForTimezone(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: timezone
  });

  const parts = formatter.formatToParts(date);
  const dateParts = parts.reduce<DateParts>(
    (acc, part) => {
      if (part.type === 'year') acc.year = part.value;
      if (part.type === 'month') acc.month = part.value;
      if (part.type === 'day') acc.day = part.value;
      return acc;
    },
    { year: '1970', month: '01', day: '01' }
  );

  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}

/**
 * Get the user's current timezone string
 */
export function getUserTimezone(): string {
  return resolveDeviceTimezone();
}
