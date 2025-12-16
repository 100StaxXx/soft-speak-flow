import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { format, addDays, subDays, isSameDay, isToday } from "date-fns";

interface DatePillsScrollerProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  tasksPerDay?: Record<string, number>;
  daysToShow?: number;
}

export function DatePillsScroller({
  selectedDate,
  onDateSelect,
  tasksPerDay = {},
  daysToShow = 14,
}: DatePillsScrollerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Generate date range centered around today
  const today = new Date();
  const startDate = subDays(today, 3);
  const dates = Array.from({ length: daysToShow }, (_, i) => addDays(startDate, i));

  const getTaskCount = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return tasksPerDay[dateKey] || 0;
  };

  // Scroll to selected date on mount and when it changes
  useEffect(() => {
    if (selectedRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const selected = selectedRef.current;
      const containerWidth = container.offsetWidth;
      const selectedLeft = selected.offsetLeft;
      const selectedWidth = selected.offsetWidth;
      
      container.scrollTo({
        left: selectedLeft - (containerWidth / 2) + (selectedWidth / 2),
        behavior: 'smooth'
      });
    }
  }, [selectedDate]);

  return (
    <div 
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {dates.map((date, i) => {
        const isSelected = isSameDay(date, selectedDate);
        const isDayToday = isToday(date);
        const taskCount = getTaskCount(date);

        return (
          <button
            key={i}
            ref={isSelected ? selectedRef : undefined}
            onClick={() => onDateSelect(date)}
            className={cn(
              "flex-shrink-0 flex flex-col items-center justify-center",
              "min-w-[52px] h-16 rounded-xl transition-all duration-200",
              "border border-border/50",
              isSelected 
                ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25" 
                : "bg-card/50 hover:bg-card hover:border-primary/30",
              isDayToday && !isSelected && "border-primary/50 ring-1 ring-primary/30"
            )}
          >
            <span className={cn(
              "text-[10px] font-medium uppercase tracking-wide",
              isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
            )}>
              {format(date, 'EEE')}
            </span>
            <span className={cn(
              "text-lg font-bold leading-tight",
              isSelected ? "text-primary-foreground" : "text-foreground"
            )}>
              {format(date, 'd')}
            </span>
            {/* Task indicator */}
            <div className="flex gap-0.5 mt-0.5 h-1.5">
              {taskCount > 0 && (
                <>
                  <div className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    isSelected ? "bg-primary-foreground/70" : "bg-primary/60"
                  )} />
                  {taskCount > 1 && (
                    <div className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      isSelected ? "bg-primary-foreground/50" : "bg-primary/40"
                    )} />
                  )}
                  {taskCount > 2 && (
                    <div className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      isSelected ? "bg-primary-foreground/30" : "bg-primary/20"
                    )} />
                  )}
                </>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
