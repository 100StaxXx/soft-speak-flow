import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useMotionValue, type MotionValue } from "framer-motion";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { useAutoscroll } from "@/hooks/useAutoscroll";
import {
  AdaptiveSnapConfig,
  DragSnapMode,
  DragZoomRailState,
  buildDragZoomRailState,
  computeAdaptiveMinute,
  minuteToTime24,
  resolveAdaptiveSnapConfig,
  time24ToMinute,
} from "@/components/calendar/dragSnap";

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

interface UseTimelineDragOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  onDrop: (taskId: string, newTime: string) => void;
  snapConfig?: Partial<AdaptiveSnapConfig>;
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

const nowMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export function useTimelineDrag({ containerRef, onDrop, snapConfig }: UseTimelineDragOptions) {
  const resolvedSnapConfig = useMemo(() => resolveAdaptiveSnapConfig(snapConfig), [snapConfig]);

  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [previewTime, setPreviewTime] = useState<string | null>(null);
  const [justDroppedId, setJustDroppedId] = useState<string | null>(null);
  const [snapMode, setSnapMode] = useState<DragSnapMode>("coarse");
  const [zoomRail, setZoomRail] = useState<DragZoomRailState | null>(null);
  const dragOffsetY = useMotionValue(0);

  // Refs (no drag-frame re-renders)
  const draggingTaskIdRef = useRef<string | null>(null);
  const originalTimeRef = useRef<string>("09:00");
  const originalMinutesRef = useRef(540);
  const dragStartYRef = useRef(0);
  const lastSnappedMinutesRef = useRef(540);
  const fineAnchorMinuteRef = useRef<number | null>(null);
  const fineAnchorClientYRef = useRef<number | null>(null);
  const coarseDwellOriginYRef = useRef(0);
  const coarseDwellStartedAtRef = useRef(0);
  const touchHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const pendingTouchDragRef = useRef<{ taskId: string; scheduledTime: string; startY: number } | null>(null);
  const windowListenersRef = useRef<WindowListeners>({});
  const lastLightHapticAtRef = useRef(0);
  const snapModeRef = useRef<DragSnapMode>("coarse");

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

  const resetSnapState = useCallback(() => {
    snapModeRef.current = "coarse";
    setSnapMode("coarse");
    setZoomRail(null);
    fineAnchorMinuteRef.current = null;
    fineAnchorClientYRef.current = null;
    coarseDwellOriginYRef.current = 0;
    coarseDwellStartedAtRef.current = 0;
  }, []);

  const maybeActivateFineMode = useCallback((clientY: number) => {
    if (snapModeRef.current !== "coarse") return;

    const dwellDistance = Math.abs(clientY - coarseDwellOriginYRef.current);
    if (dwellDistance > resolvedSnapConfig.fineActivationMovementPx) {
      coarseDwellOriginYRef.current = clientY;
      coarseDwellStartedAtRef.current = nowMs();
      return;
    }

    const dwellDuration = nowMs() - coarseDwellStartedAtRef.current;
    if (dwellDuration < resolvedSnapConfig.fineActivationHoldMs) {
      return;
    }

    snapModeRef.current = "fine";
    setSnapMode("fine");
    fineAnchorMinuteRef.current = lastSnappedMinutesRef.current;
    fineAnchorClientYRef.current = clientY;
  }, [resolvedSnapConfig.fineActivationHoldMs, resolvedSnapConfig.fineActivationMovementPx]);

  const handleMove = useCallback(
    (clientY: number) => {
      if (!draggingTaskIdRef.current) return;

      const safeClientY = Number.isFinite(clientY) ? clientY : dragStartYRef.current;
      const deltaY = safeClientY - dragStartYRef.current;
      dragOffsetY.set(deltaY);
      updateAutoscroll(safeClientY);

      maybeActivateFineMode(safeClientY);

      const computed = computeAdaptiveMinute({
        startMinute: originalMinutesRef.current,
        startClientY: dragStartYRef.current,
        currentClientY: safeClientY,
        mode: snapModeRef.current,
        lastSnappedMinute: lastSnappedMinutesRef.current,
        fineAnchorMinute: fineAnchorMinuteRef.current,
        fineAnchorClientY: fineAnchorClientYRef.current,
        config: resolvedSnapConfig,
      });

      fineAnchorMinuteRef.current = computed.fineAnchorMinute;
      fineAnchorClientYRef.current = computed.fineAnchorClientY;

      const newMinutes = computed.snappedMinute;
      if (newMinutes !== lastSnappedMinutesRef.current) {
        lastSnappedMinutesRef.current = newMinutes;
        setPreviewTime(minuteToTime24(newMinutes, resolvedSnapConfig));
        const now = nowMs();
        if (now - lastLightHapticAtRef.current >= LIGHT_HAPTIC_MIN_INTERVAL_MS) {
          lastLightHapticAtRef.current = now;
          void triggerHaptic(ImpactStyle.Light);
        }
      }

      setZoomRail(buildDragZoomRailState(
        snapModeRef.current,
        safeClientY,
        newMinutes,
        resolvedSnapConfig,
      ));
    },
    [dragOffsetY, maybeActivateFineMode, resolvedSnapConfig, updateAutoscroll],
  );

  const finishDrag = useCallback(() => {
    removeWindowListeners();
    clearTouchHoldTimer();
    pendingTouchDragRef.current = null;
    touchStartPosRef.current = null;

    const taskId = draggingTaskIdRef.current;
    const finalTime = minuteToTime24(lastSnappedMinutesRef.current, resolvedSnapConfig);
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
    resetSnapState();
  }, [
    clearDropResetTimer,
    clearTouchHoldTimer,
    dragOffsetY,
    onDrop,
    removeWindowListeners,
    resetSnapState,
    resolvedSnapConfig,
    stopScroll,
  ]);

  const startDrag = useCallback(
    (taskId: string, scheduledTime: string, startY: number) => {
      if (draggingTaskIdRef.current) return;

      removeWindowListeners();
      clearTouchHoldTimer();

      const safeStartY = Number.isFinite(startY) ? startY : 0;
      const startMinute = time24ToMinute(scheduledTime, resolvedSnapConfig);
      const normalizedStartTime = minuteToTime24(startMinute, resolvedSnapConfig);

      draggingTaskIdRef.current = taskId;
      originalTimeRef.current = normalizedStartTime;
      originalMinutesRef.current = startMinute;
      lastSnappedMinutesRef.current = startMinute;
      dragStartYRef.current = safeStartY;
      coarseDwellOriginYRef.current = safeStartY;
      coarseDwellStartedAtRef.current = nowMs();

      setDraggingTaskId(taskId);
      setPreviewTime(normalizedStartTime);
      dragOffsetY.set(0);
      lastLightHapticAtRef.current = 0;

      resetSnapState();
      setZoomRail(buildDragZoomRailState("coarse", safeStartY, startMinute, resolvedSnapConfig));

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
    [
      clearTouchHoldTimer,
      dragOffsetY,
      finishDrag,
      handleMove,
      removeWindowListeners,
      resetSnapState,
      resolvedSnapConfig,
    ],
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
    snapMode,
    zoomRail,
    getDragHandleProps,
    getRowDragProps,
  };
}
