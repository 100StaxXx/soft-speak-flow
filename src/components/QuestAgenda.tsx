import { useMemo } from "react";
import { format, isSameDay } from "date-fns";
import { Target, Zap, Plus } from "lucide-react";
import { EnhancedTaskCard, TaskCardTask } from "@/features/tasks/components/EnhancedTaskCard";
import { InteractiveEmptyState } from "@/components/InteractiveEmptyState";
import { GamifiedProgress } from "@/components/GamifiedProgress";
import { StreakIndicator } from "@/components/StreakIndicator";
import { DailyXPTracker } from "@/components/DailyXPTracker";
import { QuestSectionTooltip } from "@/components/QuestSectionTooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getEffectiveQuestXP, getQuestXPMultiplier } from "@/config/xpRewards";
import { useStreakMultiplier } from "@/hooks/useStreakMultiplier";
import type { DailyTask } from "@/hooks/useTasksQuery";

const MAIN_QUEST_MULTIPLIER = 1.5;

interface QuestAgendaProps {
  tasks: DailyTask[];
  selectedDate: Date;
  onToggle: (taskId: string, completed: boolean, xpReward: number) => void;
  onDelete: (taskId: string) => void;
  onEdit: (task: DailyTask) => void;
  onSetMainQuest: (taskId: string) => void;
  onAddQuest?: () => void;
  onQuickAdd?: (preset: { text: string; difficulty: "easy" | "medium" | "hard" }) => void;
  tutorialQuestId?: string;
  isToggling?: boolean;
}

// Thematic section headers
const sectionThemes = {
  morning: { title: "Rise & Conquer", emoji: "🌅", color: "text-amber-500" },
  afternoon: { title: "Power Hour", emoji: "⚡", color: "text-primary" },
  evening: { title: "Final Push", emoji: "🌙", color: "text-indigo-400" },
  unscheduled: { title: "Flex Quests", emoji: "📝", color: "text-muted-foreground" },
  completed: { title: "Victory Lane", emoji: "✅", color: "text-green-500" },
};

// Progress-based motivational messages
const getProgressMessage = (percent: number) => {
  if (percent === 0) return "Let's get started! 🚀";
  if (percent < 25) return "Building momentum...";
  if (percent < 50) return "Making progress! 💪";
  if (percent < 75) return "Halfway there! Keep pushing!";
  if (percent < 100) return "Almost done! Finish strong! 🔥";
  return "Legendary performance! 🏆";
};

export function QuestAgenda({
  tasks,
  selectedDate,
  onToggle,
  onDelete,
  onEdit,
  onSetMainQuest,
  onAddQuest,
  onQuickAdd,
  tutorialQuestId,
  isToggling = false,
}: QuestAgendaProps) {
  const { currentStreak, multiplier } = useStreakMultiplier();
  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const totalXP = useMemo(() => {
    return tasks.reduce((sum, task) => {
      if (!task.completed) return sum;
      const reward = task.is_main_quest ? task.xp_reward * MAIN_QUEST_MULTIPLIER : task.xp_reward;
      return sum + reward;
    }, 0);
  }, [tasks]);

  const mainQuest = tasks.find(t => t.is_main_quest);
  const sideQuests = tasks.filter(t => !t.is_main_quest);

  // Group side quests by time of day
  const groupedQuests = useMemo(() => {
    const morning: DailyTask[] = [];
    const afternoon: DailyTask[] = [];
    const evening: DailyTask[] = [];
    const unscheduled: DailyTask[] = [];
    const completed: DailyTask[] = [];

    sideQuests.forEach(task => {
      if (task.completed) {
        completed.push(task);
        return;
      }

      if (!task.scheduled_time) {
        unscheduled.push(task);
        return;
      }

      const hour = parseInt(task.scheduled_time.split(':')[0]);
      if (hour < 12) {
        morning.push(task);
      } else if (hour < 17) {
        afternoon.push(task);
      } else {
        evening.push(task);
      }
    });

    // Sort by time within each group
    const sortByTime = (a: DailyTask, b: DailyTask) => {
      if (!a.scheduled_time) return 1;
      if (!b.scheduled_time) return -1;
      return a.scheduled_time.localeCompare(b.scheduled_time);
    };

    morning.sort(sortByTime);
    afternoon.sort(sortByTime);
    evening.sort(sortByTime);

    return { morning, afternoon, evening, unscheduled, completed };
  }, [sideQuests]);

  // Map DailyTask to TaskCardTask interface
  const mapToTaskCardTask = (task: DailyTask): TaskCardTask => ({
    id: task.id,
    task_text: task.task_text,
    completed: task.completed || false,
    priority: task.priority as TaskCardTask['priority'],
    energy_level: task.energy_level as TaskCardTask['energy_level'],
    is_top_three: task.is_top_three,
    estimated_duration: task.estimated_duration,
    scheduled_time: task.scheduled_time,
    category: task.category,
  });

  const renderTaskCard = (task: DailyTask, isMainQuest = false) => (
    <EnhancedTaskCard
      key={task.id}
      task={mapToTaskCardTask(task)}
      onToggleComplete={(taskId, completed) => onToggle(
        taskId, 
        completed, 
        isMainQuest ? task.xp_reward * MAIN_QUEST_MULTIPLIER : task.xp_reward
      )}
      onDelete={(taskId) => onDelete(taskId)}
      onEdit={(taskId) => {
        const fullTask = tasks.find(t => t.id === taskId);
        if (fullTask) onEdit(fullTask);
      }}
      showSubtasks={true}
    />
  );

  const renderSection = (key: keyof typeof sectionThemes, questList: DailyTask[]) => {
    if (questList.length === 0) return null;
    const theme = sectionThemes[key];
    
    return (
      <div className="space-y-1">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 py-2">
          {theme.title}
        </h4>
        <div className="divide-y divide-border/20">
          {questList.map(task => renderTaskCard(task))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 no-text-select">
      {/* Header with Streak and XP */}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">
              {isSameDay(selectedDate, new Date()) ? "Today's Quests" : format(selectedDate, 'MMM d')}
            </h3>
            <QuestSectionTooltip />
            <StreakIndicator streak={currentStreak} multiplier={multiplier} />
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-sm text-muted-foreground">
              {tasks.length} Quest{tasks.length !== 1 ? 's' : ''}
            </p>
            <span className="text-muted-foreground/50">•</span>
            <DailyXPTracker totalXP={totalXP} />
          </div>
        </div>
        {onAddQuest && (
            <Button
              size="sm"
              onClick={onAddQuest}
              className="gap-1.5 shadow-lg shadow-primary/25"
            >
              <Plus className="h-4 w-4" />
              Add Quest
            </Button>
        )}
      </div>

      {/* Progress Bar with Motivational Message */}
      {totalCount > 0 && (
        <div className="space-y-1">
          <GamifiedProgress 
            value={progressPercent} 
            completedCount={completedCount}
            totalCount={totalCount}
          />
          <p className={cn(
            "text-xs text-center transition-colors",
            progressPercent >= 100 ? "text-stardust-gold font-medium" : "text-muted-foreground"
          )}>
            {getProgressMessage(progressPercent)}
          </p>
        </div>
      )}

      {/* Quest List */}
      <div className="space-y-4">
        {tasks.length === 0 ? (
          <InteractiveEmptyState 
            icon={Target}
            title="No quests yet"
            description="Add your first quest to start earning XP!"
            onAddQuest={onAddQuest}
            onQuickAdd={onQuickAdd}
          />
        ) : (
          <>
            {/* Main Quest */}
            {mainQuest && (
              <div className="space-y-1">
                <div className="flex items-center justify-between py-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Main Quest
                  </h4>
                  <span className="text-xs font-medium text-stardust-gold">
                    {MAIN_QUEST_MULTIPLIER}x XP
                  </span>
                </div>
                <div className="divide-y divide-border/20">
                  {renderTaskCard(mainQuest, true)}
                </div>
              </div>
            )}

            {/* Time-based sections with thematic headers */}
            {renderSection("morning", groupedQuests.morning)}
            {renderSection("afternoon", groupedQuests.afternoon)}
            {renderSection("evening", groupedQuests.evening)}
            {renderSection("unscheduled", groupedQuests.unscheduled)}
            {renderSection("completed", groupedQuests.completed)}
          </>
        )}
      </div>

      {/* XP Preview for next quest - informational only */}
      {tasks.length > 0 && (
        <div className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/20">
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-muted-foreground/60" />
            <span className="text-xs text-muted-foreground">Next Quest ({tasks.length + 1})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground/80">
              {Math.round(getQuestXPMultiplier(tasks.length + 1) * 100)}% XP
            </span>
            <span className="text-xs text-muted-foreground/60">
              · {getEffectiveQuestXP("medium", tasks.length + 1)} XP
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
