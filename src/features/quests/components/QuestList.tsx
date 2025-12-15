import { Target, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TaskCard } from "@/components/TaskCard";
import { EmptyState } from "@/components/EmptyState";
import { QuestSectionTooltip } from "@/components/QuestSectionTooltip";
import { cn } from "@/lib/utils";
import { getEffectiveQuestXP, getQuestXPMultiplier } from "@/config/xpRewards";
import { format, isSameDay } from "date-fns";
import { QuestDifficulty } from "../types";

const MAIN_QUEST_MULTIPLIER = 1.5;

interface Task {
  id: string;
  task_text: string;
  completed: boolean;
  difficulty?: string | null;
  xp_reward: number;
  is_main_quest?: boolean | null;
  scheduled_time?: string | null;
  estimated_duration?: number | null;
  recurrence_pattern?: string | null;
}

interface QuestListProps {
  tasks: Task[];
  selectedDate: Date;
  completedCount: number;
  totalCount: number;
  totalXP: number;
  taskDifficulty: QuestDifficulty;
  tutorialQuestId?: string;
  onToggle: (taskId: string, completed: boolean, xpReward: number) => void;
  onDelete: (taskId: string) => void;
  onSetMainQuest: (taskId: string) => void;
  onEdit?: (task: Task) => void;
}

export function QuestList({
  tasks,
  selectedDate,
  completedCount,
  totalCount,
  totalXP,
  taskDifficulty,
  tutorialQuestId,
  onToggle,
  onDelete,
  onSetMainQuest,
  onEdit,
}: QuestListProps) {
  const mainQuest = tasks.find(t => t.is_main_quest);
  const sideQuests = tasks.filter(t => !t.is_main_quest);

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div>
            <h3 data-tour="today-quests-header" className="font-semibold inline-flex items-center">
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
              Progress: {completedCount}/{totalCount} Complete
            </span>
            <span className="text-primary font-semibold">
              +{totalXP} XP Today
            </span>
          </div>
          <Progress 
            value={(completedCount / totalCount) * 100} 
            className="h-2"
          />
        </div>
      )}

      {/* Quest List */}
      <div className="space-y-6">
        {tasks.length === 0 ? (
          <EmptyState 
            icon={Target}
            title="No quests yet"
            description="Add quests throughout your day - first 3 earn full XP!"
          />
        ) : (
          <>
            {/* Main Quest Section */}
            {mainQuest && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="text-xl">⚔️</div>
                  <h3 className="font-semibold text-foreground">Main Quest</h3>
                  <div className="ml-auto">
                    <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
                      {`${MAIN_QUEST_MULTIPLIER}x XP`}
                    </span>
                  </div>
                </div>
                <TaskCard
                  task={{ ...mainQuest, xp_reward: mainQuest.xp_reward * MAIN_QUEST_MULTIPLIER }}
                  onToggle={() => onToggle(mainQuest.id, !mainQuest.completed, mainQuest.xp_reward * MAIN_QUEST_MULTIPLIER)}
                  onDelete={() => onDelete(mainQuest.id)}
                  onEdit={onEdit ? () => onEdit(mainQuest) : undefined}
                  isMainQuest={true}
                  isTutorialQuest={mainQuest.id === tutorialQuestId}
                />
              </div>
            )}

            {/* Side Quests */}
            {sideQuests.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="text-lg">📜</div>
                  <h3 className="font-semibold text-muted-foreground">Side Quests</h3>
                </div>
                <div className="space-y-3">
                  {sideQuests.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onToggle={() => onToggle(task.id, !task.completed, task.xp_reward)}
                      onDelete={() => onDelete(task.id)}
                      onEdit={onEdit ? () => onEdit(task) : undefined}
                      onSetMainQuest={() => onSetMainQuest(task.id)}
                      showPromoteButton={!mainQuest}
                      isTutorialQuest={task.id === tutorialQuestId}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* XP Preview for Next Quest */}
      {tasks.length > 0 && (
        <div className={cn(
          "flex items-center justify-between p-3 rounded-lg border",
          tasks.length >= 3 ? "bg-amber-500/5 border-amber-500/20" : "bg-primary/5 border-primary/20"
        )}>
          <div className="flex items-center gap-2">
            <Zap className={cn(
              "h-4 w-4",
              tasks.length >= 3 ? "text-amber-500" : "text-primary"
            )} />
            <span className="text-sm font-medium">
              Next Quest ({tasks.length + 1})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-xs font-semibold px-2 py-1 rounded-full",
              tasks.length >= 3 
                ? "text-amber-600 bg-amber-500/10" 
                : "text-primary bg-primary/10"
            )}>
              {Math.round(getQuestXPMultiplier(tasks.length + 1) * 100)}% XP
            </span>
            <span className="text-sm text-muted-foreground">
              {getEffectiveQuestXP(taskDifficulty, tasks.length + 1)} XP
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
