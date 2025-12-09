import { format, addDays, subDays, isSameDay } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Clock } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { ScrollArea } from "./ui/scroll-area";
import { QuestDragCard } from "./QuestDragCard";
import { useState, useRef, useEffect } from "react";
import { playSound } from "@/utils/soundEffects";

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
  category?: string | null;
}

interface CalendarDayViewProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  tasks: Task[];
  onTaskDrop: (taskId: string, newDate: Date, newTime?: string) => void;
  onTimeSlotLongPress?: (date: Date, time: string) => void;
}

export const CalendarDayView = ({
  selectedDate,
  onDateSelect,
  tasks,
  onTaskDrop,
  onTimeSlotLongPress
}: CalendarDayViewProps) => {
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [longPressSlot, setLongPressSlot] = useState<{ hour: number; minute: number } | null>(null);

  // Generate time slots every 30 minutes from 6am to 11pm
  const startHour = 6;
  const endHour = 23;
  const timeSlots = [];

  for (let hour = startHour; hour <= endHour; hour++) {
    timeSlots.push({ hour, minute: 0 });
    if (hour < endHour) {
      timeSlots.push({ hour, minute: 30 });
    }
  }

  const formatTimeSlot = (hour: number, minute: number) => {
    return format(new Date().setHours(hour, minute, 0), 'h:mm a');
  };

  const formatTime24 = (hour: number, minute: number) => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  const getTasksForTimeSlot = (hour: number, minute: number) => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return tasks.filter(task => {
      if (!task.scheduled_time || task.task_date !== dateStr) return false;
      const [taskHour, taskMinute] = task.scheduled_time.split(':').map(Number);
      return taskHour === hour && taskMinute === minute;
    });
  };

  const getUnscheduledTasks = () => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return tasks.filter(task => task.task_date === dateStr && !task.scheduled_time);
  };

  const calculateTaskHeight = (duration: number | null) => {
    if (!duration) return 60; // Default 30min slot height
    // Each 30min = 60px, so duration in minutes / 30 * 60px
    return Math.max(60, (duration / 30) * 60);
  };

  const handleTouchStart = (hour: number, minute: number) => {
    const timer = setTimeout(() => {
      setLongPressSlot({ hour, minute });
      playSound('pop');
      const time24 = formatTime24(hour, minute);
      onTimeSlotLongPress?.(selectedDate, time24);
    }, 500); // 500ms long press
    setLongPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const unscheduledTasks = getUnscheduledTasks();
  const isToday = isSameDay(selectedDate, new Date());

  return (
    <div className="space-y-3">
      {/* Compact Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onDateSelect(subDays(selectedDate, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="text-center">
            <h2 className={cn(
              "text-lg font-bold",
              isToday && "text-primary"
            )}>
              {isToday ? "Today" : format(selectedDate, 'EEEE')}
            </h2>
            <p className="text-xs text-muted-foreground">
              {format(selectedDate, 'MMMM d, yyyy')}
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onDateSelect(addDays(selectedDate, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="text-right">
          <div className="text-sm font-semibold text-foreground">
            {tasks.filter(t => t.completed).length}/{tasks.length}
          </div>
          <div className="text-xs text-muted-foreground">
            {tasks.reduce((sum, t) => sum + (t.completed ? t.xp_reward : 0), 0)} XP
          </div>
        </div>
      </div>

      {/* Unscheduled Tasks */}
      {unscheduledTasks.length > 0 && (
        <div className="bg-muted/30 rounded-lg p-3 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              Unscheduled ({unscheduledTasks.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {unscheduledTasks.map(task => (
              <div
                key={task.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('taskId', task.id);
                  setDraggedTask(task.id);
                  playSound('pop');
                }}
                className="cursor-move"
              >
                <QuestDragCard
                  task={task}
                  isDragging={draggedTask === task.id}
                  compact
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <ScrollArea className="h-[calc(100vh-280px)] rounded-lg border border-border">
        <div className="relative">
          {timeSlots.map(({ hour, minute }, index) => {
            const slotTasks = getTasksForTimeSlot(hour, minute);
            const isHourMark = minute === 0;
            const time24 = formatTime24(hour, minute);

            return (
              <div
                key={`${hour}-${minute}`}
                className={cn(
                  "flex border-b border-border/50 hover:bg-accent/30 transition-colors group",
                  isHourMark && "border-t border-border"
                )}
                style={{ minHeight: '60px' }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const taskId = e.dataTransfer.getData('taskId');
                  playSound('complete');
                  onTaskDrop(taskId, selectedDate, time24);
                  setDraggedTask(null);
                }}
                onTouchStart={() => handleTouchStart(hour, minute)}
                onTouchEnd={handleTouchEnd}
                onMouseDown={() => handleTouchStart(hour, minute)}
                onMouseUp={handleTouchEnd}
                onMouseLeave={handleTouchEnd}
              >
                {/* Time Label */}
                <div className={cn(
                  "flex-shrink-0 w-20 p-2 text-xs font-medium",
                  isHourMark ? "text-foreground" : "text-muted-foreground/60"
                )}>
                  {isHourMark && formatTimeSlot(hour, minute)}
                </div>

                {/* Task Area */}
                <div className="flex-1 p-2 relative">
                  {slotTasks.length === 0 ? (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 text-xs text-muted-foreground">
                      <Plus className="h-3 w-3" />
                      <span>Long press to add quest</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {slotTasks.map(task => (
                        <div
                          key={task.id}
                          style={{
                            height: `${calculateTaskHeight(task.estimated_duration)}px`,
                            minHeight: '60px'
                          }}
                        >
                          <QuestDragCard
                            task={task}
                            isDragging={draggedTask === task.id}
                            onDragStart={(e) => {
                              e.dataTransfer.setData('taskId', task.id);
                              setDraggedTask(task.id);
                              playSound('pop');
                            }}
                            showTime
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Long Press Hint */}
      <div className="text-center text-xs text-muted-foreground">
        💡 Drag unscheduled quests or long press on a time to add a new quest
      </div>
    </div>
  );
};
