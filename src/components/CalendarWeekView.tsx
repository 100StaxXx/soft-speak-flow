import { format, addDays, startOfWeek, isSameDay, addWeeks, subWeeks } from "date-fns";
import { ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { ScrollArea } from "./ui/scroll-area";
import { QuestDragCard } from "./QuestDragCard";
import { QuestDropZone } from "./QuestDropZone";
import { useState } from "react";
import { playSound } from "@/utils/soundEffects";
import { toast } from "sonner";
import { CalendarTask } from "@/types/quest";

interface CalendarWeekViewProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  tasks: CalendarTask[];
  onTaskDrop: (taskId: string, newDate: Date, newTime?: string) => void;
  onTimeSlotLongPress?: (date: Date, time: string) => void;
}

export const CalendarWeekView = ({ selectedDate, onDateSelect, tasks, onTaskDrop, onTimeSlotLongPress }: CalendarWeekViewProps) => {
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const handleLongPressStart = (date: Date, hour: number) => {
    const timer = setTimeout(() => {
      playSound('pop');
      const time = format(new Date().setHours(hour, 0), 'HH:mm');
      onTimeSlotLongPress?.(date, time);
    }, 500);
    setLongPressTimer(timer);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const getTasksForDateTime = (date: Date, hour: number) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return tasks.filter(task => {
      if (!task.scheduled_time) return false;
      const taskHour = parseInt(task.scheduled_time.split(':')[0]);
      return task.task_date === dateStr && taskHour === hour;
    });
  };

  const getUnscheduledTasksForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return tasks.filter(task => {
      return task.task_date === dateStr && !task.scheduled_time;
    });
  };

  const checkTimeConflict = (date: Date, hour: number) => {
    const hourTasks = getTasksForDateTime(date, hour);
    return hourTasks.length > 1;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">
          Week of {format(weekStart, "MMM d, yyyy")}
        </h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => onDateSelect(subWeeks(selectedDate, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onDateSelect(addWeeks(selectedDate, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="h-[600px]">
        <div className="border border-border">
          {/* Header row */}
          <div className="grid grid-cols-8 border-b border-border bg-muted/30">
            {/* Time column header */}
            <div className="h-16 border-r border-border" />
            {/* Day headers */}
            {weekDays.map((day, i) => {
              const isToday = isSameDay(day, new Date());
              const isSelected = isSameDay(day, selectedDate);
              const unscheduledTasks = getUnscheduledTasksForDate(day);
              const isLast = i === weekDays.length - 1;

              return (
                <div
                  key={day.toString()}
                  className={cn(
                    "h-16 p-2 cursor-pointer transition-colors",
                    !isLast && "border-r border-border",
                    isSelected && "bg-primary/10",
                    isToday && "bg-primary/5"
                  )}
                  onClick={() => onDateSelect(day)}
                >
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">
                      {format(day, 'EEE')}
                    </div>
                    <div className={cn(
                      "text-lg font-bold",
                      isToday && "bg-primary text-primary-foreground w-7 h-7 flex items-center justify-center mx-auto"
                    )}>
                      {format(day, 'd')}
                    </div>
                    {unscheduledTasks.length > 0 && (
                      <div className="text-[10px] text-muted-foreground">
                        {unscheduledTasks.length} unscheduled
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hour rows */}
          {hours.map((hour, hourIndex) => {
            const isLastHour = hourIndex === hours.length - 1;
            
            return (
              <div 
                key={hour} 
                className={cn(
                  "grid grid-cols-8",
                  !isLastHour && "border-b border-border"
                )}
              >
                {/* Time label */}
                <div className="h-16 flex items-start pt-1 px-2 text-xs text-muted-foreground border-r border-border">
                  {format(new Date().setHours(hour, 0), 'h a')}
                </div>
                
                {/* Day cells for this hour */}
                {weekDays.map((day, dayIndex) => {
                  const hourTasks = getTasksForDateTime(day, hour);
                  const hasConflict = checkTimeConflict(day, hour);
                  const isLast = dayIndex === weekDays.length - 1;

                  return (
                    <QuestDropZone
                      key={`${day}-${hour}`}
                      hasConflict={hasConflict}
                      className={cn(
                        "h-16 rounded-none border-0",
                        !isLast && "border-r border-border"
                      )}
                      onDrop={(e) => {
                        e.preventDefault();
                        const taskId = e.dataTransfer.getData('taskId');
                        const time = format(new Date().setHours(hour, 0), 'HH:mm');

                        if (!hasConflict) {
                          playSound('complete');
                          onTaskDrop(taskId, day, time);
                        } else {
                          playSound('error');
                          toast.error("Time conflict!", {
                            description: "There's already a quest scheduled at this time. Resolve the conflict first."
                          });
                        }
                        setDraggedTask(null);
                      }}
                      onTouchStart={() => handleLongPressStart(day, hour)}
                      onTouchEnd={handleLongPressEnd}
                      onMouseDown={() => handleLongPressStart(day, hour)}
                      onMouseUp={handleLongPressEnd}
                      onMouseLeave={handleLongPressEnd}
                    >
                      {hourTasks.map(task => (
                        <QuestDragCard
                          key={task.id}
                          task={task}
                          isDragging={draggedTask === task.id}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('taskId', task.id);
                            setDraggedTask(task.id);
                            playSound('pop');
                          }}
                        />
                      ))}
                      {hasConflict && hourTasks.length > 1 && (
                        <div className="flex items-center gap-1 text-[10px] text-destructive mt-1 animate-pulse">
                          <AlertTriangle className="h-3 w-3" />
                          Resolve conflict for +10 XP
                        </div>
                      )}
                    </QuestDropZone>
                  );
                })}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
