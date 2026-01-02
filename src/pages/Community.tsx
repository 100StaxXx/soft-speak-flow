import { useState, useEffect, useRef, useMemo } from "react";
import { format, addDays, subDays } from "date-fns";
import { motion } from "framer-motion";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, LayoutList, Grid3X3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/BottomNav";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { CalendarDayView } from "@/components/CalendarDayView";
import { CalendarMonthView } from "@/components/CalendarMonthView";
import { AddQuestSheet, AddQuestData } from "@/components/AddQuestSheet";
import { EditQuestDialog } from "@/features/quests/components/EditQuestDialog";
import { useCalendarTasks } from "@/hooks/useCalendarTasks";
import { useCalendarMilestones } from "@/hooks/useCalendarMilestones";
import { useDailyTasks } from "@/hooks/useDailyTasks";
import { cn } from "@/lib/utils";

type ViewMode = 'day' | 'month';

const Community = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [prefilledTime, setPrefilledTime] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Edit quest state
  const [editingTask, setEditingTask] = useState<{
    id: string;
    task_text: string;
    difficulty?: string | null;
    scheduled_time?: string | null;
    estimated_duration?: number | null;
  } | null>(null);
  
  // Fetch calendar data
  const { tasks: allCalendarTasks, isLoading: tasksLoading } = useCalendarTasks(selectedDate, viewMode === 'day' ? 'week' : 'month');
  const { milestones: calendarMilestones, getMilestonesForDate } = useCalendarMilestones(selectedDate);
  
  // Daily tasks for updates
  const { addTask, updateTask, isAdding, isUpdating } = useDailyTasks(selectedDate);

  // Format tasks for calendar components
  const formattedTasks = useMemo(() => 
    allCalendarTasks.map(task => ({
      id: task.id,
      task_text: task.task_text,
      completed: task.completed || false,
      scheduled_time: task.scheduled_time,
      estimated_duration: task.estimated_duration,
      task_date: task.task_date,
      difficulty: task.difficulty,
      xp_reward: task.xp_reward,
      is_main_quest: task.is_main_quest || false,
      category: task.category,
    })), [allCalendarTasks]);

  // Auto-scroll to current hour when opening day view
  useEffect(() => {
    if (viewMode === 'day' && scrollRef.current) {
      const currentHour = new Date().getHours();
      const scrollPosition = Math.max(0, (currentHour - 1) * 60);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollPosition, behavior: 'smooth' });
      }, 100);
    }
  }, [viewMode]);

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    if (viewMode === 'month') {
      setViewMode('day');
    }
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    setSelectedDate(current => 
      direction === 'prev' ? subDays(current, 1) : addDays(current, 1)
    );
  };

  const handleTimeSlotLongPress = (date: Date, time: string) => {
    setSelectedDate(date);
    setPrefilledTime(time);
    setShowAddSheet(true);
  };

  const handleTaskClick = (task: { id: string; task_text: string; difficulty?: string | null; scheduled_time?: string | null; estimated_duration?: number | null }) => {
    setEditingTask({
      id: task.id,
      task_text: task.task_text,
      difficulty: task.difficulty,
      scheduled_time: task.scheduled_time,
      estimated_duration: task.estimated_duration,
    });
  };

  const handleTaskLongPress = (taskId: string) => {
    const task = formattedTasks.find(t => t.id === taskId);
    if (task) {
      handleTaskClick(task);
    }
  };

  const handleAddQuest = async (data: AddQuestData) => {
    const taskDate = format(selectedDate, 'yyyy-MM-dd');
    await addTask({
      taskText: data.text,
      difficulty: data.difficulty,
      taskDate,
      isMainQuest: false,
      scheduledTime: data.scheduledTime,
      estimatedDuration: data.estimatedDuration,
      recurrencePattern: data.recurrencePattern,
      recurrenceDays: data.recurrenceDays,
      reminderEnabled: data.reminderEnabled,
      reminderMinutesBefore: data.reminderMinutesBefore,
    });
    setShowAddSheet(false);
    setPrefilledTime(null);
  };

  const handleSaveEdit = async (taskId: string, updates: {
    task_text: string;
    difficulty: string;
    scheduled_time: string | null;
    estimated_duration: number | null;
    recurrence_pattern: string | null;
    recurrence_days: number[];
    reminder_enabled: boolean;
    reminder_minutes_before: number;
    category: string | null;
  }) => {
    await updateTask({ taskId, updates });
    setEditingTask(null);
  };

  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="min-h-screen bg-background pb-nav-safe relative overflow-hidden">
      <StarfieldBackground />
      
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50 pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl mx-auto px-4 py-3">
          {/* Top Row: View Toggle and Title */}
          <div className="flex items-center justify-between mb-3">
            {/* View Mode Toggle */}
            <div className="flex bg-muted/50 rounded-lg p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('day')}
                className={cn(
                  "h-8 px-3 rounded-md transition-all",
                  viewMode === 'day' 
                    ? "bg-background shadow-sm text-foreground" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutList className="h-4 w-4 mr-1.5" />
                Day
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('month')}
                className={cn(
                  "h-8 px-3 rounded-md transition-all",
                  viewMode === 'month' 
                    ? "bg-background shadow-sm text-foreground" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Grid3X3 className="h-4 w-4 mr-1.5" />
                Month
              </Button>
            </div>
            
            {/* Today Button */}
            {!isToday && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(new Date())}
                className="text-xs"
              >
                Today
              </Button>
            )}
          </div>
          
          {/* Date Navigation (Day View Only) */}
          {viewMode === 'day' && (
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateDate('prev')}
                className="h-9 w-9"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              
              <motion.div
                key={format(selectedDate, 'yyyy-MM-dd')}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
              >
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-primary" />
                  <span className="font-semibold">
                    {isToday ? "Today" : format(selectedDate, 'EEEE')}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(selectedDate, 'MMMM d, yyyy')}
                </p>
              </motion.div>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateDate('next')}
                className="h-9 w-9"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto relative z-10">
        {viewMode === 'day' ? (
          <div ref={scrollRef} className="h-[calc(100vh-180px)] overflow-y-auto">
            <CalendarDayView
              selectedDate={selectedDate}
              tasks={formattedTasks}
              milestones={calendarMilestones}
              onDateSelect={handleDateSelect}
              onTaskDrop={() => {}}
              onTimeSlotLongPress={handleTimeSlotLongPress}
              onTaskLongPress={handleTaskLongPress}
              onMilestoneClick={() => {}}
            />
          </div>
        ) : (
          <div className="p-4">
            <CalendarMonthView
              selectedDate={selectedDate}
              onDateSelect={handleDateSelect}
              onMonthChange={setSelectedDate}
              tasks={formattedTasks}
              milestones={calendarMilestones}
              onTaskClick={handleTaskClick}
              onMilestoneClick={() => {}}
            />
          </div>
        )}
      </div>

      {/* Add Quest Sheet */}
      <AddQuestSheet
        open={showAddSheet}
        onOpenChange={(open) => {
          setShowAddSheet(open);
          if (!open) setPrefilledTime(null);
        }}
        selectedDate={selectedDate}
        onAdd={handleAddQuest}
        isAdding={isAdding}
        prefilledTime={prefilledTime}
      />
      
      {/* Edit Quest Dialog */}
      <EditQuestDialog
        task={editingTask}
        open={!!editingTask}
        onOpenChange={(open) => !open && setEditingTask(null)}
        onSave={handleSaveEdit}
        isSaving={isUpdating}
      />

      <BottomNav />
    </div>
  );
};

export default Community;
