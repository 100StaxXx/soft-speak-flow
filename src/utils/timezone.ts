/**
 * Utility functions for timezone detection and handling
 */

/**
 * Detects the user's timezone using the browser's Intl API
 * Falls back to 'UTC' if detection fails
 */
export const detectTimezone = (): string => {
  try {
    // Use Intl API to get the user's timezone
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Validate that we got a valid timezone string
    if (timezone && typeof timezone === 'string' && timezone.length > 0) {
      return timezone;
    }
    
    console.warn('Timezone detection returned invalid value:', timezone);
    return 'UTC';
  } catch (error) {
    console.error('Error detecting timezone:', error);
    return 'UTC';
  }
};

/**
 * Validates a timezone string against IANA timezone database
 * Returns true if valid, false otherwise
 */
export const isValidTimezone = (timezone: string): boolean => {
  try {
    // Try to create a DateTimeFormat with the timezone
    // If it's invalid, this will throw an error
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
};
