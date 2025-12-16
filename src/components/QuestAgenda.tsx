import { useMemo } from "react";
import { format, isSameDay } from "date-fns";
import { Target, Star, Zap } from "lucide-react";
import { TaskCard } from "@/components/TaskCard";
import { EmptyState } from "@/components/EmptyState";
import { Progress } from "@/components/ui/progress";
import { QuestSectionTooltip } from "@/components/QuestSectionTooltip";
import { cn } from "@/lib/utils";
import { getEffectiveQuestXP, getQuestXPMultiplier } from "@/config/xpRewards";
import type { DailyTask } from "@/hooks/useTasksQuery";

const MAIN_QUEST_MULTIPLIER = 1.5;

interface QuestAgendaProps {
  tasks: DailyTask[];
  selectedDate: Date;
  onToggle: (taskId: string, completed: boolean, xpReward: number) => void;
  onDelete: (taskId: string) => void;
  onEdit: (task: DailyTask) => void;
  onSetMainQuest: (taskId: string) => void;
  tutorialQuestId?: string;
}

export function QuestAgenda({
  tasks,
  selectedDate,
  onToggle,
  onDelete,
  onEdit,
  onSetMainQuest,
  tutorialQuestId,
}: QuestAgendaProps) {
  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;

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

  const renderTaskCard = (task: DailyTask, isMainQuest = false) => (
    <TaskCard
      key={task.id}
      task={isMainQuest ? { ...task, xp_reward: task.xp_reward * MAIN_QUEST_MULTIPLIER } : task}
      onToggle={() => onToggle(
        task.id, 
        !task.completed, 
        isMainQuest ? task.xp_reward * MAIN_QUEST_MULTIPLIER : task.xp_reward
      )}
      onDelete={() => onDelete(task.id)}
      onEdit={() => onEdit(task)}
      onSetMainQuest={!isMainQuest && !mainQuest ? () => onSetMainQuest(task.id) : undefined}
      showPromoteButton={!isMainQuest && !mainQuest}
      isMainQuest={isMainQuest}
      isTutorialQuest={task.id === tutorialQuestId}
    />
  );

  const renderSection = (title: string, emoji: string, questList: DailyTask[], color?: string) => {
    if (questList.length === 0) return null;
    
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{emoji}</span>
          <h4 className={cn("text-sm font-medium", color || "text-muted-foreground")}>
            {title}
          </h4>
          <span className="text-xs text-muted-foreground">({questList.length})</span>
        </div>
        <div className="space-y-2 pl-6">
          {questList.map(task => renderTaskCard(task))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div>
            <h3 className="font-semibold inline-flex items-center">
              {isSameDay(selectedDate, new Date()) ? "Today's Quests" : format(selectedDate, 'MMM d')}
            </h3>
            <QuestSectionTooltip />
            <p className="text-sm text-muted-foreground">
              {tasks.length} Quest{tasks.length !== 1 ? 's' : ''} • First 3 earn full XP
            </p>
          </div>
        </div>
        <div className="text-sm font-medium text-primary">
          {completedCount}/{totalCount}
        </div>
      </div>

      {/* Progress Bar */}
      {totalCount > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Progress: {completedCount}/{totalCount}
            </span>
            <span className="text-primary font-semibold">
              +{totalXP} XP
            </span>
          </div>
          <Progress value={(completedCount / totalCount) * 100} className="h-2" />
        </div>
      )}

      {/* Quest List */}
      <div className="space-y-4">
        {tasks.length === 0 ? (
          <EmptyState 
            icon={Target}
            title="No quests yet"
            description="Tap + to add your first quest!"
          />
        ) : (
          <>
            {/* Main Quest */}
            {mainQuest && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚔️</span>
                  <h4 className="font-semibold text-foreground">Main Quest</h4>
                  <span className="ml-auto text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
                    {MAIN_QUEST_MULTIPLIER}x XP
                  </span>
                </div>
                {renderTaskCard(mainQuest, true)}
              </div>
            )}

            {/* Time-based sections */}
            {renderSection("Morning", "🌅", groupedQuests.morning)}
            {renderSection("Afternoon", "☀️", groupedQuests.afternoon)}
            {renderSection("Evening", "🌙", groupedQuests.evening)}
            {renderSection("Unscheduled", "📝", groupedQuests.unscheduled)}
            {renderSection("Completed", "✅", groupedQuests.completed, "text-green-500")}
          </>
        )}
      </div>

      {/* XP Preview for next quest */}
      {tasks.length > 0 && (
        <div className={cn(
          "flex items-center justify-between p-3 rounded-lg border",
          tasks.length >= 3 ? "bg-amber-500/5 border-amber-500/20" : "bg-primary/5 border-primary/20"
        )}>
          <div className="flex items-center gap-2">
            <Zap className={cn("h-4 w-4", tasks.length >= 3 ? "text-amber-500" : "text-primary")} />
            <span className="text-sm font-medium">Next Quest ({tasks.length + 1})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-xs font-semibold px-2 py-1 rounded-full",
              tasks.length >= 3 ? "text-amber-600 bg-amber-500/10" : "text-primary bg-primary/10"
            )}>
              {Math.round(getQuestXPMultiplier(tasks.length + 1) * 100)}% XP
            </span>
            <span className="text-sm text-muted-foreground">
              {getEffectiveQuestXP("medium", tasks.length + 1)} XP
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
