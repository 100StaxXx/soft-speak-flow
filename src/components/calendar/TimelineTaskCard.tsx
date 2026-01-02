import { format, parse } from "date-fns";
import { cn } from "@/lib/utils";
import { Check, RotateCcw, Brain, Dumbbell, Heart, Sparkles } from "lucide-react";
import { CalendarTask } from "@/types/quest";

interface TimelineTaskCardProps {
  task: CalendarTask;
  onTaskClick?: (task: CalendarTask) => void;
  onTaskLongPress?: (taskId: string) => void;
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

export function TimelineTaskCard({ task, onTaskClick, onTaskLongPress }: TimelineTaskCardProps) {
  const categoryConfig = CATEGORY_CONFIG[task.category || "default"] || CATEGORY_CONFIG.default;
  const IconComponent = categoryConfig.icon;

  const handleClick = () => {
    onTaskClick?.(task);
  };

  const handleLongPress = () => {
    onTaskLongPress?.(task.id);
  };

  return (
    <div
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        handleLongPress();
      }}
      className={cn(
        "flex items-center gap-3 py-3 cursor-pointer transition-all active:scale-[0.98]",
        task.completed && "opacity-60"
      )}
    >
      {/* Time Marker */}
      <div className="w-12 text-right">
        <span className="text-sm font-medium text-muted-foreground">
          {task.scheduled_time ? format(parse(task.scheduled_time, "HH:mm", new Date()), "h:mm") : ""}
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
        {/* Time Range */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
          <span>
            {task.scheduled_time && formatTimeRange(task.scheduled_time, task.estimated_duration)}
          </span>
          {task.is_main_quest && (
            <RotateCcw className="h-3 w-3" />
          )}
        </div>
        
        {/* Task Title */}
        <p className={cn(
          "font-medium text-foreground truncate",
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
          "flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all",
          task.completed
            ? "bg-primary border-primary"
            : "border-muted-foreground/40 hover:border-primary"
        )}
      >
        {task.completed && <Check className="h-4 w-4 text-primary-foreground" />}
      </button>
    </div>
  );
}
