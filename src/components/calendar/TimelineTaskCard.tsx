import { format } from "date-fns";
import type { PointerEventHandler, TouchEventHandler } from "react";
import { cn } from "@/lib/utils";
import { Check, RotateCcw, Brain, Dumbbell, Heart, Sparkles, Sun, GripVertical } from "lucide-react";
import { CalendarTask } from "@/types/quest";
import { normalizeScheduledTime, parseScheduledTime } from "@/utils/scheduledTime";

interface TimelineTaskCardProps {
  task: CalendarTask;
  onTaskClick?: (task: CalendarTask) => void;
  onTaskLongPress?: (taskId: string) => void;
  isDragging?: boolean;
  previewTime?: string | null;
  dragHandleProps?: {
    onPointerDown?: PointerEventHandler<HTMLElement>;
    onTouchStart?: TouchEventHandler<HTMLElement>;
    onTouchMove?: TouchEventHandler<HTMLElement>;
    onTouchEnd?: TouchEventHandler<HTMLElement>;
    onTouchCancel?: TouchEventHandler<HTMLElement>;
  };
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
  dragHandleProps,
}: TimelineTaskCardProps) {
  const categoryConfig = CATEGORY_CONFIG[task.category || "default"] || CATEGORY_CONFIG.default;
  const IconComponent = categoryConfig.icon;

  const handleClick = () => {
    onTaskClick?.(task);
  };

  const handleLongPress = () => {
    onTaskLongPress?.(task.id);
  };

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
      <div className="flex items-center gap-2">
        {!task.completed && dragHandleProps && (
          <button
            type="button"
            aria-label="Drag to reschedule"
            title="Drag handle to reschedule (15-minute snap, hold for 5-minute precision)"
            className={cn(
              "h-8 w-8 rounded-md flex items-center justify-center touch-none",
              isDragging ? "cursor-grabbing text-primary" : "cursor-grab text-muted-foreground hover:text-foreground"
            )}
            style={{ WebkitTapHighlightColor: "transparent", touchAction: "none" }}
            onClick={(e) => e.stopPropagation()}
            {...dragHandleProps}
          >
            <GripVertical className="w-4 h-4" />
          </button>
        )}

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
    </div>
  );
}
