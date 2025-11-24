import { memo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { HabitDifficultySelector } from "@/components/HabitDifficultySelector";
import { FrequencyPicker } from "@/components/FrequencyPicker";

interface EpicHabitFormProps {
  habitTitle: string;
  difficulty: "easy" | "medium" | "hard";
  selectedDays: number[];
  habitCount: number;
  onTitleChange: (value: string) => void;
  onDifficultyChange: (value: "easy" | "medium" | "hard") => void;
  onDaysChange: (days: number[]) => void;
  onAddHabit: () => void;
}

export const EpicHabitForm = memo(({
  habitTitle,
  difficulty,
  selectedDays,
  habitCount,
  onTitleChange,
  onDifficultyChange,
  onDaysChange,
  onAddHabit,
}: EpicHabitFormProps) => {
  return (
    <div className="border rounded-lg p-3 space-y-3">
      <Input
        placeholder="Habit name (e.g., Morning run)"
        value={habitTitle}
        onChange={(e) => onTitleChange(e.target.value)}
        maxLength={60}
      />
      
      <HabitDifficultySelector
        value={difficulty}
        onChange={onDifficultyChange}
      />
      
      <FrequencyPicker
        selectedDays={selectedDays}
        onDaysChange={onDaysChange}
      />
      
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onAddHabit}
        disabled={!habitTitle.trim()}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Habit {habitCount > 0 && `(${2 - habitCount} remaining)`}
      </Button>
    </div>
  );
});

EpicHabitForm.displayName = "EpicHabitForm";
