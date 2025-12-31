import { useState, useEffect } from "react";
import { Pencil, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HabitDifficultySelector } from "@/components/HabitDifficultySelector";
import { AdvancedQuestOptions } from "@/components/AdvancedQuestOptions";
import { NaturalLanguageEditor } from "./NaturalLanguageEditor";
import { QuestDifficulty } from "../types";
import { ParsedTask } from "@/features/tasks/hooks";

interface Task {
  id: string;
  task_text: string;
  difficulty?: string | null;
  scheduled_time?: string | null;
  estimated_duration?: number | null;
  recurrence_pattern?: string | null;
  recurrence_days?: number[] | null;
  reminder_enabled?: boolean | null;
  reminder_minutes_before?: number | null;
  category?: string | null;
  habit_source_id?: string | null;
}

interface EditQuestDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (taskId: string, updates: {
    task_text: string;
    difficulty: string;
    scheduled_time: string | null;
    estimated_duration: number | null;
    recurrence_pattern: string | null;
    recurrence_days: number[];
    reminder_enabled: boolean;
    reminder_minutes_before: number;
    category: string | null;
  }) => Promise<void>;
  isSaving: boolean;
}

export function EditQuestDialog({
  task,
  open,
  onOpenChange,
  onSave,
  isSaving,
}: EditQuestDialogProps) {
  const [taskText, setTaskText] = useState("");
  const [difficulty, setDifficulty] = useState<QuestDifficulty>("medium");
  const [scheduledTime, setScheduledTime] = useState<string>("");
  const [estimatedDuration, setEstimatedDuration] = useState<number | null>(null);
  const [recurrencePattern, setRecurrencePattern] = useState<string | null>(null);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState(15);
  const [moreInformation, setMoreInformation] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (task) {
      setTaskText(task.task_text);
      setDifficulty((task.difficulty as QuestDifficulty) || "medium");
      setScheduledTime(task.scheduled_time || "");
      setEstimatedDuration(task.estimated_duration || null);
      setRecurrencePattern(task.recurrence_pattern || null);
      setRecurrenceDays(task.recurrence_days || []);
      setReminderEnabled(task.reminder_enabled || false);
      setReminderMinutesBefore(task.reminder_minutes_before || 15);
      setMoreInformation(task.category || null);
      // Auto-expand advanced if any advanced fields are set
      setShowAdvanced(
        !!task.recurrence_pattern || 
        !!task.reminder_enabled || 
        !!task.category
      );
    }
  }, [task]);

  const handleNaturalLanguageApply = (parsed: ParsedTask) => {
    if (parsed.text && parsed.text !== taskText) {
      setTaskText(parsed.text);
    }
    if (parsed.scheduledTime) {
      setScheduledTime(parsed.scheduledTime);
    }
    if (parsed.estimatedDuration) {
      setEstimatedDuration(parsed.estimatedDuration);
    }
    if (parsed.difficulty) {
      setDifficulty(parsed.difficulty);
    }
    if (parsed.recurrencePattern) {
      setRecurrencePattern(parsed.recurrencePattern);
    }
  };

  const handleSave = async () => {
    if (!task || !taskText.trim()) return;
    
    await onSave(task.id, {
      task_text: taskText.trim(),
      difficulty,
      scheduled_time: scheduledTime || null,
      estimated_duration: estimatedDuration,
      recurrence_pattern: recurrencePattern,
      recurrence_days: recurrenceDays,
      reminder_enabled: reminderEnabled,
      reminder_minutes_before: reminderMinutesBefore,
      category: moreInformation,
    });
    
    onOpenChange(false);
  };

  const isRitual = !!task?.habit_source_id;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-xl">
        <SheetHeader className="pb-2">
          <SheetTitle className="flex items-center gap-2">
            {isRitual ? (
              <>
                <Repeat className="h-5 w-5 text-accent" />
                Edit Ritual
              </>
            ) : (
              <>
                <Pencil className="h-5 w-5" />
                Edit Quest
              </>
            )}
          </SheetTitle>
          {isRitual && (
            <p className="text-xs text-muted-foreground">
              This is a daily ritual from your habits
            </p>
          )}
        </SheetHeader>
        
        <ScrollArea className="h-[calc(85vh-140px)] pr-4">
          <div className="space-y-6 py-4">
            {/* Natural Language Quick Edit */}
            <NaturalLanguageEditor onApply={handleNaturalLanguageApply} />

            <div className="space-y-2">
              <label className="text-sm font-medium">Quest Name</label>
              <Input
                value={taskText}
                onChange={(e) => setTaskText(e.target.value)}
                placeholder="What quest will you conquer?"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Difficulty</label>
              <HabitDifficultySelector
                value={difficulty}
                onChange={setDifficulty}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Scheduled Time</label>
                <Input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Duration (min)</label>
                <Input
                  type="number"
                  value={estimatedDuration || ""}
                  onChange={(e) => setEstimatedDuration(e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="30"
                  min="1"
                />
              </div>
            </div>

            {/* Advanced Options */}
            <div className="pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full justify-between text-muted-foreground"
              >
                Advanced Options
                <span className="text-xs">{showAdvanced ? "▲" : "▼"}</span>
              </Button>
              
              {showAdvanced && (
                <div className="mt-4">
                  <AdvancedQuestOptions
                    scheduledTime={scheduledTime || null}
                    estimatedDuration={estimatedDuration}
                    recurrencePattern={recurrencePattern}
                    recurrenceDays={recurrenceDays}
                    reminderEnabled={reminderEnabled}
                    reminderMinutesBefore={reminderMinutesBefore}
                    moreInformation={moreInformation}
                    onScheduledTimeChange={setScheduledTime}
                    onEstimatedDurationChange={setEstimatedDuration}
                    onRecurrencePatternChange={setRecurrencePattern}
                    onRecurrenceDaysChange={setRecurrenceDays}
                    onReminderEnabledChange={setReminderEnabled}
                    onReminderMinutesBeforeChange={setReminderMinutesBefore}
                    onMoreInformationChange={setMoreInformation}
                  />
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="pt-4 gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !taskText.trim()}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
