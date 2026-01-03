import { useState, useCallback, ReactNode, useRef } from "react";
import { Reorder, motion } from "framer-motion";
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTaskDragOptional } from "@/contexts/TaskDragContext";

interface DraggableTaskListProps<T extends { id: string; task_text?: string; xp_reward?: number; task_date?: string }> {
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

export function DraggableTaskList<T extends { id: string; task_text?: string; xp_reward?: number; task_date?: string }>({
  tasks,
  onReorder,
  renderItem,
  disabled = false,
  onDragStart: onExternalDragStart,
  onDragEnd: onExternalDragEnd,
}: DraggableTaskListProps<T>) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragContext = useTaskDragOptional();

  const handleDragStart = useCallback((id: string, task: T) => {
    setDraggingId(id);
    triggerHaptic(ImpactStyle.Medium);
    onExternalDragStart?.(id);
    
    // Broadcast to global drag context for cross-day dragging
    if (dragContext && task.task_text && task.xp_reward !== undefined && task.task_date) {
      dragContext.startDrag({
        id: task.id,
        task_text: task.task_text,
        xp_reward: task.xp_reward,
        task_date: task.task_date,
      });
    }
  }, [onExternalDragStart, dragContext]);

  const handleDragEnd = useCallback(() => {
    if (draggingId) {
      triggerHaptic(ImpactStyle.Light);
    }
    setDraggingId(null);
    onExternalDragEnd?.();
    
    // End global drag
    dragContext?.endDrag();
  }, [draggingId, onExternalDragEnd, dragContext]);

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

  const isAnyDragging = draggingId !== null;

  return (
    <Reorder.Group
      axis="y"
      values={tasks}
      onReorder={onReorder}
      className="space-y-0"
    >
      {tasks.map((task) => (
        <DraggableItem
          key={task.id}
          task={task}
          isDragging={draggingId === task.id}
          isAnyDragging={isAnyDragging}
          onDragStart={() => handleDragStart(task.id, task)}
          onDragEnd={handleDragEnd}
          renderItem={renderItem}
        />
      ))}
    </Reorder.Group>
  );
}

interface DraggableItemProps<T extends { id: string }> {
  task: T;
  isDragging: boolean;
  isAnyDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  renderItem: (task: T, dragHandleProps: DragHandleProps) => ReactNode;
}

function DraggableItem<T extends { id: string }>({
  task,
  isDragging,
  isAnyDragging,
  onDragStart,
  onDragEnd,
  renderItem,
}: DraggableItemProps<T>) {
  const dragHandleRef = useRef<HTMLDivElement | null>(null);
  const [isSettling, setIsSettling] = useState(false);
  const [isLongPressActive, setIsLongPressActive] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  // Clear long press timer
  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartPosRef.current = null;
  }, []);

  // Handle touch start - start long press timer
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isDragging || isAnyDragging) return;
    
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    
    longPressTimerRef.current = setTimeout(async () => {
      setIsLongPressActive(true);
      try {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } catch {}
      onDragStart();
    }, 300);
  }, [isDragging, isAnyDragging, onDragStart]);

  // Handle touch move - cancel if moved too much before long press
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isLongPressActive || isDragging) return; // Let framer-motion handle it during drag
    
    if (!touchStartPosRef.current) return;
    
    const touch = e.touches[0];
    const deltaY = Math.abs(touch.clientY - touchStartPosRef.current.y);
    
    // Cancel long press if user scrolls
    if (deltaY > 10) {
      clearLongPress();
    }
  }, [isLongPressActive, isDragging, clearLongPress]);

  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    clearLongPress();
    if (!isDragging) {
      setIsLongPressActive(false);
    }
  }, [clearLongPress, isDragging]);

  const handleDragEnd = async () => {
    setIsSettling(true);
    setIsLongPressActive(false);
    clearLongPress();
    
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {}
    
    setTimeout(() => {
      setIsSettling(false);
    }, 250);
    
    onDragEnd();
  };

  // Determine current visual state
  const getScale = () => {
    if (isDragging) return 1.03;
    if (isSettling) return 1.01;
    if (isLongPressActive && !isDragging) return 0.97;
    return 1;
  };

  const getBoxShadow = () => {
    if (isDragging) {
      return "0 15px 30px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -4px rgba(0, 0, 0, 0.15)";
    }
    if (isSettling) {
      return "0 5px 15px -3px rgba(0, 0, 0, 0.15), 0 3px 6px -2px rgba(0, 0, 0, 0.1)";
    }
    return "none";
  };

  const shouldBlockPointerEvents = isAnyDragging && !isDragging;

  return (
    <Reorder.Item
      value={task}
      // KEY FIX: Use native dragListener when long press is active
      // This lets framer-motion handle touch events natively on iOS
      dragListener={isLongPressActive}
      onDragStart={() => {
        onDragStart();
      }}
      onDragEnd={handleDragEnd}
      drag="y"
      className={cn(
        "relative",
        isDragging && "z-50"
      )}
      style={{
        cursor: isDragging ? 'grabbing' : isLongPressActive ? 'grab' : 'default',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
        touchAction: isLongPressActive || isDragging ? 'none' : 'pan-y',
        pointerEvents: shouldBlockPointerEvents ? 'none' : 'auto',
      }}
      initial={false}
      animate={{
        scale: getScale(),
        boxShadow: getBoxShadow(),
        opacity: shouldBlockPointerEvents ? 0.6 : 1,
        backgroundColor: isDragging || isSettling ? "hsl(var(--background))" : "transparent",
        borderRadius: isDragging || isSettling ? 12 : 0,
      }}
      transition={{
        scale: { type: "spring", stiffness: 300, damping: 22 },
        boxShadow: { duration: 0.2, ease: "easeOut" },
        opacity: { duration: 0.15 },
        backgroundColor: { duration: 0.2 },
        borderRadius: { duration: 0.2 },
      }}
      // Native touch handlers for long-press detection only
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {renderItem(task, {
        isDragging,
        isPressed: isLongPressActive && !isDragging,
        isActivated: isLongPressActive,
        dragHandleRef,
        onDragStart,
        onDragEnd: handleDragEnd,
      })}
      
      {/* Grip indicator */}
      <motion.div 
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1"
        initial={{ opacity: 0, x: 4 }}
        animate={{ 
          opacity: isLongPressActive || isDragging ? 0.7 : 0,
          x: isLongPressActive || isDragging ? 0 : 4,
        }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </motion.div>
    </Reorder.Item>
  );
}
