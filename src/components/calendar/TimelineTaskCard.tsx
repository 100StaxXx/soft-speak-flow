import { format, parse } from "date-fns";
import { useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Check, RotateCcw, Brain, Dumbbell, Heart, Sparkles, GripVertical } from "lucide-react";
import { CalendarTask } from "@/types/quest";

interface TimelineTaskCardProps {
  task: CalendarTask;
  onTaskClick?: (task: CalendarTask) => void;
  onTaskLongPress?: (taskId: string) => void;
  isDragging?: boolean;
  previewTime?: string | null;
  onDragStart?: () => void;
  onDragMove?: (deltaY: number) => void;
  onDragEnd?: () => void;
}

const CATEGORY_CONFIG: Record<string, { icon: typeof Brain; bg: string; iconColor: string }> = {
  mind: { icon: Brain, bg: "bg-violet-500/20", iconColor: "text-violet-500" },
  body: { icon: Dumbbell, bg: "bg-coral-500/20", iconColor: "text-coral-500" },
  soul: { icon: Heart, bg: "bg-pink-400/20", iconColor: "text-pink-400" },
  default: { icon: Sparkles, bg: "bg-muted", iconColor: "text-muted-foreground" },
};

function formatTimeRange(startTime: string, durationMinutes: number | null): string {
  const start = parse(startTime, "HH:mm", new Date());
  const formattedStart = format(start, "h:mm");
  
  if (!durationMinutes) {
    return `${formattedStart} ${format(start, "a")}`;
  }
  
  const end = new Date(start.getTime() + durationMinutes * 60000);
  const formattedEnd = format(end, "h:mm a");
  
  return `${formattedStart} – ${formattedEnd} (${durationMinutes} min)`;
}

export function TimelineTaskCard({ 
  task, 
  onTaskClick, 
  onTaskLongPress,
  isDragging,
  previewTime,
  onDragStart,
  onDragMove,
  onDragEnd,
}: TimelineTaskCardProps) {
  const categoryConfig = CATEGORY_CONFIG[task.category || "default"] || CATEGORY_CONFIG.default;
  const IconComponent = categoryConfig.icon;
  
  // Drag tracking refs
  const startYRef = useRef<number>(0);
  const isDraggingRef = useRef(false);

  const handleClick = () => {
    if (!isDraggingRef.current) {
      onTaskClick?.(task);
    }
  };

  const handleLongPress = () => {
    onTaskLongPress?.(task.id);
  };

  // Touch/pointer event handlers for drag
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (task.completed || !onDragStart) return;
    
    // Only start drag from the grip handle area (check target)
    const target = e.target as HTMLElement;
    if (!target.closest('[data-drag-handle]')) return;
    
    e.preventDefault();
    startYRef.current = e.clientY;
    isDraggingRef.current = false;
    
    const element = e.currentTarget as HTMLElement;
    element.setPointerCapture(e.pointerId);
  }, [task.completed, onDragStart]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!startYRef.current || !onDragMove) return;
    
    const deltaY = e.clientY - startYRef.current;
    
    // Start drag after 5px threshold
    if (!isDraggingRef.current && Math.abs(deltaY) > 5) {
      isDraggingRef.current = true;
      onDragStart?.();
    }
    
    if (isDraggingRef.current) {
      onDragMove(deltaY);
    }
  }, [onDragStart, onDragMove]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const element = e.currentTarget as HTMLElement;
    element.releasePointerCapture(e.pointerId);
    
    if (isDraggingRef.current) {
      onDragEnd?.();
    }
    
    startYRef.current = 0;
    // Reset dragging state after a tick to prevent click firing
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 10);
  }, [onDragEnd]);

  // Display time (show preview if dragging)
  const displayTime = previewTime || task.scheduled_time;

  return (
    <div
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        handleLongPress();
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={cn(
        "flex items-center gap-3 py-3 cursor-pointer transition-all select-none",
        task.completed && "opacity-60",
        isDragging && "cosmiq-glass-subtle shadow-lg rounded-xl scale-[1.02] ring-2 ring-primary/30"
      )}
    >
      {/* Drag Handle + Time Marker */}
      <div className="w-12 flex items-center gap-1">
        {!task.completed && onDragStart && (
          <div 
            data-drag-handle
            className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical className="h-4 w-4" />
          </div>
        )}
        <span className={cn(
          "text-sm font-medium text-muted-foreground flex-1 text-right",
          isDragging && previewTime && "text-primary font-semibold"
        )}>
          {displayTime ? format(parse(displayTime, "HH:mm", new Date()), "h:mm") : ""}
        </span>
      </div>

      {/* Category Icon Circle */}
      <div className={cn(
        "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
        categoryConfig.bg
      )}>
        <IconComponent className={cn("h-5 w-5", categoryConfig.iconColor)} />
      </div>

      {/* Task Content */}
      <div className="flex-1 min-w-0">
        {/* Task Title */}
        <p className={cn(
          "text-lg font-medium text-foreground truncate leading-tight",
          task.completed && "line-through text-muted-foreground"
        )}>
          {task.task_text}
        </p>
        
        {/* Time Range */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
          <span className={cn(isDragging && previewTime && "text-primary")}>
            {displayTime && formatTimeRange(displayTime, task.estimated_duration)}
          </span>
          {task.is_main_quest && (
            <RotateCcw className="h-3.5 w-3.5" />
          )}
        </div>
      </div>

      {/* Checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          // Toggle will be handled by parent
        }}
        className={cn(
          "flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all",
          task.completed
            ? "bg-green-500 border-green-500"
            : "border-muted-foreground/40 hover:border-green-500"
        )}
      >
        {task.completed && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
      </button>
    </div>
  );
}
