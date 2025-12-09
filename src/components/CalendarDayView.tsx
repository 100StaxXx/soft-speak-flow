import { format, addDays, subDays, isSameDay } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Clock, ChevronDown, ChevronUp, Zap, AlertTriangle, TrendingUp, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { ScrollArea } from "./ui/scroll-area";
import { QuestDragCard } from "./QuestDragCard";
import { useState } from "react";
import { playSound } from "@/utils/soundEffects";
import { Progress } from "./ui/progress";
import { Card } from "./ui/card";
import { toast } from "sonner";
import { CalendarTask } from "@/types/quest";

interface CalendarDayViewProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  tasks: CalendarTask[];
  onTaskDrop: (taskId: string, newDate: Date, newTime?: string) => void;
  onTimeSlotLongPress?: (date: Date, time: string) => void;
  onAutoSchedule?: (tasks: CalendarTask[]) => void;
}

export const CalendarDayView = ({
  selectedDate,
  onDateSelect,
  tasks,
  onTaskDrop,
  onTimeSlotLongPress,
  onAutoSchedule
}: CalendarDayViewProps) => {
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [longPressSlot, setLongPressSlot] = useState<{ hour: number; minute: number } | null>(null);
  const [showStats, setShowStats] = useState(true);

  // Calculate date string and day tasks first
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const dayTasks = tasks.filter(t => t.task_date === dateStr);

  // Auto-expand time range based on scheduled tasks
  const calculateTimeRange = () => {
    const scheduledTasks = dayTasks.filter(t => t.scheduled_time);

    if (scheduledTasks.length === 0) {
      return { start: 6, end: 23 }; // Default 6am-11pm
    }

    let earliestHour = 6;
    let latestHour = 23;

    scheduledTasks.forEach(task => {
      const [hourStr, minuteStr] = task.scheduled_time!.split(':');
      const hour = parseInt(hourStr);
      const duration = task.estimated_duration || 30;
      const endHour = Math.ceil((hour * 60 + parseInt(minuteStr) + duration) / 60);

      earliestHour = Math.min(earliestHour, hour);
      latestHour = Math.max(latestHour, endHour);
    });

    // Add buffer before and after
    earliestHour = Math.max(0, earliestHour - 1);
    latestHour = Math.min(23, latestHour + 1);

    return { start: earliestHour, end: latestHour };
  };

  const { start: startHour, end: endHour } = calculateTimeRange();
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

  // Calculate stats
  const completedCount = dayTasks.filter(t => t.completed).length;
  const totalCount = dayTasks.length;
  const totalXP = dayTasks.reduce((sum, t) => sum + (t.completed ? t.xp_reward : 0), 0);

  // Check for time conflicts
  const checkConflicts = () => {
    const scheduledTasks = dayTasks.filter(t => t.scheduled_time && t.estimated_duration);
    let conflicts = 0;
    for (let i = 0; i < scheduledTasks.length; i++) {
      for (let j = i + 1; j < scheduledTasks.length; j++) {
        const task1Start = new Date(`2000-01-01T${scheduledTasks[i].scheduled_time}:00`);
        const task1End = new Date(task1Start.getTime() + (scheduledTasks[i].estimated_duration! * 60000));
        const task2Start = new Date(`2000-01-01T${scheduledTasks[j].scheduled_time}:00`);
        const task2End = new Date(task2Start.getTime() + (scheduledTasks[j].estimated_duration! * 60000));
        if (task1Start < task2End && task2Start < task1End) conflicts++;
      }
    }
    return conflicts;
  };

  // Check for power-ups
  const checkPowerUps = () => {
    const scheduledTasks = dayTasks.filter(t => t.scheduled_time && t.estimated_duration && !t.completed);
    let powerUpXP = 0;

    // Power Hour bonus (3+ consecutive hours)
    const sortedTasks = [...scheduledTasks].sort((a, b) =>
      a.scheduled_time!.localeCompare(b.scheduled_time!)
    );

    // Morning Warrior (before 9am)
    const morningTasks = scheduledTasks.filter(t => {
      const hour = parseInt(t.scheduled_time!.split(':')[0]);
      return hour < 9;
    });
    powerUpXP += morningTasks.length * 10;

    // Deep Work Blocks (90+ min)
    const deepWorkTasks = scheduledTasks.filter(t => t.estimated_duration! >= 90);
    powerUpXP += deepWorkTasks.length * 20;

    return powerUpXP;
  };

  const conflicts = checkConflicts();
  const powerUpXP = checkPowerUps();

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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowStats(!showStats)}
          className="flex items-center gap-2 h-auto py-1"
        >
          <div className="text-right">
            <div className="text-sm font-semibold text-foreground">
              {completedCount}/{totalCount}
            </div>
            <div className="text-xs text-muted-foreground">
              {totalXP} XP
            </div>
          </div>
          {showStats ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </div>

      {/* Collapsible Stats Panel */}
      {showStats && (totalCount > 0 || conflicts > 0 || powerUpXP > 0) && (
        <Card className="p-3 space-y-3 bg-muted/30">
          {/* Progress Bar */}
          {totalCount > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Progress: {completedCount}/{totalCount}
                </span>
                <span className="text-primary font-semibold">
                  +{totalXP} XP
                </span>
              </div>
              <Progress
                value={(completedCount / totalCount) * 100}
                className="h-2"
              />
            </div>
          )}

          {/* Conflicts Warning */}
          {conflicts > 0 && (
            <div className="flex items-center gap-2 p-2 bg-destructive/10 border border-destructive/20 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
              <div className="text-sm">
                <span className="font-semibold text-destructive">{conflicts} time conflict{conflicts > 1 ? 's' : ''}</span>
                <span className="text-muted-foreground"> - Resolve for +10 XP each</span>
              </div>
            </div>
          )}

          {/* Power-Ups */}
          {powerUpXP > 0 && (
            <div className="flex items-center gap-2 p-2 bg-primary/10 border border-primary/20 rounded-lg">
              <Zap className="h-4 w-4 text-primary flex-shrink-0" />
              <div className="text-sm">
                <span className="font-semibold text-primary">+{powerUpXP} Bonus XP</span>
                <span className="text-muted-foreground"> available from power-ups</span>
              </div>
            </div>
          )}

          {/* Potential Total */}
          {(totalCount > 0 || powerUpXP > 0) && (
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-sm text-muted-foreground">Potential Total</span>
              <span className="text-sm font-bold text-primary flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {totalXP + powerUpXP} XP
              </span>
            </div>
          )}
        </Card>
      )}

      {/* Unscheduled Tasks */}
      {unscheduledTasks.length > 0 && (
        <div className="bg-muted/30 rounded-lg p-3 border border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                Unscheduled ({unscheduledTasks.length})
              </span>
            </div>
            {onAutoSchedule && unscheduledTasks.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  playSound('pop');
                  onAutoSchedule(unscheduledTasks);
                  toast.success("Auto-scheduling quests...", {
                    description: "Finding optimal time slots for your quests"
                  });
                }}
                className="h-7 gap-1 text-xs bg-gradient-to-r from-primary/10 to-purple-500/10 border-primary/30 hover:from-primary/20 hover:to-purple-500/20"
              >
                <Sparkles className="h-3 w-3" />
                Auto-Schedule
              </Button>
            )}
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

      {/* Empty State Prompt */}
      {dayTasks.filter(t => t.scheduled_time).length === 0 && unscheduledTasks.length > 0 && (
        <Card className="p-4 bg-gradient-to-br from-primary/5 to-purple-500/5 border-primary/20">
          <div className="text-center space-y-2">
            <div className="text-2xl">📅</div>
            <h3 className="font-semibold text-foreground">Schedule Your Day</h3>
            <p className="text-sm text-muted-foreground">
              You have {unscheduledTasks.length} unscheduled quest{unscheduledTasks.length > 1 ? 's' : ''}.
              <br />
              Drag them to the timeline or long press a time slot to add more.
            </p>
          </div>
        </Card>
      )}

      {/* Completely Empty State */}
      {totalCount === 0 && (
        <Card className="p-6 bg-gradient-to-br from-primary/5 to-purple-500/5 border-primary/20">
          <div className="text-center space-y-3">
            <div className="text-4xl">✨</div>
            <h3 className="text-lg font-bold text-foreground">Ready to Start Your Quest?</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Long press any time slot on the timeline below to quickly add a quest, or scroll down to create your first quest.
            </p>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
              <div className="flex items-center gap-1">
                <Plus className="h-3 w-3" />
                <span>Long press = Quick add</span>
              </div>
            </div>
          </div>
        </Card>
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
