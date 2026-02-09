import { useState } from "react";
import { format, setYear } from "date-fns";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CalendarMonthView } from "./CalendarMonthView";
import { YearView } from "./calendar/YearViewModal";
import { CalendarTask, CalendarMilestone } from "@/types/quest";

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

export function HourlyViewModal({
  open,
  onOpenChange,
  selectedDate,
  onDateSelect,
  tasks,
  milestones = [],
  onTimeSlotLongPress,
}: HourlyViewModalProps) {
  const [showYearView, setShowYearView] = useState(false);

  const handleDateSelectFromMonth = (date: Date) => {
    onDateSelect(date);
    onOpenChange(false);
  };

  const handleMonthChange = (date: Date) => {
    onDateSelect(date);
  };

  const handleTaskClick = (task: CalendarTask) => {
    const taskDate = new Date(task.task_date + 'T00:00:00');
    onDateSelect(taskDate);
    onOpenChange(false);
  };

  const handleMilestoneClick = (milestone: CalendarMilestone) => {
    const milestoneDate = new Date(milestone.target_date + 'T00:00:00');
    onDateSelect(milestoneDate);
    onOpenChange(false);
  };

  const handleYearSelect = (year: number) => {
    onDateSelect(setYear(selectedDate, year));
  };

  const handleMonthSelectFromYear = (date: Date) => {
    onDateSelect(date);
    setShowYearView(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-2xl w-full h-[90vh] p-0 gap-0 flex flex-col bg-background"
        hideCloseButton
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <DialogTitle className="text-lg font-semibold">
            {format(selectedDate, "MMMM yyyy")}
          </DialogTitle>
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
          Tap any date to view daily schedule
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
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
