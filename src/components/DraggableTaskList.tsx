import { useState, useCallback, ReactNode, useRef } from "react";
import { Reorder, useDragControls, motion } from "framer-motion";
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLongPress } from "@/hooks/useLongPress";

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

export function DraggableTaskList<T extends { id: string }>({
  tasks,
  onReorder,
  renderItem,
  disabled = false,
  onDragStart: onExternalDragStart,
  onDragEnd: onExternalDragEnd,
}: DraggableTaskListProps<T>) {
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const handleDragStart = useCallback((id: string) => {
    setDraggingId(id);
    triggerHaptic(ImpactStyle.Medium);
    onExternalDragStart?.(id);
  }, [onExternalDragStart]);

  const handleDragEnd = useCallback(() => {
    if (draggingId) {
      triggerHaptic(ImpactStyle.Light);
    }
    setDraggingId(null);
    onExternalDragEnd?.();
  }, [draggingId, onExternalDragEnd]);

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
          onDragStart={() => handleDragStart(task.id)}
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
  onDragStart: () => void;
  onDragEnd: () => void;
  renderItem: (task: T, dragHandleProps: DragHandleProps) => ReactNode;
}

function DraggableItem<T extends { id: string }>({
  task,
  isDragging,
  onDragStart,
  onDragEnd,
}: DraggableItemProps<T>) {
  const dragControls = useDragControls();
  const dragHandleRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const [isSettling, setIsSettling] = useState(false);

  const { isPressed, isActivated, handlers } = useLongPress({
    onLongPress: (e) => {
      isDraggingRef.current = true;
      onDragStart();
      // Start drag programmatically using the pointer event
      dragControls.start(e as unknown as PointerEvent);
    },
    threshold: 300,
    moveThreshold: 8,
  });

  const handleDragEnd = async () => {
    isDraggingRef.current = false;
    setIsSettling(true);
    
    // Light haptic on release
    await triggerHaptic(ImpactStyle.Light);
    
    // Clear settling state after animation completes
    setTimeout(() => {
      setIsSettling(false);
    }, 250);
    
    onDragEnd();
  };

  // Determine current visual state
  const getScale = () => {
    if (isDragging) return 1.03;
    if (isSettling) return 1.01;
    if (isPressed) return 0.97;
    if (isActivated) return 1.02;
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

  return (
    <Reorder.Item
      value={task}
      dragListener={false}
      dragControls={dragControls}
      onDragEnd={handleDragEnd}
      drag="y"
      className={cn(
        "relative",
        isDragging && "z-50"
      )}
      style={{
        cursor: isDragging ? 'grabbing' : isActivated ? 'grab' : 'default',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
        touchAction: isDragging ? 'none' : 'auto',
      }}
      initial={false}
      animate={{
        scale: getScale(),
        boxShadow: getBoxShadow(),
        opacity: isPressed && !isDragging ? 0.85 : 1,
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
      {...handlers}
    >
      {arguments[0].renderItem(task, {
        isDragging,
        isPressed,
        isActivated,
        dragHandleRef,
        onDragStart,
        onDragEnd: handleDragEnd,
      })}
      
      {/* Grip indicator */}
      <motion.div 
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1"
        initial={{ opacity: 0, x: 4 }}
        animate={{ 
          opacity: isActivated || isDragging ? 0.7 : 0,
          x: isActivated || isDragging ? 0 : 4,
        }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </motion.div>
    </Reorder.Item>
  );
}
