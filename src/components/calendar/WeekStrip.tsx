import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

interface WeekStripProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

export function WeekStrip({ selectedDate, onDateSelect }: WeekStripProps) {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  return (
    <div className="space-y-2">
      {/* Date Header */}
      <button className="flex items-center gap-1 text-lg font-semibold text-foreground hover:text-primary transition-colors">
        {format(selectedDate, "MMMM d, yyyy")}
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* Week Strip */}
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day) => {
          const isSelected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, today);

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDateSelect(day)}
              className={cn(
                "flex flex-col items-center py-2 rounded-xl transition-all",
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : isToday
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <span className="text-[10px] font-medium uppercase">
                {format(day, "EEE")}
              </span>
              <span className={cn(
                "text-lg font-semibold mt-0.5",
                isSelected && "text-primary-foreground"
              )}>
                {format(day, "d")}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
