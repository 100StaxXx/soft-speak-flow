import { useMemo } from "react";
import { format } from "date-fns";
import { Plus, CheckCircle2 } from "lucide-react";
import { FocusTaskCard } from "./FocusTaskCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  task_text: string;
  completed: boolean | null;
  scheduled_time?: string | null;
  estimated_duration?: number | null;
  is_main_quest?: boolean | null;
  xp_reward?: number;
}

interface FocusSchedulerViewProps {
  tasks: Task[];
  selectedDate: Date;
  onToggle: (taskId: string, completed: boolean, xpReward: number) => void;
  onEdit: (task: Task) => void;
  onAddQuest: () => void;
  completedCount: number;
  totalCount: number;
  tutorialQuestId?: string;
}

export function FocusSchedulerView({
  tasks,
  selectedDate,
  onToggle,
  onEdit,
  onAddQuest,
  completedCount,
  totalCount,
  tutorialQuestId,
}: FocusSchedulerViewProps) {
  // Group tasks: scheduled (sorted by time), then unscheduled
  const { scheduledTasks, unscheduledTasks } = useMemo(() => {
    const scheduled = tasks
      .filter((t) => t.scheduled_time)
      .sort((a, b) => {
        if (!a.scheduled_time || !b.scheduled_time) return 0;
        return a.scheduled_time.localeCompare(b.scheduled_time);
      });
    const unscheduled = tasks.filter((t) => !t.scheduled_time);
    return { scheduledTasks: scheduled, unscheduledTasks: unscheduled };
  }, [tasks]);

  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const isToday = format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {completedCount}/{totalCount} completed
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          {isToday ? "Today" : format(selectedDate, "MMM d")}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Scheduled tasks section */}
      {scheduledTasks.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Scheduled
          </h3>
          <div className="space-y-2">
            {scheduledTasks.map((task) => (
              <FocusTaskCard
                key={task.id}
                id={task.id}
                text={task.task_text}
                completed={!!task.completed}
                scheduledTime={task.scheduled_time}
                estimatedDuration={task.estimated_duration}
                isTutorialQuest={task.id === tutorialQuestId}
                onToggle={(id, completed) => onToggle(id, completed, task.xp_reward || 10)}
                onEdit={() => onEdit(task)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Unscheduled tasks section */}
      {unscheduledTasks.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {scheduledTasks.length > 0 ? "Anytime" : "Quests"}
          </h3>
          <div className="space-y-2">
            {unscheduledTasks.map((task) => (
              <FocusTaskCard
                key={task.id}
                id={task.id}
                text={task.task_text}
                completed={!!task.completed}
                scheduledTime={task.scheduled_time}
                estimatedDuration={task.estimated_duration}
                isTutorialQuest={task.id === tutorialQuestId}
                onToggle={(id, completed) => onToggle(id, completed, task.xp_reward || 10)}
                onEdit={() => onEdit(task)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {tasks.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-sm mb-4">No quests for this day</p>
          <Button variant="outline" size="sm" onClick={onAddQuest} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Quest
          </Button>
        </div>
      )}

      {/* Add task button (when tasks exist) */}
      {tasks.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddQuest}
          className={cn(
            "w-full justify-center gap-2 text-muted-foreground hover:text-foreground",
            "border border-dashed border-border/60 hover:border-border"
          )}
        >
          <Plus className="h-4 w-4" />
          Add Quest
        </Button>
      )}
    </div>
  );
}
