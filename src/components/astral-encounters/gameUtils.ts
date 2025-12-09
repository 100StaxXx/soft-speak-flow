import { useState } from 'react';

// Screen shake effect hook
export const useScreenShake = () => {
  const [shake, setShake] = useState(false);

  const triggerShake = (intensity: 'light' | 'medium' | 'heavy' = 'medium') => {
    setShake(true);
    const duration = intensity === 'light' ? 100 : intensity === 'medium' ? 200 : 400;
    setTimeout(() => setShake(false), duration);
  };

  const shakeStyle = shake ? {
    animation: 'shake 0.15s ease-in-out',
  } : {};

  return { shake, triggerShake, shakeStyle };
};

// Haptic feedback helper
export const triggerHaptic = (type: 'light' | 'medium' | 'heavy' | 'success' | 'error' = 'medium') => {
  if ('vibrate' in navigator) {
    const patterns = {
      light: [10],
      medium: [25],
      heavy: [50],
      success: [30, 50, 80],
      error: [100, 50, 100],
    };
    navigator.vibrate(patterns[type]);
  }
};
