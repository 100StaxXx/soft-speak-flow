import { format, addDays, startOfWeek, isSameDay, addWeeks, subWeeks } from "date-fns";
import { ChevronLeft, ChevronRight, Clock, Target, AlertTriangle } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { Card } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";

interface Task {
  id: string;
  task_text: string;
  task_date?: string;
  scheduled_time: string | null;
  estimated_duration: number | null;
  completed: boolean;
  is_main_quest: boolean;
  difficulty: string | null;
  xp_reward: number;
}

interface CalendarWeekViewProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  tasks: Task[];
  onTaskDrop: (taskId: string, newDate: Date, newTime?: string) => void;
}

export const CalendarWeekView = ({ selectedDate, onDateSelect, tasks, onTaskDrop }: CalendarWeekViewProps) => {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getTasksForDateTime = (date: Date, hour: number) => {
    return tasks.filter(task => {
      if (!task.scheduled_time) return false;
      const taskDate = new Date(task.task_date || selectedDate);
      const taskHour = parseInt(task.scheduled_time.split(':')[0]);
      return isSameDay(taskDate, date) && taskHour === hour;
    });
  };

  const getUnscheduledTasksForDate = (date: Date) => {
    return tasks.filter(task => {
      const taskDate = new Date(task.task_date || selectedDate);
      return isSameDay(taskDate, date) && !task.scheduled_time;
    });
  };

  const checkTimeConflict = (date: Date, hour: number) => {
    const hourTasks = getTasksForDateTime(date, hour);
    return hourTasks.length > 1;
  };

  const difficultyColors = {
    easy: "border-l-4 border-l-emerald-500 bg-emerald-500/10",
    medium: "border-l-4 border-l-amber-500 bg-amber-500/10",
    hard: "border-l-4 border-l-rose-500 bg-rose-500/10"
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
        <div className="grid grid-cols-8 gap-2">
          {/* Time column */}
          <div className="space-y-1">
            <div className="h-20 border-b border-border" />
            {hours.map(hour => (
              <div key={hour} className="h-20 flex items-start pt-1 text-xs text-muted-foreground">
                {format(new Date().setHours(hour, 0), 'h a')}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map(day => {
            const isToday = isSameDay(day, new Date());
            const isSelected = isSameDay(day, selectedDate);
            const unscheduledTasks = getUnscheduledTasksForDate(day);

            return (
              <div key={day.toString()} className="space-y-1">
                {/* Day header */}
                <Card
                  className={cn(
                    "h-20 p-2 cursor-pointer transition-all",
                    isSelected && "ring-2 ring-primary",
                    isToday && "bg-primary/10"
                  )}
                  onClick={() => onDateSelect(day)}
                >
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">
                      {format(day, 'EEE')}
                    </div>
                    <div className={cn(
                      "text-lg font-bold",
                      isToday && "text-primary"
                    )}>
                      {format(day, 'd')}
                    </div>
                    {unscheduledTasks.length > 0 && (
                      <div className="text-[10px] text-muted-foreground">
                        {unscheduledTasks.length} unscheduled
                      </div>
                    )}
                  </div>
                </Card>

                {/* Hour slots */}
                {hours.map(hour => {
                  const hourTasks = getTasksForDateTime(day, hour);
                  const hasConflict = checkTimeConflict(day, hour);

                  return (
                    <div
                      key={hour}
                      className={cn(
                        "h-20 border rounded p-1 transition-all",
                        hasConflict && "border-destructive bg-destructive/5"
                      )}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const taskId = e.dataTransfer.getData('taskId');
                        const time = format(new Date().setHours(hour, 0), 'HH:mm');
                        onTaskDrop(taskId, day, time);
                      }}
                    >
                      {hourTasks.map(task => (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('taskId', task.id);
                          }}
                          className={cn(
                            "text-xs p-1 rounded mb-1 cursor-move transition-all hover:scale-105",
                            task.completed && "opacity-50 line-through",
                            task.is_main_quest && "border-l-4 border-l-amber-500 bg-amber-500/10",
                            !task.is_main_quest && task.difficulty && difficultyColors[task.difficulty as keyof typeof difficultyColors]
                          )}
                        >
                          <div className="flex items-start gap-1">
                            {task.is_main_quest && <Target className="h-3 w-3 text-amber-500 flex-shrink-0" />}
                            <span className="truncate flex-1">{task.task_text}</span>
                            {task.estimated_duration && (
                              <span className="text-[10px] text-muted-foreground flex-shrink-0">
                                {task.estimated_duration}m
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {hasConflict && (
                        <div className="flex items-center gap-1 text-[10px] text-destructive">
                          <AlertTriangle className="h-3 w-3" />
                          Conflict
                        </div>
                      )}
                    </div>
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
