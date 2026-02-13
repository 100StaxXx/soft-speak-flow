import { Capacitor } from "@capacitor/core";
import { Haptics as NativeHaptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

/**
 * Haptic feedback utility for mobile and web clients.
 * Fallback order: Capacitor native -> navigator.vibrate -> no-op
 */

const hasNavigator = typeof navigator !== "undefined";
const supportsVibrate = hasNavigator && "vibrate" in navigator && typeof navigator.vibrate === "function";
let vibrationDisabled = false;

const safeVibrate = (pattern: number | number[]) => {
  if (!supportsVibrate || vibrationDisabled) return;

  try {
    navigator.vibrate(pattern);
  } catch (error) {
    console.warn("Haptics unavailable, disabling vibration", error);
    vibrationDisabled = true;
  }
};

const runWithFallback = (
  nativeCall: () => Promise<void>,
  fallbackPattern: number | number[],
) => {
  if (Capacitor.isNativePlatform()) {
    nativeCall().catch(() => {
      safeVibrate(fallbackPattern);
    });
    return;
  }

  safeVibrate(fallbackPattern);
};

export const haptics = {
  /**
   * Light impact - for subtle interactions like taps.
   */
  light: () => {
    runWithFallback(() => NativeHaptics.impact({ style: ImpactStyle.Light }), 10);
  },

  /**
   * Medium impact - for selection changes.
   */
  medium: () => {
    runWithFallback(() => NativeHaptics.impact({ style: ImpactStyle.Medium }), 20);
  },

  /**
   * Heavy impact - for important actions.
   */
  heavy: () => {
    runWithFallback(() => NativeHaptics.impact({ style: ImpactStyle.Heavy }), 30);
  },

  /**
   * Success pattern - celebratory feedback.
   */
  success: () => {
    runWithFallback(
      () => NativeHaptics.notification({ type: NotificationType.Success }),
      [10, 50, 10],
    );
  },

  /**
   * Error pattern - warning feedback.
   */
  error: () => {
    runWithFallback(
      () => NativeHaptics.notification({ type: NotificationType.Error }),
      [50, 100, 50],
    );
  },
};
