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
  onTaskLongPress?: (taskId: string) => void;
}

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
  const isToday = isSameDay(selectedDate, new Date());

  // Auto-scroll to show previous hour at top when modal opens
  useEffect(() => {
    if (open) {
      const currentHour = new Date().getHours();
      const previousHour = Math.max(0, currentHour - 1);
      
      let attempts = 0;
      const maxAttempts = 10;
      
      const attemptScroll = () => {
        // Find the time slot element by data-hour attribute
        const targetElement = scrollRef.current?.querySelector(`[data-hour="${previousHour}"]`);
        
        if (targetElement) {
          // Use scrollIntoView with block: 'start' to put the element at the top
          targetElement.scrollIntoView({ block: 'start', behavior: 'instant' });
          
          // Add a small offset to not have it flush against the top
          if (scrollRef.current) {
            scrollRef.current.scrollTop = Math.max(0, scrollRef.current.scrollTop - 8);
          }
        } else if (attempts < maxAttempts) {
          // Element not found yet, content still rendering
          attempts++;
          setTimeout(attemptScroll, 100);
        }
      };
      
      // Initial delay for dialog animation to complete
      const timer = setTimeout(attemptScroll, 300);
      
      return () => clearTimeout(timer);
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
            onTaskLongPress={onTaskLongPress}
            fullDayMode
            hideHeader
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
