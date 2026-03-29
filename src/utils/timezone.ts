/**
 * Timezone utilities for consistent 2 AM daily reset across the app
 */

const RESET_HOUR = 2; // Reset at 2 AM local time

type DateParts = {
  year: string;
  month: string;
  day: string;
};

function resolveTimezone(userTimezone?: string): string {
  const fallback = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!userTimezone) {
    return fallback;
  }

  try {
    Intl.DateTimeFormat("en-US", { timeZone: userTimezone });
    return userTimezone;
  } catch {
    return fallback;
  }
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
  
  // Get local hour in user's timezone
  const localHour = parseInt(
    new Intl.DateTimeFormat('en-US', { 
      hour: 'numeric', 
      hour12: false, 
      timeZone: tz 
    }).format(now)
  );
  
  // If before reset hour, use previous day's date
  if (localHour < resetHour) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return formatDateForTimezone(yesterday, tz);
  }
  
  return formatDateForTimezone(now, tz);
}

/**
 * Get the effective mission date based on user timezone.
 * If current time is before 2 AM, returns yesterday's date.
 * This allows users who stay up past midnight to still see the same missions.
 */
export function getEffectiveMissionDate(userTimezone?: string): string {
  return getEffectiveDailyDate(userTimezone, RESET_HOUR);
}

/**
 * Get the effective day of week (0=Sunday, 1=Monday, etc.) based on user timezone.
 * Respects the 2 AM reset rule.
 */
export function getEffectiveDayOfWeek(userTimezone?: string): number {
  const now = new Date();
  const tz = resolveTimezone(userTimezone);
  
  // Get local hour in user's timezone
  const localHour = parseInt(
    new Intl.DateTimeFormat('en-US', { 
      hour: 'numeric', 
      hour12: false, 
      timeZone: tz 
    }).format(now)
  );
  
  // Get the day of week in user's timezone
  const dayFormatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: tz
  });
  
  let targetDate = now;
  if (localHour < RESET_HOUR) {
    targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() - 1);
  }
  
  const dayName = dayFormatter.format(targetDate);
  const dayMap: Record<string, number> = {
    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
  };
  
  return dayMap[dayName] ?? 0;
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
  return resolveTimezone();
}
