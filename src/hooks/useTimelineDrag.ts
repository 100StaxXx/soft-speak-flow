import { useState, useRef, useCallback, useEffect } from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useAutoscroll } from '@/hooks/useAutoscroll';

const PIXELS_PER_10MIN = 40;
const LONG_PRESS_DURATION = 500;
const SCROLL_CANCEL_THRESHOLD = 10;

const triggerHaptic = async (style: ImpactStyle) => {
  try {
    await Haptics.impact({ style });
  } catch (e) {
    // Haptics not available on web
  }
};

/** Clamp total minutes to 0..1430 (00:00 – 23:50) */
const clampMinutes = (m: number) => Math.max(0, Math.min(1430, m));

/** Convert "HH:mm" → total minutes */
const timeToMinutes = (t: string): number => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

/** Convert total minutes → "HH:mm" */
const minutesToTime = (totalMin: number): string => {
  const clamped = clampMinutes(totalMin);
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

interface UseTimelineDragOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  onDrop: (taskId: string, newTime: string) => void;
}

export function useTimelineDrag({ containerRef, onDrop }: UseTimelineDragOptions) {
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [previewTime, setPreviewTime] = useState<string | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);

  // Refs (no re-renders)
  const draggingRef = useRef<string | null>(null);
  const originalTimeRef = useRef<string>('09:00');
  const originalMinutesRef = useRef(540);
  const dragStartYRef = useRef(0);
  const currentYRef = useRef(0);
  const lastSnappedMinutesRef = useRef(540);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const isLongPressActiveRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const justDroppedIdRef = useRef<string | null>(null);
  const [justDroppedId, setJustDroppedId] = useState<string | null>(null);

  // Autoscroll
  const { updatePosition: updateAutoscroll, stopScroll } = useAutoscroll({
    containerRef,
    enabled: draggingTaskId !== null,
    edgeThreshold: 80,
    scrollSpeed: 8,
  });

  // --- Move handlers (window-level for smooth tracking) ---
  const handleMove = useCallback((clientY: number) => {
    if (!draggingRef.current) return;

    currentYRef.current = clientY;
    const deltaY = clientY - dragStartYRef.current;

    // Throttled offset update
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        setDragOffsetY(currentYRef.current - dragStartYRef.current);
        rafRef.current = null;
      });
    }

    updateAutoscroll(clientY);

    // Snap to 10-min increments
    const deltaMinutes = Math.round(deltaY / PIXELS_PER_10MIN) * 10;
    const newMinutes = clampMinutes(originalMinutesRef.current + deltaMinutes);

    if (newMinutes !== lastSnappedMinutesRef.current) {
      lastSnappedMinutesRef.current = newMinutes;
      const newTime = minutesToTime(newMinutes);
      setPreviewTime(newTime);
      triggerHaptic(ImpactStyle.Light);
    }
  }, [updateAutoscroll]);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    handleMove(e.clientY);
  }, [handleMove]);

  const handleTouchMoveWindow = useCallback((e: TouchEvent) => {
    if (!draggingRef.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    if (touch) handleMove(touch.clientY);
  }, [handleMove]);

  // --- End handlers ---
  const cleanup = useCallback(() => {
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handleEnd);
    window.removeEventListener('pointercancel', handleEnd);
    window.removeEventListener('touchmove', handleTouchMoveWindow);
    window.removeEventListener('touchend', handleTouchEnd);
    window.removeEventListener('touchcancel', handleTouchEnd);
  }, []);

  const finishDrag = useCallback(() => {
    const taskId = draggingRef.current;
    const finalTime = lastSnappedMinutesRef.current;

    if (taskId) {
      const newTimeStr = minutesToTime(finalTime);
      triggerHaptic(ImpactStyle.Medium);
      onDrop(taskId, newTimeStr);

      // Bounce animation trigger
      justDroppedIdRef.current = taskId;
      setJustDroppedId(taskId);
      setTimeout(() => {
        justDroppedIdRef.current = null;
        setJustDroppedId(null);
      }, 300);
    }

    draggingRef.current = null;
    setDraggingTaskId(null);
    setPreviewTime(null);
    setDragOffsetY(0);
    isLongPressActiveRef.current = false;
    stopScroll();
    cleanup();
  }, [onDrop, stopScroll, cleanup]);

  // We need stable references for window listeners
  const handleEnd = useCallback(() => { finishDrag(); }, [finishDrag]);
  const handleTouchEnd = useCallback(() => { finishDrag(); }, [finishDrag]);

  // --- Start drag ---
  const startDrag = useCallback((taskId: string, scheduledTime: string, startY: number) => {
    draggingRef.current = taskId;
    originalTimeRef.current = scheduledTime;
    originalMinutesRef.current = timeToMinutes(scheduledTime);
    lastSnappedMinutesRef.current = timeToMinutes(scheduledTime);
    dragStartYRef.current = startY;
    currentYRef.current = startY;

    setDraggingTaskId(taskId);
    setPreviewTime(scheduledTime);
    setDragOffsetY(0);

    triggerHaptic(ImpactStyle.Medium);

    // Add window-level listeners for smooth tracking
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handleEnd);
    window.addEventListener('pointercancel', handleEnd);
    window.addEventListener('touchmove', handleTouchMoveWindow, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);
  }, [handlePointerMove, handleEnd, handleTouchMoveWindow, handleTouchEnd]);

  // --- Long press detection (touch) ---
  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartPosRef.current = null;
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent, taskId: string, scheduledTime: string) => {
    if (draggingRef.current) return;

    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[role="checkbox"]') || target.closest('[data-interactive]')) {
      return;
    }

    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };

    longPressTimerRef.current = setTimeout(() => {
      isLongPressActiveRef.current = true;
      startDrag(taskId, scheduledTime, touch.clientY);
    }, LONG_PRESS_DURATION);
  }, [startDrag]);

  const handleTouchMoveLocal = useCallback((e: React.TouchEvent) => {
    // If dragging, window handler takes care of it
    if (isLongPressActiveRef.current || draggingRef.current) return;

    if (!touchStartPosRef.current) return;
    const touch = e.touches[0];
    const deltaY = Math.abs(touch.clientY - touchStartPosRef.current.y);
    if (deltaY > SCROLL_CANCEL_THRESHOLD) {
      clearLongPress();
    }
  }, [clearLongPress]);

  const handleTouchEndLocal = useCallback(() => {
    clearLongPress();
    isLongPressActiveRef.current = false;
  }, [clearLongPress]);

  // --- Pointer (mouse) long press ---
  const handlePointerDown = useCallback((e: React.PointerEvent, taskId: string, scheduledTime: string) => {
    if (draggingRef.current || e.pointerType === 'touch') return;

    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[role="checkbox"]') || target.closest('[data-interactive]')) {
      return;
    }

    touchStartPosRef.current = { x: e.clientX, y: e.clientY };

    longPressTimerRef.current = setTimeout(() => {
      isLongPressActiveRef.current = true;
      startDrag(taskId, scheduledTime, e.clientY);
    }, LONG_PRESS_DURATION);
  }, [startDrag]);

  const handlePointerUp = useCallback(() => {
    if (!isLongPressActiveRef.current) {
      clearLongPress();
    }
  }, [clearLongPress]);

  const handlePointerCancel = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
      clearLongPress();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [cleanup, clearLongPress]);

  return {
    draggingTaskId,
    previewTime,
    dragOffsetY,
    justDroppedId,
    isDragging: draggingTaskId !== null,

    // Touch handlers (pass to each row)
    getRowHandlers: (taskId: string, scheduledTime: string) => ({
      onTouchStart: (e: React.TouchEvent) => handleTouchStart(e, taskId, scheduledTime),
      onTouchMove: handleTouchMoveLocal,
      onTouchEnd: handleTouchEndLocal,
      onTouchCancel: handleTouchEndLocal,
      onPointerDown: (e: React.PointerEvent) => handlePointerDown(e, taskId, scheduledTime),
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
    }),
  };
}
