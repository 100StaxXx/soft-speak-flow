import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { PanInfo } from 'framer-motion';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import { safeLocalStorage } from '@/utils/storage';

export type FABPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const STORAGE_KEY = 'add-quest-fab-position';
const LONG_PRESS_DURATION = 500;

// Position styles for each corner
const POSITION_STYLES: Record<FABPosition, React.CSSProperties> = {
  'top-left': { 
    top: 'calc(env(safe-area-inset-top, 0px) + 80px)', 
    left: '16px',
    bottom: 'auto',
    right: 'auto'
  },
  'top-right': { 
    top: 'calc(env(safe-area-inset-top, 0px) + 80px)', 
    right: '16px',
    bottom: 'auto',
    left: 'auto'
  },
  'bottom-left': { 
    bottom: '144px', 
    left: '16px',
    top: 'auto',
    right: 'auto'
  },
  'bottom-right': { 
    bottom: '144px', 
    right: '16px',
    top: 'auto',
    left: 'auto'
  },
};

interface UseDraggableFABOptions {
  defaultPosition?: FABPosition;
  onDragStart?: () => void;
  onDragEnd?: (position: FABPosition) => void;
}

interface UseDraggableFABReturn {
  position: FABPosition;
  isDragging: boolean;
  isLongPressing: boolean;
  dragControls: {
    drag: boolean | 'x' | 'y';
    dragConstraints: { top: number; left: number; right: number; bottom: number };
    dragElastic: number;
    dragMomentum: boolean;
    onDragStart: () => void;
    onDragEnd: (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => void;
  };
  longPressHandlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
  };
  positionStyles: React.CSSProperties;
  dragOffset: { x: number; y: number };
}

const triggerHaptic = async (style: ImpactStyle = ImpactStyle.Medium) => {
  if (Capacitor.isNativePlatform()) {
    try {
      await Haptics.impact({ style });
    } catch {
      // Haptics not available
    }
  }
};

const calculateNearestCorner = (x: number, y: number): FABPosition => {
  const midX = window.innerWidth / 2;
  const midY = window.innerHeight / 2;
  
  if (y < midY && x < midX) return 'top-left';
  if (y < midY) return 'top-right';
  if (x < midX) return 'bottom-left';
  return 'bottom-right';
};

export const useDraggableFAB = ({
  defaultPosition = 'bottom-right',
  onDragStart,
  onDragEnd,
}: UseDraggableFABOptions = {}): UseDraggableFABReturn => {
  // Load saved position from localStorage
  const [position, setPosition] = useState<FABPosition>(() => {
    const saved = safeLocalStorage.getItem(STORAGE_KEY);
    if (saved && ['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(saved)) {
      return saved as FABPosition;
    }
    return defaultPosition;
  });
  
  const [isDragging, setIsDragging] = useState(false);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const buttonRef = useRef<{ x: number; y: number } | null>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  // Save position to localStorage when it changes
  useEffect(() => {
    safeLocalStorage.setItem(STORAGE_KEY, position);
  }, [position]);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Store initial button position for drag calculation
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    buttonRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };

    longPressTimerRef.current = setTimeout(() => {
      setIsLongPressing(true);
      triggerHaptic(ImpactStyle.Medium);
    }, LONG_PRESS_DURATION);
  }, []);

  const handlePointerUp = useCallback(() => {
    clearLongPressTimer();
    if (!isDragging) {
      setIsLongPressing(false);
    }
  }, [clearLongPressTimer, isDragging]);

  const handlePointerCancel = useCallback(() => {
    clearLongPressTimer();
    setIsLongPressing(false);
  }, [clearLongPressTimer]);

  const handleDragStart = useCallback(() => {
    if (!isLongPressing) return;
    setIsDragging(true);
    onDragStart?.();
  }, [isLongPressing, onDragStart]);

  const handleDragEnd = useCallback((
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    if (!isDragging) {
      setIsLongPressing(false);
      return;
    }
    
    // Calculate final position based on where button was dropped
    const finalX = (buttonRef.current?.x || window.innerWidth / 2) + info.offset.x;
    const finalY = (buttonRef.current?.y || window.innerHeight / 2) + info.offset.y;
    
    const newPosition = calculateNearestCorner(finalX, finalY);
    
    setPosition(newPosition);
    setIsDragging(false);
    setIsLongPressing(false);
    setDragOffset({ x: 0, y: 0 });
    
    triggerHaptic(ImpactStyle.Light);
    onDragEnd?.(newPosition);
  }, [isDragging, onDragEnd]);

  const positionStyles = useMemo(() => POSITION_STYLES[position], [position]);

  const dragControls = useMemo(() => ({
    drag: isLongPressing as boolean | 'x' | 'y',
    dragConstraints: { top: -500, left: -500, right: 500, bottom: 500 },
    dragElastic: 0.1,
    dragMomentum: false,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
  }), [isLongPressing, handleDragStart, handleDragEnd]);

  const longPressHandlers = useMemo(() => ({
    onPointerDown: handlePointerDown,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerCancel,
  }), [handlePointerDown, handlePointerUp, handlePointerCancel]);

  return {
    position,
    isDragging,
    isLongPressing,
    dragControls,
    longPressHandlers,
    positionStyles,
    dragOffset,
  };
};
