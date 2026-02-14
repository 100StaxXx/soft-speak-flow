/**
 * Haptic feedback utility for mobile devices
 * Provides tactile feedback for user interactions
 */

const hasNavigator = typeof navigator !== 'undefined';
const supportsVibrate = hasNavigator && 'vibrate' in navigator && typeof navigator.vibrate === 'function';

let hasVibrationError = false;

const safeVibrate = (pattern: number | number[]) => {
  if (!supportsVibrate || hasVibrationError) return;

  try {
    navigator.vibrate(pattern);
  } catch (error) {
    console.warn('Haptics unavailable, disabling vibration', error);
    hasVibrationError = true; // Avoid repeated attempts on unsupported environments
  }
};

export const haptics = {
  /**
   * Light impact - for subtle interactions like hover states
   */
  light: () => {
    safeVibrate(10);
  },

  /**
   * Medium impact - for button presses and selections
   */
  medium: () => {
    safeVibrate(20);
  },

  /**
   * Heavy impact - for important actions like completions
   */
  heavy: () => {
    safeVibrate(30);
  },

  /**
   * Success pattern - celebratory feedback
   */
  success: () => {
    safeVibrate([10, 50, 10]);
  },

  /**
   * Error pattern - warning feedback
   */
  error: () => {
    safeVibrate([50, 100, 50]);
  }
};
