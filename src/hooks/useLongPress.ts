import { useRef, useCallback, useState } from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

interface UseLongPressOptions {
  onLongPress: (event: React.PointerEvent) => void;
  onPressStart?: () => void;
  onPressEnd?: () => void;
  threshold?: number;
  moveThreshold?: number;
}

export const useLongPress = ({
  onLongPress,
  onPressStart,
  onPressEnd,
  threshold = 500,
  moveThreshold = 12, // Increased from 6 for more tolerance
}: UseLongPressOptions) => {
  const [isPressed, setIsPressed] = useState(false);
  const [isActivated, setIsActivated] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const isLongPressRef = useRef(false);
  const isDraggingRef = useRef(false); // Track when drag control is handed off
  const pointerEventRef = useRef<React.PointerEvent | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const targetElementRef = useRef<HTMLElement | null>(null);

  const triggerHaptic = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } catch (e) {
        // Haptics not available
      }
    }
  };

  // Release pointer capture to hand control to framer-motion
  const releaseCapture = useCallback(() => {
    if (pointerIdRef.current !== null && targetElementRef.current) {
      try {
        targetElementRef.current.releasePointerCapture?.(pointerIdRef.current);
      } catch {
        // Already released or not captured
      }
      pointerIdRef.current = null;
    }
  }, []);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPosRef.current = null;
    pointerEventRef.current = null;
    targetElementRef.current = null;
    pointerIdRef.current = null;
    setIsPressed(false);
    setIsActivated(false);
    onPressEnd?.();
  }, [onPressEnd]);

  // Reset everything including drag state
  const fullReset = useCallback(() => {
    isDraggingRef.current = false;
    isLongPressRef.current = false;
    releaseCapture();
    clear();
  }, [clear, releaseCapture]);

  const start = useCallback(
    (e: React.PointerEvent) => {
      // Only handle primary pointer (touch or mouse button)
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      
      // Reset drag state on new press
      isDraggingRef.current = false;
      isLongPressRef.current = false;
      setIsPressed(true);
      onPressStart?.();
      
      // Store pointer info for later release
      pointerIdRef.current = e.pointerId;
      targetElementRef.current = e.target as HTMLElement;
      
      // Capture pointer for smoother tracking during long-press detection
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
        isDraggingRef.current = true; // Mark as dragging - handlers should now no-op
        setIsActivated(true);
        
        // CRITICAL: Release pointer capture BEFORE handing to framer-motion
        // This prevents pointercancel events when dragging over other elements
        releaseCapture();
        
        triggerHaptic();
        if (pointerEventRef.current) {
          onLongPress(pointerEventRef.current);
        }
      }, threshold);
    },
    [onLongPress, onPressStart, threshold, releaseCapture]
  );

  const move = useCallback(
    (e: React.PointerEvent) => {
      // If drag has started, let framer-motion handle everything
      if (isDraggingRef.current) return;
      
      if (!startPosRef.current || !timerRef.current) return;

      const deltaY = Math.abs(e.clientY - startPosRef.current.y);

      // Only cancel on vertical movement before long press triggers
      if (!isLongPressRef.current && deltaY > moveThreshold) {
        clear();
      }
    },
    [clear, moveThreshold]
  );

  const end = useCallback(
    (e: React.PointerEvent) => {
      // If drag was active, just reset - framer-motion handles the drag end
      if (isDraggingRef.current) {
        fullReset();
        return false;
      }
      
      const wasLongPress = isLongPressRef.current;
      
      // Prevent default click if long press was triggered
      if (wasLongPress) {
        e.preventDefault();
        e.stopPropagation();
      }
      
      fullReset();
      
      return wasLongPress;
    },
    [fullReset]
  );

  const cancel = useCallback(() => {
    // If drag is active, don't cancel - let framer-motion handle it
    if (isDraggingRef.current) return;
    
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
      onPointerCancel: () => {
        // Only cancel if not dragging
        if (!isDraggingRef.current) {
          cancel();
        }
      },
    },
    // Expose reset for external cleanup
    reset: fullReset,
  };
};
