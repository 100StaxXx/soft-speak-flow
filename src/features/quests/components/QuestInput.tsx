import { Plus, Sliders } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { HabitDifficultySelector } from "@/components/HabitDifficultySelector";
import { AdvancedQuestOptions } from "@/components/AdvancedQuestOptions";
import { cn } from "@/lib/utils";
import { getEffectiveQuestXP, getQuestXPMultiplier } from "@/config/xpRewards";
import { QuestDifficulty } from "../types";

interface QuestInputProps {
  newTaskText: string;
  setNewTaskText: (text: string) => void;
  taskDifficulty: QuestDifficulty;
  setTaskDifficulty: (difficulty: QuestDifficulty) => void;
  showAdvanced: boolean;
  setShowAdvanced: (show: boolean) => void;
  scheduledTime: string | null;
  setScheduledTime: (time: string | null) => void;
  estimatedDuration: number | null;
  setEstimatedDuration: (duration: number | null) => void;
  recurrencePattern: string | null;
  setRecurrencePattern: (pattern: string | null) => void;
  recurrenceDays: number[];
  setRecurrenceDays: (days: number[]) => void;
  reminderEnabled: boolean;
  setReminderEnabled: (enabled: boolean) => void;
  reminderMinutesBefore: number;
  setReminderMinutesBefore: (minutes: number) => void;
  moreInformation: string | null;
  setMoreInformation: (info: string | null) => void;
  onAddTask: () => void;
  isAdding: boolean;
  taskCount: number;
}

export function QuestInput({
  newTaskText,
  setNewTaskText,
  taskDifficulty,
  setTaskDifficulty,
  showAdvanced,
  setShowAdvanced,
  scheduledTime,
  setScheduledTime,
  estimatedDuration,
  setEstimatedDuration,
  recurrencePattern,
  setRecurrencePattern,
  recurrenceDays,
  setRecurrenceDays,
  reminderEnabled,
  setReminderEnabled,
  reminderMinutesBefore,
  setReminderMinutesBefore,
  moreInformation,
  setMoreInformation,
  onAddTask,
  isAdding,
  taskCount,
}: QuestInputProps) {
  return (
    <Card data-tour="add-task-section" className="p-4 space-y-4">
      <h3 className="font-semibold">Add New Quest</h3>

      {/* Main Input */}
      <div className="flex gap-2">
        <Input
          data-tour="add-task-input"
          placeholder="What quest will you conquer?"
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !isAdding) {
              onAddTask();
            }
          }}
          className="flex-1"
        />
        <Button
          data-tour="add-task-button"
          onClick={onAddTask}
          disabled={!newTaskText.trim() || isAdding}
          size="icon"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Difficulty Selector */}
      <div className="flex items-center justify-between">
        <HabitDifficultySelector
          value={taskDifficulty}
          onChange={setTaskDifficulty}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={cn("gap-2", showAdvanced && "text-primary")}
        >
          <Sliders className="h-4 w-4" />
          Advanced
        </Button>
      </div>

      {/* XP Preview */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>XP for this quest:</span>
        <span className="font-semibold text-primary">
          +{getEffectiveQuestXP(taskDifficulty, taskCount + 1)} XP
          {taskCount >= 3 && (
            <span className="text-amber-500 ml-1">
              ({Math.round(getQuestXPMultiplier(taskCount + 1) * 100)}%)
            </span>
          )}
        </span>
      </div>

      {/* Advanced Options */}
      {showAdvanced && (
        <AdvancedQuestOptions
          scheduledTime={scheduledTime}
          onScheduledTimeChange={setScheduledTime}
          estimatedDuration={estimatedDuration}
          onEstimatedDurationChange={setEstimatedDuration}
          recurrencePattern={recurrencePattern}
          onRecurrencePatternChange={setRecurrencePattern}
          recurrenceDays={recurrenceDays}
          onRecurrenceDaysChange={setRecurrenceDays}
          reminderEnabled={reminderEnabled}
          onReminderEnabledChange={setReminderEnabled}
          reminderMinutesBefore={reminderMinutesBefore}
          onReminderMinutesBeforeChange={setReminderMinutesBefore}
          moreInformation={moreInformation}
          onMoreInformationChange={setMoreInformation}
        />
      )}
    </Card>
  );
}
