import { useState, useEffect } from "react";
import { Repeat, Loader2, Brain, Dumbbell, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { NaturalLanguageEditor } from "@/features/quests/components/NaturalLanguageEditor";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ParsedTask } from "@/features/tasks/hooks";

type HabitCategory = 'mind' | 'body' | 'soul';
type Difficulty = 'easy' | 'medium' | 'hard';

/**
 * Unified ritual data that can be opened from either:
 * - A habit (template) from EpicCheckInDrawer
 * - A daily_task (instance) with habit_source_id from TodaysAgenda
 */
export interface RitualData {
  // The habit (template) ID - source of truth
  habitId: string;
  // Optional: the daily_task ID if opened from a task instance
  taskId?: string;
  // Shared fields
  title: string;
  description?: string | null;
  difficulty: string;
  frequency?: string;
  estimated_minutes?: number | null;
  preferred_time?: string | null;
  category?: HabitCategory | null;
  custom_days?: number[] | null;
  // Task-specific fields (for instance)
  recurrence_pattern?: string | null;
  recurrence_days?: number[] | null;
  reminder_enabled?: boolean | null;
  reminder_minutes_before?: number | null;
}

interface EditRitualSheetProps {
  ritual: RitualData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveComplete?: () => void;
}

const categoryConfig: Record<HabitCategory, { icon: typeof Brain; label: string; color: string }> = {
  mind: { icon: Brain, label: 'Mind', color: 'text-blue-500 border-blue-500/50 bg-blue-500/10' },
  body: { icon: Dumbbell, label: 'Body', color: 'text-green-500 border-green-500/50 bg-green-500/10' },
  soul: { icon: Flame, label: 'Soul', color: 'text-orange-500 border-orange-500/50 bg-orange-500/10' },
};

export function EditRitualSheet({
  ritual,
  open,
  onOpenChange,
  onSaveComplete,
}: EditRitualSheetProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState("daily");
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | null>(null);
  const [preferredTime, setPreferredTime] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [category, setCategory] = useState<HabitCategory>("soul");
  const [recurrencePattern, setRecurrencePattern] = useState<string | null>(null);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState(15);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset form when ritual changes
  useEffect(() => {
    if (ritual) {
      setTitle(ritual.title);
      setDescription(ritual.description || "");
      setFrequency(ritual.frequency || "daily");
      setEstimatedMinutes(ritual.estimated_minutes || null);
      setPreferredTime(ritual.preferred_time || "");
      setDifficulty((ritual.difficulty as Difficulty) || "medium");
      setCategory((ritual.category as HabitCategory) || "soul");
      setRecurrencePattern(ritual.recurrence_pattern || null);
      setRecurrenceDays(ritual.recurrence_days || ritual.custom_days || []);
      setReminderEnabled(ritual.reminder_enabled || false);
      setReminderMinutesBefore(ritual.reminder_minutes_before || 15);
      // Auto-expand advanced if any advanced fields are set
      setShowAdvanced(
        !!ritual.recurrence_pattern || 
        !!ritual.reminder_enabled ||
        !!ritual.category
      );
    }
  }, [ritual]);

  const handleNaturalLanguageApply = (parsed: ParsedTask) => {
    if (parsed.text && parsed.text !== title) {
      setTitle(parsed.text);
    }
    if (parsed.scheduledTime) {
      setPreferredTime(parsed.scheduledTime);
    }
    if (parsed.estimatedDuration) {
      setEstimatedMinutes(parsed.estimatedDuration);
    }
    if (parsed.difficulty) {
      setDifficulty(parsed.difficulty);
    }
    if (parsed.recurrencePattern) {
      setRecurrencePattern(parsed.recurrencePattern);
    }
  };

  const handleSave = async () => {
    if (!ritual || !user?.id || !title.trim()) return;
    
    setSaving(true);
    try {
      // Prepare updates for both tables
      const habitUpdates = {
        title: title.trim(),
        description: description.trim() || null,
        frequency,
        estimated_minutes: estimatedMinutes,
        difficulty,
        preferred_time: preferredTime || null,
        category,
        custom_days: recurrenceDays.length > 0 ? recurrenceDays : null,
      };

      const taskUpdates = {
        task_text: title.trim(),
        difficulty,
        scheduled_time: preferredTime || null,
        estimated_duration: estimatedMinutes,
        category,
        recurrence_pattern: recurrencePattern,
        recurrence_days: recurrenceDays,
        reminder_enabled: reminderEnabled,
        reminder_minutes_before: reminderMinutesBefore,
      };

      // 1. Update the habit template (source of truth)
      const { error: habitError } = await supabase
        .from('habits')
        .update(habitUpdates)
        .eq('id', ritual.habitId)
        .eq('user_id', user.id);

      if (habitError) {
        console.error('Error updating habit:', habitError);
        toast.error('Failed to update ritual template');
        return;
      }

      // 2. Update ALL daily_tasks that are linked to this habit
      const { error: tasksError } = await supabase
        .from('daily_tasks')
        .update(taskUpdates)
        .eq('habit_source_id', ritual.habitId)
        .eq('user_id', user.id)
        .eq('completed', false); // Only update non-completed tasks

      if (tasksError) {
        console.error('Error updating linked tasks:', tasksError);
        // Don't fail completely - habit was updated
        toast.warning('Ritual updated, but some task instances may not have synced');
      } else {
        toast.success('Ritual updated everywhere!');
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['epics'] });

      onSaveComplete?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving ritual:', error);
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-xl">
        <SheetHeader className="pb-2">
          <SheetTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5 text-accent" />
            Edit Ritual
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            Changes sync to all instances of this ritual
          </p>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(85vh-140px)] pr-4">
          <div className="space-y-6 py-4" data-vaul-no-drag>
            {/* Natural Language Quick Edit */}
            <NaturalLanguageEditor onApply={handleNaturalLanguageApply} />

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Ritual Name</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What's your ritual?"
              />
            </div>
            
            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this ritual involves..."
                rows={3}
              />
            </div>

            {/* Difficulty */}
            <div className="space-y-2">
              <Label>Difficulty</Label>
              <HabitDifficultySelector
                value={difficulty}
                onChange={setDifficulty}
              />
            </div>

            {/* Time and Duration */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="time">Scheduled Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={preferredTime}
                  onChange={(e) => setPreferredTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (min)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={estimatedMinutes || ""}
                  onChange={(e) => setEstimatedMinutes(e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="30"
                  min="1"
                />
              </div>
            </div>
            
            {/* Frequency */}
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger>
                  <SelectValue placeholder="How often?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="5x_week">5x per week</SelectItem>
                  <SelectItem value="3x_week">3x per week</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>Attribute Boost</Label>
              <div className="flex gap-2">
                {(Object.keys(categoryConfig) as HabitCategory[]).map((cat) => {
                  const config = categoryConfig[cat];
                  const Icon = config.icon;
                  return (
                    <Button
                      key={cat}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCategory(cat)}
                      className={cn(
                        "flex-1 gap-2",
                        category === cat && config.color
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {config.label}
                    </Button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Which companion attribute grows when you complete this ritual
              </p>
            </div>

            {/* Advanced Options Toggle */}
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
                    scheduledTime={preferredTime || null}
                    estimatedDuration={estimatedMinutes}
                    recurrencePattern={recurrencePattern}
                    recurrenceDays={recurrenceDays}
                    reminderEnabled={reminderEnabled}
                    reminderMinutesBefore={reminderMinutesBefore}
                    moreInformation={null}
                    onScheduledTimeChange={setPreferredTime}
                    onEstimatedDurationChange={setEstimatedMinutes}
                    onRecurrencePatternChange={setRecurrencePattern}
                    onRecurrenceDaysChange={setRecurrenceDays}
                    onReminderEnabledChange={setReminderEnabled}
                    onReminderMinutesBeforeChange={setReminderMinutesBefore}
                    onMoreInformationChange={() => {}}
                  />
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="pt-4 gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
