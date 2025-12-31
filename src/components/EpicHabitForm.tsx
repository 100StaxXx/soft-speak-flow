import { memo } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Check, Clock } from "lucide-react";
import { HabitDifficultySelector } from "@/components/HabitDifficultySelector";
import { FrequencyPicker } from "@/components/FrequencyPicker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EpicHabitFormProps {
  habitTitle: string;
  habitDescription?: string;
  difficulty: "easy" | "medium" | "hard";
  selectedDays: number[];
  habitCount: number;
  maxHabits?: number;
  preferredTime: string;
  reminderEnabled: boolean;
  reminderMinutesBefore: number;
  onTitleChange: (value: string) => void;
  onDescriptionChange?: (value: string) => void;
  onDifficultyChange: (value: "easy" | "medium" | "hard") => void;
  onDaysChange: (days: number[]) => void;
  onPreferredTimeChange: (value: string) => void;
  onReminderEnabledChange: (value: boolean) => void;
  onReminderMinutesChange: (value: number) => void;
  onAddHabit: () => void;
  isEditing?: boolean;
  onCancelEdit?: () => void;
}

export const EpicHabitForm = memo(({
  habitTitle,
  habitDescription = "",
  difficulty,
  selectedDays,
  habitCount,
  maxHabits = 2,
  preferredTime,
  reminderEnabled,
  reminderMinutesBefore,
  onTitleChange,
  onDescriptionChange,
  onDifficultyChange,
  onDaysChange,
  onPreferredTimeChange,
  onReminderEnabledChange,
  onReminderMinutesChange,
  onAddHabit,
  isEditing = false,
  onCancelEdit,
}: EpicHabitFormProps) => {
  const remaining = maxHabits - habitCount;
  return (
    <div className="border rounded-lg p-3 space-y-3">
      <Input
        placeholder="Habit name (e.g., Morning run)"
        value={habitTitle}
        onChange={(e) => onTitleChange(e.target.value)}
        maxLength={60}
      />

      {onDescriptionChange && (
        <Textarea
          placeholder="Brief description or ritual details (optional)"
          value={habitDescription}
          onChange={(e) => onDescriptionChange(e.target.value)}
          maxLength={200}
          rows={2}
          className="text-sm resize-none"
        />
      )}
      
      <HabitDifficultySelector
        value={difficulty}
        onChange={onDifficultyChange}
      />
      
      <FrequencyPicker
        selectedDays={selectedDays}
        onDaysChange={onDaysChange}
      />

      {/* Time and Reminder Settings */}
      <div className="space-y-3 pt-2 border-t border-border/50">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm text-muted-foreground">Schedule (optional)</Label>
        </div>
        
        <div className="flex gap-2">
          <Input
            type="time"
            value={preferredTime}
            onChange={(e) => onPreferredTimeChange(e.target.value)}
            className="flex-1"
            placeholder="Set time"
          />
          {preferredTime && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onPreferredTimeChange("")}
              className="text-muted-foreground"
            >
              Clear
            </Button>
          )}
        </div>

        {preferredTime && (
          <div className="space-y-2 pl-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="reminder-toggle" className="text-sm">
                Push notification reminder
              </Label>
              <Switch
                id="reminder-toggle"
                checked={reminderEnabled}
                onCheckedChange={onReminderEnabledChange}
              />
            </div>

            {reminderEnabled && (
              <Select
                value={reminderMinutesBefore.toString()}
                onValueChange={(val) => onReminderMinutesChange(parseInt(val))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Remind me..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 minutes before</SelectItem>
                  <SelectItem value="10">10 minutes before</SelectItem>
                  <SelectItem value="15">15 minutes before</SelectItem>
                  <SelectItem value="30">30 minutes before</SelectItem>
                  <SelectItem value="60">1 hour before</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        )}
      </div>
      
      <div className="flex gap-2">
        <Button
          type="button"
          variant={isEditing ? "default" : "outline"}
          size="sm"
          onClick={onAddHabit}
          disabled={!habitTitle.trim()}
          className="flex-1"
        >
          {isEditing ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Update Habit
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Add Habit {habitCount > 0 && `(${remaining} remaining)`}
            </>
          )}
        </Button>
        {isEditing && onCancelEdit && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancelEdit}
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
});

EpicHabitForm.displayName = "EpicHabitForm";
