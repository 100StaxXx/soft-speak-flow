import { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, setMonth, setYear } from "date-fns";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { cn } from "@/lib/utils";
import { CalendarTask, CalendarMilestone } from "@/types/quest";

interface YearViewProps {
  selectedDate: Date;
  onMonthSelect: (date: Date) => void;
  onBack: () => void;
  onClose: () => void;
  onYearChange: (year: number) => void;
  tasks: CalendarTask[];
  milestones?: CalendarMilestone[];
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const parseValidDate = (dateString?: string | null) => {
  if (!dateString) return null;
  const parsed = new Date(dateString);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export function YearView({ 
  selectedDate, 
  onMonthSelect, 
  onBack,
  onClose,
  onYearChange,
  tasks,
  milestones = []
}: YearViewProps) {
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const currentYear = selectedDate.getFullYear();
  const today = new Date();
  
  // Generate years from current year - 5 to current year + 10
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 16 }, (_, i) => thisYear - 5 + i);

  const handlePrevYear = () => {
    onYearChange(currentYear - 1);
  };

  const handleNextYear = () => {
    onYearChange(currentYear + 1);
  };

  const handleQuickYearSelect = (year: number) => {
    onYearChange(year);
    setShowYearDropdown(false);
  };

  const handleMonthClick = (monthIndex: number) => {
    const newDate = setMonth(setYear(new Date(), currentYear), monthIndex);
    onMonthSelect(newDate);
  };

  const getTasksForMonth = (monthIndex: number) => {
    const monthStart = startOfMonth(setMonth(setYear(new Date(), currentYear), monthIndex));
    const monthEnd = endOfMonth(monthStart);
    const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    return tasks.filter(task => {
      const taskDate = parseValidDate(task.task_date);
      if (!taskDate) return false;
      return monthDays.some(day => 
        format(day, 'yyyy-MM-dd') === format(taskDate, 'yyyy-MM-dd')
      );
    });
  };

  const getMilestonesForMonth = (monthIndex: number) => {
    const monthStart = startOfMonth(setMonth(setYear(new Date(), currentYear), monthIndex));
    const monthEnd = endOfMonth(monthStart);
    const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    return milestones.filter(m => {
      const mDate = parseValidDate(m.target_date);
      if (!mDate) return false;
      return monthDays.some(day => 
        format(day, 'yyyy-MM-dd') === format(mDate, 'yyyy-MM-dd')
      );
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevYear}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          
          {/* Year Dropdown */}
          <Popover open={showYearDropdown} onOpenChange={setShowYearDropdown}>
            <PopoverTrigger asChild>
              <button className="text-2xl font-bold text-primary hover:opacity-80 transition-opacity">
                {currentYear}
              </button>
            </PopoverTrigger>
          <PopoverContent 
            className="w-32 p-0 bg-background border border-border z-[70] pointer-events-auto" 
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onPointerDownOutside={(e) => e.preventDefault()}
          >
            <div 
              className="h-64 overflow-y-auto overscroll-contain p-2"
              style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
              onTouchMove={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <div className="space-y-1">
                {years.map(year => (
                  <button
                    key={year}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleQuickYearSelect(year);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      year === currentYear 
                        ? "bg-primary text-primary-foreground" 
                        : "hover:bg-muted"
                    )}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
          </PopoverContent>
          </Popover>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextYear}
            className="h-8 w-8"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-9 w-9 rounded-full bg-muted"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Year Grid */}
      <div className="p-4 overflow-y-auto flex-1">
        <div className="grid grid-cols-3 gap-3">
          {MONTHS.map((month, index) => {
            const monthTasks = getTasksForMonth(index);
            const monthMilestones = getMilestonesForMonth(index);
            const isCurrentMonth = today.getMonth() === index && today.getFullYear() === currentYear;
            const isSelectedMonth = selectedDate.getMonth() === index && selectedDate.getFullYear() === currentYear;
            const incompleteTasks = monthTasks.filter(t => !t.completed).length;
            const completedTasks = monthTasks.filter(t => t.completed).length;
            const hasMilestones = monthMilestones.length > 0;

            return (
              <button
                key={month}
                onClick={() => handleMonthClick(index)}
                className={cn(
                  "flex flex-col items-center justify-center py-4 px-2 rounded-xl transition-all min-h-[80px]",
                  isSelectedMonth
                    ? "bg-coral-500 text-white"
                    : isCurrentMonth
                    ? "bg-coral-500/15 text-coral-500"
                    : "text-foreground hover:bg-muted/50"
                )}
              >
                <span className={cn(
                  "text-base font-semibold",
                  isSelectedMonth && "text-white"
                )}>
                  {month}
                </span>
                
                {/* Task indicator dots */}
                <div className="flex items-center justify-center gap-1 mt-2 min-h-[8px]">
                  {hasMilestones && (
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      isSelectedMonth ? "bg-white/70" : "bg-amber-500"
                    )} />
                  )}
                  {incompleteTasks > 0 && (
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      isSelectedMonth ? "bg-white/70" : "bg-coral-500"
                    )} />
                  )}
                  {completedTasks > 0 && (
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      isSelectedMonth ? "bg-white/50" : "bg-celestial-blue"
                    )} />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
