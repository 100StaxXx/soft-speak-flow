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
  minuteToTime24,
  resolveAdaptiveSnapConfig,
  snapMinuteByMode,
  time24ToMinute,
} from "@/components/calendar/dragSnap";

const DROP_BOUNCE_MS = 300;
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
  const currentRawMinutesRef = useRef(540);
  const lastPreviewMinuteRef = useRef(540);
  const dragStartYRef = useRef(0);
  const dragMovedRef = useRef(false);
  const runtimeScaleRef = useRef<AdaptiveSnapRuntimeScale>(
    buildAdaptiveSnapRuntimeScale(resolvedSnapConfig, getViewportHeight()),
  );
  const dropResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const windowListenersRef = useRef<WindowListeners>({});
  const scrollContextRef = useRef<ScrollContext>({ kind: "window" });
  const dragStartScrollOffsetRef = useRef(0);
  const lastPointerClientYRef = useRef(0);

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

  const handleMove = useCallback(
    (clientY: number, options?: { skipAutoscrollUpdate?: boolean }) => {
      if (!draggingTaskIdRef.current) return;

      const safeClientY = Number.isFinite(clientY) ? clientY : dragStartYRef.current;
      lastPointerClientYRef.current = safeClientY;

      if (!options?.skipAutoscrollUpdate) {
        updateAutoscroll(safeClientY);
      }

      const scrollDelta = getScrollOffset(scrollContextRef.current) - dragStartScrollOffsetRef.current;
      const effectiveClientY = safeClientY + scrollDelta;
      const deltaY = effectiveClientY - dragStartYRef.current;
      dragOffsetY.set(deltaY);
      if (!dragMovedRef.current && Math.abs(deltaY) > 0.5) {
        dragMovedRef.current = true;
      }

      const rawMinute = originalMinutesRef.current + (deltaY / runtimeScaleRef.current.coarsePixelsPerMinute);
      currentRawMinutesRef.current = rawMinute;
      const previewMinute = snapMinuteByMode(rawMinute, "fine", resolvedSnapConfig);
      if (previewMinute !== lastPreviewMinuteRef.current) {
        lastPreviewMinuteRef.current = previewMinute;
        setPreviewTime(minuteToTime24(previewMinute, resolvedSnapConfig));
      }
    },
    [dragOffsetY, resolvedSnapConfig, updateAutoscroll],
  );

  const finishDrag = useCallback(() => {
    removeWindowListeners();

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
    stopScroll();
    scrollContextRef.current = { kind: "window" };
    dragStartScrollOffsetRef.current = 0;
    lastPointerClientYRef.current = 0;
    dragMovedRef.current = false;
    resetSnapState();
  }, [
    clearDropResetTimer,
    dragOffsetY,
    onDrop,
    removeWindowListeners,
    resetSnapState,
    resolvedSnapConfig,
    stopScroll,
  ]);

  const startDrag = useCallback(
    (taskId: string, scheduledTime: string, startY: number, inputSource: "pointer" | "touch") => {
      if (draggingTaskIdRef.current) return;

      removeWindowListeners();

      const safeStartY = Number.isFinite(startY) ? startY : 0;
      const startMinute = time24ToMinute(scheduledTime, resolvedSnapConfig);
      const normalizedStartTime = minuteToTime24(startMinute, resolvedSnapConfig);
      const scrollContext = findNearestScrollContext(containerRef.current);
      const dragStartScrollOffset = getScrollOffset(scrollContext);

      draggingTaskIdRef.current = taskId;
      originalTimeRef.current = normalizedStartTime;
      originalMinutesRef.current = startMinute;
      currentRawMinutesRef.current = startMinute;
      lastPreviewMinuteRef.current = startMinute;
      dragStartYRef.current = safeStartY;
      scrollContextRef.current = scrollContext;
      dragStartScrollOffsetRef.current = dragStartScrollOffset;
      lastPointerClientYRef.current = safeStartY;
      dragMovedRef.current = false;
      runtimeScaleRef.current = buildAdaptiveSnapRuntimeScale(
        resolvedSnapConfig,
        getViewportHeight(),
      );

      setDraggingTaskId(taskId);
      setPreviewTime(normalizedStartTime);
      dragOffsetY.set(0);
      setSnapMode("coarse");
      setZoomRail(null);

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
      const scrollListener = () => {
        if (!draggingTaskIdRef.current) return;
        handleMove(lastPointerClientYRef.current, { skipAutoscrollUpdate: true });
      };

      windowListenersRef.current = {
        scroll: scrollListener,
        scrollContext,
      };

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
      if (scrollContext.kind === "element") {
        scrollContext.element.addEventListener("scroll", scrollListener, { passive: true });
      } else {
        window.addEventListener("scroll", scrollListener, { passive: true });
      }
    },
    [
      containerRef,
      dragOffsetY,
      finishDrag,
      handleMove,
      removeWindowListeners,
      resolvedSnapConfig,
    ],
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLElement>, taskId: string, scheduledTime: string) => {
      if (draggingTaskIdRef.current) return;
      if (isInteractiveEventTarget(e.target)) return;
      const touch = e.touches[0];
      if (!touch) return;

      e.preventDefault();
      e.stopPropagation();
      startDrag(taskId, scheduledTime, touch.clientY, "touch");
    },
    [isInteractiveEventTarget, startDrag],
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
      if (draggingTaskIdRef.current) return;
      if (isInteractiveEventTarget(e.target)) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;

      e.preventDefault();
      e.stopPropagation();
      startDrag(taskId, scheduledTime, e.clientY, "pointer");
    },
    [isInteractiveEventTarget, startDrag],
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
      stopScroll();
    };
  }, [clearDropResetTimer, removeWindowListeners, stopScroll]);

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
