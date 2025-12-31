import { useMemo } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Plus, Sparkles, Flame, Trophy } from "lucide-react";
import { QuestCard } from "./QuestCard";
import { TimePhaseSection, getTimePhase, TimePhase } from "./TimePhaseSection";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  task_text: string;
  completed: boolean | null;
  xp_reward: number;
  scheduled_time?: string | null;
  estimated_duration?: number | null;
  is_main_quest?: boolean | null;
  difficulty?: string | null;
  category?: string | null;
  notes?: string | null;
  priority?: string | null;
  energy_level?: string | null;
  is_recurring?: boolean | null;
  recurrence_pattern?: string | null;
}

interface QuestSchedulerViewProps {
  tasks: Task[];
  selectedDate: Date;
  onToggle: (taskId: string, completed: boolean, xpReward: number) => void;
  onEdit: (task: Task) => void;
  onAddQuest: () => void;
  completedCount: number;
  totalCount: number;
  currentStreak?: number;
  tutorialQuestId?: string;
}

export function QuestSchedulerView({
  tasks,
  selectedDate,
  onToggle,
  onEdit,
  onAddQuest,
  completedCount,
  totalCount,
  currentStreak = 0,
  tutorialQuestId,
}: QuestSchedulerViewProps) {
  // Group tasks by time phase
  const { phasedTasks, unscheduledTasks } = useMemo(() => {
    const phased: Record<TimePhase, Task[]> = {
      dawn: [],
      day: [],
      twilight: [],
      night: [],
    };
    const unscheduled: Task[] = [];

    tasks.forEach((task) => {
      if (task.scheduled_time) {
        const phase = getTimePhase(task.scheduled_time);
        phased[phase].push(task);
      } else {
        unscheduled.push(task);
      }
    });

    // Sort each phase by time
    Object.keys(phased).forEach((key) => {
      phased[key as TimePhase].sort((a, b) => {
        if (!a.scheduled_time || !b.scheduled_time) return 0;
        return a.scheduled_time.localeCompare(b.scheduled_time);
      });
    });

    return { phasedTasks: phased, unscheduledTasks: unscheduled };
  }, [tasks]);

  const totalXP = tasks.reduce((sum, t) => (t.completed ? sum + t.xp_reward : sum), 0);
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const isToday = format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
  const allComplete = totalCount > 0 && completedCount === totalCount;

  return (
    <div className="space-y-4">
      {/* Epic progress header with XP and streak */}
      <motion.div
        className={cn(
          "relative p-4 rounded-xl border overflow-hidden",
          "bg-gradient-to-br from-card via-card to-primary/5",
          "border-primary/20"
        )}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Background glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5 pointer-events-none" />

        <div className="relative flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                {isToday ? "Today's Journey" : format(selectedDate, "MMM d")}
              </span>
            </div>
            {currentStreak > 0 && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 text-xs">
                <Flame className="h-3 w-3" />
                {currentStreak} day streak
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-sm">
            <Trophy className={cn(
              "h-4 w-4",
              allComplete ? "text-stardust-gold" : "text-muted-foreground"
            )} />
            <span className="font-medium">{totalXP} XP</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative h-2 bg-muted/50 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
          {/* Shimmer effect when complete */}
          {allComplete && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
          )}
        </div>

        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>{completedCount} of {totalCount} quests</span>
          <span>{Math.round(progressPercent)}%</span>
        </div>
      </motion.div>

      {/* Phased quest sections */}
      {(["dawn", "day", "twilight", "night"] as TimePhase[]).map((phase) => (
        <TimePhaseSection
          key={phase}
          phase={phase}
          count={phasedTasks[phase].length}
        >
          {phasedTasks[phase].map((task) => (
            <QuestCard
              key={task.id}
              id={task.id}
              text={task.task_text}
              completed={!!task.completed}
              xpReward={task.xp_reward}
              isMainQuest={!!task.is_main_quest}
              isTutorialQuest={task.id === tutorialQuestId}
              difficulty={(task.difficulty as "easy" | "medium" | "hard") || "medium"}
              category={task.category as "mind" | "body" | "soul" | null}
              scheduledTime={task.scheduled_time}
              estimatedDuration={task.estimated_duration}
              notes={task.notes}
              priority={task.priority}
              energyLevel={task.energy_level}
              isRecurring={task.is_recurring}
              recurrencePattern={task.recurrence_pattern}
              onToggle={(id, completed) => onToggle(id, completed, task.xp_reward)}
              onEdit={() => onEdit(task)}
            />
          ))}
        </TimePhaseSection>
      ))}

      {/* Unscheduled quests */}
      {unscheduledTasks.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Anytime Quests</span>
            <span className="ml-auto text-xs bg-background/50 px-2 py-0.5 rounded-full">
              {unscheduledTasks.length} quest{unscheduledTasks.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="pl-2 space-y-2">
            {unscheduledTasks.map((task) => (
              <QuestCard
                key={task.id}
                id={task.id}
                text={task.task_text}
                completed={!!task.completed}
                xpReward={task.xp_reward}
                isMainQuest={!!task.is_main_quest}
                isTutorialQuest={task.id === tutorialQuestId}
                difficulty={(task.difficulty as "easy" | "medium" | "hard") || "medium"}
                category={task.category as "mind" | "body" | "soul" | null}
                scheduledTime={task.scheduled_time}
                estimatedDuration={task.estimated_duration}
                notes={task.notes}
                priority={task.priority}
                energyLevel={task.energy_level}
                isRecurring={task.is_recurring}
                recurrencePattern={task.recurrence_pattern}
                onToggle={(id, completed) => onToggle(id, completed, task.xp_reward)}
                onEdit={() => onEdit(task)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {tasks.length === 0 && (
        <motion.div
          className="text-center py-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Sparkles className="h-12 w-12 mx-auto text-primary/40 mb-4" />
          <p className="text-muted-foreground text-sm mb-4">
            No quests for this day. Start your journey!
          </p>
          <Button onClick={onAddQuest} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Quest
          </Button>
        </motion.div>
      )}

      {/* Add quest button */}
      {tasks.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddQuest}
          className={cn(
            "w-full justify-center gap-2",
            "border border-dashed border-primary/30 hover:border-primary/50",
            "text-primary/70 hover:text-primary hover:bg-primary/5"
          )}
        >
          <Plus className="h-4 w-4" />
          Add Quest
        </Button>
      )}
    </div>
  );
}
