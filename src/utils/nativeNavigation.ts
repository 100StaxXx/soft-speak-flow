import { Capacitor } from '@capacitor/core';

/**
 * Safe navigation utility for iOS native platforms.
 * Uses window.location.href on native platforms where React Router's navigate()
 * can fail after async operations (auth, signup, etc.).
 */
export const safeNavigate = (
  navigate: (path: string) => void,
  path: string
): void => {
  if (Capacitor.isNativePlatform()) {
    // Native iOS: Use direct location change for reliable post-auth navigation
    window.location.href = path;
  } else {
    // Web: Use React Router navigate
    navigate(path);
  }
};
