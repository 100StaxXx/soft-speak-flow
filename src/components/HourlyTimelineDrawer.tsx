import { useState, useEffect, useMemo } from "react";
import { format, isSameDay } from "date-fns";
import { Clock, ChevronUp, Plus, GripHorizontal } from "lucide-react";
import { Drawer } from "vaul";
import { cn } from "@/lib/utils";
import { ScrollArea } from "./ui/scroll-area";
import { QuestDragCard } from "./QuestDragCard";
import { playSound } from "@/utils/soundEffects";
import { CalendarTask } from "@/types/quest";

interface HourlyTimelineDrawerProps {
  selectedDate: Date;
  tasks: CalendarTask[];
  onTaskDrop: (taskId: string, newDate: Date, newTime?: string) => void;
  onTimeSlotLongPress?: (date: Date, time: string) => void;
}

export const HourlyTimelineDrawer = ({
  selectedDate,
  tasks,
  onTaskDrop,
  onTimeSlotLongPress,
}: HourlyTimelineDrawerProps) => {
  const [snap, setSnap] = useState<number | string | null>(0.15);
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const dayTasks = tasks.filter((t) => t.task_date === dateStr);
  const isToday = isSameDay(selectedDate, new Date());

  // Calculate time range based on scheduled tasks
  const { startHour, endHour } = useMemo(() => {
    const scheduledTasks = dayTasks.filter((t) => t.scheduled_time);

    if (scheduledTasks.length === 0) {
      return { startHour: 6, endHour: 22 };
    }

    let earliest = 6;
    let latest = 22;

    scheduledTasks.forEach((task) => {
      const [hourStr, minuteStr] = task.scheduled_time!.split(":");
      const hour = parseInt(hourStr);
      const duration = task.estimated_duration || 30;
      const endHour = Math.ceil((hour * 60 + parseInt(minuteStr) + duration) / 60);

      earliest = Math.min(earliest, hour);
      latest = Math.max(latest, endHour);
    });

    return {
      startHour: Math.max(0, earliest - 1),
      endHour: Math.min(23, latest + 1),
    };
  }, [dayTasks]);

  // Generate time slots
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = startHour; hour <= endHour; hour++) {
      slots.push({ hour, minute: 0 });
      if (hour < endHour) {
        slots.push({ hour, minute: 30 });
      }
    }
    return slots;
  }, [startHour, endHour]);

  // Get next scheduled task for peek preview
  const nextScheduledTask = useMemo(() => {
    const now = new Date();
    const currentTime = format(now, "HH:mm");

    if (!isToday) {
      return dayTasks.find((t) => t.scheduled_time && !t.completed);
    }

    return dayTasks
      .filter((t) => t.scheduled_time && !t.completed && t.scheduled_time >= currentTime)
      .sort((a, b) => a.scheduled_time!.localeCompare(b.scheduled_time!))[0];
  }, [dayTasks, isToday]);

  const formatTimeSlot = (hour: number, minute: number) => {
    return format(new Date().setHours(hour, minute, 0), "h:mm a");
  };

  const formatTime24 = (hour: number, minute: number) => {
    return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  };

  const getTasksForTimeSlot = (hour: number, minute: number) => {
    return dayTasks.filter((task) => {
      if (!task.scheduled_time) return false;
      const [taskHour, taskMinute] = task.scheduled_time.split(":").map(Number);
      return taskHour === hour && taskMinute === minute;
    });
  };

  const calculateTaskHeight = (duration: number | null) => {
    if (!duration) return 56;
    return Math.max(56, (duration / 30) * 56);
  };

  const handleTouchStart = (hour: number, minute: number) => {
    const timer = setTimeout(() => {
      playSound("pop");
      const time24 = formatTime24(hour, minute);
      onTimeSlotLongPress?.(selectedDate, time24);
    }, 500);
    setLongPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  // Current time indicator position
  const currentTimePosition = useMemo(() => {
    if (!isToday) return null;
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    if (currentHour < startHour || currentHour > endHour) return null;

    const slotIndex = (currentHour - startHour) * 2 + (currentMinute >= 30 ? 1 : 0);
    const offsetInSlot = currentMinute % 30;
    const pixelOffset = slotIndex * 56 + (offsetInSlot / 30) * 56;

    return pixelOffset;
  }, [isToday, startHour, endHour]);

  // Scroll to current time when expanded
  useEffect(() => {
    if (snap === 0.75 && currentTimePosition !== null) {
      const scrollArea = document.querySelector("[data-hourly-scroll]");
      if (scrollArea) {
        scrollArea.scrollTop = Math.max(0, currentTimePosition - 100);
      }
    }
  }, [snap, currentTimePosition]);

  const isExpanded = snap === 0.75;
  const scheduledCount = dayTasks.filter((t) => t.scheduled_time).length;

  return (
    <Drawer.Root
      snapPoints={[0.15, 0.75]}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
      modal={false}
    >
      <Drawer.Portal>
        <Drawer.Content
          className="fixed bottom-0 left-0 right-0 z-30 mx-auto max-w-2xl outline-none"
          style={{
            height: "75vh",
          }}
        >
          <div className="flex h-full flex-col rounded-t-2xl border border-border bg-background shadow-2xl">
            {/* Drag Handle */}
            <div
              className="flex flex-col items-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
              onClick={() => setSnap(isExpanded ? 0.15 : 0.75)}
            >
              <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Peek Content (visible when collapsed) */}
            {!isExpanded && (
              <div className="px-4 pb-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Clock className="h-4 w-4 text-primary" />
                    <span>
                      {isToday ? "Today's Schedule" : format(selectedDate, "EEE, MMM d")}
                    </span>
                    {scheduledCount > 0 && (
                      <span className="text-xs text-muted-foreground">
                        ({scheduledCount} scheduled)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ChevronUp className="h-3 w-3" />
                    Swipe up
                  </div>
                </div>

                {nextScheduledTask ? (
                  <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-2">
                    <div className="text-xs font-medium text-primary">
                      {nextScheduledTask.scheduled_time &&
                        format(
                          new Date(`2000-01-01T${nextScheduledTask.scheduled_time}`),
                          "h:mm a"
                        )}
                    </div>
                    <div className="flex-1 truncate text-sm">
                      {nextScheduledTask.task_text}
                    </div>
                    {nextScheduledTask.is_main_quest && (
                      <span className="text-xs text-[hsl(45,100%,60%)]">★</span>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground text-center py-1">
                    No upcoming scheduled quests
                  </div>
                )}
              </div>
            )}

            {/* Expanded Timeline Content */}
            {isExpanded && (
              <div className="flex-1 overflow-hidden px-2">
                <div className="px-2 pb-2 text-sm font-medium text-foreground">
                  {isToday ? "Today" : format(selectedDate, "EEEE, MMMM d")}
                </div>

                <ScrollArea
                  className="h-[calc(75vh-100px)]"
                  data-hourly-scroll
                >
                  <div className="relative">
                    {/* Current time indicator */}
                    {currentTimePosition !== null && (
                      <div
                        className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                        style={{ top: currentTimePosition }}
                      >
                        <div className="h-2.5 w-2.5 rounded-full bg-destructive" />
                        <div className="flex-1 h-0.5 bg-destructive" />
                      </div>
                    )}

                    {timeSlots.map(({ hour, minute }) => {
                      const slotTasks = getTasksForTimeSlot(hour, minute);
                      const isHourMark = minute === 0;
                      const time24 = formatTime24(hour, minute);

                      return (
                        <div
                          key={`${hour}-${minute}`}
                          className={cn(
                            "flex border-b border-border/40 transition-colors group",
                            isHourMark && "border-t border-border/60"
                          )}
                          style={{ minHeight: "56px" }}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const taskId = e.dataTransfer.getData("taskId");
                            playSound("complete");
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
                          <div
                            className={cn(
                              "flex-shrink-0 w-16 p-2 text-xs font-medium",
                              isHourMark ? "text-foreground" : "text-muted-foreground/50"
                            )}
                          >
                            {isHourMark && formatTimeSlot(hour, minute)}
                          </div>

                          {/* Task Area */}
                          <div className="flex-1 p-1.5 relative">
                            {slotTasks.length === 0 ? (
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs text-muted-foreground h-full">
                                <Plus className="h-3 w-3" />
                                <span>Long press to add</span>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                {slotTasks.map((task) => (
                                  <div
                                    key={task.id}
                                    style={{
                                      height: `${calculateTaskHeight(task.estimated_duration)}px`,
                                      minHeight: "48px",
                                    }}
                                  >
                                    <QuestDragCard
                                      task={task}
                                      isDragging={draggedTask === task.id}
                                      onDragStart={(e) => {
                                        e.dataTransfer.setData("taskId", task.id);
                                        setDraggedTask(task.id);
                                        playSound("pop");
                                      }}
                                      showTime
                                      compact
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
              </div>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
};
