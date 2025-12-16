import { useState } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday
} from "date-fns";

interface MiniCalendarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  tasksPerDay?: Record<string, number>;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function MiniCalendar({
  selectedDate,
  onDateSelect,
  tasksPerDay = {},
  collapsed = true,
  onToggleCollapse,
}: MiniCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(selectedDate);
  
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const getTaskCount = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return tasksPerDay[dateKey] || 0;
  };

  return (
    <div className="bg-card/50 rounded-lg border border-border/50 overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={onToggleCollapse}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors"
      >
        <span className="font-medium text-sm">{format(currentMonth, 'MMMM yyyy')}</span>
        {collapsed ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Collapsible content */}
      <div className={cn(
        "transition-all duration-300 overflow-hidden",
        collapsed ? "max-h-0" : "max-h-80"
      )}>
        <div className="p-3 pt-0">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={(e) => {
                e.stopPropagation();
                setCurrentMonth(subMonths(currentMonth, 1));
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setCurrentMonth(new Date());
              }}
              className="text-xs h-7 px-2"
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={(e) => {
                e.stopPropagation();
                setCurrentMonth(addMonths(currentMonth, 1));
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Week day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {weekDays.map((day, i) => (
              <div key={i} className="text-center text-xs text-muted-foreground font-medium py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, i) => {
              const taskCount = getTaskCount(day);
              const isSelected = isSameDay(day, selectedDate);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isDayToday = isToday(day);

              return (
                <button
                  key={i}
                  onClick={() => onDateSelect(day)}
                  className={cn(
                    "relative h-8 w-full rounded-md text-xs font-medium transition-all",
                    "hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/50",
                    !isCurrentMonth && "text-muted-foreground/50",
                    isSelected && "bg-primary text-primary-foreground hover:bg-primary/90",
                    isDayToday && !isSelected && "ring-1 ring-primary text-primary"
                  )}
                >
                  {format(day, 'd')}
                  {/* Task indicator dot */}
                  {taskCount > 0 && !isSelected && (
                    <div className={cn(
                      "absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full",
                      isDayToday ? "bg-primary" : "bg-primary/60"
                    )} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
