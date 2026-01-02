import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { CalendarTask } from "@/types/quest";

interface WeekStripProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  tasks?: CalendarTask[];
}

export function WeekStrip({ selectedDate, onDateSelect, tasks = [] }: WeekStripProps) {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  const getTasksForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return tasks.filter(t => t.task_date === dateStr);
  };

  return (
    <div className="grid grid-cols-7 gap-1">
      {weekDays.map((day) => {
        const isSelected = isSameDay(day, selectedDate);
        const isToday = isSameDay(day, today);
        const dayTasks = getTasksForDate(day);
        const incompleteTasks = dayTasks.filter(t => !t.completed).length;
        const completedTasks = dayTasks.filter(t => t.completed).length;

        return (
          <button
            key={day.toISOString()}
            onClick={() => onDateSelect(day)}
            className={cn(
              "flex flex-col items-center py-2 px-1 rounded-xl transition-all min-h-[70px]",
              isSelected
                ? "bg-coral-500 text-white"
                : isToday
                ? "bg-coral-500/15 text-coral-500"
                : "text-muted-foreground hover:bg-muted/50"
            )}
          >
            <span className="text-[10px] font-medium uppercase tracking-wide">
              {format(day, "EEE")}
            </span>
            <span className={cn(
              "text-xl font-bold mt-0.5",
              isSelected && "text-white"
            )}>
              {format(day, "d")}
            </span>
            
            {/* Task indicator dots */}
            <div className="flex items-center justify-center gap-0.5 mt-1.5 min-h-[6px]">
              {incompleteTasks > 0 && (
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  isSelected ? "bg-white/70" : "bg-coral-500"
                )} />
              )}
              {completedTasks > 0 && (
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  isSelected ? "bg-white/50" : "bg-celestial-blue"
                )} />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
