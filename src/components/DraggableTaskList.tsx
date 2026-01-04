import { useState, useCallback, ReactNode, useRef, useEffect, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAutoscroll } from "@/hooks/useAutoscroll";

interface DraggableTaskListProps<T extends { id: string }> {
  tasks: T[];
  onReorder: (tasks: T[]) => void;
  renderItem: (task: T, dragHandleProps?: DragHandleProps) => ReactNode;
  disabled?: boolean;
  onDragStart?: (taskId: string) => void;
  onDragEnd?: () => void;
}

export interface DragHandleProps {
  isDragging: boolean;
  isPressed: boolean;
  isActivated: boolean;
  dragHandleRef: React.RefObject<HTMLDivElement | null>;
  onDragStart: () => void;
  onDragEnd: () => void;
}

const triggerHaptic = async (style: ImpactStyle) => {
  try {
    await Haptics.impact({ style });
  } catch (e) {
    // Haptics not available on web
  }
};

const ROW_HEIGHT = 56; // Fixed row height for calculations
const LONG_PRESS_DURATION = 500;
const SWAP_THRESHOLD = 0.6; // 60% hysteresis

function DraggableTaskListInner<T extends { id: string }>({
  tasks,
  onReorder,
  renderItem,
  disabled = false,
  onDragStart: onExternalDragStart,
  onDragEnd: onExternalDragEnd,
}: DraggableTaskListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  
  // Drag state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [visualOrder, setVisualOrder] = useState<T[]>(tasks);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [justDroppedId, setJustDroppedId] = useState<string | null>(null);
  
  // Refs for drag tracking (no re-renders)
  const draggingIdRef = useRef<string | null>(null); // Sync ref for closures
  const dragStartYRef = useRef(0);
  const currentYRef = useRef(0);
  const originalIndexRef = useRef(0);
  const currentIndexRef = useRef(0);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressActiveRef = useRef(false);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const visualOrderRef = useRef<T[]>(tasks);
  const lastSwapIndexRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingOffsetRef = useRef({ x: 0, y: 0 });

  // Autoscroll hook
  const { updatePosition: updateAutoscroll, stopScroll } = useAutoscroll({
    containerRef,
    enabled: draggingId !== null,
    edgeThreshold: 80,
    scrollSpeed: 8,
  });

  // Sync visual order with tasks when not dragging
  useEffect(() => {
    if (!draggingId) {
      setVisualOrder(tasks);
      visualOrderRef.current = tasks;
    }
  }, [tasks, draggingId]);

  // Calculate target index - only allow one position swap at a time
  const calculateTargetIndex = useCallback((currentY: number): number => {
    const deltaY = currentY - dragStartYRef.current;
    const threshold = ROW_HEIGHT * SWAP_THRESHOLD;
    
    let targetIndex = currentIndexRef.current;
    
    // Only move one position when threshold exceeded
    if (deltaY > threshold) {
      targetIndex = currentIndexRef.current + 1;
    } else if (deltaY < -threshold) {
      targetIndex = currentIndexRef.current - 1;
    }
    
    // Clamp to valid range
    return Math.max(0, Math.min(targetIndex, visualOrderRef.current.length - 1));
  }, []);
  // Handle pointer move during drag (desktop)
  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!draggingIdRef.current) return;
    
    currentYRef.current = e.clientY;
    
    // Throttle offset updates with RAF
    pendingOffsetRef.current = { x: 0, y: e.clientY - dragStartYRef.current };
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        setDragOffset(pendingOffsetRef.current);
        rafRef.current = null;
      });
    }
    
    updateAutoscroll(e.clientY);
    
    const newIndex = calculateTargetIndex(e.clientY);
    
    if (newIndex !== currentIndexRef.current) {
      triggerHaptic(ImpactStyle.Light);
      
      const newOrder = [...visualOrderRef.current];
      const [removed] = newOrder.splice(currentIndexRef.current, 1);
      newOrder.splice(newIndex, 0, removed);
      
      visualOrderRef.current = newOrder;
      currentIndexRef.current = newIndex;
      lastSwapIndexRef.current = newIndex;
      
      // Reset drag start to current Y so next swap starts fresh
      dragStartYRef.current = currentYRef.current;
      
      setVisualOrder(newOrder);
    }
  }, [calculateTargetIndex, updateAutoscroll]);

  // Handle touch move during drag (iOS compatible)
  const handleTouchMoveWhileDragging = useCallback((e: TouchEvent) => {
    if (!draggingIdRef.current) return;
    
    e.preventDefault();
    
    const touch = e.touches[0];
    if (!touch) return;
    
    currentYRef.current = touch.clientY;
    
    // Throttle offset updates with RAF
    pendingOffsetRef.current = { x: 0, y: touch.clientY - dragStartYRef.current };
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        setDragOffset(pendingOffsetRef.current);
        rafRef.current = null;
      });
    }
    
    updateAutoscroll(touch.clientY);
    
    const newIndex = calculateTargetIndex(touch.clientY);
    
    if (newIndex !== currentIndexRef.current) {
      triggerHaptic(ImpactStyle.Light);
      
      const newOrder = [...visualOrderRef.current];
      const [removed] = newOrder.splice(currentIndexRef.current, 1);
      newOrder.splice(newIndex, 0, removed);
      
      visualOrderRef.current = newOrder;
      currentIndexRef.current = newIndex;
      
      // Reset drag start to current Y so next swap starts fresh
      dragStartYRef.current = currentYRef.current;
      
      setVisualOrder(newOrder);
    }
  }, [calculateTargetIndex, updateAutoscroll]);

  // Cleanup function for all drag listeners
  const cleanupDragListeners = useCallback(() => {
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    window.removeEventListener('pointercancel', handlePointerUp);
    window.removeEventListener('touchmove', handleTouchMoveWhileDragging);
    window.removeEventListener('touchend', handleTouchEndWhileDragging);
    window.removeEventListener('touchcancel', handleTouchEndWhileDragging);
  }, []);

  // Handle touch end during drag (iOS)
  const handleTouchEndWhileDragging = useCallback(() => {
    const droppedId = draggingIdRef.current;
    if (droppedId) { // Use ref for closure
      triggerHaptic(ImpactStyle.Medium);
      onReorder(visualOrderRef.current);
      onExternalDragEnd?.();
      
      // Trigger bounce animation
      setJustDroppedId(droppedId);
      setTimeout(() => setJustDroppedId(null), 300);
    }
    
    draggingIdRef.current = null;
    setDraggingId(null);
    setDragOffset({ x: 0, y: 0 });
    isLongPressActiveRef.current = false;
    lastSwapIndexRef.current = null;
    stopScroll();
    cleanupDragListeners();
  }, [onReorder, onExternalDragEnd, stopScroll, cleanupDragListeners]);

  // Handle pointer up - commit order
  const handlePointerUp = useCallback(() => {
    const droppedId = draggingIdRef.current;
    if (droppedId) { // Use ref for closure
      triggerHaptic(ImpactStyle.Medium);
      
      // Commit final order
      onReorder(visualOrderRef.current);
      onExternalDragEnd?.();
      
      // Trigger bounce animation
      setJustDroppedId(droppedId);
      setTimeout(() => setJustDroppedId(null), 300);
    }
    
    // Cleanup
    draggingIdRef.current = null;
    setDraggingId(null);
    setDragOffset({ x: 0, y: 0 });
    isLongPressActiveRef.current = false;
    lastSwapIndexRef.current = null;
    stopScroll();
    cleanupDragListeners();
  }, [onReorder, onExternalDragEnd, stopScroll, cleanupDragListeners]);

  // Start drag after long press
  const startDrag = useCallback((taskId: string, index: number, startY: number) => {
    // Set ref FIRST (synchronous) for closures
    draggingIdRef.current = taskId;
    setDraggingId(taskId);
    dragStartYRef.current = startY;
    currentYRef.current = startY;
    originalIndexRef.current = index;
    currentIndexRef.current = index;
    visualOrderRef.current = [...tasks];
    setVisualOrder([...tasks]);
    
    triggerHaptic(ImpactStyle.Medium);
    onExternalDragStart?.(taskId);
    
    // Add BOTH pointer (desktop) AND touch (iOS) listeners
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    window.addEventListener('touchmove', handleTouchMoveWhileDragging, { passive: false });
    window.addEventListener('touchend', handleTouchEndWhileDragging);
    window.addEventListener('touchcancel', handleTouchEndWhileDragging);
  }, [tasks, onExternalDragStart, handlePointerMove, handlePointerUp, handleTouchMoveWhileDragging, handleTouchEndWhileDragging]);

  // Long press handlers
  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartPosRef.current = null;
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent, taskId: string, index: number) => {
    if (disabled || draggingId) return;
    
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    
    longPressTimerRef.current = setTimeout(() => {
      isLongPressActiveRef.current = true;
      startDrag(taskId, index, touch.clientY);
    }, LONG_PRESS_DURATION);
  }, [disabled, draggingId, startDrag]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isLongPressActiveRef.current || draggingId) return;
    
    if (!touchStartPosRef.current) return;
    
    const touch = e.touches[0];
    const deltaY = Math.abs(touch.clientY - touchStartPosRef.current.y);
    
    // Cancel long press if user scrolls before it triggers
    if (deltaY > 10) {
      clearLongPress();
    }
  }, [draggingId, clearLongPress]);

  const handleTouchEnd = useCallback(() => {
    clearLongPress();
    isLongPressActiveRef.current = false;
  }, [clearLongPress]);

  // Pointer events for mouse (desktop)
  const handlePointerDown = useCallback((e: React.PointerEvent, taskId: string, index: number) => {
    if (disabled || draggingId || e.pointerType === 'touch') return;
    
    touchStartPosRef.current = { x: e.clientX, y: e.clientY };
    
    longPressTimerRef.current = setTimeout(() => {
      isLongPressActiveRef.current = true;
      startDrag(taskId, index, e.clientY);
    }, LONG_PRESS_DURATION);
  }, [disabled, draggingId, startDrag]);

  // Disabled or single item - no drag
  if (disabled || tasks.length <= 1) {
    return (
      <div className="space-y-0">
        {tasks.map((task) => (
          <div key={task.id}>
            {renderItem(task, {
              isDragging: false,
              isPressed: false,
              isActivated: false,
              dragHandleRef: { current: null },
              onDragStart: () => {},
              onDragEnd: () => {},
            })}
          </div>
        ))}
      </div>
    );
  }

  const isDragging = draggingId !== null;

  return (
    <div ref={containerRef} className="space-y-0 relative">
      {visualOrder.map((task, index) => {
        const isThisDragging = draggingId === task.id;
        const isAnyDragging = isDragging;
        const isJustDropped = justDroppedId === task.id;
        
        return (
          <motion.div
            key={task.id}
            ref={(el) => {
              if (el) itemRefsMap.current.set(task.id, el);
            }}
            className={cn(
              "relative",
              isThisDragging && "z-50"
            )}
            // Bounce animation on drop
            animate={isJustDropped ? {
              scale: [1, 1.02, 0.98, 1],
              y: [0, -2, 1, 0],
            } : {
              scale: 1,
              y: 0,
            }}
            transition={isJustDropped ? {
              duration: 0.25,
              ease: [0.25, 0.1, 0.25, 1],
            } : {
              duration: 0,
            }}
            style={{
              WebkitUserSelect: 'none',
              userSelect: 'none',
              WebkitTouchCallout: 'none',
              touchAction: isThisDragging ? 'none' : 'pan-y',
              pointerEvents: isAnyDragging && !isThisDragging ? 'none' : 'auto',
              // Direct CSS transform for dragged item (instant, no animation lag)
              transform: isThisDragging 
                ? `translateY(${dragOffset.y}px) scale(1.03)` 
                : undefined,
              opacity: isAnyDragging && !isThisDragging ? 0.7 : 1,
              boxShadow: isThisDragging 
                ? "0 15px 30px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -4px rgba(0, 0, 0, 0.15)"
                : "none",
              backgroundColor: isThisDragging ? "hsl(var(--background))" : "transparent",
              borderRadius: isThisDragging ? 12 : 0,
            }}
            // Touch handlers
            onTouchStart={(e) => handleTouchStart(e, task.id, index)}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            // Pointer handlers (mouse)
            onPointerDown={(e) => handlePointerDown(e, task.id, index)}
            onPointerUp={() => {
              if (!isLongPressActiveRef.current) {
                clearLongPress();
              }
            }}
            onPointerCancel={() => {
              clearLongPress();
            }}
          >
            {renderItem(task, {
              isDragging: isThisDragging,
              isPressed: false,
              isActivated: isThisDragging,
              dragHandleRef: { current: null },
              onDragStart: () => startDrag(task.id, index, currentYRef.current),
              onDragEnd: handlePointerUp,
            })}
            
            {/* Grip indicator */}
            <AnimatePresence>
              {isThisDragging && (
                <motion.div 
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1"
                  initial={{ opacity: 0, x: 4 }}
                  animate={{ opacity: 0.7, x: 0 }}
                  exit={{ opacity: 0, x: 4 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}

// Memoized export
export const DraggableTaskList = memo(DraggableTaskListInner) as typeof DraggableTaskListInner;
