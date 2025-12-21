import { useEffect, useRef } from "react";
import { format, isSameDay } from "date-fns";
import { X, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CalendarDayView } from "./CalendarDayView";
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
}

export function HourlyViewModal({
  open,
  onOpenChange,
  selectedDate,
  onDateSelect,
  tasks,
  onTaskDrop,
  onTimeSlotLongPress,
}: HourlyViewModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isToday = isSameDay(selectedDate, new Date());

  // Auto-scroll to show previous hour at top when modal opens
  useEffect(() => {
    if (open && scrollRef.current) {
      setTimeout(() => {
        const currentHour = new Date().getHours();
        const previousHour = Math.max(0, currentHour - 1);
        
        // Find the time slot element for the previous hour using data-hour attribute
        const timeSlotElement = scrollRef.current?.querySelector(
          `[data-hour="${previousHour}"]`
        );
        
        if (timeSlotElement) {
          timeSlotElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 200);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-2xl w-full h-[90vh] p-0 gap-0 flex flex-col bg-background"
        hideCloseButton
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-primary" />
            <DialogTitle className={cn("text-lg font-semibold", isToday && "text-primary")}>
              {isToday ? "Today's Schedule" : `${format(selectedDate, "EEEE")}'s Schedule`}
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

        {/* Date subtitle */}
        <div className="px-4 py-2 text-sm text-muted-foreground border-b border-border/50 shrink-0">
          {format(selectedDate, "MMMM d, yyyy")} • Scroll to view full day (12:00 AM - 11:59 PM)
        </div>

        {/* Scrollable Timeline */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
          <CalendarDayView
            selectedDate={selectedDate}
            onDateSelect={onDateSelect}
            tasks={tasks}
            onTaskDrop={onTaskDrop}
            onTimeSlotLongPress={onTimeSlotLongPress}
            fullDayMode
            hideHeader
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
