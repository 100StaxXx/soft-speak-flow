import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useDragControls, type DragControls, type PanInfo } from "framer-motion";
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

const LONG_PRESS_DURATION = 500;
const LONG_PRESS_MOVE_THRESHOLD_PX = 12;
const FALLBACK_ROOT_FONT_SIZE_PX = 16;
const DEFAULT_BOTTOM_NAV_SAFE_OFFSET_REM = 6.5;
const FLOATING_HERO_SIZE_PX = 144;

interface FABViewportBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface UseDraggableFABOptions {
  defaultPosition?: FABCoordinates;
  onDragStart?: () => void;
  onDragEnd?: (position: FABCoordinates) => void;
}

interface UseDraggableFABReturn {
  position: FABCoordinates;
  popupAlignment: FABPopupAlignment;
  isDragging: boolean;
  isLongPressing: boolean;
  drag: true;
  dragControls: DragControls;
  dragListener: false;
  dragConstraints: { top: number; left: number; right: number; bottom: number };
  dragElastic: number;
  dragMomentum: boolean;
  onDragStart: () => void;
  onDragEnd: (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => void;
  longPressHandlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
  };
  positionStyles: React.CSSProperties;
  dragOffset: { x: number; y: number };
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

const areSamePosition = (left: FABCoordinates, right: FABCoordinates) =>
  left.x === right.x && left.y === right.y;

const areSameBounds = (left: FABViewportBounds, right: FABViewportBounds) =>
  left.minX === right.minX
  && left.maxX === right.maxX
  && left.minY === right.minY
  && left.maxY === right.maxY;

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

const migrateLegacyCornerPosition = (value: string | null, bounds: FABViewportBounds): FABCoordinates | null => {
  switch (value) {
    case "top-left":
      return { x: bounds.minX, y: bounds.minY };
    case "top-right":
      return { x: bounds.maxX, y: bounds.minY };
    case "bottom-left":
      return { x: bounds.minX, y: bounds.maxY };
    case "bottom-right":
      return { x: bounds.maxX, y: bounds.maxY };
    default:
      return null;
  }
};

const getInitialPosition = (bounds: FABViewportBounds, fallback?: FABCoordinates) => {
  const storedPosition = parseStoredPosition(safeLocalStorage.getItem(DRAGGABLE_FAB_STORAGE_KEY_V2));
  if (storedPosition) {
    return clampPositionToBounds(storedPosition, bounds);
  }

  const migratedPosition = migrateLegacyCornerPosition(
    safeLocalStorage.getItem(DRAGGABLE_FAB_LEGACY_STORAGE_KEY),
    bounds,
  );
  if (migratedPosition) {
    return migratedPosition;
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
  onDragStart,
  onDragEnd,
}: UseDraggableFABOptions = {}): UseDraggableFABReturn => {
  const dragControls = useDragControls();
  const [bounds, setBounds] = useState<FABViewportBounds>(() => getViewportBounds());
  const [position, setPosition] = useState<FABCoordinates>(() => getInitialPosition(getViewportBounds(), defaultPosition));
  const [isDragging, setIsDragging] = useState(false);
  const [isLongPressing, setIsLongPressing] = useState(false);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartPositionRef = useRef<FABCoordinates>(position);
  const currentPositionRef = useRef(position);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const pointerEventRef = useRef<PointerEvent | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const targetElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    dragStartPositionRef.current = position;
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
    safeLocalStorage.setItem(DRAGGABLE_FAB_STORAGE_KEY_V2, JSON.stringify(position));
  }, [position]);

  useEffect(() => {
    const handleViewportChange = () => {
      const nextBounds = getViewportBounds();
      setBounds((currentBounds) => areSameBounds(currentBounds, nextBounds) ? currentBounds : nextBounds);
      setPosition((currentPosition) => {
        const nextPosition = clampPositionToBounds(currentPosition, nextBounds);
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
    pointerEventRef.current = null;
    pointerIdRef.current = null;
    targetElementRef.current = null;
  }, [releasePointerCapture]);

  const cancelLongPress = useCallback(() => {
    clearLongPressTimer();
    if (!isDragging) {
      setIsLongPressing(false);
    }
    resetPointerState();
  }, [clearLongPressTimer, isDragging, resetPointerState]);

  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    event.preventDefault();
    clearLongPressTimer();
    setIsLongPressing(false);

    pointerStartRef.current = {
      x: event.clientX,
      y: event.clientY,
    };
    pointerEventRef.current = event.nativeEvent;
    pointerIdRef.current = event.pointerId;
    targetElementRef.current = event.currentTarget as HTMLElement;

    try {
      targetElementRef.current.setPointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture is optional in this environment.
    }

    longPressTimerRef.current = setTimeout(() => {
      const activePointerEvent = pointerEventRef.current;
      if (!activePointerEvent) {
        return;
      }

      dragStartPositionRef.current = currentPositionRef.current;
      setIsLongPressing(true);
      releasePointerCapture();
      dragControls.start(activePointerEvent, { snapToCursor: false });
      void triggerHaptic(ImpactStyle.Medium);
    }, LONG_PRESS_DURATION);
  }, [clearLongPressTimer, dragControls, releasePointerCapture]);

  const handlePointerMove = useCallback((event: React.PointerEvent) => {
    if (isDragging || isLongPressing || !pointerStartRef.current || !longPressTimerRef.current) {
      return;
    }

    pointerEventRef.current = event.nativeEvent;

    const deltaX = event.clientX - pointerStartRef.current.x;
    const deltaY = event.clientY - pointerStartRef.current.y;
    if (Math.hypot(deltaX, deltaY) > LONG_PRESS_MOVE_THRESHOLD_PX) {
      cancelLongPress();
    }
  }, [cancelLongPress, isDragging, isLongPressing]);

  const handlePointerUp = useCallback(() => {
    cancelLongPress();
  }, [cancelLongPress]);

  const handlePointerCancel = useCallback(() => {
    cancelLongPress();
  }, [cancelLongPress]);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
    onDragStart?.();
  }, [onDragStart]);

  const handleDragEnd = useCallback((
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    if (!isDragging) {
      setIsLongPressing(false);
      return;
    }

    const nextPosition = clampPositionToBounds({
      x: dragStartPositionRef.current.x + info.offset.x,
      y: dragStartPositionRef.current.y + info.offset.y,
    }, getViewportBounds());

    setPosition(nextPosition);
    setIsDragging(false);
    setIsLongPressing(false);
    resetPointerState();

    void triggerHaptic(ImpactStyle.Light);
    onDragEnd?.(nextPosition);
  }, [isDragging, onDragEnd, resetPointerState]);

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
    drag: true,
    dragControls,
    dragListener: false,
    dragConstraints: {
      top: bounds.minY - position.y,
      left: bounds.minX - position.x,
      right: bounds.maxX - position.x,
      bottom: bounds.maxY - position.y,
    },
    dragElastic: 0.08,
    dragMomentum: false,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    longPressHandlers,
    positionStyles,
    dragOffset: { x: 0, y: 0 },
  };
};
