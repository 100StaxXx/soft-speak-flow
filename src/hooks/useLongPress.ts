import { useRef, useCallback } from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

interface UseLongPressOptions {
  onLongPress: () => void;
  threshold?: number; // ms
  moveThreshold?: number; // px
}

export const useLongPress = ({
  onLongPress,
  threshold = 800,
  moveThreshold = 12,
}: UseLongPressOptions) => {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const isLongPressRef = useRef(false);

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
  }, []);

  const start = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      isLongPressRef.current = false;
      
      // Get starting position
      if ('touches' in e) {
        startPosRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
      } else {
        startPosRef.current = {
          x: e.clientX,
          y: e.clientY,
        };
      }

      timerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        triggerHaptic();
        onLongPress();
      }, threshold);
    },
    [onLongPress, threshold]
  );

  const move = useCallback(
    (e: React.TouchEvent) => {
      if (!startPosRef.current || !timerRef.current) return;

      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const deltaX = Math.abs(currentX - startPosRef.current.x);
      const deltaY = Math.abs(currentY - startPosRef.current.y);

      // Cancel if moved too much
      if (deltaX > moveThreshold || deltaY > moveThreshold) {
        clear();
      }
    },
    [clear, moveThreshold]
  );

  const end = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      // Prevent default click if long press was triggered
      if (isLongPressRef.current) {
        e.preventDefault();
        e.stopPropagation();
      }
      clear();
    },
    [clear]
  );

  return {
    onTouchStart: start,
    onTouchMove: move,
    onTouchEnd: end,
    onMouseDown: start,
    onMouseUp: end,
    onMouseLeave: clear,
    isLongPress: isLongPressRef,
  };
};
