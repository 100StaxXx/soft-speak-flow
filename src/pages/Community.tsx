import { useState, useMemo, useCallback } from "react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutList, Grid3X3, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/BottomNav";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { TimelineView } from "@/components/calendar";
import { CalendarMonthView } from "@/components/CalendarMonthView";
import { AddQuestSheet, AddQuestData } from "@/components/AddQuestSheet";
import { EditQuestDialog } from "@/features/quests/components/EditQuestDialog";
import { useCalendarTasks } from "@/hooks/useCalendarTasks";
import { useCalendarMilestones } from "@/hooks/useCalendarMilestones";
import { useDailyTasks } from "@/hooks/useDailyTasks";
import { cn } from "@/lib/utils";
import { CalendarTask } from "@/types/quest";

type ViewMode = 'day' | 'month';

const Community = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [prefilledTime, setPrefilledTime] = useState<string | null>(null);
  
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
  const { milestones: calendarMilestones } = useCalendarMilestones(selectedDate);
  
  // Daily tasks for updates
  const { addTask, updateTask, isAdding, isUpdating } = useDailyTasks(selectedDate);

  // Format tasks for calendar components - memoized for performance
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

  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
    if (viewMode === 'month') {
      setViewMode('day');
    }
  }, [viewMode]);

  const handleTimeSlotLongPress = useCallback((date: Date, time: string) => {
    setSelectedDate(date);
    setPrefilledTime(time);
    setShowAddSheet(true);
  }, []);

  const handleTaskClick = useCallback((task: CalendarTask) => {
    setEditingTask({
      id: task.id,
      task_text: task.task_text,
      difficulty: task.difficulty,
      scheduled_time: task.scheduled_time,
      estimated_duration: task.estimated_duration,
    });
  }, []);

  const handleTaskLongPress = useCallback((taskId: string) => {
    const task = formattedTasks.find(t => t.id === taskId);
    if (task) {
      handleTaskClick(task);
    }
  }, [formattedTasks, handleTaskClick]);

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

  return (
    <div className="min-h-screen bg-background pb-nav-safe relative overflow-hidden flex flex-col">
      <StarfieldBackground />
      
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50 pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
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
            
            {/* Add Button */}
            <Button
              size="sm"
              onClick={() => setShowAddSheet(true)}
              className="h-8 gap-1"
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 max-w-2xl mx-auto w-full relative z-10 overflow-hidden">
        <AnimatePresence mode="wait">
          {viewMode === 'day' ? (
            <motion.div 
              key={`day-${format(selectedDate, 'yyyy-MM-dd')}`}
              className="h-full"
              initial={{ opacity: 0.8 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
            >
              <TimelineView
                selectedDate={selectedDate}
                onDateSelect={handleDateSelect}
                tasks={formattedTasks}
                milestones={calendarMilestones}
                onTaskClick={handleTaskClick}
                onTaskLongPress={handleTaskLongPress}
                onTimeSlotLongPress={handleTimeSlotLongPress}
                onMilestoneClick={() => {}}
                onAddClick={() => setShowAddSheet(true)}
              />
            </motion.div>
          ) : (
            <motion.div 
              key="month"
              className="p-4 h-full overflow-y-auto"
              initial={{ opacity: 0.8, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              <CalendarMonthView
                selectedDate={selectedDate}
                onDateSelect={handleDateSelect}
                onMonthChange={setSelectedDate}
                tasks={formattedTasks}
                milestones={calendarMilestones}
                onTaskClick={(task) => handleTaskClick(task as CalendarTask)}
                onMilestoneClick={() => {}}
              />
            </motion.div>
          )}
        </AnimatePresence>
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
