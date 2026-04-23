import { format } from "date-fns";
import type { PointerEventHandler, TouchEventHandler } from "react";
import type { DisplayQuest } from "@/features/quests/display";
import { cn } from "@/lib/utils";
import { Check, RotateCcw, Brain, Dumbbell, Heart, Sparkles, Sun } from "lucide-react";
import { normalizeScheduledTime, parseScheduledTime } from "@/utils/scheduledTime";

interface TimelineTaskCardProps {
  quest: DisplayQuest;
  onQuestClick?: () => void;
  onQuestLongPress?: (questId: string) => void;
  isDragging?: boolean;
  previewTime?: string | null;
  rowDragProps?: {
    onPointerDownCapture?: PointerEventHandler<HTMLElement>;
    onPointerDown?: PointerEventHandler<HTMLElement>;
    onTouchStartCapture?: TouchEventHandler<HTMLElement>;
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
  quest,
  onQuestClick,
  onQuestLongPress,
  isDragging,
  previewTime,
  rowDragProps,
}: TimelineTaskCardProps) {
  const categoryConfig = CATEGORY_CONFIG[quest.category || "default"] || CATEGORY_CONFIG.default;
  const IconComponent = categoryConfig.icon;

  const handleClick = () => {
    onQuestClick?.();
  };

  const handleLongPress = () => {
    onQuestLongPress?.(quest.id);
  };

  // Display time (show preview if dragging)
  const displayTime = previewTime || quest.scheduledTime;
  const parsedDisplayTime = displayTime ? parseScheduledTime(displayTime) : null;
  const isMorning = !!(parsedDisplayTime && parsedDisplayTime.getHours() < 12);

  return (
    <div
      {...(rowDragProps ?? {})}
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        handleLongPress();
      }}
      className={cn(
        "flex items-center gap-4 py-3 cursor-pointer transition-all select-none",
        quest.completed && "opacity-50",
        isDragging && "scale-[1.02] z-10"
      )}
      style={{ touchAction: isDragging ? "none" : "pan-y" }}
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
          {quest.estimatedDuration && (
            <>
              <span className="text-muted-foreground/50">•</span>
              <span>{getDurationText(quest.estimatedDuration)}</span>
            </>
          )}
          {quest.isMainQuest && (
            <RotateCcw className="h-3.5 w-3.5 text-primary" />
          )}
        </div>
        
        {/* Task Title */}
        <p className={cn(
          "font-semibold text-lg text-foreground truncate",
          quest.completed && "line-through text-muted-foreground"
        )}>
          {quest.title}
        </p>
      </div>

      {/* Checkbox */}
      <div className="flex items-center gap-2">
        <button
          data-interactive="true"
          onClick={(e) => {
            e.stopPropagation();
            // Toggle will be handled by parent
          }}
          className={cn(
            "flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all",
            quest.completed
              ? "bg-coral-500 border-coral-500"
              : "border-coral-500/50 hover:border-coral-500"
          )}
        >
          {quest.completed && <Check className="h-5 w-5 text-white" />}
        </button>
      </div>
    </div>
  );
}
