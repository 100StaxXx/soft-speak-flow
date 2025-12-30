import { useEffect, useRef, useState } from "react";
import { format, isSameDay } from "date-fns";
import { X, Clock, CalendarDays } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDayView } from "./CalendarDayView";
import { CalendarMonthView } from "./CalendarMonthView";
import { CalendarTask } from "@/types/quest";
import { cn } from "@/lib/utils";

interface HourlyViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  tasks: CalendarTask[];
  onTaskDrop: (taskId: string, newDate: Date, newTime?: string) => void;
  onTimeSlotLongPress?: (date: Date, time: string) => void;
  onTaskLongPress?: (taskId: string) => void;
}

type ViewMode = 'day' | 'month';

export function HourlyViewModal({
  open,
  onOpenChange,
  selectedDate,
  onDateSelect,
  tasks,
  onTaskDrop,
  onTimeSlotLongPress,
  onTaskLongPress,
}: HourlyViewModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const isToday = isSameDay(selectedDate, new Date());

  // Auto-scroll to show previous hour at top when modal opens (day view only)
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
              <SelectTrigger className="w-[120px] h-8 text-sm bg-muted border-0">
                <div className="flex items-center gap-2">
                  {viewMode === 'day' ? (
                    <Clock className="h-4 w-4" />
                  ) : (
                    <CalendarDays className="h-4 w-4" />
                  )}
                  <SelectValue />
                </div>
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
            <DialogTitle className={cn("text-lg font-semibold", isToday && viewMode === 'day' && "text-primary")}>
              {getTitle()}
            </DialogTitle>
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

        {/* Subtitle */}
        <div className="px-4 py-2 text-sm text-muted-foreground border-b border-border/50 shrink-0">
          {getSubtitle()}
        </div>

        {/* Content */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
          {viewMode === 'day' ? (
            <CalendarDayView
              selectedDate={selectedDate}
              onDateSelect={onDateSelect}
              tasks={tasks}
              onTaskDrop={onTaskDrop}
              onTimeSlotLongPress={onTimeSlotLongPress}
              onTaskLongPress={onTaskLongPress}
              fullDayMode
              hideHeader
            />
          ) : (
            <CalendarMonthView
              selectedDate={selectedDate}
              onDateSelect={handleDateSelectFromMonth}
              onMonthChange={handleMonthChange}
              tasks={tasks}
              onTaskClick={handleTaskClick}
              onDateLongPress={(date) => onTimeSlotLongPress?.(date, '09:00')}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
