export const EVENING_REFLECTION_START_HOUR = 18;
export const DAILY_RESET_HOUR = 2;

/**
 * Evening Reflection opens at 6 PM local time and stays available through the
 * app's 2 AM daily reset so late-night users do not lose the day's reflection.
 */
export function isEveningReflectionAvailableAtHour(localHour: number): boolean {
  return localHour >= EVENING_REFLECTION_START_HOUR || localHour < DAILY_RESET_HOUR;
}
