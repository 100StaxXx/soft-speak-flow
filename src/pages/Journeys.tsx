import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { format, addDays } from "date-fns";
import { motion, useReducedMotion } from "framer-motion";
import { Compass } from "lucide-react";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { PageTransition } from "@/components/PageTransition";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { BottomNav } from "@/components/BottomNav";
import { TodaysAgenda } from "@/components/TodaysAgenda";

import { DatePillsScroller } from "@/components/DatePillsScroller";
import { AddQuestSheet, AddQuestData } from "@/components/AddQuestSheet";
import { PageInfoButton } from "@/components/PageInfoButton";
import { PageInfoModal } from "@/components/PageInfoModal";
import { QuestHubTutorial } from "@/components/QuestHubTutorial";
import { StreakFreezePromptModal } from "@/components/StreakFreezePromptModal";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { EditQuestDialog } from "@/features/quests/components/EditQuestDialog";
import { EditRitualSheet, RitualData } from "@/components/EditRitualSheet";
import { useDailyTasks } from "@/hooks/useDailyTasks";
import { useCalendarTasks } from "@/hooks/useCalendarTasks";
import { useStreakMultiplier } from "@/hooks/useStreakMultiplier";
import { useFirstTimeModal } from "@/hooks/useFirstTimeModal";
import { useHabitSurfacing } from "@/hooks/useHabitSurfacing";
import { useRecurringTaskSpawner } from "@/hooks/useRecurringTaskSpawner";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useStreakAtRisk } from "@/hooks/useStreakAtRisk";

import { useOnboardingSchedule } from "@/hooks/useOnboardingSchedule";
import { useEpics } from "@/hooks/useEpics";
import { useDeepLink } from "@/contexts/DeepLinkContext";
import { logger } from "@/utils/logger";

import { useAIInteractionTracker } from "@/hooks/useAIInteractionTracker";
import { QuickAdjustDrawer } from "@/components/SmartDayPlanner/components/QuickAdjustDrawer";

import { Pathfinder } from "@/components/Pathfinder";
import { CampaignCreatedAnimation } from "@/components/CampaignCreatedAnimation";
import { DraggableFAB } from "@/components/DraggableFAB";
import { QuestsErrorBoundary } from "@/components/SectionErrorBoundary";

import { Wand2 } from "lucide-react";

import { useTaskCompletionWithInteraction, type InteractionType } from "@/hooks/useTaskCompletionWithInteraction";
import { InteractionLogModal } from "@/components/tasks/InteractionLogModal";

interface CreatedCampaignData {
  title: string;
  habits: Array<{ title: string }>;
}

const Journeys = () => {
  const prefersReducedMotion = useReducedMotion();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showPageInfo, setShowPageInfo] = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);
  
  const [prefilledTime, setPrefilledTime] = useState<string | null>(null);
  const [showQuickAdjust, setShowQuickAdjust] = useState(false);
  
  // Campaign creation state
  const [showPathfinder, setShowPathfinder] = useState(false);
  const [showCreatedAnimation, setShowCreatedAnimation] = useState(false);
  const [createdCampaignData, setCreatedCampaignData] = useState<CreatedCampaignData | null>(null);
  
  const { showModal: showTutorial, dismissModal: dismissTutorial } = useFirstTimeModal("journeys");
  
  // Auth and profile for onboarding
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { profile, loading: profileLoading } = useProfile();
  
  // Streak freeze
  const { 
    needsStreakDecision, 
    currentStreak: freezeStreak, 
    freezesAvailable, 
    useFreeze, 
    resetStreak, 
    isResolving 
  } = useStreakAtRisk();
  
  // Combo tracking
  
  
  // AI interaction tracking
  const { trackDailyPlanOutcome } = useAIInteractionTracker();
  
  // Epics for plan my day questions and campaign strip
  const { epics, createEpic, isCreating: isCreatingCampaign } = useEpics();
  const activeEpics = useMemo(() =>
    epics?.filter(e => e.status === 'active').slice(0, 5) || [],
    [epics]
  );
  
  const { currentStreak } = useStreakMultiplier();
  
  // Contact interaction logging
  const {
    pendingInteraction,
    isModalOpen: isInteractionModalOpen,
    handleTaskCompleted,
    logInteraction,
    skipInteraction,
    closeModal: closeInteractionModal,
  } = useTaskCompletionWithInteraction();

  const { 
    tasks: dailyTasks,
    isLoading: dailyTasksLoading,
    addTask,
    toggleTask,
    updateTask,
    deleteTask,
    restoreTask,
    moveTaskToDate,
    completedCount,
    totalCount,
    isAdding,
    isUpdating,
    isDeleting
  } = useDailyTasks(selectedDate);
  
  
  // Edit quest state (for regular quests)
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
    notes?: string | null;
    habit_source_id?: string | null;
    image_url?: string | null;
    location?: string | null;
  } | null>(null);
  
  // Edit ritual state (for tasks linked to habits)
  const [editingRitual, setEditingRitual] = useState<RitualData | null>(null);
  const { tasks: allCalendarTasks } = useCalendarTasks(selectedDate, "month");
  
  // Habit surfacing - auto-surface ALL active habits (not just epic-linked) as daily tasks
  const { surfaceAllEpicHabits, unsurfacedEpicHabitsCount } = useHabitSurfacing(selectedDate);
  
  // Recurring task spawner - auto-spawn tasks with is_recurring = true
  const { pendingRecurringCount, spawnRecurringTasks } = useRecurringTaskSpawner(selectedDate);
  
  // Auto-surface habits and spawn recurring tasks (with ref to prevent infinite loop)
  const hasSurfacedRef = useRef(false);
  const hasSpawnedRecurringRef = useRef(false);
  const dateKeyRef = useRef(format(selectedDate, 'yyyy-MM-dd'));

  useEffect(() => {
    const currentDateKey = format(selectedDate, 'yyyy-MM-dd');
    
    // Reset if date changed
    if (dateKeyRef.current !== currentDateKey) {
      dateKeyRef.current = currentDateKey;
      hasSurfacedRef.current = false;
      hasSpawnedRecurringRef.current = false;
    }
    
    // Surface habits once per date
    if (unsurfacedEpicHabitsCount > 0 && !hasSurfacedRef.current) {
      hasSurfacedRef.current = true;
      surfaceAllEpicHabits();
    }
    
    // Spawn recurring tasks once per date
    if (pendingRecurringCount > 0 && !hasSpawnedRecurringRef.current) {
      hasSpawnedRecurringRef.current = true;
      spawnRecurringTasks();
    }
  }, [unsurfacedEpicHabitsCount, pendingRecurringCount, selectedDate, surfaceAllEpicHabits, spawnRecurringTasks]);
  
  // Onboarding schedule creation for new users who completed the main walkthrough
  // Wait for profile to load before evaluating walkthrough status
  const hasCompletedWalkthrough = !profileLoading && 
    (profile?.onboarding_data as Record<string, unknown>)?.walkthrough_completed === true;
  
  useOnboardingSchedule(user?.id, hasCompletedWalkthrough, profileLoading);
  
  const handleEditQuest = useCallback(async (task: {
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
    notes?: string | null;
    habit_source_id?: string | null;
    image_url?: string | null;
    location?: string | null;
  }) => {
    // Route to the appropriate editor based on whether it's a ritual
    if (task.habit_source_id) {
      // Fetch habit data to get frequency and custom_days (source of truth)
      const { data: habit } = await supabase
        .from('habits')
        .select('frequency, custom_days, description')
        .eq('id', task.habit_source_id)
        .maybeSingle();
      
      // This is a ritual - open the unified ritual editor
      setEditingRitual({
        habitId: task.habit_source_id,
        taskId: task.id,
        title: task.task_text,
        description: habit?.description || null,
        difficulty: task.difficulty || 'medium',
        frequency: habit?.frequency || 'daily',
        custom_days: habit?.custom_days || [],
        estimated_minutes: task.estimated_duration,
        preferred_time: task.scheduled_time,
        category: task.category as 'mind' | 'body' | 'soul' | null,
        recurrence_pattern: task.recurrence_pattern,
        recurrence_days: task.recurrence_days,
        reminder_enabled: task.reminder_enabled,
        reminder_minutes_before: task.reminder_minutes_before,
      });
    } else {
      // Regular quest - use the standard edit dialog
      setEditingTask(task);
    }
  }, []);

  // Deep link handling - open task from widget tap
  const { pendingTaskId, clearPendingTask } = useDeepLink();
  const deepLinkProcessedRef = useRef<string | null>(null);
  
  useEffect(() => {
    // Skip if no pending task or already processed this task
    if (!pendingTaskId || deepLinkProcessedRef.current === pendingTaskId) {
      return;
    }
    
    // Wait for tasks query to resolve
    if (dailyTasksLoading) {
      return;
    }
    
    // Find the task in today's tasks
    const task = dailyTasks.find(t => t.id === pendingTaskId);
    
    if (task) {
      logger.log('[Journeys] Opening deep-linked task:', pendingTaskId);
      deepLinkProcessedRef.current = pendingTaskId;
      handleEditQuest(task);
      clearPendingTask();
    } else {
      // Task not found in today's list - might be on a different day
      logger.log('[Journeys] Deep link task not found in daily tasks:', pendingTaskId);
      deepLinkProcessedRef.current = pendingTaskId;
      clearPendingTask();
    }
  }, [pendingTaskId, dailyTasks, dailyTasksLoading, clearPendingTask, handleEditQuest]);
  
  const tasksPerDay = useMemo(() => {
    const map: Record<string, number> = {};
    allCalendarTasks.forEach((task: { task_date?: string | null }) => {
      if (!task.task_date) return;
      map[task.task_date] = (map[task.task_date] || 0) + 1;
    });
    return map;
  }, [allCalendarTasks]);

  const handleAddQuest = useCallback(async (data: AddQuestData) => {
    const taskDate = data.sendToInbox
      ? null
      : (data.taskDate ?? format(selectedDate, 'yyyy-MM-dd'));

    await addTask({
      taskText: data.text,
      difficulty: data.difficulty,
      taskDate: taskDate,
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
    setShowAddSheet(false);
  }, [selectedDate, addTask]);

  const handleToggleTask = useCallback((taskId: string, completed: boolean, xpReward: number, taskData?: { scheduled_time?: string | null; difficulty?: string | null; category?: string | null; ai_generated?: boolean | null; task_text?: string | null }) => {
    if (completed) {
      // Track for AI learning (only for AI-generated tasks)
      if (taskData?.ai_generated) {
        trackDailyPlanOutcome(taskId, 'completed', {
          scheduledTime: taskData.scheduled_time ?? undefined,
          difficulty: taskData.difficulty ?? undefined,
          category: taskData.category ?? undefined,
          wasOnTime: true,
        });
      }
    }
    toggleTask({ taskId, completed, xpReward }, {
      onSuccess: (result) => {
        // If completed and has a contact with auto-log enabled, trigger interaction modal
        if (result.completed && result.contact && result.autoLogInteraction) {
          handleTaskCompleted(
            result.taskId,
            result.taskText,
            result.contact,
            result.autoLogInteraction
          );
        }
      },
    });
  }, [toggleTask, trackDailyPlanOutcome, handleTaskCompleted]);
  
  const handleUndoToggle = useCallback((taskId: string, xpReward: number) => {
    toggleTask({ taskId, completed: false, xpReward, forceUndo: true });
  }, [toggleTask]);
  
  const handleSaveEdit = useCallback(async (taskId: string, updates: {
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
    setEditingTask(null);
  }, [updateTask]);

  const handleDeleteQuest = useCallback(async (taskId: string, isAIGenerated?: boolean) => {
    // Track deletion for AI learning
    if (isAIGenerated) {
      trackDailyPlanOutcome(taskId, 'deleted');
    }
    await deleteTask(taskId);
    toast.success("Quest deleted");
    setEditingTask(null);
  }, [deleteTask, trackDailyPlanOutcome]);

  const handleDeleteRitual = useCallback(async (habitId: string) => {
    if (!user?.id) return;
    try {
      // Delete the habit template
      const { error: habitError } = await supabase
        .from('habits')
        .delete()
        .eq('id', habitId)
        .eq('user_id', user.id);
      
      if (habitError) throw habitError;

      // Delete all incomplete tasks linked to this habit
      const { error: tasksError } = await supabase
        .from('daily_tasks')
        .delete()
        .eq('habit_source_id', habitId)
        .eq('user_id', user.id)
        .eq('completed', false);

      if (tasksError) {
        console.error('Error deleting linked tasks:', tasksError);
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['epics'] });
      
      toast.success('Ritual deleted');
    } catch (error) {
      console.error('Error deleting ritual:', error);
      toast.error('Failed to delete ritual');
    }
    setEditingRitual(null);
  }, [user?.id, queryClient]);

  // Handle date pill click - just navigate to that day
  const handleDatePillClick = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);


  // Handle swipe-to-delete quest with undo
  const handleSwipeDeleteQuest = useCallback(async (taskId: string) => {
    // Capture task data before deletion for potential restore
    const taskToDelete = dailyTasks.find(t => t.id === taskId);
    if (!taskToDelete) return;
    
    const taskData = {
      task_text: taskToDelete.task_text,
      task_date: taskToDelete.task_date,
      xp_reward: taskToDelete.xp_reward,
      difficulty: taskToDelete.difficulty,
      scheduled_time: taskToDelete.scheduled_time,
      estimated_duration: taskToDelete.estimated_duration,
      is_main_quest: taskToDelete.is_main_quest,
      epic_id: taskToDelete.epic_id,
      sort_order: taskToDelete.sort_order,
      priority: taskToDelete.priority,
      energy_level: taskToDelete.energy_level,
      category: taskToDelete.category,
      habit_source_id: taskToDelete.habit_source_id,
      is_recurring: taskToDelete.is_recurring,
      recurrence_pattern: taskToDelete.recurrence_pattern,
      recurrence_days: taskToDelete.recurrence_days,
      reminder_enabled: taskToDelete.reminder_enabled,
      reminder_minutes_before: taskToDelete.reminder_minutes_before,
    };
    
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch (e) {
      // Haptics not available on web
    }
    
    await deleteTask(taskId);
    
    toast("Quest deleted", {
      duration: 4000,
      action: {
        label: "Undo",
        onClick: async () => {
          try {
            await restoreTask(taskData);
            toast.success("Quest restored");
          } catch {
            toast.error("Failed to restore quest");
          }
        },
      },
    });
  }, [dailyTasks, deleteTask, restoreTask]);

  // Handle swipe-to-move-to-next-day with undo
  const handleSwipeMoveToNextDay = useCallback(async (taskId: string) => {
    // Capture original date for undo
    const taskToMove = dailyTasks.find(t => t.id === taskId);
    const originalDate = taskToMove?.task_date;
    
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (e) {
      // Haptics not available on web
    }
    
    const nextDay = addDays(selectedDate, 1);
    const nextDayStr = format(nextDay, 'yyyy-MM-dd');
    
    moveTaskToDate({ taskId, targetDate: nextDayStr });
    
    toast(`Moved to ${format(nextDay, "EEEE, MMM d")}`, {
      duration: 4000,
      action: {
        label: "Undo",
        onClick: () => {
          if (originalDate) {
            moveTaskToDate({ taskId, targetDate: originalDate });
            toast.success("Move undone");
          }
        },
      },
    });
  }, [dailyTasks, selectedDate, moveTaskToDate]);

  // Handle campaign creation
  const handleCreateCampaign = useCallback(async (data: Parameters<typeof createEpic>[0]) => {
    try {
      await createEpic(data);
      setShowPathfinder(false);
      setCreatedCampaignData({
        title: data.title,
        habits: data.habits.map(h => ({ title: h.title })),
      });
      setShowCreatedAnimation(true);
    } catch (error) {
      console.error('Failed to create campaign:', error);
    }
  }, [createEpic]);

  const handleAnimationComplete = useCallback(() => {
    setShowCreatedAnimation(false);
    setCreatedCampaignData(null);
  }, []);

  return (
    <PageTransition mode="instant">
      <StarfieldBackground />
      <div className="min-h-screen pb-nav-safe pt-safe px-4 relative z-10">
        {/* Hero Header */}
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.22 }}
          className="mb-6 text-center relative"
        >
          <div className="absolute right-0 top-0">
            <PageInfoButton 
              onClick={() => setShowPageInfo(true)} 
            />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Quests
          </h1>
          <p className="text-sm text-muted-foreground/90">Daily quests. Your path to progress.</p>
        </motion.div>

        <QuestsErrorBoundary>
          {/* Date Selector */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: prefersReducedMotion ? 0 : 0.04, duration: prefersReducedMotion ? 0 : 0.2 }}
            className="mb-4"
          >
            <DatePillsScroller
              selectedDate={selectedDate}
              onDateSelect={handleDatePillClick}
              tasksPerDay={tasksPerDay}
            />
          </motion.div>

          {/* Main Content Area */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: prefersReducedMotion ? 0 : 0.1, duration: prefersReducedMotion ? 0 : 0.2 }}
          >
            {/* Today's Agenda */}
            <TodaysAgenda
            tasks={dailyTasks}
            selectedDate={selectedDate}
            onToggle={handleToggleTask}
            onAddQuest={() => {
              setPrefilledTime(null);
              setShowAddSheet(true);
            }}
            completedCount={completedCount}
            totalCount={totalCount}
            currentStreak={currentStreak}
            onUndoToggle={handleUndoToggle}
            onEditQuest={handleEditQuest}
            calendarTasks={allCalendarTasks}
            calendarMilestones={[]}
            onDateSelect={setSelectedDate}
            activeEpics={activeEpics}
            onDeleteQuest={handleSwipeDeleteQuest}
            onMoveQuestToNextDay={handleSwipeMoveToNextDay}
            onUpdateScheduledTime={(taskId, newTime) => {
              updateTask({ taskId, updates: { scheduled_time: newTime } });
            }}
            onTimeSlotLongPress={(date, time) => {
              setSelectedDate(date);
              setPrefilledTime(time);
              setShowAddSheet(true);
            }}
          />
          </motion.div>
        </QuestsErrorBoundary>

        {/* Add Quest Sheet */}
        <AddQuestSheet
          open={showAddSheet}
          onOpenChange={setShowAddSheet}
          selectedDate={selectedDate}
          onAdd={handleAddQuest}
          isAdding={isAdding}
          prefilledTime={prefilledTime}
          onCreateCampaign={() => setShowPathfinder(true)}
        />
        
        {/* Edit Quest Dialog (for regular quests) */}
        <EditQuestDialog
          task={editingTask}
          open={!!editingTask && !editingTask.habit_source_id}
          onOpenChange={(open) => !open && setEditingTask(null)}
          onSave={handleSaveEdit}
          isSaving={isUpdating}
          onDelete={handleDeleteQuest}
          isDeleting={isDeleting}
        />
        
        {/* Edit Ritual Sheet (for habits/rituals with two-way sync) */}
        <EditRitualSheet
          ritual={editingRitual}
          open={!!editingRitual}
          onOpenChange={(open) => !open && setEditingRitual(null)}
          onDelete={handleDeleteRitual}
        />

        <PageInfoModal
          open={showPageInfo}
          onClose={() => setShowPageInfo(false)}
          title="About Quests"
          icon={Compass}
          description="Quests unite your daily tasks and recurring rituals into one powerful view."
          features={[
            "Complete daily quests to earn XP",
            "Rituals repeat automatically to build habits",
            "Track your streak and maintain momentum"
          ]}
          tip="Add quests by tapping the + button in the corner!"
        />

        <QuestHubTutorial 
          open={showTutorial} 
          onClose={dismissTutorial}
        />
        
        {/* Streak Freeze Prompt */}
        <StreakFreezePromptModal
          open={needsStreakDecision}
          currentStreak={freezeStreak}
          freezesAvailable={freezesAvailable}
          onUseFreeze={useFreeze}
          onResetStreak={resetStreak}
          isResolving={isResolving}
        />
        
        {/* Contact Interaction Log Modal */}
        <InteractionLogModal
          open={isInteractionModalOpen}
          onOpenChange={closeInteractionModal}
          contactName={pendingInteraction?.contact?.name ?? ''}
          contactAvatarUrl={pendingInteraction?.contact?.avatar_url}
          taskTitle={pendingInteraction?.taskText ?? ''}
          onLog={async (type, summary) => {
            await logInteraction(type as InteractionType, summary);
          }}
          onSkip={skipInteraction}
        />
        
        {/* Quick Adjust Floating Button + Drawer */}
        {dailyTasks.some(t => t.ai_generated) && (
          <motion.button
            initial={prefersReducedMotion ? false : { scale: 0.9, opacity: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
            className="fixed bottom-24 right-4 z-40 p-3 rounded-full bg-card/92 backdrop-blur-xl border border-border/60 shadow-[0_10px_24px_rgba(0,0,0,0.28)] active:scale-95 transition-transform"
            onClick={() => setShowQuickAdjust(true)}
            aria-label="Open quick adjust"
          >
            <Wand2 className="h-5 w-5 text-primary" />
          </motion.button>
        )}

        <QuickAdjustDrawer
          open={showQuickAdjust}
          onOpenChange={setShowQuickAdjust}
          tasks={dailyTasks}
          selectedDate={selectedDate}
          onComplete={() => {
            queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
            setShowQuickAdjust(false);
          }}
        />

        {/* Pathfinder - Campaign Creation Wizard */}
        <Pathfinder
          open={showPathfinder}
          onOpenChange={setShowPathfinder}
          onCreateEpic={handleCreateCampaign}
          isCreating={isCreatingCampaign}
          showTemplatesFirst={false}
        />

        {/* Campaign Created Celebration */}
        <CampaignCreatedAnimation
          isVisible={showCreatedAnimation}
          campaignTitle={createdCampaignData?.title || ''}
          habits={createdCampaignData?.habits || []}
          onComplete={handleAnimationComplete}
        />
        {/* Draggable FAB */}
        <DraggableFAB onTap={() => {
          setPrefilledTime(null);
          setShowAddSheet(true);
        }} />
      </div>

      <BottomNav />
    </PageTransition>
  );
};

export default Journeys;
