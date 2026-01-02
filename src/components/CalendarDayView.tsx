import { format, addDays, subDays, isSameDay } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Clock, ChevronDown, ChevronUp, Zap, AlertTriangle, TrendingUp, CheckCircle2, Star } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { ScrollArea } from "./ui/scroll-area";
import { QuestDragCard } from "./QuestDragCard";
import { MilestoneCalendarCard } from "./MilestoneCalendarCard";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { playSound } from "@/utils/soundEffects";
import { Card } from "./ui/card";
import { CalendarTask, CalendarMilestone } from "@/types/quest";
import { CALENDAR_BONUS_XP } from "@/config/xpRewards";

interface CalendarDayViewProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  tasks: CalendarTask[];
  milestones?: CalendarMilestone[];
  onTaskDrop: (taskId: string, newDate: Date, newTime?: string) => void;
  onTimeSlotLongPress?: (date: Date, time: string) => void;
  onTaskLongPress?: (taskId: string) => void;
  onMilestoneClick?: (milestone: CalendarMilestone) => void;
  fullDayMode?: boolean;
  hideHeader?: boolean;
}

export const CalendarDayView = ({
  selectedDate,
  onDateSelect,
  tasks,
  milestones = [],
  onTaskDrop,
  onTimeSlotLongPress,
  onTaskLongPress,
  onMilestoneClick,
  fullDayMode = false,
  hideHeader = false
}: CalendarDayViewProps) => {
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showAllUnscheduled, setShowAllUnscheduled] = useState(false);

  // Calculate date string and day tasks first
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const dayTasks = tasks.filter(t => t.task_date === dateStr);

  // Auto-expand time range based on scheduled tasks (or full day if fullDayMode)
  const calculateTimeRange = () => {
    if (fullDayMode) {
      return { start: 0, end: 23 }; // Full 24-hour view: 12:00 AM - 11:30 PM
    }
    
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

  // Memoize time range calculation
  const { start: startHour, end: endHour } = useMemo(() => calculateTimeRange(), [dayTasks, fullDayMode]);
  
  // Memoize time slots
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = startHour; hour <= endHour; hour++) {
      slots.push({ hour, minute: 0 });
      slots.push({ hour, minute: 30 });
    }
    return slots;
  }, [startHour, endHour]);

  const formatTimeSlot = (hour: number, minute: number) => {
    return format(new Date().setHours(hour, minute, 0), 'h:mm a');
  };

  const formatTime24 = (hour: number, minute: number) => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  const getTasksForTimeSlot = (hour: number, minute: number) => {
    return dayTasks.filter(task => {
      if (!task.scheduled_time) return false;
      const [taskHour, taskMinute] = task.scheduled_time.split(':').map(Number);
      return taskHour === hour && taskMinute === minute;
    });
  };

  const getUnscheduledTasks = () => {
    return dayTasks.filter(task => !task.scheduled_time && !task.completed);
  };

  const getCompletedTasks = () => {
    return dayTasks.filter(task => task.completed);
  };

  const getDayMilestones = () => {
    return milestones.filter(m => m.target_date === dateStr);
  };

  const calculateTaskHeight = (duration: number | null) => {
    if (!duration) return 60; // Default 30min slot height
    // Each 30min = 60px, so duration in minutes / 30 * 60px
    return Math.max(60, (duration / 30) * 60);
  };

  // Optimized touch handlers with proper cleanup
  const handleTouchStart = useCallback((hour: number, minute: number, e: React.TouchEvent) => {
    touchStartPos.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
    
    longPressTimer.current = setTimeout(() => {
      playSound('pop');
      const time24 = formatTime24(hour, minute);
      onTimeSlotLongPress?.(selectedDate, time24);
    }, 600); // Reduced for snappier response
  }, [selectedDate, onTimeSlotLongPress]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // Cancel if moved more than 10px
    if (touchStartPos.current) {
      const dx = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
      const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
      if (dx > 10 || dy > 10) {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    touchStartPos.current = null;
  }, []);

  const unscheduledTasks = getUnscheduledTasks();
  const dayMilestones = getDayMilestones();
  const scheduledTasksCount = dayTasks.length - unscheduledTasks.length;
  const MAX_UNSCHEDULED_PREVIEW = 3;
  const visibleUnscheduledTasks = showAllUnscheduled
    ? unscheduledTasks
    : unscheduledTasks.slice(0, MAX_UNSCHEDULED_PREVIEW);
  const hiddenUnscheduledCount = Math.max(unscheduledTasks.length - visibleUnscheduledTasks.length, 0);
  const shouldShowPreviewToggle = unscheduledTasks.length > MAX_UNSCHEDULED_PREVIEW;
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
    powerUpXP += morningTasks.length * CALENDAR_BONUS_XP.MORNING_WARRIOR;

    // Deep Work Blocks (90+ min)
    const deepWorkTasks = scheduledTasks.filter(t => t.estimated_duration! >= 90);
    powerUpXP += deepWorkTasks.length * CALENDAR_BONUS_XP.DEEP_WORK;

    return powerUpXP;
  };

  const conflicts = checkConflicts();
  const powerUpXP = checkPowerUps();

  useEffect(() => {
    if ((conflicts > 0 || powerUpXP > 0) && !showStats) {
      setShowStats(true);
    }
  }, [conflicts, powerUpXP, showStats]);

  useEffect(() => {
    if (!shouldShowPreviewToggle && showAllUnscheduled) {
      setShowAllUnscheduled(false);
    }
  }, [shouldShowPreviewToggle, showAllUnscheduled]);

  return (
    <div className={cn("space-y-3", fullDayMode && "h-full flex flex-col")}>
      {/* Compact Header */}
      {!hideHeader && (
      <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
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
            <h2
              className={cn(
                "text-lg font-bold",
                isToday && "text-primary"
              )}
            >
              {isToday ? "Today" : format(selectedDate, "EEEE")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {format(selectedDate, "MMMM d, yyyy")}
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

        {/* Insights */}
        <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
          <span className="rounded-full bg-muted px-3 py-1 font-medium text-foreground">
            {completedCount}/{totalCount || 0} done
          </span>
          <span className="rounded-full bg-stardust-gold/15 px-3 py-1 font-medium text-stardust-gold">
            +{totalXP} XP
          </span>
          {powerUpXP > 0 && (
            <span className="rounded-full bg-amber-500/10 px-3 py-1 font-semibold text-amber-600">
              +{powerUpXP} bonus XP
            </span>
          )}
          {conflicts > 0 && (
            <span className="rounded-full bg-destructive/10 px-3 py-1 font-semibold text-destructive">
              Resolve {conflicts} conflict{conflicts > 1 ? "s" : ""}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowStats(!showStats)}
            className="h-7 gap-1 px-2 text-xs"
          >
            {showStats ? "Hide details" : "Day details"}
            {showStats ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>
      </div>
      )}

      {/* Collapsible Stats Panel */}
      {showStats && (totalCount > 0 || conflicts > 0 || powerUpXP > 0) && (
        <Card className="space-y-3 border-dashed border-border/60 bg-background/80 p-3">
          {totalCount > 0 && (
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{scheduledTasksCount}</span> of{" "}
              <span className="font-medium text-foreground">{totalCount}</span> quests scheduled •{" "}
              <span className="font-medium text-foreground">{unscheduledTasks.length}</span> waiting to place
            </div>
          )}

          {conflicts > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              Clear {conflicts} overlapping quest{conflicts > 1 ? "s" : ""} to unlock bonus XP.
            </div>
          )}

          {powerUpXP > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2 text-sm text-primary">
              <Zap className="h-4 w-4 flex-shrink-0" />
              {powerUpXP} bonus XP available from power hours, mornings, or deep work.
            </div>
          )}

          {(totalXP > 0 || powerUpXP > 0) && (
            <div className="flex items-center justify-between border-t border-dashed border-border pt-2 text-sm">
              <span className="text-muted-foreground">Potential total today</span>
              <span className="flex items-center gap-1 font-semibold text-primary">
                <TrendingUp className="h-3 w-3" />
                {totalXP + powerUpXP} XP
              </span>
            </div>
          )}
        </Card>
      )}

      {/* Sticky Milestones Section */}
      {dayMilestones.length > 0 && (
        <div className="sticky top-0 z-10 -mx-4 px-4 pb-3 pt-1 bg-background/95 backdrop-blur-sm">
          <div className="rounded-lg border border-stardust-gold/30 bg-gradient-to-r from-stardust-gold/10 to-stardust-gold/5 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-stardust-gold mb-3">
              <Star className="h-4 w-4" />
              Goals for Today ({dayMilestones.length})
            </div>
            <div className="space-y-2">
              {dayMilestones.map((milestone) => (
                <MilestoneCalendarCard
                  key={milestone.id}
                  milestone={milestone}
                  onClick={() => onMilestoneClick?.(milestone)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Unscheduled Tasks - Full section in normal mode */}
      {!fullDayMode && unscheduledTasks.length > 0 && (
        <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Unscheduled ({unscheduledTasks.length})
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {visibleUnscheduledTasks.map((task) => (
              <div
                key={task.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("taskId", task.id);
                  setDraggedTask(task.id);
                  playSound("pop");
                }}
                className="cursor-move"
              >
                <QuestDragCard task={task} isDragging={draggedTask === task.id} compact />
              </div>
            ))}
            {!showAllUnscheduled && hiddenUnscheduledCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-dashed text-xs"
                onClick={() => setShowAllUnscheduled(true)}
              >
                +{hiddenUnscheduledCount} more
              </Button>
            )}
          </div>
          {showAllUnscheduled && shouldShowPreviewToggle && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-7 text-xs"
              onClick={() => setShowAllUnscheduled(false)}
            >
              Show less
            </Button>
          )}
        </div>
      )}

      {/* Floating unscheduled count in fullDayMode */}
      {fullDayMode && unscheduledTasks.length > 0 && (
        <div className="flex justify-center">
          <div className="rounded-full bg-muted/90 backdrop-blur-sm px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-sm border border-border/50">
            You have {unscheduledTasks.length} unscheduled quest{unscheduledTasks.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Empty State Prompt */}
      {dayTasks.filter(t => t.scheduled_time).length === 0 && unscheduledTasks.length > 0 && (
        <div className="rounded-lg border border-dashed border-border/60 bg-background/70 p-3 text-center text-sm text-muted-foreground">
          You have {unscheduledTasks.length} unscheduled quest{unscheduledTasks.length > 1 ? "s" : ""}. Drag a chip into
          the timeline or long press any slot to place it.
        </div>
      )}

      {/* Timeline */}
      {fullDayMode ? (
        // No ScrollArea in fullDayMode - let parent modal handle scrolling
        <div className="rounded-lg border border-border">
          <div className="relative">
            {timeSlots.map(({ hour, minute }, index) => {
              const slotTasks = getTasksForTimeSlot(hour, minute);
              const isHourMark = minute === 0;
              const time24 = formatTime24(hour, minute);

              return (
                <div
                  key={`${hour}-${minute}`}
                  data-hour={isHourMark ? hour : undefined}
                  className={cn(
                    "flex border-b border-border/50 hover:bg-accent/30 transition-colors group touch-manipulation",
                    isHourMark && "border-t border-border"
                  )}
                  style={{ 
                    minHeight: '60px',
                    WebkitTapHighlightColor: 'transparent'
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const taskId = e.dataTransfer.getData('taskId');
                    playSound('complete');
                    onTaskDrop(taskId, selectedDate, time24);
                    setDraggedTask(null);
                  }}
                  onTouchStart={(e) => handleTouchStart(hour, minute, e)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onTouchCancel={handleTouchEnd}
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
                              onLongPress={() => onTaskLongPress?.(task.id)}
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
        </div>
      ) : (
        // Normal view with ScrollArea
        <ScrollArea className="rounded-lg border border-border max-h-[520px] min-h-[320px]">
          <div className="relative">
            {timeSlots.map(({ hour, minute }, index) => {
              const slotTasks = getTasksForTimeSlot(hour, minute);
              const isHourMark = minute === 0;
              const time24 = formatTime24(hour, minute);

              return (
                <div
                  key={`${hour}-${minute}`}
                  className={cn(
                    "flex border-b border-border/50 hover:bg-accent/30 transition-colors group touch-manipulation",
                    isHourMark && "border-t border-border"
                  )}
                  style={{ 
                    minHeight: '60px',
                    WebkitTapHighlightColor: 'transparent'
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const taskId = e.dataTransfer.getData('taskId');
                    playSound('complete');
                    onTaskDrop(taskId, selectedDate, time24);
                    setDraggedTask(null);
                  }}
                  onTouchStart={(e) => handleTouchStart(hour, minute, e)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onTouchCancel={handleTouchEnd}
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
      )}

      {/* Completed Today Section */}
      {getCompletedTasks().length > 0 && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <CheckCircle2 className="h-4 w-4" />
            Completed Today ({getCompletedTasks().length})
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {getCompletedTasks().slice(0, 5).map((task) => (
              <div
                key={task.id}
                className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary line-through opacity-70"
              >
                {task.task_text}
              </div>
            ))}
            {getCompletedTasks().length > 5 && (
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                +{getCompletedTasks().length - 5} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Long Press Hint */}
      {dayTasks.length > 0 && (
        <div className="text-center text-xs text-muted-foreground">
          💡 Drag unscheduled quests or long press on a time to add a new quest
        </div>
      )}
    </div>
  );
};
