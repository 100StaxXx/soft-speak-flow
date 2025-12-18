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

  // Auto-scroll to current hour when modal opens
  useEffect(() => {
    if (open && scrollRef.current) {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinutes = now.getMinutes();
      
      // Each hour has 2 time slots (30min each), each slot is ~60px height
      // So each hour = 120px. Add partial hour offset for more precision.
      const hourOffset = currentHour * 120;
      const minuteOffset = (currentMinutes / 60) * 120;
      // Scroll to show current time roughly in the upper third of the viewport
      const viewportOffset = 100;
      const scrollTarget = Math.max(0, hourOffset + minuteOffset - viewportOffset);
      
      // Use a longer timeout to ensure DOM is fully rendered
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTo({ top: scrollTarget, behavior: "smooth" });
        }
      }, 150);
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
