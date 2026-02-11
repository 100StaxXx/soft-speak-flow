import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Clock, AlertCircle, Star } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { useState } from "react";
import { playSound } from "@/utils/soundEffects";
import { CalendarTask, CalendarMilestone } from "@/types/quest";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

interface CalendarMonthViewProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  onMonthChange?: (date: Date) => void;
  tasks: CalendarTask[];
  milestones?: CalendarMilestone[];
  onTaskClick: (task: CalendarTask) => void;
  onMilestoneClick?: (milestone: CalendarMilestone) => void;
  onDateLongPress?: (date: Date) => void;
}

export const CalendarMonthView = ({ selectedDate, onDateSelect, onMonthChange, tasks, milestones = [], onTaskClick, onMilestoneClick, onDateLongPress }: CalendarMonthViewProps) => {
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);

  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Generate year range (current year -2 to +5)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 8 }, (_, i) => currentYear - 2 + i);
  
  const selectedMonth = selectedDate.getMonth();
  const selectedYear = selectedDate.getFullYear();
  
  const handleMonthSelect = (monthIndex: string) => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(parseInt(monthIndex));
    (onMonthChange || onDateSelect)(newDate);
  };

  const handleYearSelect = (year: string) => {
    const newDate = new Date(selectedDate);
    newDate.setFullYear(parseInt(year));
    (onMonthChange || onDateSelect)(newDate);
  };

  const handleLongPressStart = (date: Date) => {
    const timer = setTimeout(() => {
      playSound('pop');
      onDateLongPress?.(date);
    }, 500);
    setLongPressTimer(timer);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };
  
  const getTasksForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return tasks.filter(task => {
      // task_date is already in 'yyyy-MM-dd' format from database
      return task.task_date === dateStr;
    });
  };

  const getMilestonesForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return milestones.filter(m => m.target_date === dateStr);
  };

  const hasTimeConflict = (date: Date) => {
    const dateTasks = getTasksForDate(date);
    const scheduledTasks = dateTasks.filter(t => t.scheduled_time && t.estimated_duration);
    
    for (let i = 0; i < scheduledTasks.length; i++) {
      for (let j = i + 1; j < scheduledTasks.length; j++) {
        const task1Start = new Date(`2000-01-01T${scheduledTasks[i].scheduled_time}:00`);
        const task1End = new Date(task1Start.getTime() + (scheduledTasks[i].estimated_duration! * 60000));
        const task2Start = new Date(`2000-01-01T${scheduledTasks[j].scheduled_time}:00`);
        const task2End = new Date(task2Start.getTime() + (scheduledTasks[j].estimated_duration! * 60000));
        
        if (task1Start < task2End && task2Start < task1End) {
          return true;
        }
      }
    }
    return false;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {/* Month Dropdown */}
          <Select value={selectedMonth.toString()} onValueChange={handleMonthSelect}>
            <SelectTrigger className="w-[120px] h-9 text-xl font-bold border-0 bg-transparent hover:bg-muted/50 focus:ring-0 px-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border border-border z-[110]">
              {MONTHS.map((month, index) => (
                <SelectItem key={month} value={index.toString()}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Year Dropdown */}
          <Select value={selectedYear.toString()} onValueChange={handleYearSelect}>
            <SelectTrigger className="w-[80px] h-9 text-xl font-bold border-0 bg-transparent hover:bg-muted/50 focus:ring-0 px-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border border-border z-[110]">
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => (onMonthChange || onDateSelect)(subMonths(selectedDate, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => (onMonthChange || onDateSelect)(addMonths(selectedDate, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="border border-border">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border bg-muted/30">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => (
            <div 
              key={day} 
              className={cn(
                "text-center text-sm font-medium text-muted-foreground p-2",
                i < 6 && "border-r border-border"
              )}
            >
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {days.map((day, index) => {
            const dayTasks = getTasksForDate(day);
            const dayMilestones = getMilestonesForDate(day);
            const isSelected = isSameDay(day, selectedDate);
            const isToday = isSameDay(day, new Date());
            const hasConflict = hasTimeConflict(day);
            const isLastInRow = (index + 1) % 7 === 0;
            const isInLastRow = index >= days.length - 7;
            const totalItems = dayTasks.length + dayMilestones.length;
            const maxVisibleItems = 3;
            
            return (
              <div
                key={day.toString()}
                className={cn(
                  "min-h-[120px] p-2 cursor-pointer transition-colors bg-background",
                  !isLastInRow && "border-r border-border",
                  !isInLastRow && "border-b border-border",
                  isSelected && "bg-primary/10",
                  isToday && "bg-primary/5",
                  !isSameMonth(day, selectedDate) && "bg-muted/20 text-muted-foreground"
                )}
                onClick={() => onDateSelect(day)}
                onTouchStart={() => handleLongPressStart(day)}
                onTouchEnd={handleLongPressEnd}
                onMouseDown={() => handleLongPressStart(day)}
                onMouseUp={handleLongPressEnd}
                onMouseLeave={handleLongPressEnd}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={cn(
                    "text-sm font-medium",
                    isToday && "bg-celestial-blue text-white w-6 h-6 flex items-center justify-center rounded-full ring-2 ring-celestial-blue/30"
                  )}>
                    {format(day, "d")}
                  </span>
                  <div className="flex items-center gap-1">
                    {dayMilestones.length > 0 && (
                      <Star className="h-3 w-3 text-amber-500" />
                    )}
                    {hasConflict && (
                      <AlertCircle className="h-3 w-3 text-destructive" />
                    )}
                  </div>
                </div>
                
                <div className="space-y-0.5">
                  {/* Show milestones first */}
                  {dayMilestones.slice(0, 2).map(milestone => (
                    <div
                      key={milestone.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMilestoneClick?.(milestone);
                      }}
                      className={cn(
                        "text-xs p-1 border-l-2 truncate transition-all hover:bg-amber-500/10",
                        "border-l-amber-500 bg-amber-500/5",
                        milestone.completed_at && "opacity-50 line-through"
                      )}
                    >
                      <Star className="h-2 w-2 inline mr-1 text-amber-500" />
                      {milestone.title}
                    </div>
                  ))}
                  
                  {/* Then show tasks */}
                  {dayTasks.slice(0, Math.max(0, maxVisibleItems - dayMilestones.length)).map(task => (
                    <div
                      key={task.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onTaskClick(task);
                      }}
                      className={cn(
                        "text-xs p-1 border-l-2 truncate transition-all hover:bg-muted/50",
                        task.completed && "opacity-50 line-through",
                        task.is_main_quest && "border-l-amber-500 bg-amber-500/5",
                        !task.is_main_quest && task.difficulty === "easy" && "border-l-emerald-500 bg-emerald-500/5",
                        !task.is_main_quest && task.difficulty === "medium" && "border-l-amber-500 bg-amber-500/5",
                        !task.is_main_quest && task.difficulty === "hard" && "border-l-rose-500 bg-rose-500/5"
                      )}
                    >
                      {task.scheduled_time && (
                        <Clock className="h-2 w-2 inline mr-1" />
                      )}
                      {task.task_text}
                    </div>
                  ))}
                  {totalItems > maxVisibleItems && (
                    <Badge variant="secondary" className="text-[10px] py-0">
                      +{totalItems - maxVisibleItems} more
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
