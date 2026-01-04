import { useState, useRef, useCallback, useEffect } from "react";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { haptics } from "@/utils/haptics";

interface UseEvolveLongPressOptions {
  onComplete: () => void;
  duration?: number;
  disabled?: boolean;
}

const isNativeApp = typeof window !== 'undefined' && 
  (window as any).Capacitor?.isNativePlatform?.();

const triggerHaptic = async (intensity: 'light' | 'medium' | 'heavy' | 'success') => {
  try {
    if (isNativeApp) {
      if (intensity === 'success') {
        await Haptics.notification({ type: NotificationType.Success });
      } else {
        const styleMap = {
          light: ImpactStyle.Light,
          medium: ImpactStyle.Medium,
          heavy: ImpactStyle.Heavy,
        };
        await Haptics.impact({ style: styleMap[intensity] });
      }
    } else {
      // Web fallback
      if (intensity === 'success') {
        haptics.success();
      } else {
        haptics[intensity]();
      }
    }
  } catch {
    // Haptics not available
  }
};

export const useEvolveLongPress = ({
  onComplete,
  duration = 1500,
  disabled = false,
}: UseEvolveLongPressOptions) => {
  const [progress, setProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  
  const startTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastHapticRef = useRef<number>(0);
  const completedRef = useRef(false);

  const getHapticConfig = (progress: number) => {
    if (progress < 30) return { intensity: 'light' as const, interval: 200 };
    if (progress < 70) return { intensity: 'medium' as const, interval: 150 };
    return { intensity: 'heavy' as const, interval: 100 };
  };

  const updateProgress = useCallback(() => {
    if (!startTimeRef.current || completedRef.current) return;

    const elapsed = Date.now() - startTimeRef.current;
    const newProgress = Math.min((elapsed / duration) * 100, 100);
    
    setProgress(newProgress);

    // Trigger haptic pulses
    const config = getHapticConfig(newProgress);
    if (Date.now() - lastHapticRef.current >= config.interval) {
      triggerHaptic(config.intensity);
      lastHapticRef.current = Date.now();
    }

    if (newProgress >= 100) {
      completedRef.current = true;
      triggerHaptic('success');
      onComplete();
      return;
    }

    animationFrameRef.current = requestAnimationFrame(updateProgress);
  }, [duration, onComplete]);

  const start = useCallback(() => {
    if (disabled || completedRef.current) return;
    
    setIsHolding(true);
    startTimeRef.current = Date.now();
    lastHapticRef.current = Date.now();
    triggerHaptic('light');
    animationFrameRef.current = requestAnimationFrame(updateProgress);
  }, [disabled, updateProgress]);

  const stop = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    startTimeRef.current = null;
    setIsHolding(false);
    
    if (!completedRef.current) {
      setProgress(0);
    }
  }, []);

  const reset = useCallback(() => {
    stop();
    completedRef.current = false;
    setProgress(0);
  }, [stop]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Reset when disabled changes (e.g., evolution completes)
  useEffect(() => {
    if (!disabled) {
      completedRef.current = false;
      setProgress(0);
    }
  }, [disabled]);

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      start();
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      stop();
    },
    onPointerLeave: stop,
    onPointerCancel: stop,
    onContextMenu: (e: React.SyntheticEvent) => {
      e.preventDefault();
    },
  };

  return {
    progress,
    isHolding,
    handlers,
    reset,
  };
};
