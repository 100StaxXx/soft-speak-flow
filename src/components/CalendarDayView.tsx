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
import { getScheduledTimeParts, parseScheduledTime } from "@/utils/scheduledTime";
import { bucketTaskToHalfHourSlot, computeDynamicWindow, snapPointerToFiveMinuteOffset } from "./calendar/timeWindow";

const SLOT_ROW_HEIGHT_PX = 60;
const HALF_HOUR_MINUTES = 30;
const MAX_SLOT_START_MINUTE = 24 * 60 - HALF_HOUR_MINUTES;

const formatTime24FromMinutes = (totalMinutes: number) => {
  const clamped = Math.max(0, Math.min((24 * 60) - 1, totalMinutes));
  const hour = Math.floor(clamped / 60);
  const minute = clamped % 60;
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
};

const formatTimeSlotFromMinutes = (totalMinutes: number) => {
  const clamped = Math.max(0, Math.min(MAX_SLOT_START_MINUTE, totalMinutes));
  const hour = Math.floor(clamped / 60);
  const minute = clamped % 60;
  return format(new Date(2000, 0, 1, hour, minute), "h:mm a");
};

const generateHalfHourSlots = (startMinute: number, endMinute: number) => {
  const slots: number[] = [];
  const safeStart = Math.max(0, Math.min(MAX_SLOT_START_MINUTE, startMinute));
  const safeEnd = Math.max(safeStart, Math.min(MAX_SLOT_START_MINUTE, endMinute));
  for (let minute = safeStart; minute <= safeEnd; minute += HALF_HOUR_MINUTES) {
    slots.push(minute);
  }
  return slots;
};

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
  const longPressSlot = useRef<{
    slotStartMinute: number;
    fineGrained: boolean;
    offsetY: number;
  } | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showAllUnscheduled, setShowAllUnscheduled] = useState(false);

  // Calculate date string and day tasks first
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const dayTasks = tasks.filter(t => t.task_date === dateStr);

  const dynamicWindow = useMemo(() => computeDynamicWindow(dayTasks), [dayTasks]);

  const standardTimeSlots = useMemo(
    () => generateHalfHourSlots(dynamicWindow.startMinute, dynamicWindow.endMinute),
    [dynamicWindow],
  );

  const fullDayTimeSlots = useMemo(
    () => generateHalfHourSlots(0, (23 * 60) + 30),
    [],
  );

  const timeSlots = fullDayMode ? fullDayTimeSlots : standardTimeSlots;

  const getTasksForTimeSlot = useCallback((slotStartMinute: number) => {
    return dayTasks.filter(task => bucketTaskToHalfHourSlot(task.scheduled_time) === slotStartMinute);
  }, [dayTasks]);

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

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    longPressSlot.current = null;
  }, []);

  // Optimized touch handlers with proper cleanup
  const handleTouchStart = useCallback((
    slotStartMinute: number,
    fineGrained: boolean,
    e: React.TouchEvent<HTMLDivElement>,
  ) => {
    const touch = e.touches[0];
    if (!touch) return;

    touchStartPos.current = {
      x: touch.clientX,
      y: touch.clientY
    };

    const rowBounds = e.currentTarget.getBoundingClientRect();
    longPressSlot.current = {
      slotStartMinute,
      fineGrained,
      offsetY: touch.clientY - rowBounds.top,
    };
    
    longPressTimer.current = setTimeout(() => {
      const pending = longPressSlot.current;
      if (!pending) return;

      const minuteOffset = pending.fineGrained
        ? snapPointerToFiveMinuteOffset(pending.offsetY, SLOT_ROW_HEIGHT_PX)
        : 0;
      playSound('pop');
      const time24 = formatTime24FromMinutes(pending.slotStartMinute + minuteOffset);
      onTimeSlotLongPress?.(selectedDate, time24);
    }, 600); // Reduced for snappier response
  }, [selectedDate, onTimeSlotLongPress]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // Cancel if moved more than 10px
    if (touchStartPos.current) {
      const dx = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
      const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
      if (dx > 10 || dy > 10) {
        clearLongPress();
      }
    }
  }, [clearLongPress]);

  const handleTouchEnd = useCallback(() => {
    clearLongPress();
    touchStartPos.current = null;
  }, [clearLongPress]);

  const getDropTimeForSlot = useCallback((
    slotStartMinute: number,
    fineGrained: boolean,
    e: React.DragEvent<HTMLDivElement>,
  ) => {
    if (!fineGrained) {
      return formatTime24FromMinutes(slotStartMinute);
    }

    const rowBounds = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rowBounds.top;
    const minuteOffset = snapPointerToFiveMinuteOffset(offsetY, SLOT_ROW_HEIGHT_PX);
    return formatTime24FromMinutes(slotStartMinute + minuteOffset);
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
        const task1Start = parseScheduledTime(scheduledTasks[i].scheduled_time, new Date("2000-01-01T00:00:00"));
        const task2Start = parseScheduledTime(scheduledTasks[j].scheduled_time, new Date("2000-01-01T00:00:00"));
        if (!task1Start || !task2Start) continue;
        const task1End = new Date(task1Start.getTime() + (scheduledTasks[i].estimated_duration! * 60000));
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
      const parts = getScheduledTimeParts(t.scheduled_time);
      return !!parts && parts.hour < 9;
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
            {timeSlots.map((slotStartMinute) => {
              const slotTasks = getTasksForTimeSlot(slotStartMinute);
              const isHourMark = slotStartMinute % 60 === 0;
              const time24 = formatTime24FromMinutes(slotStartMinute);

              return (
                <div
                  key={slotStartMinute}
                  data-hour={isHourMark ? slotStartMinute / 60 : undefined}
                  className={cn(
                    "flex border-b border-border/50 hover:bg-accent/30 transition-colors group touch-manipulation select-none",
                    isHourMark && "border-t border-border"
                  )}
                  style={{ 
                    minHeight: `${SLOT_ROW_HEIGHT_PX}px`,
                    WebkitTapHighlightColor: 'transparent',
                    WebkitTouchCallout: 'none',
                    WebkitUserSelect: 'none',
                    userSelect: 'none',
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const taskId = e.dataTransfer.getData('taskId');
                    playSound('complete');
                    onTaskDrop(taskId, selectedDate, time24);
                    setDraggedTask(null);
                  }}
                  onTouchStart={(e) => handleTouchStart(slotStartMinute, false, e)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onTouchCancel={handleTouchEnd}
                >
                  {/* Time Label */}
                  <div className={cn(
                    "flex-shrink-0 w-20 p-2 text-xs font-medium",
                    isHourMark ? "text-foreground" : "text-muted-foreground/60"
                  )}>
                    {isHourMark && formatTimeSlotFromMinutes(slotStartMinute)}
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
                              minHeight: `${SLOT_ROW_HEIGHT_PX}px`
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
            {timeSlots.map((slotStartMinute) => {
              const slotTasks = getTasksForTimeSlot(slotStartMinute);
              const isHourMark = slotStartMinute % 60 === 0;

              return (
                <div
                  key={slotStartMinute}
                  className={cn(
                    "flex border-b border-border/50 hover:bg-accent/30 transition-colors group touch-manipulation select-none",
                    isHourMark && "border-t border-border"
                  )}
                  style={{ 
                    minHeight: `${SLOT_ROW_HEIGHT_PX}px`,
                    WebkitTapHighlightColor: 'transparent',
                    WebkitTouchCallout: 'none',
                    WebkitUserSelect: 'none',
                    userSelect: 'none',
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const taskId = e.dataTransfer.getData('taskId');
                    const dropTime = getDropTimeForSlot(slotStartMinute, true, e);
                    playSound('complete');
                    onTaskDrop(taskId, selectedDate, dropTime);
                    setDraggedTask(null);
                  }}
                  onTouchStart={(e) => handleTouchStart(slotStartMinute, true, e)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onTouchCancel={handleTouchEnd}
                >
                  {/* Time Label */}
                  <div className={cn(
                    "flex-shrink-0 w-20 p-2 text-xs font-medium",
                    isHourMark ? "text-foreground" : "text-muted-foreground/60"
                  )}>
                    {formatTimeSlotFromMinutes(slotStartMinute)}
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
                              minHeight: `${SLOT_ROW_HEIGHT_PX}px`
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
