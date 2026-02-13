import { useState, useRef, useCallback, useEffect } from "react";
import { useMotionValue, type MotionValue } from "framer-motion";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { useAutoscroll } from "@/hooks/useAutoscroll";

const PIXELS_PER_5_MIN = 20;
const TOUCH_HOLD_MS = 180;
const TOUCH_CANCEL_THRESHOLD = 8;
const DROP_BOUNCE_MS = 300;
const LIGHT_HAPTIC_MIN_INTERVAL_MS = 45;
const INTERACTIVE_SELECTOR = '[data-interactive="true"]';

const triggerHaptic = async (style: ImpactStyle) => {
  try {
    await Haptics.impact({ style });
  } catch {
    // Haptics not available on web
  }
};

/** Clamp total minutes to 0..1435 (00:00 – 23:55) */
const clampMinutes = (m: number) => Math.max(0, Math.min(1435, m));

/** Convert "HH:mm" → total minutes */
const timeToMinutes = (t: string): number => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/** Convert total minutes → "HH:mm" */
const minutesToTime = (totalMin: number): string => {
  const clamped = clampMinutes(totalMin);
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

interface UseTimelineDragOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  onDrop: (taskId: string, newTime: string) => void;
}

interface DragHandleProps {
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  onTouchStart: (e: React.TouchEvent<HTMLElement>) => void;
  onTouchMove: (e: React.TouchEvent<HTMLElement>) => void;
  onTouchEnd: (e: React.TouchEvent<HTMLElement>) => void;
  onTouchCancel: (e: React.TouchEvent<HTMLElement>) => void;
}

interface WindowListeners {
  pointermove?: (e: PointerEvent) => void;
  pointerup?: () => void;
  pointercancel?: () => void;
  touchmove?: (e: TouchEvent) => void;
  touchend?: () => void;
  touchcancel?: () => void;
}

export function useTimelineDrag({ containerRef, onDrop }: UseTimelineDragOptions) {
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [previewTime, setPreviewTime] = useState<string | null>(null);
  const [justDroppedId, setJustDroppedId] = useState<string | null>(null);
  const dragOffsetY = useMotionValue(0);

  // Refs (no drag-frame re-renders)
  const draggingTaskIdRef = useRef<string | null>(null);
  const originalTimeRef = useRef<string>("09:00");
  const originalMinutesRef = useRef(540);
  const dragStartYRef = useRef(0);
  const lastSnappedMinutesRef = useRef(540);
  const touchHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const pendingTouchDragRef = useRef<{ taskId: string; scheduledTime: string; startY: number } | null>(null);
  const windowListenersRef = useRef<WindowListeners>({});
  const lastLightHapticAtRef = useRef(0);

  // Autoscroll
  const { updatePosition: updateAutoscroll, stopScroll } = useAutoscroll({
    containerRef,
    enabled: draggingTaskId !== null,
    edgeThreshold: 80,
    scrollSpeed: 8,
  });

  const isInteractiveEventTarget = useCallback((target: EventTarget | null) => {
    return target instanceof Element && !!target.closest(INTERACTIVE_SELECTOR);
  }, []);

  const clearTouchHoldTimer = useCallback(() => {
    if (touchHoldTimerRef.current) {
      clearTimeout(touchHoldTimerRef.current);
      touchHoldTimerRef.current = null;
    }
  }, []);

  const clearDropResetTimer = useCallback(() => {
    if (dropResetTimerRef.current) {
      clearTimeout(dropResetTimerRef.current);
      dropResetTimerRef.current = null;
    }
  }, []);

  const removeWindowListeners = useCallback(() => {
    const listeners = windowListenersRef.current;
    if (listeners.pointermove) window.removeEventListener("pointermove", listeners.pointermove);
    if (listeners.pointerup) window.removeEventListener("pointerup", listeners.pointerup);
    if (listeners.pointercancel) window.removeEventListener("pointercancel", listeners.pointercancel);
    if (listeners.touchmove) window.removeEventListener("touchmove", listeners.touchmove);
    if (listeners.touchend) window.removeEventListener("touchend", listeners.touchend);
    if (listeners.touchcancel) window.removeEventListener("touchcancel", listeners.touchcancel);
    windowListenersRef.current = {};
  }, []);

  const handleMove = useCallback(
    (clientY: number) => {
      if (!draggingTaskIdRef.current) return;

      const deltaY = clientY - dragStartYRef.current;
      dragOffsetY.set(deltaY);
      updateAutoscroll(clientY);

      const deltaMinutes = Math.round(deltaY / PIXELS_PER_5_MIN) * 5;
      const newMinutes = clampMinutes(originalMinutesRef.current + deltaMinutes);

      if (newMinutes !== lastSnappedMinutesRef.current) {
        lastSnappedMinutesRef.current = newMinutes;
        setPreviewTime(minutesToTime(newMinutes));
        const now = typeof performance !== "undefined" ? performance.now() : Date.now();
        if (now - lastLightHapticAtRef.current >= LIGHT_HAPTIC_MIN_INTERVAL_MS) {
          lastLightHapticAtRef.current = now;
          void triggerHaptic(ImpactStyle.Light);
        }
      }
    },
    [dragOffsetY, updateAutoscroll],
  );

  const finishDrag = useCallback(() => {
    removeWindowListeners();
    clearTouchHoldTimer();
    pendingTouchDragRef.current = null;
    touchStartPosRef.current = null;

    const taskId = draggingTaskIdRef.current;
    const finalTime = minutesToTime(lastSnappedMinutesRef.current);
    const didChange = taskId && finalTime !== originalTimeRef.current;

    if (taskId && didChange) {
      void triggerHaptic(ImpactStyle.Medium);
      onDrop(taskId, finalTime);
      setJustDroppedId(taskId);
      clearDropResetTimer();
      dropResetTimerRef.current = setTimeout(() => {
        setJustDroppedId(null);
      }, DROP_BOUNCE_MS);
    }

    draggingTaskIdRef.current = null;
    setDraggingTaskId(null);
    setPreviewTime(null);
    dragOffsetY.set(0);
    stopScroll();
  }, [clearDropResetTimer, clearTouchHoldTimer, dragOffsetY, onDrop, removeWindowListeners, stopScroll]);

  const startDrag = useCallback(
    (taskId: string, scheduledTime: string, startY: number) => {
      if (draggingTaskIdRef.current) return;

      removeWindowListeners();
      clearTouchHoldTimer();

      draggingTaskIdRef.current = taskId;
      originalTimeRef.current = scheduledTime;
      originalMinutesRef.current = timeToMinutes(scheduledTime);
      lastSnappedMinutesRef.current = originalMinutesRef.current;
      dragStartYRef.current = startY;

      setDraggingTaskId(taskId);
      setPreviewTime(scheduledTime);
      dragOffsetY.set(0);
      lastLightHapticAtRef.current = 0;

      void triggerHaptic(ImpactStyle.Medium);

      const pointerMove = (e: PointerEvent) => {
        handleMove(e.clientY);
      };
      const pointerEnd = () => {
        finishDrag();
      };
      const touchMove = (e: TouchEvent) => {
        if (!draggingTaskIdRef.current) return;
        e.preventDefault();
        const touch = e.touches[0];
        if (touch) {
          handleMove(touch.clientY);
        }
      };
      const touchEnd = () => {
        finishDrag();
      };

      windowListenersRef.current = {
        pointermove: pointerMove,
        pointerup: pointerEnd,
        pointercancel: pointerEnd,
        touchmove: touchMove,
        touchend: touchEnd,
        touchcancel: touchEnd,
      };

      window.addEventListener("pointermove", pointerMove);
      window.addEventListener("pointerup", pointerEnd);
      window.addEventListener("pointercancel", pointerEnd);
      window.addEventListener("touchmove", touchMove, { passive: false });
      window.addEventListener("touchend", touchEnd);
      window.addEventListener("touchcancel", touchEnd);
    },
    [clearTouchHoldTimer, dragOffsetY, finishDrag, handleMove, removeWindowListeners],
  );

  const beginTouchHold = useCallback(
    (e: React.TouchEvent<HTMLElement>, taskId: string, scheduledTime: string) => {
      if (draggingTaskIdRef.current) return;
      if (isInteractiveEventTarget(e.target)) return;
      const touch = e.touches[0];
      if (!touch) return;

      e.stopPropagation();

      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
      pendingTouchDragRef.current = { taskId, scheduledTime, startY: touch.clientY };

      clearTouchHoldTimer();
      touchHoldTimerRef.current = setTimeout(() => {
        const pending = pendingTouchDragRef.current;
        if (!pending) return;
        startDrag(pending.taskId, pending.scheduledTime, pending.startY);
      }, TOUCH_HOLD_MS);
    },
    [clearTouchHoldTimer, isInteractiveEventTarget, startDrag],
  );

  const moveTouchHold = useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      if (draggingTaskIdRef.current) return;
      if (!touchStartPosRef.current) return;

      e.stopPropagation();

      const touch = e.touches[0];
      if (!touch) return;

      const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
      const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
      if (dx > TOUCH_CANCEL_THRESHOLD || dy > TOUCH_CANCEL_THRESHOLD) {
        clearTouchHoldTimer();
        pendingTouchDragRef.current = null;
        touchStartPosRef.current = null;
      }
    },
    [clearTouchHoldTimer],
  );

  const endTouchHold = useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      e.stopPropagation();
      if (!draggingTaskIdRef.current) {
        clearTouchHoldTimer();
        pendingTouchDragRef.current = null;
        touchStartPosRef.current = null;
      }
    },
    [clearTouchHoldTimer],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>, taskId: string, scheduledTime: string) => {
      if (draggingTaskIdRef.current) return;
      if (isInteractiveEventTarget(e.target)) return;
      if (e.pointerType === "touch") return;
      if (e.pointerType === "mouse" && e.button !== 0) return;

      e.preventDefault();
      e.stopPropagation();
      startDrag(taskId, scheduledTime, e.clientY);
    },
    [isInteractiveEventTarget, startDrag],
  );

  const getDragHandleProps = useCallback(
    (taskId: string, scheduledTime: string): DragHandleProps => ({
      onPointerDown: (e) => handlePointerDown(e, taskId, scheduledTime),
      onTouchStart: (e) => beginTouchHold(e, taskId, scheduledTime),
      onTouchMove: moveTouchHold,
      onTouchEnd: endTouchHold,
      onTouchCancel: endTouchHold,
    }),
    [beginTouchHold, endTouchHold, handlePointerDown, moveTouchHold],
  );

  const getRowDragProps = useCallback(
    (taskId: string, scheduledTime: string): DragHandleProps => ({
      onPointerDown: (e) => handlePointerDown(e, taskId, scheduledTime),
      onTouchStart: (e) => beginTouchHold(e, taskId, scheduledTime),
      onTouchMove: moveTouchHold,
      onTouchEnd: endTouchHold,
      onTouchCancel: endTouchHold,
    }),
    [beginTouchHold, endTouchHold, handlePointerDown, moveTouchHold],
  );

  useEffect(() => {
    return () => {
      removeWindowListeners();
      clearTouchHoldTimer();
      clearDropResetTimer();
      stopScroll();
    };
  }, [clearDropResetTimer, clearTouchHoldTimer, removeWindowListeners, stopScroll]);

  return {
    draggingTaskId,
    previewTime,
    dragOffsetY: dragOffsetY as MotionValue<number>,
    justDroppedId,
    isDragging: draggingTaskId !== null,
    getDragHandleProps,
    getRowDragProps,
  };
}
