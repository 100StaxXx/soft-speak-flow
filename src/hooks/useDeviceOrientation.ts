import { useState, useEffect, useCallback, useRef } from 'react';

interface DeviceOrientation {
  gamma: number; // left/right tilt (-90 to 90)
  beta: number;  // front/back tilt (-180 to 180)
  permitted: boolean;
  available: boolean;
}

interface UseDeviceOrientationOptions {
  enabled?: boolean;
}

// Smoothing factor (0 = no smoothing, 1 = instant response)
const SMOOTHING_FACTOR = 0.15;

export const useDeviceOrientation = ({ enabled = true }: UseDeviceOrientationOptions = {}) => {
  const [orientation, setOrientation] = useState<DeviceOrientation>({
    gamma: 0,
    beta: 0,
    permitted: false,
    available: typeof DeviceOrientationEvent !== 'undefined',
  });

  // Smoothed values for interpolation
  const smoothedGammaRef = useRef(0);
  const smoothedBetaRef = useRef(0);
  const rawGammaRef = useRef(0);
  const rawBetaRef = useRef(0);

  const requestPermission = useCallback(async () => {
    if (!enabled) return false;

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
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !orientation.available) return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      // Store raw values
      rawGammaRef.current = e.gamma ?? 0;
      rawBetaRef.current = e.beta ?? 0;

      // Apply exponential smoothing (low-pass filter)
      smoothedGammaRef.current = smoothedGammaRef.current + SMOOTHING_FACTOR * (rawGammaRef.current - smoothedGammaRef.current);
      smoothedBetaRef.current = smoothedBetaRef.current + SMOOTHING_FACTOR * (rawBetaRef.current - smoothedBetaRef.current);

      setOrientation(prev => ({
        ...prev,
        gamma: smoothedGammaRef.current,
        beta: smoothedBetaRef.current,
        permitted: true,
      }));
    };

    // Try to start listening (will work on non-iOS or if already permitted)
    window.addEventListener('deviceorientation', handleOrientation);

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [enabled, orientation.available]);

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
    // Apply soft deadzone - gradual transition instead of hard cutoff
    const sign = beta >= 0 ? 1 : -1;
    const absBeta = Math.abs(beta);
    
    // Soft deadzone: values below deadzone are reduced, not zeroed
    const adjustedBeta = absBeta < deadzone 
      ? sign * (absBeta * absBeta / deadzone) // Quadratic ramp in deadzone
      : sign * absBeta;
    
    // Use wider tilt range (50 degrees) for more natural landscape control
    // Lower sensitivity for smoother, more forgiving controls
    const normalized = (adjustedBeta / 50) * 50 * sensitivity;
    
    // Center at 50, clamp to 3-97 range (wider range for landscape)
    return Math.max(3, Math.min(97, 50 + normalized));
  }, [orientation]);

  // Get raw (unsmoothed) values for debugging
  const getRawOrientation = useCallback(() => ({
    gamma: rawGammaRef.current,
    beta: rawBetaRef.current,
  }), []);

  return {
    ...orientation,
    requestPermission,
    getPositionFromTilt,
    getLandscapePositionFromTilt,
    getRawOrientation,
  };
};
