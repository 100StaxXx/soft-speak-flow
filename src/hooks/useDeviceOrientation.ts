import { useState, useEffect, useCallback } from 'react';

interface DeviceOrientation {
  gamma: number; // left/right tilt (-90 to 90)
  beta: number;  // front/back tilt (-180 to 180)
  permitted: boolean;
  available: boolean;
}

export const useDeviceOrientation = () => {
  const [orientation, setOrientation] = useState<DeviceOrientation>({
    gamma: 0,
    beta: 0,
    permitted: false,
    available: typeof DeviceOrientationEvent !== 'undefined',
  });

  const requestPermission = useCallback(async () => {
    // iOS 13+ requires explicit permission
    if (typeof DeviceOrientationEvent !== 'undefined' && 
        typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        if (permission === 'granted') {
          setOrientation(prev => ({ ...prev, permitted: true }));
          return true;
        }
        return false;
      } catch {
        return false;
      }
    }
    // Non-iOS devices don't need permission
    setOrientation(prev => ({ ...prev, permitted: true }));
    return true;
  }, []);

  useEffect(() => {
    if (!orientation.available) return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      // gamma: left/right tilt (-90 to 90)
      // beta: front/back tilt (-180 to 180)
      setOrientation(prev => ({
        ...prev,
        gamma: e.gamma ?? 0,
        beta: e.beta ?? 0,
        permitted: true,
      }));
    };

    // Try to start listening (will work on non-iOS or if already permitted)
    window.addEventListener('deviceorientation', handleOrientation);

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [orientation.available]);

  // Convert gamma (-90 to 90) to a normalized position (0 to 100)
  // with deadzone and smoothing - for PORTRAIT orientation
  const getPositionFromTilt = useCallback((deadzone = 5, sensitivity = 2.5) => {
    const { gamma } = orientation;
    
    // Apply deadzone
    const adjustedGamma = Math.abs(gamma) < deadzone ? 0 : gamma;
    
    // Map gamma to position with sensitivity
    // gamma of -30 to +30 covers most comfortable tilt range
    const normalized = (adjustedGamma / 30) * 50 * sensitivity;
    
    // Center at 50, clamp to 8-92 range
    return Math.max(8, Math.min(92, 50 + normalized));
  }, [orientation]);

  // Convert beta to position for LANDSCAPE orientation
  // In landscape, beta controls left/right movement
  const getLandscapePositionFromTilt = useCallback((deadzone = 8, sensitivity = 1.5) => {
    const { beta } = orientation;
    
    // In landscape mode, beta ranges from about -45 (tilt left) to +45 (tilt right)
    // Apply deadzone for stability
    const adjustedBeta = Math.abs(beta) < deadzone ? 0 : beta;
    
    // Use wider tilt range (45 degrees) for more natural landscape control
    // Lower sensitivity for smoother, more forgiving controls
    const normalized = (adjustedBeta / 45) * 50 * sensitivity;
    
    // Center at 50, clamp to 5-95 range (wider range for landscape)
    return Math.max(5, Math.min(95, 50 + normalized));
  }, [orientation]);

  return {
    ...orientation,
    requestPermission,
    getPositionFromTilt,
    getLandscapePositionFromTilt,
  };
};
