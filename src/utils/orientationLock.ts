import { ScreenOrientation } from '@capacitor/screen-orientation';
import { isNativeIOSHandheld } from '@/utils/platformTargets';

export const lockToPortrait = async () => {
  // Only lock orientation on native platforms
  if (isNativeIOSHandheld()) {
    try {
      await ScreenOrientation.lock({ orientation: 'portrait' });
      console.log('Orientation locked to portrait');
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
      console.log('Orientation locked to landscape');
    } catch (error) {
      console.error('Failed to lock to landscape:', error);
    }
  }
};

export const unlockOrientation = async () => {
  if (isNativeIOSHandheld()) {
    try {
      await ScreenOrientation.unlock();
      console.log('Orientation unlocked');
    } catch (error) {
      console.error('Failed to unlock orientation:', error);
    }
  }
};
