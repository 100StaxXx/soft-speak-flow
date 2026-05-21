import { SplashScreen } from '@capacitor/splash-screen';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

const CAPACITOR_DEBUG = import.meta.env.VITE_CAPACITOR_DEBUG === 'true';

function capacitorDebug(message: string, ...args: unknown[]): void {
  if (CAPACITOR_DEBUG) {
    console.debug(message, ...args);
  }
}

/**
 * Initialize Capacitor features (called early in app lifecycle)
 */
export const initializeCapacitor = async () => {
  try {
    // Keep splash screen visible - will be hidden when app is ready
    capacitorDebug('Capacitor initialized, splash screen visible');
  } catch (error) {
    capacitorDebug('Capacitor initialization error:', error);
  }
};

/**
 * Hide splash screen when app is fully ready
 * Call this after critical data (auth, profile, routing) is loaded
 */
export const hideSplashScreen = async () => {
  try {
    await SplashScreen.hide({
      fadeOutDuration: 300 // Smooth 300ms fade out
    });
    capacitorDebug('Splash screen hidden');
  } catch (error) {
    // Splash screen plugin not available (web), ignore
    capacitorDebug('Splash screen not available:', error);
  }
};

/**
 * Share content using native share sheet (iOS) or fallback
 */
export const shareContent = async (options: {
  title: string;
  text: string;
  url?: string;
}): Promise<boolean> => {
  try {
    if (Capacitor.isNativePlatform()) {
      await Share.share({
        title: options.title,
        text: options.text,
        url: options.url,
      });
      return true;
    } else {
      // Web fallback - copy to clipboard
      await navigator.clipboard.writeText(options.text);
      return true;
    }
  } catch (error) {
    console.error('Share failed:', error);
    return false;
  }
};
