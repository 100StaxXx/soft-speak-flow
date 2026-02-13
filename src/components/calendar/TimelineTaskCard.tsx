import { format } from "date-fns";
import { useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Check, RotateCcw, Brain, Dumbbell, Heart, Sparkles, Sun } from "lucide-react";
import { CalendarTask } from "@/types/quest";
import { normalizeScheduledTime, parseScheduledTime } from "@/utils/scheduledTime";

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
  default: { icon: Sparkles, bg: "bg-coral-500/20", iconColor: "text-coral-500" },
};

function formatTimeDisplay(time: string): string {
  const parsed = parseScheduledTime(time);
  if (!parsed) return normalizeScheduledTime(time) ?? time;
  const hour = parsed.getHours();
  const formattedTime = format(parsed, "h:mm a");
  
  // Add sun icon indicator for morning times
  if (hour >= 6 && hour < 12) {
    return formattedTime;
  }
  return formattedTime;
}

function getDurationText(durationMinutes: number | null): string {
  if (!durationMinutes) return "";
  if (durationMinutes === 1440) return "All Day";
  if (durationMinutes < 60) return `${durationMinutes} min`;
  const hours = Math.floor(durationMinutes / 60);
  const mins = durationMinutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
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
  const parsedDisplayTime = displayTime ? parseScheduledTime(displayTime) : null;
  const isMorning = !!(parsedDisplayTime && parsedDisplayTime.getHours() < 12);

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
        "flex items-center gap-4 py-3 cursor-pointer transition-all select-none touch-none",
        task.completed && "opacity-50",
        isDragging && "scale-[1.02] z-10"
      )}
    >
      {/* Category Icon Circle */}
      <div className={cn(
        "flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center",
        categoryConfig.bg
      )}>
        <IconComponent className={cn("h-7 w-7", categoryConfig.iconColor)} />
      </div>

      {/* Task Content */}
      <div className="flex-1 min-w-0">
        {/* Time + Duration Row */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-0.5">
          {displayTime && (
            <span className={cn(
              "flex items-center gap-1",
              isDragging && previewTime && "text-coral-500 font-medium"
            )}>
              {isMorning && <Sun className="h-3.5 w-3.5 text-amber-500" />}
              {formatTimeDisplay(displayTime)}
            </span>
          )}
          {task.estimated_duration && (
            <>
              <span className="text-muted-foreground/50">•</span>
              <span>{getDurationText(task.estimated_duration)}</span>
            </>
          )}
          {task.is_main_quest && (
            <RotateCcw className="h-3.5 w-3.5 text-primary" />
          )}
        </div>
        
        {/* Task Title */}
        <p className={cn(
          "font-semibold text-lg text-foreground truncate",
          task.completed && "line-through text-muted-foreground"
        )}>
          {task.task_text}
        </p>
      </div>

      {/* Checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          // Toggle will be handled by parent
        }}
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all",
          task.completed
            ? "bg-coral-500 border-coral-500"
            : "border-coral-500/50 hover:border-coral-500"
        )}
      >
        {task.completed && <Check className="h-5 w-5 text-white" />}
      </button>
    </div>
  );
}
