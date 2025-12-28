import { Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface FocusTaskCardProps {
  id: string;
  text: string;
  completed: boolean;
  scheduledTime?: string | null;
  estimatedDuration?: number | null;
  onToggle: (id: string, completed: boolean) => void;
  onEdit?: () => void;
}

export function FocusTaskCard({
  id,
  text,
  completed,
  scheduledTime,
  estimatedDuration,
  onToggle,
  onEdit,
}: FocusTaskCardProps) {
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours, 10);
    const suffix = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${suffix}`;
  };

  return (
    <div
      className={cn(
        "group flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer",
        "bg-card hover:bg-muted/50",
        completed 
          ? "border-border/30 opacity-60" 
          : "border-border"
      )}
      onClick={onEdit}
    >
      {/* Checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle(id, !completed);
        }}
        className={cn(
          "flex-shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center transition-all",
          completed
            ? "bg-primary border-primary text-primary-foreground"
            : "border-muted-foreground/40 hover:border-primary"
        )}
      >
        {completed && <Check className="h-3 w-3" />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-medium truncate",
          completed && "line-through text-muted-foreground"
        )}>
          {text}
        </p>
      </div>

      {/* Time info */}
      {(scheduledTime || estimatedDuration) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {scheduledTime && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTime(scheduledTime)}
            </span>
          )}
          {estimatedDuration && (
            <span className="bg-muted px-1.5 py-0.5 rounded">
              {estimatedDuration}m
            </span>
          )}
        </div>
      )}
    </div>
  );
}
