/**
 * Timezone-aware date utilities
 * 
 * Fixes critical bug: Tasks should be tied to user's local date, not device time.
 * This prevents tasks from appearing/disappearing when traveling or at midnight.
 * 
 * Strategy: Always use UTC for storage, but present dates in user's timezone context.
 */

import { format, startOfDay, endOfDay } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

/**
 * Get user's timezone from browser (fallback if not in profile)
 */
export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

/**
 * Get the current "today" date string for a user's timezone
 * Returns YYYY-MM-DD format
 * 
 * @param timezone - User's timezone (e.g., 'America/New_York', 'Asia/Tokyo')
 * @returns Date string in user's local date
 */
export function getTodayInTimezone(timezone?: string): string {
  const tz = timezone || getBrowserTimezone();
  const now = new Date();
  
  try {
    // Get the current date in the user's timezone
    return formatInTimeZone(now, tz, 'yyyy-MM-dd');
  } catch (error) {
    console.error('Invalid timezone, falling back to UTC:', timezone, error);
    return format(now, 'yyyy-MM-dd');
  }
}

/**
 * Format a date for storage (always in YYYY-MM-DD format)
 * This ensures consistent storage regardless of timezone
 * 
 * @param date - The date to format
 * @param timezone - User's timezone
 * @returns Date string for database storage
 */
export function formatDateForStorage(date: Date, timezone?: string): string {
  const tz = timezone || getBrowserTimezone();
  
  try {
    // Format the date in the user's timezone to get their "local date"
    return formatInTimeZone(date, tz, 'yyyy-MM-dd');
  } catch (error) {
    console.error('Date formatting error, using fallback:', error);
    return format(date, 'yyyy-MM-dd');
  }
}

/**
 * Parse a stored date string into a Date object in user's timezone
 * 
 * @param dateString - YYYY-MM-DD format string
 * @param timezone - User's timezone
 * @returns Date object at start of day in user's timezone
 */
export function parseStoredDate(dateString: string, timezone?: string): Date {
  const tz = timezone || getBrowserTimezone();
  
  try {
    // Parse as midnight in the user's timezone
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day, 0, 0, 0, 0);
    return toZonedTime(date, tz);
  } catch (error) {
    console.error('Date parsing error:', error);
    return new Date(dateString);
  }
}

/**
 * Get start and end of day in user's timezone as ISO strings for DB queries
 * 
 * @param dateString - YYYY-MM-DD format
 * @param timezone - User's timezone
 * @returns Object with startISO and endISO for filtering
 */
export function getDayBoundaries(dateString: string, timezone?: string): {
  startISO: string;
  endISO: string;
} {
  const tz = timezone || getBrowserTimezone();
  
  try {
    const date = parseStoredDate(dateString, tz);
    const start = startOfDay(date);
    const end = endOfDay(date);
    
    return {
      startISO: start.toISOString(),
      endISO: end.toISOString(),
    };
  } catch (error) {
    console.error('Day boundaries calculation error:', error);
    // Fallback to basic date
    const date = new Date(dateString);
    return {
      startISO: startOfDay(date).toISOString(),
      endISO: endOfDay(date).toISOString(),
    };
  }
}

/**
 * Check if two date strings represent the same day in a given timezone
 * 
 * @param date1 - First date string (YYYY-MM-DD)
 * @param date2 - Second date string (YYYY-MM-DD)
 * @param timezone - User's timezone
 * @returns true if same day
 */
export function isSameDay(date1: string, date2: string, timezone?: string): boolean {
  return date1 === date2;
}

/**
 * Get the date string for X days ago/ahead in user's timezone
 * 
 * @param daysOffset - Negative for past, positive for future
 * @param timezone - User's timezone
 * @returns Date string (YYYY-MM-DD)
 */
export function getDateWithOffset(daysOffset: number, timezone?: string): string {
  const tz = timezone || getBrowserTimezone();
  const now = new Date();
  now.setDate(now.getDate() + daysOffset);
  
  return formatDateForStorage(now, tz);
}

/**
 * Format a date string for display to user
 * 
 * @param dateString - YYYY-MM-DD format
 * @param formatString - date-fns format string (default: 'MMM d, yyyy')
 * @param timezone - User's timezone
 * @returns Formatted date string
 */
export function formatDateForDisplay(
  dateString: string,
  formatString: string = 'MMM d, yyyy',
  timezone?: string
): string {
  const tz = timezone || getBrowserTimezone();
  
  try {
    const date = parseStoredDate(dateString, tz);
    return formatInTimeZone(date, tz, formatString);
  } catch (error) {
    console.error('Display formatting error:', error);
    return dateString;
  }
}

/**
 * Check if a date string is today in user's timezone
 * 
 * @param dateString - YYYY-MM-DD format
 * @param timezone - User's timezone
 * @returns true if the date is today
 */
export function isToday(dateString: string, timezone?: string): boolean {
  const today = getTodayInTimezone(timezone);
  return dateString === today;
}

/**
 * Check if a date string is in the past (before today) in user's timezone
 * 
 * @param dateString - YYYY-MM-DD format
 * @param timezone - User's timezone
 * @returns true if date is before today
 */
export function isPastDate(dateString: string, timezone?: string): boolean {
  const today = getTodayInTimezone(timezone);
  return dateString < today;
}

/**
 * Check if a date string is in the future (after today) in user's timezone
 * 
 * @param dateString - YYYY-MM-DD format
 * @param timezone - User's timezone
 * @returns true if date is after today
 */
export function isFutureDate(dateString: string, timezone?: string): boolean {
  const today = getTodayInTimezone(timezone);
  return dateString > today;
}
