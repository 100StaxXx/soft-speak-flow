import { Star, CheckCircle2, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CalendarMilestone } from "@/hooks/useCalendarMilestones";

interface MilestoneCalendarCardProps {
  milestone: CalendarMilestone;
  compact?: boolean;
  onClick?: () => void;
}

export function MilestoneCalendarCard({ milestone, compact = false, onClick }: MilestoneCalendarCardProps) {
  const isCompleted = !!milestone.completed_at;

  if (compact) {
    return (
      <div
        onClick={onClick}
        className={cn(
          "text-xs p-1 border-l-2 truncate transition-all hover:bg-amber-500/10 cursor-pointer",
          "border-l-amber-500 bg-amber-500/5",
          isCompleted && "opacity-50"
        )}
      >
        <Star className="h-2 w-2 inline mr-1 text-amber-500" />
        {milestone.title}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer",
        "border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-amber-500/5",
        "hover:border-amber-500/50 hover:bg-amber-500/15",
        isCompleted && "opacity-60"
      )}
    >
      <div className={cn(
        "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
        isCompleted 
          ? "bg-emerald-500/20 text-emerald-500" 
          : "bg-amber-500/20 text-amber-500"
      )}>
        {isCompleted ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <Star className="h-4 w-4" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-amber-500 font-medium">
            {milestone.epic_title}
          </span>
          {milestone.phase_name && (
            <span className="text-xs text-muted-foreground">
              • {milestone.phase_name}
            </span>
          )}
        </div>
        <h4 className={cn(
          "font-medium text-sm truncate",
          isCompleted && "line-through text-muted-foreground"
        )}>
          {milestone.title}
        </h4>
        <div className="flex items-center gap-2 mt-1">
          <Target className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {milestone.milestone_percent}% checkpoint
          </span>
        </div>
      </div>
    </div>
  );
}
