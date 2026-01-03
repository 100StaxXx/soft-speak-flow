import { useRef, useCallback, useState } from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

interface UseLongPressOptions {
  onLongPress: (event: React.PointerEvent) => void;
  onPressStart?: () => void;
  onPressEnd?: () => void;
  threshold?: number; // ms - reduced to 300ms for iOS-like feel
  moveThreshold?: number; // px
}

export const useLongPress = ({
  onLongPress,
  onPressStart,
  onPressEnd,
  threshold = 300,
  moveThreshold = 6,
}: UseLongPressOptions) => {
  const [isPressed, setIsPressed] = useState(false);
  const [isActivated, setIsActivated] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const isLongPressRef = useRef(false);
  const pointerEventRef = useRef<React.PointerEvent | null>(null);

  const triggerHaptic = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } catch (e) {
        // Haptics not available
      }
    }
  };

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPosRef.current = null;
    pointerEventRef.current = null;
    setIsPressed(false);
    setIsActivated(false);
    onPressEnd?.();
  }, [onPressEnd]);

  const start = useCallback(
    (e: React.PointerEvent) => {
      // Only handle primary pointer (touch or mouse button)
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      
      isLongPressRef.current = false;
      setIsPressed(true);
      onPressStart?.();
      
      // Capture pointer for smoother tracking
      try {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      } catch {
        // Pointer capture not available
      }
      
      // Store the pointer event for drag initiation
      pointerEventRef.current = e;
      
      startPosRef.current = {
        x: e.clientX,
        y: e.clientY,
      };

      timerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        setIsActivated(true);
        triggerHaptic();
        if (pointerEventRef.current) {
          onLongPress(pointerEventRef.current);
        }
      }, threshold);
    },
    [onLongPress, onPressStart, threshold]
  );

  const move = useCallback(
    (e: React.PointerEvent) => {
      if (!startPosRef.current || !timerRef.current) return;

      const deltaY = Math.abs(e.clientY - startPosRef.current.y);

      // Only cancel on vertical movement (allow horizontal swipes)
      if (!isLongPressRef.current && deltaY > moveThreshold) {
        clear();
      }
    },
    [clear, moveThreshold]
  );

  const end = useCallback(
    (e: React.PointerEvent) => {
      const wasLongPress = isLongPressRef.current;
      
      // Prevent default click if long press was triggered
      if (wasLongPress) {
        e.preventDefault();
        e.stopPropagation();
      }
      
      clear();
      
      return wasLongPress;
    },
    [clear]
  );

  const cancel = useCallback(() => {
    isLongPressRef.current = false;
    clear();
  }, [clear]);

  return {
    isPressed,
    isActivated,
    handlers: {
      onPointerDown: start,
      onPointerMove: move,
      onPointerUp: end,
      onPointerCancel: cancel,
      onPointerLeave: cancel,
    },
  };
};
