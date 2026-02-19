import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useMotionValue, type MotionValue } from "framer-motion";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { useAutoscroll } from "@/hooks/useAutoscroll";
import {
  AdaptiveSnapConfig,
  AdaptiveSnapRuntimeScale,
  DragSnapMode,
  DragZoomRailState,
  buildAdaptiveSnapRuntimeScale,
  clampMinuteToRange,
  minuteToTime24,
  resolveAdaptiveSnapConfig,
  snapMinuteByMode,
  time24ToMinute,
} from "@/components/calendar/dragSnap";

const DROP_BOUNCE_MS = 300;
const INTERACTIVE_SELECTOR = '[data-interactive="true"]';
const DEFAULT_ACTIVATION_THRESHOLD_PX = 8;
const POINTER_NUDGE_RELEASE_DEADZONE_PX = 2;

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
  activationThresholdPx?: number;
}

interface DragHandleProps {
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerDownCapture?: (e: React.PointerEvent<HTMLElement>) => void;
  onTouchStart: (e: React.TouchEvent<HTMLElement>) => void;
  onTouchStartCapture?: (e: React.TouchEvent<HTMLElement>) => void;
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
  scroll?: () => void;
  scrollContext?: ScrollContext;
}

type ScrollContext =
  | { kind: "window" }
  | { kind: "element"; element: HTMLElement };

interface PendingDragCandidate {
  taskId: string;
  scheduledTime: string;
  startY: number;
}

type MoveSource = "pointer" | "scroll";

interface HandleMoveOptions {
  skipAutoscrollUpdate?: boolean;
  source?: MoveSource;
}

const getViewportHeight = () => {
  if (typeof window === "undefined") return 720;
  const candidate = window.visualViewport?.height ?? window.innerHeight;
  return Number.isFinite(candidate) ? candidate : 720;
};

const isScrollableElement = (element: HTMLElement) => {
  if (typeof window === "undefined") return false;
  const style = window.getComputedStyle(element);
  const overflowY = style.overflowY || style.overflow;
  const canScroll = /(auto|scroll|overlay)/i.test(overflowY);
  return canScroll && element.scrollHeight > element.clientHeight;
};

const findNearestScrollContext = (container: HTMLElement | null): ScrollContext => {
  if (!container) return { kind: "window" };

  let current: HTMLElement | null = container;
  while (current) {
    if (isScrollableElement(current)) {
      return { kind: "element", element: current };
    }
    current = current.parentElement;
  }

  return { kind: "window" };
};

const getScrollOffset = (context: ScrollContext): number => {
  if (context.kind === "window") {
    if (typeof window === "undefined") return 0;
    return Number.isFinite(window.scrollY) ? window.scrollY : window.pageYOffset;
  }
  return context.element.scrollTop;
};

export function useTimelineDrag({
  containerRef,
  onDrop,
  snapConfig,
  activationThresholdPx = DEFAULT_ACTIVATION_THRESHOLD_PX,
}: UseTimelineDragOptions) {
  const resolvedSnapConfig = useMemo(() => resolveAdaptiveSnapConfig(snapConfig), [snapConfig]);
  const resolvedActivationThresholdPx = Math.max(0, activationThresholdPx);

  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [previewTime, setPreviewTime] = useState<string | null>(null);
  const [justDroppedId, setJustDroppedId] = useState<string | null>(null);
  const [snapMode, setSnapMode] = useState<DragSnapMode>("coarse");
  const [zoomRail, setZoomRail] = useState<DragZoomRailState | null>(null);
  const dragOffsetY = useMotionValue(0);
  const dragEdgeOffsetY = useMotionValue(0);

  // Refs (no drag-frame re-renders)
  const draggingTaskIdRef = useRef<string | null>(null);
  const originalTimeRef = useRef<string>("09:00");
  const originalMinutesRef = useRef(540);
  const pointerMinutesRef = useRef(540);
  const nudgeOffsetMinutesRef = useRef(0);
  const currentRawMinutesRef = useRef(540);
  const lastPreviewMinuteRef = useRef(540);
  const dragStartYRef = useRef(0);
  const dragMovedRef = useRef(false);
  const runtimeScaleRef = useRef<AdaptiveSnapRuntimeScale>(
    buildAdaptiveSnapRuntimeScale(resolvedSnapConfig, getViewportHeight()),
  );
  const dropResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const windowListenersRef = useRef<WindowListeners>({});
  const pendingDragRef = useRef<PendingDragCandidate | null>(null);
  const scrollContextRef = useRef<ScrollContext>({ kind: "window" });
  const dragStartScrollOffsetRef = useRef(0);
  const lastPointerClientYRef = useRef(0);
  const queuedMoveClientYRef = useRef<number | null>(null);
  const queuedMoveFrameRef = useRef<number | null>(null);

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
    if (listeners.scroll) {
      if (listeners.scrollContext?.kind === "element") {
        listeners.scrollContext.element.removeEventListener("scroll", listeners.scroll);
      } else {
        window.removeEventListener("scroll", listeners.scroll);
      }
    }
    windowListenersRef.current = {};
  }, []);

  const resetSnapState = useCallback(() => {
    setSnapMode("coarse");
    setZoomRail(null);
    runtimeScaleRef.current = buildAdaptiveSnapRuntimeScale(resolvedSnapConfig, getViewportHeight());
  }, [resolvedSnapConfig]);

  const applyComposedDragMinute = useCallback(
    (pointerMinute: number, nudgeOffsetMinutes: number) => {
      const safePointerMinute = clampMinuteToRange(pointerMinute, resolvedSnapConfig);
      const composedMinute = clampMinuteToRange(safePointerMinute + nudgeOffsetMinutes, resolvedSnapConfig);
      const resolvedNudgeOffsetMinutes = composedMinute - safePointerMinute;

      pointerMinutesRef.current = safePointerMinute;
      nudgeOffsetMinutesRef.current = resolvedNudgeOffsetMinutes;
      currentRawMinutesRef.current = composedMinute;

      const edgeDeltaY = (safePointerMinute - originalMinutesRef.current) * runtimeScaleRef.current.coarsePixelsPerMinute;
      const visualDeltaY = (composedMinute - originalMinutesRef.current) * runtimeScaleRef.current.coarsePixelsPerMinute;

      dragEdgeOffsetY.set(edgeDeltaY);
      dragOffsetY.set(visualDeltaY);
      if (!dragMovedRef.current && Math.abs(visualDeltaY) > 0.5) {
        dragMovedRef.current = true;
      }

      const previewMinute = snapMinuteByMode(composedMinute, "fine", resolvedSnapConfig);
      if (previewMinute !== lastPreviewMinuteRef.current) {
        lastPreviewMinuteRef.current = previewMinute;
        setPreviewTime(minuteToTime24(previewMinute, resolvedSnapConfig));
      }
    },
    [dragEdgeOffsetY, dragOffsetY, resolvedSnapConfig],
  );

  const handleMove = useCallback(
    (clientY: number, options?: HandleMoveOptions) => {
      if (!draggingTaskIdRef.current) return;

      const safeClientY = Number.isFinite(clientY) ? clientY : dragStartYRef.current;
      const previousPointerClientY = lastPointerClientYRef.current;
      lastPointerClientYRef.current = safeClientY;
      const moveSource = options?.source ?? "pointer";

      if (!options?.skipAutoscrollUpdate) {
        updateAutoscroll(safeClientY);
      }

      const scrollDelta = getScrollOffset(scrollContextRef.current) - dragStartScrollOffsetRef.current;
      const effectiveClientY = safeClientY + scrollDelta;
      const deltaY = effectiveClientY - dragStartYRef.current;
      const rawMinute = originalMinutesRef.current + (deltaY / runtimeScaleRef.current.coarsePixelsPerMinute);
      const pointerMinute = clampMinuteToRange(rawMinute, resolvedSnapConfig);

      let nextNudgeOffsetMinutes = nudgeOffsetMinutesRef.current;
      if (
        moveSource === "pointer" &&
        Math.abs(previousPointerClientY - safeClientY) > POINTER_NUDGE_RELEASE_DEADZONE_PX &&
        Math.abs(nextNudgeOffsetMinutes) > 0
      ) {
        const pointerDirection = Math.sign(safeClientY - previousPointerClientY);
        const nudgeDirection = Math.sign(nextNudgeOffsetMinutes);
        if (pointerDirection !== 0 && pointerDirection === -nudgeDirection) {
          nextNudgeOffsetMinutes -= nudgeDirection * resolvedSnapConfig.fineStepMinutes;
          if (Math.sign(nextNudgeOffsetMinutes) !== nudgeDirection) {
            nextNudgeOffsetMinutes = 0;
          }
        }
      }

      applyComposedDragMinute(pointerMinute, nextNudgeOffsetMinutes);
    },
    [applyComposedDragMinute, resolvedSnapConfig, updateAutoscroll],
  );

  const clearQueuedMove = useCallback(() => {
    if (queuedMoveFrameRef.current !== null && typeof window !== "undefined") {
      window.cancelAnimationFrame(queuedMoveFrameRef.current);
      queuedMoveFrameRef.current = null;
    }
    queuedMoveClientYRef.current = null;
  }, []);

  const flushQueuedMove = useCallback(
    (options?: HandleMoveOptions) => {
      const queuedClientY = queuedMoveClientYRef.current;
      if (queuedMoveFrameRef.current !== null && typeof window !== "undefined") {
        window.cancelAnimationFrame(queuedMoveFrameRef.current);
        queuedMoveFrameRef.current = null;
      }
      if (queuedClientY === null) return;
      queuedMoveClientYRef.current = null;
      handleMove(queuedClientY, { source: "pointer", ...options });
    },
    [handleMove],
  );

  const queueMove = useCallback(
    (clientY: number) => {
      if (!draggingTaskIdRef.current) return;
      const safeClientY = Number.isFinite(clientY) ? clientY : dragStartYRef.current;
      queuedMoveClientYRef.current = safeClientY;

      if (typeof window === "undefined") {
        flushQueuedMove();
        return;
      }
      if (queuedMoveFrameRef.current !== null) return;

      queuedMoveFrameRef.current = window.requestAnimationFrame(() => {
        queuedMoveFrameRef.current = null;
        const nextClientY = queuedMoveClientYRef.current;
        if (nextClientY === null) return;
        queuedMoveClientYRef.current = null;
        handleMove(nextClientY, { source: "pointer" });
      });
    },
    [flushQueuedMove, handleMove],
  );

  const attachActiveScrollListener = useCallback(() => {
    const scrollContext = findNearestScrollContext(containerRef.current);
    scrollContextRef.current = scrollContext;
    dragStartScrollOffsetRef.current = getScrollOffset(scrollContext);

    const scrollListener = () => {
      if (!draggingTaskIdRef.current) return;
      handleMove(lastPointerClientYRef.current, { skipAutoscrollUpdate: true, source: "scroll" });
    };

    windowListenersRef.current.scroll = scrollListener;
    windowListenersRef.current.scrollContext = scrollContext;
    if (scrollContext.kind === "element") {
      scrollContext.element.addEventListener("scroll", scrollListener, { passive: true });
    } else {
      window.addEventListener("scroll", scrollListener, { passive: true });
    }
  }, [containerRef, handleMove]);

  const activateDrag = useCallback(
    (pendingDrag: PendingDragCandidate) => {
      if (draggingTaskIdRef.current) return;

      const safeStartY = Number.isFinite(pendingDrag.startY) ? pendingDrag.startY : 0;
      const startMinute = time24ToMinute(pendingDrag.scheduledTime, resolvedSnapConfig);
      const normalizedStartTime = minuteToTime24(startMinute, resolvedSnapConfig);

      pendingDragRef.current = null;
      draggingTaskIdRef.current = pendingDrag.taskId;
      originalTimeRef.current = normalizedStartTime;
      originalMinutesRef.current = startMinute;
      pointerMinutesRef.current = startMinute;
      nudgeOffsetMinutesRef.current = 0;
      currentRawMinutesRef.current = startMinute;
      lastPreviewMinuteRef.current = startMinute;
      dragStartYRef.current = safeStartY;
      lastPointerClientYRef.current = safeStartY;
      dragMovedRef.current = false;
      runtimeScaleRef.current = buildAdaptiveSnapRuntimeScale(
        resolvedSnapConfig,
        getViewportHeight(),
      );

      setDraggingTaskId(pendingDrag.taskId);
      setPreviewTime(normalizedStartTime);
      dragOffsetY.set(0);
      dragEdgeOffsetY.set(0);
      setSnapMode("coarse");
      setZoomRail(null);
      attachActiveScrollListener();
    },
    [attachActiveScrollListener, dragEdgeOffsetY, dragOffsetY, resolvedSnapConfig],
  );

  const maybeActivateDrag = useCallback(
    (clientY: number): boolean => {
      if (draggingTaskIdRef.current) return true;
      const pendingDrag = pendingDragRef.current;
      if (!pendingDrag) return false;

      const safeClientY = Number.isFinite(clientY) ? clientY : pendingDrag.startY;
      lastPointerClientYRef.current = safeClientY;
      const movementY = Math.abs(safeClientY - pendingDrag.startY);
      if (movementY < resolvedActivationThresholdPx) {
        return false;
      }

      activateDrag(pendingDrag);
      return true;
    },
    [activateDrag, resolvedActivationThresholdPx],
  );

  const finishDrag = useCallback(() => {
    flushQueuedMove({ skipAutoscrollUpdate: true });
    removeWindowListeners();
    pendingDragRef.current = null;

    const taskId = draggingTaskIdRef.current;
    const finalMinute = snapMinuteByMode(currentRawMinutesRef.current, "fine", resolvedSnapConfig);
    const finalTime = dragMovedRef.current
      ? minuteToTime24(finalMinute, resolvedSnapConfig)
      : originalTimeRef.current;
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
    dragEdgeOffsetY.set(0);
    clearQueuedMove();
    stopScroll();
    scrollContextRef.current = { kind: "window" };
    dragStartScrollOffsetRef.current = 0;
    lastPointerClientYRef.current = 0;
    pointerMinutesRef.current = originalMinutesRef.current;
    nudgeOffsetMinutesRef.current = 0;
    dragMovedRef.current = false;
    resetSnapState();
  }, [
    clearDropResetTimer,
    clearQueuedMove,
    dragEdgeOffsetY,
    dragOffsetY,
    flushQueuedMove,
    onDrop,
    removeWindowListeners,
    resetSnapState,
    resolvedSnapConfig,
    stopScroll,
  ]);

  const startPendingDrag = useCallback(
    (taskId: string, scheduledTime: string, startY: number, inputSource: "pointer" | "touch") => {
      if (draggingTaskIdRef.current || pendingDragRef.current) return;

      removeWindowListeners();
      clearQueuedMove();
      const safeStartY = Number.isFinite(startY) ? startY : 0;
      pendingDragRef.current = {
        taskId,
        scheduledTime,
        startY: safeStartY,
      };
      lastPointerClientYRef.current = safeStartY;
      nudgeOffsetMinutesRef.current = 0;
      dragMovedRef.current = false;

      const pointerMove = (e: PointerEvent) => {
        const isActive = maybeActivateDrag(e.clientY);
        if (!isActive) return;
        queueMove(e.clientY);
      };
      const pointerEnd = () => {
        if (draggingTaskIdRef.current) {
          finishDrag();
          return;
        }
        pendingDragRef.current = null;
        pointerMinutesRef.current = originalMinutesRef.current;
        nudgeOffsetMinutesRef.current = 0;
        clearQueuedMove();
        removeWindowListeners();
      };
      const touchMove = (e: TouchEvent) => {
        const touch = e.touches[0];
        if (!touch) return;
        const isActive = maybeActivateDrag(touch.clientY);
        if (!isActive) return;
        e.preventDefault();
        queueMove(touch.clientY);
      };
      const touchEnd = () => {
        if (draggingTaskIdRef.current) {
          finishDrag();
          return;
        }
        pendingDragRef.current = null;
        pointerMinutesRef.current = originalMinutesRef.current;
        nudgeOffsetMinutesRef.current = 0;
        clearQueuedMove();
        removeWindowListeners();
      };

      windowListenersRef.current = {};

      if (inputSource === "touch") {
        windowListenersRef.current.touchmove = touchMove;
        windowListenersRef.current.touchend = touchEnd;
        windowListenersRef.current.touchcancel = touchEnd;
        window.addEventListener("touchmove", touchMove, { passive: false });
        window.addEventListener("touchend", touchEnd);
        window.addEventListener("touchcancel", touchEnd);
      } else {
        windowListenersRef.current.pointermove = pointerMove;
        windowListenersRef.current.pointerup = pointerEnd;
        windowListenersRef.current.pointercancel = pointerEnd;
        window.addEventListener("pointermove", pointerMove);
        window.addEventListener("pointerup", pointerEnd);
        window.addEventListener("pointercancel", pointerEnd);
      }
    },
    [
      clearQueuedMove,
      finishDrag,
      maybeActivateDrag,
      queueMove,
      removeWindowListeners,
    ],
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLElement>, taskId: string, scheduledTime: string) => {
      if (e.defaultPrevented) return;
      if (draggingTaskIdRef.current || pendingDragRef.current) return;
      if (isInteractiveEventTarget(e.target)) return;
      const touch = e.touches[0];
      if (!touch) return;

      startPendingDrag(taskId, scheduledTime, touch.clientY, "touch");
    },
    [isInteractiveEventTarget, startPendingDrag],
  );

  const noopTouchMove = useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      e.stopPropagation();
    },
    [],
  );

  const noopTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      e.stopPropagation();
    },
    [],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>, taskId: string, scheduledTime: string) => {
      if (e.defaultPrevented) return;
      if (draggingTaskIdRef.current || pendingDragRef.current) return;
      if (isInteractiveEventTarget(e.target)) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;

      startPendingDrag(taskId, scheduledTime, e.clientY, "pointer");
    },
    [isInteractiveEventTarget, startPendingDrag],
  );

  const nudgeByFineStep = useCallback(
    (direction: -1 | 1): boolean => {
      flushQueuedMove({ skipAutoscrollUpdate: true });
      if (!draggingTaskIdRef.current) return false;

      const previousComposedMinute = currentRawMinutesRef.current;
      const pointerMinute = pointerMinutesRef.current;
      const nextNudgeOffsetMinutes =
        nudgeOffsetMinutesRef.current + (direction * resolvedSnapConfig.fineStepMinutes);
      applyComposedDragMinute(pointerMinute, nextNudgeOffsetMinutes);
      if (currentRawMinutesRef.current === previousComposedMinute) {
        return false;
      }

      dragMovedRef.current = true;
      return true;
    },
    [applyComposedDragMinute, flushQueuedMove, resolvedSnapConfig],
  );

  const getDragHandleProps = useCallback(
    (taskId: string, scheduledTime: string): DragHandleProps => ({
      onPointerDownCapture: (e) => handlePointerDown(e, taskId, scheduledTime),
      onPointerDown: (e) => handlePointerDown(e, taskId, scheduledTime),
      onTouchStartCapture: (e) => handleTouchStart(e, taskId, scheduledTime),
      onTouchStart: (e) => handleTouchStart(e, taskId, scheduledTime),
      onTouchMove: noopTouchMove,
      onTouchEnd: noopTouchEnd,
      onTouchCancel: noopTouchEnd,
    }),
    [handlePointerDown, handleTouchStart, noopTouchEnd, noopTouchMove],
  );

  const getRowDragProps = useCallback(
    (taskId: string, scheduledTime: string): DragHandleProps => ({
      onPointerDownCapture: (e) => handlePointerDown(e, taskId, scheduledTime),
      onPointerDown: (e) => handlePointerDown(e, taskId, scheduledTime),
      onTouchStartCapture: (e) => handleTouchStart(e, taskId, scheduledTime),
      onTouchStart: (e) => handleTouchStart(e, taskId, scheduledTime),
      onTouchMove: noopTouchMove,
      onTouchEnd: noopTouchEnd,
      onTouchCancel: noopTouchEnd,
    }),
    [handlePointerDown, handleTouchStart, noopTouchEnd, noopTouchMove],
  );

  useEffect(() => {
    return () => {
      removeWindowListeners();
      clearDropResetTimer();
      clearQueuedMove();
      pendingDragRef.current = null;
      pointerMinutesRef.current = originalMinutesRef.current;
      nudgeOffsetMinutesRef.current = 0;
      stopScroll();
    };
  }, [clearDropResetTimer, clearQueuedMove, removeWindowListeners, stopScroll]);

  return {
    draggingTaskId,
    previewTime,
    dragOffsetY: dragOffsetY as MotionValue<number>,
    dragVisualOffsetY: dragOffsetY as MotionValue<number>,
    dragEdgeOffsetY: dragEdgeOffsetY as MotionValue<number>,
    justDroppedId,
    isDragging: draggingTaskId !== null,
    snapMode,
    zoomRail,
    nudgeByFineStep,
    getDragHandleProps,
    getRowDragProps,
  };
}
