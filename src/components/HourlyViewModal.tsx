import { useEffect, useRef, useState } from "react";
import { format, isSameDay, addDays, subDays, setYear } from "date-fns";
import { X, Clock, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDayView } from "./CalendarDayView";
import { CalendarMonthView } from "./CalendarMonthView";
import { YearView } from "./calendar/YearViewModal";
import { CalendarTask, CalendarMilestone } from "@/types/quest";
import { cn } from "@/lib/utils";

interface HourlyViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  tasks: CalendarTask[];
  milestones?: CalendarMilestone[];
  onTaskDrop: (taskId: string, newDate: Date, newTime?: string) => void;
  onTimeSlotLongPress?: (date: Date, time: string) => void;
  onTaskLongPress?: (taskId: string) => void;
  onMilestoneClick?: (milestone: CalendarMilestone) => void;
}

type ViewMode = 'day' | 'month';

export function HourlyViewModal({
  open,
  onOpenChange,
  selectedDate,
  onDateSelect,
  tasks,
  milestones = [],
  onTaskDrop,
  onTimeSlotLongPress,
  onTaskLongPress,
  onMilestoneClick,
}: HourlyViewModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [showYearView, setShowYearView] = useState(false);
  const isToday = isSameDay(selectedDate, new Date());

  // Auto-scroll to show previous hour at top when modal opens (day view only)
  // Scroll to top when switching to month view
  useEffect(() => {
    if (open && viewMode === 'day') {
      const currentHour = new Date().getHours();
      const previousHour = Math.max(0, currentHour - 1);
      
      let attempts = 0;
      const maxAttempts = 10;
      
      const attemptScroll = () => {
        const targetElement = scrollRef.current?.querySelector(`[data-hour="${previousHour}"]`);
        
        if (targetElement) {
          targetElement.scrollIntoView({ block: 'start', behavior: 'instant' });
          
          if (scrollRef.current) {
            scrollRef.current.scrollTop = Math.max(0, scrollRef.current.scrollTop - 8);
          }
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(attemptScroll, 100);
        }
      };
      
      const timer = setTimeout(attemptScroll, 300);
      
      return () => clearTimeout(timer);
    } else if (open && viewMode === 'month') {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
      }
    }
  }, [open, viewMode]);

  const handleDateSelectFromMonth = (date: Date) => {
    onDateSelect(date);
    setViewMode('day');
  };

  const handleMonthChange = (date: Date) => {
    onDateSelect(date);
    // Stay in month view - don't change viewMode
  };

  const handleTaskClick = (task: CalendarTask) => {
    // Switch to day view for the task's date
    const taskDate = new Date(task.task_date + 'T00:00:00');
    onDateSelect(taskDate);
    setViewMode('day');
  };

  const handleMilestoneClick = (milestone: CalendarMilestone) => {
    // Switch to day view for the milestone's target date
    const milestoneDate = new Date(milestone.target_date + 'T00:00:00');
    onDateSelect(milestoneDate);
    setViewMode('day');
  };

  const handleYearSelect = (year: number) => {
    onDateSelect(setYear(selectedDate, year));
  };

  const handleMonthSelectFromYear = (date: Date) => {
    onDateSelect(date);
    setShowYearView(false);
    setViewMode('month');
  };

  const getTitle = () => {
    if (viewMode === 'month') {
      return format(selectedDate, "MMMM yyyy");
    }
    return isToday ? "Today's Schedule" : `${format(selectedDate, "EEEE")}'s Schedule`;
  };

  const getSubtitle = () => {
    if (viewMode === 'month') {
      return "Tap any date to view daily schedule";
    }
    return `${format(selectedDate, "MMMM d, yyyy")} • Scroll to view full day`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-2xl w-full h-[90vh] p-0 gap-0 flex flex-col bg-background"
        hideCloseButton
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            {/* View Mode Dropdown */}
            <Select value={viewMode} onValueChange={(value: ViewMode) => setViewMode(value)}>
            <SelectTrigger className="w-[140px] h-8 text-sm bg-muted border-0">
              <SelectValue />
            </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>Day View</span>
                  </div>
                </SelectItem>
                <SelectItem value="month">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    <span>Month View</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            {viewMode === 'day' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onDateSelect(subDays(selectedDate, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle className={cn("text-lg font-semibold", isToday && viewMode === 'day' && "text-primary")}>
              {getTitle()}
            </DialogTitle>
            {viewMode === 'day' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onDateSelect(addDays(selectedDate, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Subtitle - clickable month and year in day view */}
        <div className="px-4 py-2 text-sm text-muted-foreground border-b border-border/50 shrink-0 flex items-center gap-1">
          {viewMode === 'day' && !showYearView ? (
            <>
              <button 
                onClick={() => setViewMode('month')}
                className="hover:text-primary transition-colors"
              >
                {format(selectedDate, "MMMM d,")}
              </button>
              <button 
                onClick={() => setShowYearView(true)}
                className="text-primary hover:underline transition-colors"
              >
                {format(selectedDate, "yyyy")}
              </button>
              <span className="ml-1">• Scroll to view full day</span>
            </>
          ) : (
            getSubtitle()
          )}
        </div>

        {/* Content */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
          {showYearView ? (
            <YearView
              selectedDate={selectedDate}
              onMonthSelect={handleMonthSelectFromYear}
              onBack={() => setShowYearView(false)}
              onClose={() => onOpenChange(false)}
              onYearChange={handleYearSelect}
              tasks={tasks}
              milestones={milestones}
            />
          ) : viewMode === 'day' ? (
            <div className="relative">
              <CalendarDayView
                selectedDate={selectedDate}
                onDateSelect={onDateSelect}
                tasks={tasks}
                milestones={milestones}
                onTaskDrop={onTaskDrop}
                onTimeSlotLongPress={onTimeSlotLongPress}
                onTaskLongPress={onTaskLongPress}
                onMilestoneClick={onMilestoneClick}
                fullDayMode
                hideHeader
              />
            </div>
          ) : (
            <CalendarMonthView
              selectedDate={selectedDate}
              onDateSelect={handleDateSelectFromMonth}
              onMonthChange={handleMonthChange}
              tasks={tasks}
              milestones={milestones}
              onTaskClick={handleTaskClick}
              onMilestoneClick={handleMilestoneClick}
              onDateLongPress={(date) => onTimeSlotLongPress?.(date, '09:00')}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
