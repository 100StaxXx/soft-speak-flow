import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon, Pencil, Repeat, Trash2, Camera, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HabitDifficultySelector } from "@/components/HabitDifficultySelector";
import { AdvancedQuestOptions } from "@/components/AdvancedQuestOptions";
import { NaturalLanguageEditor } from "./NaturalLanguageEditor";
import { QuestImageThumbnail } from "@/components/QuestImageThumbnail";
import { QuestImagePicker } from "@/components/QuestImagePicker";
import { useQuestImagePicker } from "@/hooks/useQuestImagePicker";
import { QuestDifficulty } from "../types";
import { ParsedTask } from "@/features/tasks/hooks";

interface Task {
  id: string;
  task_text: string;
  task_date?: string | null;
  difficulty?: string | null;
  scheduled_time?: string | null;
  estimated_duration?: number | null;
  recurrence_pattern?: string | null;
  recurrence_days?: number[] | null;
  reminder_enabled?: boolean | null;
  reminder_minutes_before?: number | null;
  category?: string | null;
  habit_source_id?: string | null;
  image_url?: string | null;
}

interface EditQuestDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (taskId: string, updates: {
    task_text: string;
    task_date: string | null;
    difficulty: string;
    scheduled_time: string | null;
    estimated_duration: number | null;
    recurrence_pattern: string | null;
    recurrence_days: number[];
    reminder_enabled: boolean;
    reminder_minutes_before: number;
    category: string | null;
    image_url: string | null;
  }) => Promise<void>;
  isSaving: boolean;
  onDelete?: (taskId: string) => Promise<void>;
  isDeleting?: boolean;
}

export function EditQuestDialog({
  task,
  open,
  onOpenChange,
  onSave,
  isSaving,
  onDelete,
  isDeleting,
}: EditQuestDialogProps) {
  const [taskText, setTaskText] = useState("");
  const [taskDate, setTaskDate] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<QuestDifficulty>("medium");
  const [scheduledTime, setScheduledTime] = useState<string>("");
  const [estimatedDuration, setEstimatedDuration] = useState<number | null>(null);
  const [recurrencePattern, setRecurrencePattern] = useState<string | null>(null);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState(15);
  const [moreInformation, setMoreInformation] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  
  const { deleteImage } = useQuestImagePicker();

  useEffect(() => {
    if (task) {
      setTaskText(task.task_text);
      setTaskDate(task.task_date || null);
      setDifficulty((task.difficulty as QuestDifficulty) || "medium");
      setScheduledTime(task.scheduled_time || "");
      setEstimatedDuration(task.estimated_duration || null);
      setRecurrencePattern(task.recurrence_pattern || null);
      setRecurrenceDays(task.recurrence_days || []);
      setReminderEnabled(task.reminder_enabled || false);
      setReminderMinutesBefore(task.reminder_minutes_before || 15);
      setMoreInformation(task.category || null);
      setImageUrl(task.image_url || null);
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
    // Handle setting values
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
    // Handle clearing values
    if (parsed.clearTime) {
      setScheduledTime('');
    }
    if (parsed.clearDuration) {
      setEstimatedDuration(null);
    }
    if (parsed.clearRecurrence) {
      setRecurrencePattern(null);
      setRecurrenceDays([]);
    }
  };

  const handleSave = async () => {
    if (!task || !taskText.trim()) return;
    
    await onSave(task.id, {
      task_text: taskText.trim(),
      task_date: taskDate,
      difficulty,
      scheduled_time: scheduledTime || null,
      estimated_duration: estimatedDuration,
      recurrence_pattern: recurrencePattern,
      recurrence_days: recurrenceDays,
      reminder_enabled: reminderEnabled,
      reminder_minutes_before: reminderMinutesBefore,
      category: moreInformation,
      image_url: imageUrl,
    });
    
    onOpenChange(false);
  };

  const handleRemoveImage = async () => {
    if (imageUrl) {
      // Delete from storage if it was uploaded
      await deleteImage(imageUrl);
      setImageUrl(null);
    }
  };

  const handleDelete = async () => {
    if (!task || !onDelete) return;
    await onDelete(task.id);
    setShowDeleteConfirm(false);
    onOpenChange(false);
  };

  const isRitual = !!task?.habit_source_id;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-xl flex flex-col">
        <SheetHeader className="pb-2 flex-shrink-0">
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
        
        <ScrollArea className="flex-1 pr-4">
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

            {/* Date Picker */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !taskDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {taskDate ? format(new Date(taskDate + 'T00:00:00'), "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={taskDate ? new Date(taskDate + 'T00:00:00') : undefined}
                    onSelect={(date) => setTaskDate(date ? format(date, 'yyyy-MM-dd') : null)}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
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

        <SheetFooter className="pt-4 pb-6 flex-shrink-0 flex flex-col gap-3 border-t">
          <div className="flex gap-2 w-full">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !taskText.trim()} className="flex-1">
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
          {onDelete && (
            <Button 
              variant="ghost" 
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          )}
        </SheetFooter>
      </SheetContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this quest?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete "{task?.task_text}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
