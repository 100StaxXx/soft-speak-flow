import { ScreenOrientation } from '@capacitor/screen-orientation';
import { isNativeIOSHandheld } from '@/utils/platformTargets';

const ORIENTATION_DEBUG = import.meta.env.VITE_ORIENTATION_DEBUG === 'true';

function orientationDebug(message: string): void {
  if (ORIENTATION_DEBUG) {
    console.debug(message);
  }
}

export const lockToPortrait = async () => {
  // Only lock orientation on native platforms
  if (isNativeIOSHandheld()) {
    try {
      await ScreenOrientation.lock({ orientation: 'portrait' });
      orientationDebug('Orientation locked to portrait');
    } catch (error) {
      console.error('Failed to lock orientation:', error);
    }
  }
};

export const lockToLandscape = async () => {
  // Lock to landscape for games that need horizontal orientation
  if (isNativeIOSHandheld()) {
    try {
      await ScreenOrientation.lock({ orientation: 'landscape' });
      orientationDebug('Orientation locked to landscape');
    } catch (error) {
      console.error('Failed to lock to landscape:', error);
    }
  }
};

export const unlockOrientation = async () => {
  if (isNativeIOSHandheld()) {
    try {
      await ScreenOrientation.unlock();
      orientationDebug('Orientation unlocked');
    } catch (error) {
      console.error('Failed to unlock orientation:', error);
    }
  }
};
