import { useMemo } from "react";
import { format, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { Clock, Plus } from "lucide-react";
import { CalendarTask, CalendarMilestone } from "@/types/quest";
import { WeekStrip } from "./WeekStrip";
import { TimelineTaskCard } from "./TimelineTaskCard";
import { TimelinePill } from "./TimelinePill";
import { MilestoneCalendarCard } from "../MilestoneCalendarCard";
import { Button } from "../ui/button";

interface TimelineViewProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  tasks: CalendarTask[];
  milestones?: CalendarMilestone[];
  onTaskClick?: (task: CalendarTask) => void;
  onTaskLongPress?: (taskId: string) => void;
  onTimeSlotLongPress?: (date: Date, time: string) => void;
  onMilestoneClick?: (milestone: CalendarMilestone) => void;
  onAddClick?: () => void;
}

export function TimelineView({
  selectedDate,
  onDateSelect,
  tasks,
  milestones = [],
  onTaskClick,
  onTaskLongPress,
  onTimeSlotLongPress,
  onMilestoneClick,
  onAddClick,
}: TimelineViewProps) {
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const isToday = isSameDay(selectedDate, new Date());

  // Filter and sort tasks for the selected day
  const dayTasks = useMemo(() => {
    return tasks
      .filter((t) => t.task_date === dateStr)
      .sort((a, b) => {
        // Scheduled tasks first, sorted by time
        if (a.scheduled_time && b.scheduled_time) {
          return a.scheduled_time.localeCompare(b.scheduled_time);
        }
        if (a.scheduled_time) return -1;
        if (b.scheduled_time) return 1;
        return 0;
      });
  }, [tasks, dateStr]);

  const scheduledTasks = dayTasks.filter((t) => t.scheduled_time && !t.completed);
  const unscheduledTasks = dayTasks.filter((t) => !t.scheduled_time && !t.completed);
  const completedTasks = dayTasks.filter((t) => t.completed);
  const dayMilestones = milestones.filter((m) => m.target_date === dateStr);

  // Stats
  const completedCount = completedTasks.length;
  const totalCount = dayTasks.length;
  const totalXP = dayTasks.reduce((sum, t) => sum + (t.completed ? t.xp_reward : 0), 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header with Week Strip */}
      <div className="px-4 pt-2 pb-4 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <WeekStrip selectedDate={selectedDate} onDateSelect={onDateSelect} />
        
        {/* Stats Row */}
        {totalCount > 0 && (
          <div className="flex items-center gap-2 mt-3 text-xs">
            <span className="rounded-full bg-muted px-3 py-1 font-medium">
              {completedCount}/{totalCount} done
            </span>
            {totalXP > 0 && (
              <span className="rounded-full bg-stardust-gold/15 px-3 py-1 font-medium text-stardust-gold">
                +{totalXP} XP
              </span>
            )}
          </div>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4">
        {/* Milestones */}
        {dayMilestones.length > 0 && (
          <div className="py-4 border-b border-border/30">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Goals for Today
            </h3>
            <div className="space-y-2">
              {dayMilestones.map((milestone) => (
                <MilestoneCalendarCard
                  key={milestone.id}
                  milestone={milestone}
                  onClick={() => onMilestoneClick?.(milestone)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Scheduled Tasks Timeline */}
        {scheduledTasks.length > 0 && (
          <div className="py-4">
            {scheduledTasks.map((task, index) => (
              <div key={task.id} className="relative">
                {/* Timeline Pill Connector */}
                {index < scheduledTasks.length - 1 && (
                  <div className="absolute left-[4.25rem] top-14 z-0">
                    <TimelinePill
                      duration={task.estimated_duration || 30}
                      category={task.category}
                      isCompleted={task.completed}
                    />
                  </div>
                )}
                
                <TimelineTaskCard
                  task={task}
                  onTaskClick={onTaskClick}
                  onTaskLongPress={onTaskLongPress}
                />
              </div>
            ))}
          </div>
        )}

        {/* Unscheduled / Anytime Tasks */}
        {unscheduledTasks.length > 0 && (
          <div className="py-4 border-t border-dashed border-border/50">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
              <Clock className="h-3.5 w-3.5" />
              Anytime
            </div>
            <div className="space-y-1">
              {unscheduledTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => onTaskClick?.(task)}
                  className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/40" />
                  <span className="font-medium text-foreground text-sm truncate">
                    {task.task_text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed Tasks */}
        {completedTasks.length > 0 && (
          <div className="py-4 border-t border-border/30">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Completed ({completedTasks.length})
            </h3>
            <div className="space-y-1 opacity-60">
              {completedTasks.map((task) => (
                <TimelineTaskCard
                  key={task.id}
                  task={task}
                  onTaskClick={onTaskClick}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {dayTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <Plus className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">No quests yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {isToday ? "Start your day by adding a quest" : "Add quests for this day"}
            </p>
            {onAddClick && (
              <Button onClick={onAddClick} size="sm">
                Add Quest
              </Button>
            )}
          </div>
        )}
        
        {/* Bottom padding for scroll */}
        <div className="h-8" />
      </div>
    </div>
  );
}
