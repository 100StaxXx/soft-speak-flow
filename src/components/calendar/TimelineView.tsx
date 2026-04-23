import { useMemo, useRef } from "react";
import { format, isSameDay } from "date-fns";
import { motion } from "framer-motion";
import type { CalendarMilestone } from "@/features/epics/types";
import type { CalendarQuest } from "@/features/quests/display";
import { cn } from "@/lib/utils";
import { Clock, Plus, ChevronRight } from "lucide-react";
import { useTimelineDrag } from "@/hooks/useTimelineDrag";
import {
  SHARED_TIMELINE_DRAG_INTERACTION_PROFILE,
  SHARED_TIMELINE_DRAG_PROFILE,
} from "./dragSnap";
import { WeekStrip } from "./WeekStrip";
import { TimelineTaskCard } from "./TimelineTaskCard";
import { AllDayTaskBanner } from "./AllDayTaskBanner";
import { MilestoneCalendarCard } from "../MilestoneCalendarCard";
import { DragTimeZoomRail } from "./DragTimeZoomRail";
import { Button } from "../ui/button";

interface TimelineViewProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  quests: CalendarQuest[];
  milestones?: CalendarMilestone[];
  onQuestClick?: (quest: CalendarQuest) => void;
  onTaskLongPress?: (taskId: string) => void;
  onTimeSlotLongPress?: (date: Date, time: string) => void;
  onMilestoneClick?: (milestone: CalendarMilestone) => void;
  onAddClick?: () => void;
  onTaskReschedule?: (taskId: string, newTime: string) => void;
  onDateHeaderClick?: () => void;
}

export function TimelineView({
  selectedDate,
  onDateSelect,
  quests,
  milestones = [],
  onQuestClick,
  onTaskLongPress,
  onTimeSlotLongPress: _onTimeSlotLongPress,
  onMilestoneClick,
  onAddClick,
  onTaskReschedule,
  onDateHeaderClick,
}: TimelineViewProps) {
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const isToday = isSameDay(selectedDate, new Date());

  // Filter and sort quests for the selected day
  const dayQuests = useMemo(() => {
    return quests
      .filter((quest) => quest.taskDate === dateStr)
      .sort((a, b) => {
        if (a.scheduledTime && b.scheduledTime) {
          return a.scheduledTime.localeCompare(b.scheduledTime);
        }
        if (a.scheduledTime) return -1;
        if (b.scheduledTime) return 1;
        return 0;
      });
  }, [quests, dateStr]);

  const allDayQuests = dayQuests.filter((quest) => quest.estimatedDuration === 1440);
  const scheduledQuests = dayQuests.filter((quest) => quest.scheduledTime && quest.estimatedDuration !== 1440);
  const unscheduledQuests = dayQuests.filter((quest) => !quest.scheduledTime && quest.estimatedDuration !== 1440);
  const dayMilestones = milestones.filter((m) => m.target_date === dateStr);
  const timelineDragContainerRef = useRef<HTMLDivElement>(null);
  const timelineDrag = useTimelineDrag({
    containerRef: timelineDragContainerRef,
    snapConfig: SHARED_TIMELINE_DRAG_PROFILE,
    ...SHARED_TIMELINE_DRAG_INTERACTION_PROFILE,
    onDrop: (taskId, newTime) => {
      onTaskReschedule?.(taskId, newTime);
    },
  });

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
          quests={quests}
        />
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="relative px-4">
          {/* Vertical Timeline Line */}
          {(scheduledQuests.length > 0 || unscheduledQuests.length > 0) && (
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

          {/* All Day Tasks */}
          {allDayQuests.length > 0 && (
            <div className="py-3 space-y-1.5">
              {allDayQuests.map((quest) => (
                <AllDayTaskBanner
                  key={quest.id}
                  quest={quest}
                  onClick={onQuestClick ? () => onQuestClick(quest) : undefined}
                />
              ))}
            </div>
          )}

          {/* Scheduled Tasks Timeline */}
          {scheduledQuests.length > 0 && (
            <div className="py-4" ref={timelineDragContainerRef}>
              {scheduledQuests.map((quest) => {
                const isThisDragging = timelineDrag.draggingTaskId === quest.id;
                const isThisLongPressed = timelineDrag.longPressTaskId === quest.id;
                const isThisEngaged = isThisDragging || isThisLongPressed;
                const isAnyDragging = timelineDrag.isDragging;

                return (
                <motion.div 
                  key={quest.id} 
                  className={cn(
                    "relative transition-transform duration-75",
                    isThisDragging && "z-10"
                  )}
                  style={{
                    y: isThisDragging ? timelineDrag.dragOffsetY : 0,
                    touchAction: isThisEngaged ? "none" : "pan-y",
                    opacity: isAnyDragging && !isThisDragging ? 0.7 : 1,
                    pointerEvents: isAnyDragging && !isThisDragging ? "none" : "auto",
                  }}
                >
                  <TimelineTaskCard
                    quest={quest}
                    onQuestClick={onQuestClick ? () => onQuestClick(quest) : undefined}
                    onQuestLongPress={onTaskLongPress}
                    isDragging={isThisDragging}
                    previewTime={isThisDragging ? timelineDrag.previewTime : null}
                    rowDragProps={quest.scheduledTime && !quest.completed
                      ? timelineDrag.getRowDragProps(quest.id, quest.scheduledTime)
                      : undefined}
                  />
                </motion.div>
              )})}
            </div>
          )}

          {/* Inline Add Task Button */}
          {onAddClick && (
            <div className="py-3">
              <button
                onClick={onAddClick}
                data-tour="add-quest-launcher"
                className="flex items-center gap-3 w-full py-3 px-4 rounded-xl bg-coral-500/10 hover:bg-coral-500/20 transition-colors group"
              >
                <div className="w-10 h-10 rounded-full bg-coral-500/20 flex items-center justify-center group-hover:bg-coral-500/30 transition-colors">
                  <Plus className="h-5 w-5 text-coral-500" />
                </div>
                <span className="font-medium text-coral-500">Add Quest</span>
              </button>
            </div>
          )}

          {/* Unscheduled / Anytime Tasks */}
          {unscheduledQuests.length > 0 && (
            <div className="py-4 border-t border-dashed border-border/40">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 pl-16">
                <Clock className="h-3.5 w-3.5" />
                Anytime
              </div>
              <div className="space-y-1">
                {unscheduledQuests.map((quest) => (
                  <div
                    key={quest.id}
                    onClick={() => onQuestClick?.(quest)}
                    className="flex items-center gap-4 py-3 cursor-pointer"
                  >
                    <div className="w-14 h-14 rounded-full bg-muted/30 flex items-center justify-center">
                      <Clock className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <span className="font-semibold text-lg text-foreground flex-1 truncate">
                      {quest.title}
                    </span>
                    <div className="w-8 h-8 rounded-full border-2 border-muted-foreground/30" />
                  </div>
                ))}
              </div>
            </div>
          )}


          {/* Empty State */}
          {dayQuests.length === 0 && (
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
                  data-tour="add-quest-launcher"
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

      <DragTimeZoomRail rail={timelineDrag.zoomRail} />
    </div>
  );
}
