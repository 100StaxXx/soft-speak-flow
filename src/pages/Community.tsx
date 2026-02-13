import { useState, useMemo, useCallback } from "react";
import { format } from "date-fns";
import { BottomNav } from "@/components/BottomNav";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { TimelineView } from "@/components/calendar";
import { CalendarDayView } from "@/components/CalendarDayView";
import { MonthViewModal } from "@/components/calendar/MonthViewModal";
import { CalendarViewToggle } from "@/components/calendar/CalendarViewToggle";
import { AddQuestSheet, AddQuestData } from "@/components/AddQuestSheet";
import { EditQuestDialog } from "@/features/quests/components/EditQuestDialog";
import { useCalendarTasks } from "@/hooks/useCalendarTasks";
import { useCalendarMilestones } from "@/hooks/useCalendarMilestones";
import { useDailyTasks } from "@/hooks/useDailyTasks";
import { useQuestCalendarSync } from "@/hooks/useQuestCalendarSync";
import { CalendarTask } from "@/types/quest";
import { PageTransition } from "@/components/PageTransition";
import { toast } from "sonner";

const TIME_24H_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_INPUT_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const Community = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarView, setCalendarView] = useState<'timeline' | 'grid'>('timeline');
  const [showMonthModal, setShowMonthModal] = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [prefilledTime, setPrefilledTime] = useState<string | null>(null);
  
  // Edit quest state
  const [editingTask, setEditingTask] = useState<{
    id: string;
    task_text: string;
    task_date?: string | null;
    difficulty?: string | null;
    scheduled_time?: string | null;
    estimated_duration?: number | null;
    recurrence_pattern?: string | null;
    recurrence_days?: number[] | null;
    reminder_enabled?: boolean | null;
    reminder_minutes_before?: number | null;
    category?: string | null;
    image_url?: string | null;
  } | null>(null);
  
  // Fetch calendar data - always fetch week view for timeline
  const { tasks: allCalendarTasks, isLoading: tasksLoading } = useCalendarTasks(selectedDate, 'month');
  const { milestones: calendarMilestones } = useCalendarMilestones(selectedDate);
  
  // Daily tasks for updates
  const { addTask, updateTask, deleteTask, isAdding, isUpdating, isDeleting } = useDailyTasks(selectedDate);
  const { sendTaskToCalendar, syncTaskUpdate, syncTaskDelete, hasLinkedEvent } = useQuestCalendarSync();

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
      task_date: task.task_date,
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
    await syncTaskUpdate.mutateAsync({ taskId }).catch(() => {
      toast.error("Saved quest, but failed to sync linked calendar event");
    });
  }, [updateTask, syncTaskUpdate]);

  // Adapter for CalendarDayView's onTaskDrop signature
  const handleTaskDrop = useCallback((taskId: string, _date: Date, newTime?: string) => {
    if (newTime) {
      handleTaskReschedule(taskId, newTime);
    }
  }, [handleTaskReschedule]);

  const handleSendTaskToCalendar = useCallback(async (taskId: string) => {
    let taskDateOverride: string | undefined;
    let scheduledTimeOverride: string | undefined;

    const attempt = async () => {
      await sendTaskToCalendar.mutateAsync({
        taskId,
        options: taskDateOverride || scheduledTimeOverride
          ? {
              taskDate: taskDateOverride,
              scheduledTime: scheduledTimeOverride,
            }
          : undefined,
      });
    };

    try {
      await attempt();
      toast.success("Quest synced to calendar");
      return;
    } catch (error) {
      let message = error instanceof Error ? error.message : "Failed to send quest to calendar";

      for (let attemptIndex = 0; attemptIndex < 2; attemptIndex += 1) {
        if (message.includes("TASK_DATE_REQUIRED") && !taskDateOverride) {
          const pickedDate = window.prompt(
            "Choose a date to send this quest (YYYY-MM-DD)",
            format(selectedDate, "yyyy-MM-dd"),
          );
          if (!pickedDate || !DATE_INPUT_REGEX.test(pickedDate)) {
            toast.error("Calendar send cancelled. Please choose a valid YYYY-MM-DD date.");
            return;
          }
          taskDateOverride = pickedDate;
        }

        if (message.includes("SCHEDULED_TIME_REQUIRED") && !scheduledTimeOverride) {
          const pickedTime = window.prompt("Choose a time to send this quest (HH:mm)", "09:00");
          if (!pickedTime || !TIME_24H_REGEX.test(pickedTime)) {
            toast.error("Calendar send cancelled. Please choose a valid HH:mm time.");
            return;
          }
          scheduledTimeOverride = pickedTime;
        }

        try {
          await attempt();
          toast.success("Quest synced to calendar");
          return;
        } catch (retryError) {
          message = retryError instanceof Error ? retryError.message : "Failed to send quest to calendar";
          if (
            !message.includes("TASK_DATE_REQUIRED")
            && !message.includes("SCHEDULED_TIME_REQUIRED")
          ) {
            toast.error(message);
            return;
          }
        }
      }

      if (message.includes("TASK_DATE_REQUIRED")) {
        toast.error("Please assign a date before sending this quest to calendar.");
        return;
      }

      if (message.includes("SCHEDULED_TIME_REQUIRED")) {
        toast.error("Please assign a time before sending this quest to calendar.");
        return;
      }

      toast.error(message);
    }
  }, [selectedDate, sendTaskToCalendar]);

  const handleAddQuest = async (data: AddQuestData) => {
    const taskDate = data.sendToInbox
      ? null
      : (data.taskDate ?? format(selectedDate, 'yyyy-MM-dd'));

    const createdTask = await addTask({
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
      notes: data.moreInformation,
      location: data.location,
      contactId: data.contactId,
      autoLogInteraction: data.autoLogInteraction,
      subtasks: data.subtasks,
    });

    if (data.sendToCalendar && createdTask?.id) {
      await handleSendTaskToCalendar(createdTask.id);
    }
    setShowAddSheet(false);
    setPrefilledTime(null);
  };

  const handleSaveEdit = async (taskId: string, updates: {
    task_text: string;
    task_date: string | null;
    difficulty: string;
    scheduled_time: string | null;
    estimated_duration: number | null;
    recurrence_pattern: string | null;
    recurrence_days: number[];
    reminder_enabled: boolean;
    reminder_minutes_before: number;
    notes: string | null;
    category: string | null;
    image_url: string | null;
    location: string | null;
  }) => {
    await updateTask({ taskId, updates });
    await syncTaskUpdate.mutateAsync({ taskId }).catch(() => {
      toast.error("Saved quest, but failed to sync linked calendar event");
    });
    setEditingTask(null);
  };

  const handleDeleteQuest = async (taskId: string) => {
    await syncTaskDelete.mutateAsync({ taskId }).catch(() => {
      toast.error("Failed to remove linked calendar event");
    });
    await deleteTask(taskId);
    toast.success("Quest deleted");
    setEditingTask(null);
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-nav-safe relative overflow-hidden flex flex-col">
        <StarfieldBackground />
        
        {/* Safe area padding for top */}
        <div className="pt-[env(safe-area-inset-top)]" />

        {/* View Toggle Header */}
        <div className="max-w-2xl mx-auto w-full px-4 pt-3 pb-2 relative z-10 flex justify-end">
          <CalendarViewToggle view={calendarView} onChange={setCalendarView} />
        </div>

        {/* Main Content */}
        <div className="flex-1 max-w-2xl mx-auto w-full relative z-10 overflow-hidden">
          {calendarView === 'timeline' ? (
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
          ) : (
            <CalendarDayView
              selectedDate={selectedDate}
              onDateSelect={handleDateSelect}
              tasks={formattedTasks}
              milestones={calendarMilestones}
              onTaskDrop={handleTaskDrop}
              onTimeSlotLongPress={handleTimeSlotLongPress}
              onTaskLongPress={handleTaskLongPress}
              onMilestoneClick={() => {}}
            />
          )}
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
          onSendToCalendar={handleSendTaskToCalendar}
          hasCalendarLink={editingTask ? hasLinkedEvent(editingTask.id) : false}
          isSendingToCalendar={sendTaskToCalendar.isPending}
          onDelete={handleDeleteQuest}
          isDeleting={isDeleting}
        />

        <BottomNav />
      </div>
    </PageTransition>
  );
};

export default Community;
