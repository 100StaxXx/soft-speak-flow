import { ScreenOrientation } from '@capacitor/screen-orientation';
import { Capacitor } from '@capacitor/core';

export const lockToPortrait = async () => {
  // Only lock orientation on native platforms
  if (Capacitor.isNativePlatform()) {
    try {
      await ScreenOrientation.lock({ orientation: 'portrait' });
      console.log('Orientation locked to portrait');
    } catch (error) {
      console.error('Failed to lock orientation:', error);
    }
  }
};

export const unlockOrientation = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      await ScreenOrientation.unlock();
      console.log('Orientation unlocked');
    } catch (error) {
      console.error('Failed to unlock orientation:', error);
    }
  }
};
