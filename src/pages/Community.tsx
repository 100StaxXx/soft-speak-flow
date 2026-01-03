import { useState, useMemo, useCallback } from "react";
import { format } from "date-fns";
import { BottomNav } from "@/components/BottomNav";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { TimelineView } from "@/components/calendar";
import { MonthViewModal } from "@/components/calendar/MonthViewModal";
import { AddQuestSheet, AddQuestData } from "@/components/AddQuestSheet";
import { EditQuestDialog } from "@/features/quests/components/EditQuestDialog";
import { useCalendarTasks } from "@/hooks/useCalendarTasks";
import { useCalendarMilestones } from "@/hooks/useCalendarMilestones";
import { useDailyTasks } from "@/hooks/useDailyTasks";
import { CalendarTask } from "@/types/quest";
import { PageTransition } from "@/components/PageTransition";

const Community = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showMonthModal, setShowMonthModal] = useState(false);
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
  
  // Fetch calendar data - always fetch week view for timeline
  const { tasks: allCalendarTasks, isLoading: tasksLoading } = useCalendarTasks(selectedDate, 'month');
  const { milestones: calendarMilestones } = useCalendarMilestones(selectedDate);
  
  // Daily tasks for updates
  const { addTask, updateTask, deleteTask, isAdding, isUpdating, isDeleting } = useDailyTasks(selectedDate);

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

  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

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

  const handleTaskReschedule = useCallback(async (taskId: string, newTime: string) => {
    await updateTask({ 
      taskId, 
      updates: { scheduled_time: newTime } 
    });
  }, [updateTask]);

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

  const handleDeleteQuest = async (taskId: string) => {
    await deleteTask(taskId);
    setEditingTask(null);
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-nav-safe relative overflow-hidden flex flex-col">
        <StarfieldBackground />
        
        {/* Safe area padding for top */}
        <div className="pt-[env(safe-area-inset-top)]" />

        {/* Main Content */}
        <div className="flex-1 max-w-2xl mx-auto w-full relative z-10 overflow-hidden">
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
            onTaskReschedule={handleTaskReschedule}
            onDateHeaderClick={() => setShowMonthModal(true)}
          />
        </div>

        {/* Month View Modal */}
        <MonthViewModal
          open={showMonthModal}
          onOpenChange={setShowMonthModal}
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
          tasks={formattedTasks}
          milestones={calendarMilestones}
        />

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
          onDelete={handleDeleteQuest}
          isDeleting={isDeleting}
        />

        <BottomNav />
      </div>
    </PageTransition>
  );
};

export default Community;
