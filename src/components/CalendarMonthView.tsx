import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Clock, AlertCircle } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { useState } from "react";
import { playSound } from "@/utils/soundEffects";
import { CalendarTask } from "@/types/quest";

interface CalendarMonthViewProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  tasks: CalendarTask[];
  onTaskClick: (task: CalendarTask) => void;
  onDateLongPress?: (date: Date) => void;
}

export const CalendarMonthView = ({ selectedDate, onDateSelect, tasks, onTaskClick, onDateLongPress }: CalendarMonthViewProps) => {
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);

  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfMonth(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

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

  const difficultyColors = {
    easy: "bg-emerald-500/20 border-emerald-500/40",
    medium: "bg-amber-500/20 border-amber-500/40",
    hard: "bg-rose-500/20 border-rose-500/40"
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">
          {format(selectedDate, "MMMM yyyy")}
        </h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => onDateSelect(subMonths(selectedDate, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onDateSelect(addMonths(selectedDate, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
          <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
            {day}
          </div>
        ))}
        
        {days.map(day => {
          const dayTasks = getTasksForDate(day);
          const isSelected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, new Date());
          const hasConflict = hasTimeConflict(day);
          
          return (
            <Card
              key={day.toString()}
              className={cn(
                "min-h-[120px] p-2 cursor-pointer transition-all hover:shadow-glow",
                isSelected && "ring-2 ring-primary shadow-glow",
                isToday && "border-primary",
                !isSameMonth(day, selectedDate) && "opacity-50"
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
                  isToday && "text-primary font-bold"
                )}>
                  {format(day, "d")}
                </span>
                {hasConflict && (
                  <AlertCircle className="h-3 w-3 text-destructive" />
                )}
              </div>
              
              <div className="space-y-1">
                {dayTasks.slice(0, 3).map(task => (
                  <div
                    key={task.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTaskClick(task);
                    }}
                    className={cn(
                      "text-xs p-1 rounded border truncate transition-all hover:scale-105",
                      task.completed && "opacity-50 line-through",
                      task.is_main_quest && "border-amber-500 bg-amber-500/10",
                      !task.is_main_quest && task.difficulty && difficultyColors[task.difficulty as keyof typeof difficultyColors]
                    )}
                  >
                    {task.scheduled_time && (
                      <Clock className="h-2 w-2 inline mr-1" />
                    )}
                    {task.task_text}
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <Badge variant="secondary" className="text-[10px] py-0">
                    +{dayTasks.length - 3} more
                  </Badge>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
