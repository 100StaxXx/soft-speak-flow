import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Pencil, Clock, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

interface Habit {
  title: string;
  difficulty: string;
  frequency: string;
  custom_days: number[];
  preferred_time?: string;
  reminder_enabled?: boolean;
  reminder_minutes_before?: number;
}

interface EpicHabitListProps {
  habits: Habit[];
  onRemove: (index: number) => void;
  onEdit?: (index: number) => void;
}

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

const formatTime = (time: string) => {
  if (!time) return "";
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

// Format days for display - show day chips or readable text
const formatDaysDisplay = (frequency: string, days: number[]): { type: 'text' | 'chips', value: string | number[] } => {
  if (frequency === 'daily' || (!days || days.length === 0) || days.length === 7) {
    return { type: 'text', value: 'Daily' };
  }
  // Check for weekdays
  if (days.length === 5 && [0,1,2,3,4].every(d => days.includes(d))) {
    return { type: 'text', value: 'Weekdays' };
  }
  // Show chips for custom days
  return { type: 'chips', value: days };
};

export const EpicHabitList = memo(({ habits, onRemove, onEdit }: EpicHabitListProps) => {
  if (habits.length === 0) return null;

  return (
    <div className="space-y-2">
      {habits.map((habit, index) => {
        const daysDisplay = formatDaysDisplay(habit.frequency, habit.custom_days);
        
        return (
          <div key={index} className="flex items-center justify-between p-3 bg-accent/20 rounded-lg">
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{habit.title}</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                {/* Day chips or text */}
                {daysDisplay.type === 'text' ? (
                  <span>{daysDisplay.value}</span>
                ) : (
                  <div className="flex gap-0.5">
                    {DAYS.map((day, dayIndex) => (
                      <span
                        key={dayIndex}
                        className={cn(
                          "w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center",
                          (daysDisplay.value as number[]).includes(dayIndex)
                            ? "bg-primary/80 text-primary-foreground"
                            : "bg-muted/50 text-muted-foreground/50"
                        )}
                      >
                        {day}
                      </span>
                    ))}
                  </div>
                )}
                {habit.preferred_time && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(habit.preferred_time)}
                    </span>
                  </>
                )}
                {habit.reminder_enabled && (
                  <Bell className="h-3 w-3 text-primary" />
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {onEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(index)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemove(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
});

EpicHabitList.displayName = "EpicHabitList";
