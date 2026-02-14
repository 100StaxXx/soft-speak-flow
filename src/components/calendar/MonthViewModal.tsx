import { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, subMonths, startOfWeek, endOfWeek, setYear } from "date-fns";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CalendarTask, CalendarMilestone } from "@/types/quest";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { YearView } from "./YearViewModal";

interface MonthViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  tasks: CalendarTask[];
  milestones?: CalendarMilestone[];
}

export function MonthViewModal({ 
  open, 
  onOpenChange, 
  selectedDate, 
  onDateSelect, 
  tasks,
  milestones = []
}: MonthViewModalProps) {
  const [showYearView, setShowYearView] = useState(false);
  
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const handlePrevMonth = () => {
    onDateSelect(subMonths(selectedDate, 1));
  };

  const handleDateClick = (date: Date) => {
    onDateSelect(date);
    onOpenChange(false);
  };

  const handleHeaderClick = () => {
    setShowYearView(true);
  };

  const handleMonthSelect = (date: Date) => {
    onDateSelect(date);
    setShowYearView(false);
  };

  const handleYearChange = (year: number) => {
    onDateSelect(setYear(selectedDate, year));
  };

  const handleClose = () => {
    setShowYearView(false);
    onOpenChange(false);
  };

  const getTasksForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return tasks.filter(task => task.task_date === dateStr);
  };

  const getMilestonesForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return milestones.filter(m => m.target_date === dateStr);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent 
        className="fixed bottom-0 left-0 right-0 top-auto translate-y-0 translate-x-0 rounded-t-3xl max-h-[75vh] w-full max-w-full p-0 gap-0 border-t border-x border-border/50 bg-background"
        hideCloseButton
      >
        {showYearView ? (
          <YearView
            selectedDate={selectedDate}
            onMonthSelect={handleMonthSelect}
            onBack={() => setShowYearView(false)}
            onClose={handleClose}
            onYearChange={handleYearChange}
            tasks={tasks}
            milestones={milestones}
          />
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePrevMonth}
                  className="h-8 w-8"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <button 
                  onClick={handleHeaderClick}
                  className="text-2xl font-bold flex items-center gap-1"
                >
                  <span className="text-foreground">{format(selectedDate, "MMMM")}</span>
                  <span className="text-primary">{format(selectedDate, "yyyy")}</span>
                  <ChevronRight className="h-5 w-5 text-primary" />
                </button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="h-9 w-9 rounded-full bg-muted"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Calendar Grid */}
            <div className="p-4 overflow-y-auto">
              {/* Day headers */}
              <div className="grid grid-cols-7 mb-2">
                {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
                  <div 
                    key={`${day}-${i}`}
                    className="text-center text-sm font-medium text-muted-foreground py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar days */}
              <div className="grid grid-cols-7 gap-1">
                {days.map((day) => {
                  const dayTasks = getTasksForDate(day);
                  const dayMilestones = getMilestonesForDate(day);
                  const isSelected = isSameDay(day, selectedDate);
                  const isToday = isSameDay(day, new Date());
                  const incompleteTasks = dayTasks.filter(t => !t.completed).length;
                  const completedTasks = dayTasks.filter(t => t.completed).length;
                  const hasMilestones = dayMilestones.length > 0;

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => handleDateClick(day)}
                      className={cn(
                        "flex flex-col items-center py-2.5 rounded-xl transition-all min-h-[60px]",
                        isSelected
                          ? "bg-coral-500 text-white"
                          : isToday
                          ? "bg-coral-500/15 text-coral-500"
                          : !isSameMonth(day, selectedDate)
                          ? "text-muted-foreground/40"
                          : "text-foreground hover:bg-muted/50"
                      )}
                    >
                      <span className={cn(
                        "text-base font-semibold",
                        isSelected && "text-white"
                      )}>
                        {format(day, "d")}
                      </span>
                      
                      {/* Task indicator dots */}
                      <div className="flex items-center justify-center gap-0.5 mt-1 min-h-[6px]">
                        {hasMilestones && (
                          <div className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            isSelected ? "bg-white/70" : "bg-amber-500"
                          )} />
                        )}
                        {incompleteTasks > 0 && (
                          <div className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            isSelected ? "bg-white/70" : "bg-coral-500"
                          )} />
                        )}
                        {completedTasks > 0 && (
                          <div className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            isSelected ? "bg-white/50" : "bg-celestial-blue"
                          )} />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
