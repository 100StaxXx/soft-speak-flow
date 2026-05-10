import { useState, useEffect, memo } from "react";
import { Repeat, Loader2, Brain, Dumbbell, Flame, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { HabitDifficultySelector } from "@/components/HabitDifficultySelector";
import { AdvancedQuestOptions } from "@/components/AdvancedQuestOptions";
import { NaturalLanguageEditor } from "@/features/quests/components/NaturalLanguageEditor";
import { FrequencyPresets } from "@/components/Pathfinder/FrequencyPresets";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { DurationPickerField, TimePickerField, getNextTimeForStep } from "@/components/scheduling";
import type { ParsedTask } from "@/features/tasks/hooks";
import { inferCustomPeriod } from "@/utils/habitSchedule";
import { useRitualUpdate } from "@/hooks/useRitualUpdate";
import { plannerPathfinderTheme } from "@/components/companion/plannerPathfinderTheme";
import { usePlannerPathfinderAppearance } from "@/hooks/usePlannerPathfinderAppearance";
import { QUEST_FORM_STYLES } from "@/components/quest-shared";

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
  custom_month_days?: number[] | null;
  // Task-specific fields (for instance)
  recurrence_pattern?: string | null;
  recurrence_days?: number[] | null;
  recurrence_month_days?: number[] | null;
  recurrence_custom_period?: "week" | "month" | null;
  reminder_enabled?: boolean | null;
  reminder_minutes_before?: number | null;
}

interface EditRitualSheetProps {
  ritual: RitualData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveComplete?: () => void;
  onDelete?: (habitId: string) => Promise<void>;
  isDeleting?: boolean;
}

const categoryConfig: Record<HabitCategory, { icon: typeof Brain; label: string }> = {
  mind: { icon: Brain, label: 'Mind' },
  body: { icon: Dumbbell, label: 'Body' },
  soul: { icon: Flame, label: 'Soul' },
};

export const EditRitualSheet = memo(function EditRitualSheet({
  ritual,
  open,
  onOpenChange,
  onSaveComplete,
  onDelete,
  isDeleting,
}: EditRitualSheetProps) {
  const { saveRitual } = useRitualUpdate();
  const { themeModeClassName } = usePlannerPathfinderAppearance();
  
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
  const [recurrenceMonthDays, setRecurrenceMonthDays] = useState<number[]>([]);
  const [customPeriod, setCustomPeriod] = useState<'week' | 'month'>('week');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState(15);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
      setRecurrenceMonthDays(ritual.recurrence_month_days || ritual.custom_month_days || []);
      setCustomPeriod(
        ritual.recurrence_custom_period
          || inferCustomPeriod({
            frequency: ritual.frequency,
            custom_days: ritual.custom_days,
            custom_month_days: ritual.custom_month_days,
          }),
      );
      setReminderEnabled(ritual.reminder_enabled || false);
      setReminderMinutesBefore(ritual.reminder_minutes_before || 15);
      setShowAdvanced(!!ritual.reminder_enabled);
    }
  }, [ritual]);

  const handleNaturalLanguageApply = (parsed: ParsedTask) => {
    // Handle clear all first
    if (parsed.clearAll) {
      setPreferredTime('');
      setEstimatedMinutes(null);
      setRecurrencePattern(null);
      setRecurrenceDays([]);
      setReminderEnabled(false);
      return;
    }
    
    // Handle title/rename
    if (parsed.newTitle) {
      setTitle(parsed.newTitle);
    } else if (parsed.text && parsed.text !== title) {
      setTitle(parsed.text);
    }
    
    // Handle setting values
    if (parsed.scheduledTime) setPreferredTime(parsed.scheduledTime);
    if (parsed.estimatedDuration) setEstimatedMinutes(parsed.estimatedDuration);
    if (parsed.difficulty) setDifficulty(parsed.difficulty);
    if (parsed.recurrencePattern) setRecurrencePattern(parsed.recurrencePattern);
    if (parsed.category) setCategory(parsed.category);
    if (parsed.customDays) setRecurrenceDays(parsed.customDays);
    if (parsed.reminderEnabled) {
      setReminderEnabled(true);
      if (parsed.reminderMinutesBefore) setReminderMinutesBefore(parsed.reminderMinutesBefore);
    }
    
    // Handle clearing individual values
    if (parsed.clearTime) setPreferredTime('');
    if (parsed.clearDuration) setEstimatedMinutes(null);
    if (parsed.clearRecurrence) {
      setRecurrencePattern(null);
      setRecurrenceDays([]);
    }
    if (parsed.clearCategory) setCategory('soul');
    if (parsed.clearReminder) setReminderEnabled(false);
  };

  const handleSave = async () => {
    if (!ritual || !title.trim()) return;
    
    setSaving(true);
    try {
      const result = await saveRitual({
        habitId: ritual.habitId,
        title,
        description,
        frequency,
        estimatedMinutes,
        difficulty,
        preferredTime: preferredTime || null,
        category,
        customDays: recurrenceDays,
        customMonthDays: recurrenceMonthDays,
        customPeriod,
        reminderEnabled,
        reminderMinutesBefore,
      });

      const scheduleChangeCount = result.createdCount + result.updatedCount + result.deletedCount;
      toast.success(result.queued ? "Ritual saved offline" : "Ritual updated", {
        description: result.queued
          ? "Your schedule changes will sync when you're back online."
          : scheduleChangeCount > 0
            ? `Updated ${scheduleChangeCount} upcoming ritual ${scheduleChangeCount === 1 ? "instance" : "instances"}.`
            : "Your ritual details are up to date.",
      });

      onSaveComplete?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving ritual:', error);
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!ritual || !onDelete) return;
    await onDelete(ritual.habitId);
    setShowDeleteConfirm(false);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        data-testid="edit-ritual-sheet-shell"
        className={cn(
          themeModeClassName,
          plannerPathfinderTheme.shell,
          "fixed flex h-[88dvh] max-h-[88dvh] flex-col overflow-hidden rounded-t-[2.25rem] px-0 pb-0 pt-0",
        )}
      >
        <div className={plannerPathfinderTheme.shellGloss} />
        <div className={plannerPathfinderTheme.shellGlow} />

        <SheetHeader className="relative z-10 shrink-0 px-4 pt-4 text-left sm:px-5 sm:pt-5">
          <div className={plannerPathfinderTheme.headerBar}>
            <div className={cn(plannerPathfinderTheme.heroIcon, "h-12 w-12 shrink-0 rounded-[1rem]")}>
              <Repeat className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <SheetTitle className="text-xl text-foreground">
                Edit Ritual
              </SheetTitle>
              <p className="text-sm text-muted-foreground">
                Changes sync to all instances of this ritual.
              </p>
              <SheetDescription className="sr-only">
                Update this ritual details, schedule, and reminders.
              </SheetDescription>
            </div>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className={cn("h-10 w-10 shrink-0", plannerPathfinderTheme.headerIconButton)}
              onClick={() => onOpenChange(false)}
              aria-label="Close Edit Ritual"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className={plannerPathfinderTheme.scrollWell}>
          <div className="space-y-5 px-4 pb-10 pt-4 text-foreground sm:px-5" data-vaul-no-drag>
            <NaturalLanguageEditor onApply={handleNaturalLanguageApply} visualStyle="quest-soft" />

            <section className={cn(plannerPathfinderTheme.raisedPanel, "space-y-4 p-4")}>
              <div className="space-y-2">
                <Label htmlFor="ritual-title" className={QUEST_FORM_STYLES.label}>Ritual Name</Label>
                <Input
                  id="ritual-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What's your ritual?"
                  className={plannerPathfinderTheme.textField}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ritual-description" className={QUEST_FORM_STYLES.label}>Description</Label>
                <Textarea
                  id="ritual-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this ritual involve? Add details about how to perform it, timing, or any tips..."
                  rows={3}
                  className={cn(plannerPathfinderTheme.textField, "min-h-[108px]")}
                />
                {!description && (
                  <p className={QUEST_FORM_STYLES.helperText}>
                    Add details about what this ritual involves - this was drafted when you created your campaign.
                  </p>
                )}
              </div>
            </section>

            <section className={cn(plannerPathfinderTheme.raisedPanel, "space-y-4 p-4")}>
              <HabitDifficultySelector
                value={difficulty}
                onChange={setDifficulty}
                variant="quest-soft"
                idPrefix={ritual?.habitId ? `edit-ritual-${ritual.habitId}` : "edit-ritual"}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <TimePickerField
                  value={preferredTime || null}
                  onChange={(time) => setPreferredTime(time ?? "")}
                  label="Scheduled Time"
                  placeholder="Time"
                  ariaLabel="Scheduled ritual time"
                  seedValueOnOpen={() => getNextTimeForStep(30)}
                  variant="quest-soft"
                  tone={difficulty}
                />
                <DurationPickerField
                  value={estimatedMinutes}
                  onChange={setEstimatedMinutes}
                  label="Duration"
                  variant="quest-soft"
                  tone={difficulty}
                />
              </div>
            </section>
            
            <section className={cn(plannerPathfinderTheme.mutedPanel, "space-y-3 p-4")}>
              <FrequencyPresets
                frequency={frequency === '3x_week' ? 'custom' : frequency as 'daily' | '5x_week' | 'weekly' | 'monthly' | 'custom'}
                customDays={recurrenceDays}
                customMonthDays={recurrenceMonthDays}
                customPeriod={customPeriod}
                variant="planner"
                onFrequencyChange={({ frequency: newFreq, customDays, customMonthDays, customPeriod: nextCustomPeriod }) => {
                  setFrequency(newFreq);
                  setRecurrenceDays(customDays);
                  setRecurrenceMonthDays(customMonthDays);
                  setCustomPeriod(nextCustomPeriod);
                }}
              />
            </section>

            <section className={cn(plannerPathfinderTheme.raisedPanel, "space-y-3 p-4")}>
              <Label className={QUEST_FORM_STYLES.label}>Attribute Boost</Label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(categoryConfig) as HabitCategory[]).map((cat) => {
                  const config = categoryConfig[cat];
                  const Icon = config.icon;
                  const isSelected = category === cat;
                  return (
                    <Button
                      key={cat}
                      type="button"
                      variant="outline"
                      aria-pressed={isSelected}
                      onClick={() => setCategory(cat)}
                      className={cn(
                        "min-h-[4.25rem] flex-col gap-1.5 px-2 text-sm",
                        isSelected ? plannerPathfinderTheme.primaryButton : plannerPathfinderTheme.outlineButton,
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {config.label}
                    </Button>
                  );
                })}
              </div>
              <p className={QUEST_FORM_STYLES.helperText}>
                Which companion attribute grows when you complete this ritual.
              </p>
            </section>

            <section className={cn(plannerPathfinderTheme.mutedPanel, "space-y-3 p-4")}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={QUEST_FORM_STYLES.advancedTrigger}
              >
                Advanced Options
                <span className="text-xs">{showAdvanced ? "▲" : "▼"}</span>
              </Button>
              
              {showAdvanced && (
                <div className="mt-3">
                  {preferredTime ? (
                    <AdvancedQuestOptions
                      scheduledTime={preferredTime || null}
                      estimatedDuration={estimatedMinutes}
                      recurrencePattern={recurrencePattern}
                      recurrenceDays={recurrenceDays}
                      recurrenceMonthDays={recurrenceMonthDays}
                      recurrenceCustomPeriod={null}
                      reminderEnabled={reminderEnabled}
                      reminderMinutesBefore={reminderMinutesBefore}
                      moreInformation={null}
                      onScheduledTimeChange={(time) => setPreferredTime(time ?? "")}
                      onEstimatedDurationChange={setEstimatedMinutes}
                      onRecurrencePatternChange={setRecurrencePattern}
                      onRecurrenceDaysChange={setRecurrenceDays}
                      onRecurrenceMonthDaysChange={setRecurrenceMonthDays}
                      onRecurrenceCustomPeriodChange={() => {}}
                      onReminderEnabledChange={setReminderEnabled}
                      onReminderMinutesBeforeChange={setReminderMinutesBefore}
                      onMoreInformationChange={() => {}}
                      location={null}
                      onLocationChange={() => {}}
                      taskDifficulty={difficulty}
                      hideScheduledTime
                      hideDuration
                      hideRecurrence
                      hideLocation
                      hideMoreInformation
                      visualStyle="quest-soft"
                      portalClassName={cn(themeModeClassName, plannerPathfinderTheme.portalSurface)}
                    />
                  ) : (
                    <p className={QUEST_FORM_STYLES.helperText}>
                      Set a scheduled time to enable reminder options.
                    </p>
                  )}
                </div>
              )}
            </section>

            {onDelete && (
              <section className="space-y-3 rounded-[1.5rem] border-[3px] border-destructive/45 bg-destructive/10 p-4 text-destructive shadow-[0_8px_0_hsl(var(--destructive)_/_0.18)]">
                <div className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4" />
                  <h3 className="text-sm font-semibold">Danger zone</h3>
                </div>
                <p className="text-sm text-destructive/80">
                  Permanently delete this ritual and remove all future instances. Completed tasks stay in your history.
                </p>
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isDeleting || saving}
                  className="gap-2"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Ritual
                </Button>
              </section>
            )}
          </div>
        </ScrollArea>

        <SheetFooter className={cn(plannerPathfinderTheme.footerBar, "relative z-10 flex shrink-0 flex-col gap-3 px-4 pb-safe pt-4 sm:flex-row sm:px-5 sm:space-x-0")}>
          <Button
            type="button"
            variant="outline"
            className={cn("flex-1", plannerPathfinderTheme.outlineButton)}
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className={cn("flex-1 gap-2", plannerPathfinderTheme.primaryButton)}
            onClick={handleSave}
            disabled={saving || !title.trim()}
          >
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this ritual?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{ritual?.title}" and remove all future instances. Completed tasks will remain in your history.
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
});
