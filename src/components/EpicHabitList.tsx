import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface Habit {
  title: string;
  difficulty: string;
  frequency: string;
  custom_days: number[];
}

interface EpicHabitListProps {
  habits: Habit[];
  onRemove: (index: number) => void;
}

export const EpicHabitList = memo(({ habits, onRemove }: EpicHabitListProps) => {
  if (habits.length === 0) return null;

  return (
    <div className="space-y-2">
      {habits.map((habit, index) => (
        <div key={index} className="flex items-center justify-between p-3 bg-accent/20 rounded-lg">
          <div className="flex-1">
            <div className="font-medium">{habit.title}</div>
            <div className="text-xs text-muted-foreground">
              {habit.frequency === 'daily' ? 'Daily' : 'Custom days'}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onRemove(index)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
});

EpicHabitList.displayName = "EpicHabitList";
