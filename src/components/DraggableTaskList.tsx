import { useState, useCallback, ReactNode } from "react";
import { Reorder, useDragControls } from "framer-motion";
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
    // Render without drag functionality
    return (
      <div className="space-y-0">
        {tasks.map((task) => (
          <div key={task.id}>
            {renderItem(task, {
              isDragging: false,
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
  renderItem,
}: DraggableItemProps<T>) {
  const [canDrag, setCanDrag] = useState(false);
  const dragControls = useDragControls();
  const dragHandleRef = { current: null } as React.RefObject<HTMLDivElement | null>;

  const longPressProps = useLongPress({
    onLongPress: () => {
      setCanDrag(true);
      onDragStart();
    },
    threshold: 400,
    moveThreshold: 10,
  });

  const handleDragEnd = () => {
    setCanDrag(false);
    onDragEnd();
  };

  return (
    <Reorder.Item
      value={task}
      dragListener={canDrag}
      dragControls={dragControls}
      onDragEnd={handleDragEnd}
      className={cn(
        "relative transition-transform",
        isDragging && "z-50"
      )}
      style={{
        cursor: canDrag ? 'grabbing' : 'default',
      }}
      whileDrag={{
        scale: 1.02,
        boxShadow: "0 8px 20px -4px rgba(0, 0, 0, 0.3)",
        backgroundColor: "hsl(var(--background))",
        borderRadius: "12px",
      }}
      {...longPressProps}
    >
      {renderItem(task, {
        isDragging,
        dragHandleRef,
        onDragStart,
        onDragEnd: handleDragEnd,
      })}
      
      {/* Grip indicator that appears during drag */}
      {isDragging && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 opacity-60">
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
    </Reorder.Item>
  );
}
