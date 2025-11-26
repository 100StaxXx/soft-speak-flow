import { SplashScreen } from '@capacitor/splash-screen';

/**
 * Initialize Capacitor features (called early in app lifecycle)
 */
export const initializeCapacitor = async () => {
  try {
    // Keep splash screen visible - will be hidden when app is ready
    console.debug('Capacitor initialized, splash screen visible');
  } catch (error) {
    console.debug('Capacitor initialization error:', error);
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
    console.debug('Splash screen hidden');
  } catch (error) {
    // Splash screen plugin not available (web), ignore
    console.debug('Splash screen not available:', error);
  }
};
