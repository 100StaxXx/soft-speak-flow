import { useRef, useEffect, useCallback, memo } from "react";
import { cn } from "@/lib/utils";
import { format, addDays, subDays, isSameDay, isToday } from "date-fns";
import { motion } from "framer-motion";
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useTaskDragOptional } from "@/contexts/TaskDragContext";

interface DatePillsScrollerProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  tasksPerDay?: Record<string, number>;
  daysToShow?: number;
  onTaskDrop?: (taskId: string, targetDate: Date) => void;
}

const triggerHaptic = async (style: ImpactStyle) => {
  try {
    await Haptics.impact({ style });
  } catch (e) {
    // Haptics not available on web
  }
};

export const DatePillsScroller = memo(function DatePillsScroller({
  selectedDate,
  onDateSelect,
  tasksPerDay = {},
  daysToShow = 14,
  onTaskDrop,
}: DatePillsScrollerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const lastHoveredRef = useRef<string | null>(null);
  
  const dragContext = useTaskDragOptional();
  const isDraggingTask = dragContext?.isDragging ?? false;
  const draggedTask = dragContext?.draggedTask;
  const hoveredDate = dragContext?.hoveredDate;

  // Generate date range centered around today
  const today = new Date();
  const startDate = subDays(today, 3);
  const dates = Array.from({ length: daysToShow }, (_, i) => addDays(startDate, i));

  const getTaskCount = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return tasksPerDay[dateKey] || 0;
  };

  // Scroll to selected date on mount and when it changes
  useEffect(() => {
    if (selectedRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const selected = selectedRef.current;
      const containerWidth = container.offsetWidth;
      const selectedLeft = selected.offsetLeft;
      const selectedWidth = selected.offsetWidth;
      
      container.scrollTo({
        left: selectedLeft - (containerWidth / 2) + (selectedWidth / 2),
        behavior: 'smooth'
      });
    }
  }, [selectedDate]);

  const handlePointerEnter = useCallback((date: Date) => {
    if (!isDraggingTask || !dragContext) return;
    
    const dateKey = format(date, 'yyyy-MM-dd');
    if (lastHoveredRef.current !== dateKey) {
      lastHoveredRef.current = dateKey;
      dragContext.setHoveredDate(date);
      triggerHaptic(ImpactStyle.Light);
    }
  }, [isDraggingTask, dragContext]);

  const handlePointerLeave = useCallback(() => {
    if (!isDraggingTask || !dragContext) return;
    lastHoveredRef.current = null;
    dragContext.setHoveredDate(null);
  }, [isDraggingTask, dragContext]);

  const handlePointerUp = useCallback((date: Date) => {
    if (!isDraggingTask || !draggedTask || !onTaskDrop) return;
    
    // Don't move to the same date
    const targetDateStr = format(date, 'yyyy-MM-dd');
    if (draggedTask.task_date === targetDateStr) return;
    
    onTaskDrop(draggedTask.id, date);
    triggerHaptic(ImpactStyle.Medium);
  }, [isDraggingTask, draggedTask, onTaskDrop]);

  return (
    <div 
      ref={scrollRef}
      className={cn(
        "flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1 transition-all duration-200",
        isDraggingTask && "py-1"
      )}
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {dates.map((date, i) => {
        const isSelected = isSameDay(date, selectedDate);
        const isDayToday = isToday(date);
        const taskCount = getTaskCount(date);
        const dateKey = format(date, 'yyyy-MM-dd');
        const isHovered = hoveredDate && isSameDay(date, hoveredDate);
        const isSourceDate = draggedTask?.task_date === dateKey;

        return (
          <motion.button
            key={i}
            ref={isSelected ? selectedRef : undefined}
            onClick={() => !isDraggingTask && onDateSelect(date)}
            onPointerEnter={() => handlePointerEnter(date)}
            onPointerLeave={handlePointerLeave}
            onPointerUp={() => handlePointerUp(date)}
            className={cn(
              "flex-shrink-0 flex flex-col items-center justify-center",
              "min-w-[52px] h-16 rounded-xl transition-all duration-200",
              "border border-border/50",
              isSelected 
                ? "bg-gradient-to-br from-primary to-purple-500 text-white border-primary shadow-lg shadow-primary/25" 
                : "bg-card/50 hover:bg-card hover:border-primary/30",
              isDayToday && !isSelected && "border-celestial-blue/50 ring-1 ring-celestial-blue/30 bg-celestial-blue/5",
              // Drag states
              isDraggingTask && !isSourceDate && "ring-2 ring-primary/30 border-primary/50",
              isHovered && !isSourceDate && "ring-2 ring-accent border-accent bg-accent/20 scale-110",
              isSourceDate && isDraggingTask && "opacity-50"
            )}
            animate={{
              scale: isHovered && !isSourceDate ? 1.1 : isDraggingTask && !isSourceDate ? 1.02 : 1,
              y: isHovered && !isSourceDate ? -4 : 0,
            }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <span className={cn(
              "text-[10px] font-medium uppercase tracking-wide",
              isSelected ? "text-white/90" : isDayToday ? "text-celestial-blue" : "text-muted-foreground"
            )}>
              {format(date, 'EEE')}
            </span>
            <span className={cn(
              "text-lg font-bold leading-tight",
              isSelected ? "text-white" : isDayToday ? "text-celestial-blue" : "text-foreground"
            )}>
              {format(date, 'd')}
            </span>
            {/* Task indicator */}
            <div className="flex gap-0.5 mt-0.5 h-1.5">
              {taskCount > 0 && (
                <>
                  <div className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    isSelected ? "bg-white/70" : isDayToday ? "bg-celestial-blue/60" : "bg-stardust-gold/60"
                  )} />
                  {taskCount > 1 && (
                    <div className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      isSelected ? "bg-white/50" : isDayToday ? "bg-celestial-blue/40" : "bg-stardust-gold/40"
                    )} />
                  )}
                  {taskCount > 2 && (
                    <div className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      isSelected ? "bg-white/30" : isDayToday ? "bg-celestial-blue/20" : "bg-stardust-gold/20"
                    )} />
                  )}
                </>
              )}
            </div>
            
            {/* Drop indicator when hovered during drag */}
            {isHovered && !isSourceDate && (
              <motion.div
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-1 rounded-full bg-accent"
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                exit={{ opacity: 0, scaleX: 0 }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
});
