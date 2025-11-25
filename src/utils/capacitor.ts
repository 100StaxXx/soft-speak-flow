import { SplashScreen } from '@capacitor/splash-screen';

/**
 * Initialize Capacitor features and hide splash screen when app is ready
 */
export const initializeCapacitor = async () => {
  try {
    // Hide the splash screen after the app has loaded
    await SplashScreen.hide();
  } catch (error) {
    // Splash screen plugin not available (web), ignore
    console.debug('Splash screen not available:', error);
  }
};
