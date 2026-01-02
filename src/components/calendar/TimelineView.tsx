import { useMemo, useState, useCallback } from "react";
import { format, isSameDay, parse } from "date-fns";
import { cn } from "@/lib/utils";
import { Clock, Plus, ChevronRight } from "lucide-react";
import { CalendarTask, CalendarMilestone } from "@/types/quest";
import { WeekStrip } from "./WeekStrip";
import { TimelineTaskCard } from "./TimelineTaskCard";
import { MilestoneCalendarCard } from "../MilestoneCalendarCard";
import { Button } from "../ui/button";

interface TimelineViewProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  tasks: CalendarTask[];
  milestones?: CalendarMilestone[];
  onTaskClick?: (task: CalendarTask) => void;
  onTaskLongPress?: (taskId: string) => void;
  onTimeSlotLongPress?: (date: Date, time: string) => void;
  onMilestoneClick?: (milestone: CalendarMilestone) => void;
  onAddClick?: () => void;
  onTaskReschedule?: (taskId: string, newTime: string) => void;
  onDateHeaderClick?: () => void;
}

// Calculate new time based on drag offset
function calculateNewTime(originalTime: string, deltaY: number): string {
  const minutesPerPixel = 0.75;
  const deltaMinutes = Math.round((deltaY * minutesPerPixel) / 15) * 15;
  
  const original = parse(originalTime, "HH:mm", new Date());
  const newTime = new Date(original.getTime() + deltaMinutes * 60000);
  
  const hours = Math.max(6, Math.min(23, newTime.getHours()));
  const minutes = Math.min(45, Math.max(0, Math.floor(newTime.getMinutes() / 15) * 15));
  
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

export function TimelineView({
  selectedDate,
  onDateSelect,
  tasks,
  milestones = [],
  onTaskClick,
  onTaskLongPress,
  onTimeSlotLongPress,
  onMilestoneClick,
  onAddClick,
  onTaskReschedule,
  onDateHeaderClick,
}: TimelineViewProps) {
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const isToday = isSameDay(selectedDate, new Date());

  // Drag state
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  // Filter and sort tasks for the selected day
  const dayTasks = useMemo(() => {
    return tasks
      .filter((t) => t.task_date === dateStr)
      .sort((a, b) => {
        if (a.scheduled_time && b.scheduled_time) {
          return a.scheduled_time.localeCompare(b.scheduled_time);
        }
        if (a.scheduled_time) return -1;
        if (b.scheduled_time) return 1;
        return 0;
      });
  }, [tasks, dateStr]);

  const scheduledTasks = dayTasks.filter((t) => t.scheduled_time && !t.completed);
  const unscheduledTasks = dayTasks.filter((t) => !t.scheduled_time && !t.completed);
  const completedTasks = dayTasks.filter((t) => t.completed);
  const dayMilestones = milestones.filter((m) => m.target_date === dateStr);

  // Drag handlers
  const handleDragStart = useCallback((taskId: string) => {
    setDraggingTaskId(taskId);
    setDragOffset(0);
  }, []);

  const handleDragMove = useCallback((deltaY: number) => {
    setDragOffset(deltaY);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (draggingTaskId && dragOffset !== 0 && onTaskReschedule) {
      const task = scheduledTasks.find(t => t.id === draggingTaskId);
      if (task?.scheduled_time) {
        const newTime = calculateNewTime(task.scheduled_time, dragOffset);
        if (newTime !== task.scheduled_time) {
          onTaskReschedule(draggingTaskId, newTime);
        }
      }
    }
    setDraggingTaskId(null);
    setDragOffset(0);
  }, [draggingTaskId, dragOffset, scheduledTasks, onTaskReschedule]);

  const getDragPreviewTime = (task: CalendarTask) => {
    if (task.id === draggingTaskId && task.scheduled_time && dragOffset !== 0) {
      return calculateNewTime(task.scheduled_time, dragOffset);
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with Date + Week Strip */}
      <div className="px-4 pt-4 pb-4 border-b border-border/30">
        {/* Tappable Date Header */}
        <button 
          onClick={onDateHeaderClick}
          className="flex items-center gap-1 mb-4 group"
        >
          <span className="text-3xl font-bold text-foreground">
            {format(selectedDate, "MMMM d,")}
          </span>
          <span className="text-3xl font-bold text-primary">
            {format(selectedDate, "yyyy")}
          </span>
          <ChevronRight className="h-6 w-6 text-primary group-hover:translate-x-0.5 transition-transform" />
        </button>
        
        <WeekStrip 
          selectedDate={selectedDate} 
          onDateSelect={onDateSelect}
          tasks={tasks}
        />
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="relative px-4">
          {/* Vertical Timeline Line */}
          {(scheduledTasks.length > 0 || unscheduledTasks.length > 0) && (
            <div className="absolute left-11 top-4 bottom-4 w-px border-l-2 border-dashed border-border/40" />
          )}

          {/* Milestones */}
          {dayMilestones.length > 0 && (
            <div className="py-4 border-b border-border/30">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 pl-16">
                Goals for Today
              </h3>
              <div className="space-y-2 pl-16">
                {dayMilestones.map((milestone) => (
                  <MilestoneCalendarCard
                    key={milestone.id}
                    milestone={milestone}
                    onClick={() => onMilestoneClick?.(milestone)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Scheduled Tasks Timeline */}
          {scheduledTasks.length > 0 && (
            <div className="py-4">
              {scheduledTasks.map((task) => (
                <div 
                  key={task.id} 
                  className={cn(
                    "relative transition-transform duration-75",
                    task.id === draggingTaskId && "z-10"
                  )}
                  style={{
                    transform: task.id === draggingTaskId ? `translateY(${dragOffset}px)` : undefined,
                  }}
                >
                  <TimelineTaskCard
                    task={task}
                    onTaskClick={onTaskClick}
                    onTaskLongPress={onTaskLongPress}
                    isDragging={task.id === draggingTaskId}
                    previewTime={getDragPreviewTime(task)}
                    onDragStart={() => handleDragStart(task.id)}
                    onDragMove={handleDragMove}
                    onDragEnd={handleDragEnd}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Inline Add Task Button */}
          {onAddClick && (
            <div className="py-3">
              <button
                onClick={onAddClick}
                className="flex items-center gap-3 w-full py-3 px-4 rounded-xl bg-coral-500/10 hover:bg-coral-500/20 transition-colors group"
              >
                <div className="w-10 h-10 rounded-full bg-coral-500/20 flex items-center justify-center group-hover:bg-coral-500/30 transition-colors">
                  <Plus className="h-5 w-5 text-coral-500" />
                </div>
                <span className="font-medium text-coral-500">Add Task</span>
              </button>
            </div>
          )}

          {/* Unscheduled / Anytime Tasks */}
          {unscheduledTasks.length > 0 && (
            <div className="py-4 border-t border-dashed border-border/40">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 pl-16">
                <Clock className="h-3.5 w-3.5" />
                Anytime
              </div>
              <div className="space-y-1">
                {unscheduledTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => onTaskClick?.(task)}
                    className="flex items-center gap-4 py-3 cursor-pointer"
                  >
                    <div className="w-14 h-14 rounded-full bg-muted/30 flex items-center justify-center">
                      <Clock className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <span className="font-semibold text-lg text-foreground flex-1 truncate">
                      {task.task_text}
                    </span>
                    <div className="w-8 h-8 rounded-full border-2 border-muted-foreground/30" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed Tasks */}
          {completedTasks.length > 0 && (
            <div className="py-4 border-t border-border/30">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 pl-16">
                Completed ({completedTasks.length})
              </h3>
              <div className="space-y-1 opacity-50">
                {completedTasks.map((task) => (
                  <TimelineTaskCard
                    key={task.id}
                    task={task}
                    onTaskClick={onTaskClick}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {dayTasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-full bg-coral-500/10 flex items-center justify-center mb-4">
                <Plus className="h-10 w-10 text-coral-500" />
              </div>
              <h3 className="font-bold text-xl text-foreground mb-1">No quests yet</h3>
              <p className="text-sm text-muted-foreground mb-6">
                {isToday ? "Start your day by adding a quest" : "Add quests for this day"}
              </p>
              {onAddClick && (
                <Button 
                  onClick={onAddClick} 
                  className="bg-coral-500 hover:bg-coral-600 text-white rounded-full px-6"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Quest
                </Button>
              )}
            </div>
          )}
          
          {/* Bottom padding */}
          <div className="h-8" />
        </div>
      </div>
    </div>
  );
}
