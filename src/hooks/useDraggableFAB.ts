import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";
import { safeLocalStorage } from "@/utils/storage";
import {
  QUEST_LAUNCHER_BOTTOM_GAP_PX,
  QUEST_LAUNCHER_SIDE_INSET_PX,
  QUEST_LAUNCHER_TOP_OFFSET_PX,
} from "@/components/quest-launchers/metrics";

export interface FABCoordinates {
  x: number;
  y: number;
}

export interface FABPopupAlignment {
  horizontal: "left" | "right";
  vertical: "top" | "bottom";
}

export const DRAGGABLE_FAB_LEGACY_STORAGE_KEY = "add-quest-fab-position";
export const DRAGGABLE_FAB_STORAGE_KEY_V2 = "add-quest-fab-position-v2";
export const DRAGGABLE_FAB_STORAGE_KEY_V3 = "companion-planner-fab-position-v1";

const LONG_PRESS_DURATION = 500;
const LONG_PRESS_MOVE_THRESHOLD_PX = 12;
const FALLBACK_ROOT_FONT_SIZE_PX = 16;
const DEFAULT_BOTTOM_NAV_SAFE_OFFSET_REM = 6.5;
const FLOATING_HERO_SIZE_PX = 96;

interface FABViewportBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface UseDraggableFABOptions {
  defaultPosition?: FABCoordinates;
  onDragEnd?: (position: FABCoordinates) => void;
}

interface UseDraggableFABReturn {
  position: FABCoordinates;
  popupAlignment: FABPopupAlignment;
  isDragging: boolean;
  isLongPressing: boolean;
  longPressHandlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
  };
  positionStyles: React.CSSProperties;
}

const parsePixelValue = (value: string | null | undefined): number | null => {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.endsWith("px")) {
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
  }

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
  }

  return null;
};

const readSafeAreaInsetPx = (side: "top" | "right" | "bottom" | "left"): number => {
  if (typeof window === "undefined" || typeof document === "undefined") return 0;

  const rootStyle = window.getComputedStyle(document.documentElement);
  const aliases = {
    top: ["--safe-area-inset-top", "--sat"],
    right: ["--safe-area-inset-right", "--sar"],
    bottom: ["--safe-area-inset-bottom", "--sab"],
    left: ["--safe-area-inset-left", "--sal"],
  }[side];

  for (const alias of aliases) {
    const fromVars = parsePixelValue(rootStyle.getPropertyValue(alias));
    if (fromVars !== null) return fromVars;
  }

  if (!document.body) return 0;

  const probe = document.createElement("div");
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";

  const propertyBySide = {
    top: "paddingTop",
    right: "paddingRight",
    bottom: "paddingBottom",
    left: "paddingLeft",
  } as const;
  const envBySide = {
    top: "env(safe-area-inset-top, 0px)",
    right: "env(safe-area-inset-right, 0px)",
    bottom: "env(safe-area-inset-bottom, 0px)",
    left: "env(safe-area-inset-left, 0px)",
  } as const;

  probe.style[propertyBySide[side]] = envBySide[side];
  document.body.appendChild(probe);
  const fromProbe = parsePixelValue(window.getComputedStyle(probe)[propertyBySide[side]]) ?? 0;
  probe.remove();
  return fromProbe;
};

const getBottomNavObstructionPx = () => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return DEFAULT_BOTTOM_NAV_SAFE_OFFSET_REM * FALLBACK_ROOT_FONT_SIZE_PX;
  }

  const rootStyles = window.getComputedStyle(document.documentElement);
  const runtimeOffset = parsePixelValue(rootStyles.getPropertyValue("--bottom-nav-runtime-offset"));
  if (runtimeOffset !== null) {
    return runtimeOffset;
  }

  const safeOffset = parsePixelValue(rootStyles.getPropertyValue("--bottom-nav-safe-offset"));
  if (safeOffset !== null) {
    return safeOffset;
  }

  if (!document.body) {
    return DEFAULT_BOTTOM_NAV_SAFE_OFFSET_REM * FALLBACK_ROOT_FONT_SIZE_PX;
  }

  const probe = document.createElement("div");
  probe.style.position = "fixed";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.top = "0";
  probe.style.left = "0";
  probe.style.height = "var(--bottom-nav-runtime-offset, var(--bottom-nav-safe-offset))";
  document.body.appendChild(probe);
  const measured = probe.getBoundingClientRect().height;
  probe.remove();

  if (Number.isFinite(measured) && measured > 0) {
    return measured;
  }

  const rootFontSize = Number.parseFloat(rootStyles.fontSize || String(FALLBACK_ROOT_FONT_SIZE_PX));
  const safeRootFontSize = Number.isFinite(rootFontSize) && rootFontSize > 0
    ? rootFontSize
    : FALLBACK_ROOT_FONT_SIZE_PX;
  return DEFAULT_BOTTOM_NAV_SAFE_OFFSET_REM * safeRootFontSize;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const getFiniteCoordinate = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback);

const areSamePosition = (left: FABCoordinates, right: FABCoordinates) =>
  left.x === right.x && left.y === right.y;

const getViewportBounds = (): FABViewportBounds => {
  if (typeof window === "undefined") {
    return {
      minX: QUEST_LAUNCHER_SIDE_INSET_PX,
      maxX: QUEST_LAUNCHER_SIDE_INSET_PX,
      minY: QUEST_LAUNCHER_TOP_OFFSET_PX,
      maxY: QUEST_LAUNCHER_TOP_OFFSET_PX,
    };
  }

  const safeLeft = readSafeAreaInsetPx("left");
  const safeRight = readSafeAreaInsetPx("right");
  const safeTop = readSafeAreaInsetPx("top");
  const bottomNavObstructionPx = getBottomNavObstructionPx();

  const minX = Math.round(safeLeft + QUEST_LAUNCHER_SIDE_INSET_PX);
  const maxX = Math.round(Math.max(
    minX,
    window.innerWidth - safeRight - QUEST_LAUNCHER_SIDE_INSET_PX - FLOATING_HERO_SIZE_PX,
  ));
  const minY = Math.round(safeTop + QUEST_LAUNCHER_TOP_OFFSET_PX);
  const maxY = Math.round(Math.max(
    minY,
    window.innerHeight - bottomNavObstructionPx - QUEST_LAUNCHER_BOTTOM_GAP_PX - FLOATING_HERO_SIZE_PX,
  ));

  return { minX, maxX, minY, maxY };
};

const clampPositionToBounds = (position: FABCoordinates, bounds: FABViewportBounds): FABCoordinates => ({
  x: Math.round(clamp(position.x, bounds.minX, bounds.maxX)),
  y: Math.round(clamp(position.y, bounds.minY, bounds.maxY)),
});

const getDefaultPosition = (bounds: FABViewportBounds, fallback?: FABCoordinates): FABCoordinates => (
  clampPositionToBounds(
    fallback ?? { x: bounds.maxX, y: bounds.maxY },
    bounds,
  )
);

const parseStoredPosition = (value: string | null): FABCoordinates | null => {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<FABCoordinates> | null;
    if (
      parsed
      && typeof parsed.x === "number"
      && Number.isFinite(parsed.x)
      && typeof parsed.y === "number"
      && Number.isFinite(parsed.y)
    ) {
      return {
        x: parsed.x,
        y: parsed.y,
      };
    }
  } catch {
    return null;
  }

  return null;
};

const getInitialPosition = (bounds: FABViewportBounds, fallback?: FABCoordinates) => {
  const storedPosition = parseStoredPosition(safeLocalStorage.getItem(DRAGGABLE_FAB_STORAGE_KEY_V3));
  if (storedPosition) {
    return clampPositionToBounds(storedPosition, bounds);
  }

  return getDefaultPosition(bounds, fallback);
};

const derivePopupAlignment = (position: FABCoordinates): FABPopupAlignment => {
  if (typeof window === "undefined") {
    return {
      horizontal: "right",
      vertical: "bottom",
    };
  }

  const centerX = position.x + (FLOATING_HERO_SIZE_PX / 2);
  const centerY = position.y + (FLOATING_HERO_SIZE_PX / 2);

  return {
    horizontal: centerX <= (window.innerWidth / 2) ? "left" : "right",
    vertical: centerY <= (window.innerHeight / 2) ? "top" : "bottom",
  };
};

const triggerHaptic = async (style: ImpactStyle = ImpactStyle.Medium) => {
  if (Capacitor.isNativePlatform()) {
    try {
      await Haptics.impact({ style });
    } catch {
      // Haptics not available
    }
  }
};

export const useDraggableFAB = ({
  defaultPosition,
  onDragEnd,
}: UseDraggableFABOptions = {}): UseDraggableFABReturn => {
  const initialBounds = getViewportBounds();
  const [position, setPosition] = useState<FABCoordinates>(() => getInitialPosition(initialBounds, defaultPosition));
  const [isDragging, setIsDragging] = useState(false);
  const [isLongPressing, setIsLongPressing] = useState(false);

  const boundsRef = useRef<FABViewportBounds>(initialBounds);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentPositionRef = useRef(position);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const currentPointerRef = useRef<{ x: number; y: number } | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const targetElementRef = useRef<HTMLElement | null>(null);
  const gripOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const dragActiveRef = useRef(false);

  useEffect(() => {
    currentPositionRef.current = position;
  }, [position]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isDragging) return;
    safeLocalStorage.setItem(DRAGGABLE_FAB_STORAGE_KEY_V3, JSON.stringify(position));
  }, [isDragging, position]);

  useEffect(() => {
    const handleViewportChange = () => {
      const nextBounds = getViewportBounds();
      setPosition((currentPosition) => {
        const nextPosition = clampPositionToBounds(currentPosition, nextBounds);
        boundsRef.current = nextBounds;
        currentPositionRef.current = nextPosition;
        return areSamePosition(currentPosition, nextPosition) ? currentPosition : nextPosition;
      });
    };

    handleViewportChange();
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("orientationchange", handleViewportChange);
    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("orientationchange", handleViewportChange);
    };
  }, []);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const releasePointerCapture = useCallback(() => {
    if (pointerIdRef.current !== null && targetElementRef.current) {
      try {
        targetElementRef.current.releasePointerCapture?.(pointerIdRef.current);
      } catch {
        // Pointer capture is already released or unavailable.
      }
    }
  }, []);

  const resetPointerState = useCallback(() => {
    releasePointerCapture();
    pointerStartRef.current = null;
    currentPointerRef.current = null;
    pointerIdRef.current = null;
    targetElementRef.current = null;
    gripOffsetRef.current = null;
  }, [releasePointerCapture]);

  const cancelPendingPress = useCallback(() => {
    clearLongPressTimer();
    dragActiveRef.current = false;
    setIsDragging(false);
    setIsLongPressing(false);
    resetPointerState();
  }, [clearLongPressTimer, resetPointerState]);

  const updatePositionFromPointer = useCallback((clientX: number, clientY: number) => {
    const gripOffset = gripOffsetRef.current ?? { x: 0, y: 0 };
    const nextPosition = clampPositionToBounds({
      x: clientX - gripOffset.x,
      y: clientY - gripOffset.y,
    }, boundsRef.current);

    currentPositionRef.current = nextPosition;
    setPosition((currentPosition) => areSamePosition(currentPosition, nextPosition) ? currentPosition : nextPosition);
    return nextPosition;
  }, []);

  const finishDragSession = useCallback((finalPosition?: FABCoordinates) => {
    clearLongPressTimer();

    const didDrag = dragActiveRef.current;
    const settledPosition = finalPosition ?? currentPositionRef.current;
    dragActiveRef.current = false;
    setIsDragging(false);
    setIsLongPressing(false);
    resetPointerState();

    if (!didDrag) {
      return;
    }

    currentPositionRef.current = settledPosition;
    setPosition((currentPosition) => areSamePosition(currentPosition, settledPosition) ? currentPosition : settledPosition);
    void triggerHaptic(ImpactStyle.Light);
    onDragEnd?.(settledPosition);
  }, [clearLongPressTimer, onDragEnd, resetPointerState]);

  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    event.preventDefault();
    cancelPendingPress();

    const fallbackPointer = currentPointerRef.current ?? currentPositionRef.current;
    const clientX = getFiniteCoordinate(event.clientX, fallbackPointer.x);
    const clientY = getFiniteCoordinate(event.clientY, fallbackPointer.y);

    pointerStartRef.current = {
      x: clientX,
      y: clientY,
    };
    currentPointerRef.current = {
      x: clientX,
      y: clientY,
    };
    pointerIdRef.current = event.pointerId;
    targetElementRef.current = event.currentTarget as HTMLElement;

    try {
      targetElementRef.current.setPointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture is optional in this environment.
    }

    longPressTimerRef.current = setTimeout(() => {
      const activePointer = currentPointerRef.current;
      if (!activePointer) {
        return;
      }

      gripOffsetRef.current = {
        x: activePointer.x - currentPositionRef.current.x,
        y: activePointer.y - currentPositionRef.current.y,
      };
      dragActiveRef.current = true;
      setIsDragging(true);
      setIsLongPressing(true);
      void triggerHaptic(ImpactStyle.Medium);
    }, LONG_PRESS_DURATION);
  }, [cancelPendingPress]);

  const handlePointerMove = useCallback((event: React.PointerEvent) => {
    if (pointerIdRef.current !== event.pointerId) {
      return;
    }

    const fallbackPointer = currentPointerRef.current ?? pointerStartRef.current ?? currentPositionRef.current;
    const clientX = getFiniteCoordinate(event.clientX, fallbackPointer.x);
    const clientY = getFiniteCoordinate(event.clientY, fallbackPointer.y);

    currentPointerRef.current = {
      x: clientX,
      y: clientY,
    };

    if (dragActiveRef.current) {
      event.preventDefault();
      updatePositionFromPointer(clientX, clientY);
      return;
    }

    if (!pointerStartRef.current || !longPressTimerRef.current) {
      return;
    }

    const deltaX = clientX - pointerStartRef.current.x;
    const deltaY = clientY - pointerStartRef.current.y;
    if (Math.hypot(deltaX, deltaY) > LONG_PRESS_MOVE_THRESHOLD_PX) {
      cancelPendingPress();
    }
  }, [cancelPendingPress, updatePositionFromPointer]);

  const handlePointerUp = useCallback((event: React.PointerEvent) => {
    if (pointerIdRef.current !== event.pointerId) {
      return;
    }

    const fallbackPointer = currentPointerRef.current ?? pointerStartRef.current ?? currentPositionRef.current;
    const clientX = getFiniteCoordinate(event.clientX, fallbackPointer.x);
    const clientY = getFiniteCoordinate(event.clientY, fallbackPointer.y);

    currentPointerRef.current = {
      x: clientX,
      y: clientY,
    };

    if (!dragActiveRef.current) {
      cancelPendingPress();
      return;
    }

    event.preventDefault();
    const settledPosition = updatePositionFromPointer(clientX, clientY);
    finishDragSession(settledPosition);
  }, [cancelPendingPress, finishDragSession, updatePositionFromPointer]);

  const handlePointerCancel = useCallback((event: React.PointerEvent) => {
    if (pointerIdRef.current !== event.pointerId) {
      return;
    }

    if (!dragActiveRef.current) {
      cancelPendingPress();
      return;
    }

    finishDragSession(currentPositionRef.current);
  }, [cancelPendingPress, finishDragSession]);

  const popupAlignment = useMemo(() => derivePopupAlignment(position), [position]);

  const longPressHandlers = useMemo(() => ({
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerCancel,
  }), [handlePointerCancel, handlePointerDown, handlePointerMove, handlePointerUp]);

  const positionStyles = useMemo<React.CSSProperties>(() => ({
    top: position.y,
    left: position.x,
    right: "auto",
    bottom: "auto",
  }), [position]);

  return {
    position,
    popupAlignment,
    isDragging,
    isLongPressing,
    longPressHandlers,
    positionStyles,
  };
};
