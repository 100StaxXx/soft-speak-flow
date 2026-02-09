import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { format, addDays } from "date-fns";
import { motion } from "framer-motion";
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
import { HourlyViewModal } from "@/components/HourlyViewModal";
import { StreakFreezePromptModal } from "@/components/StreakFreezePromptModal";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { QuestClearCelebration } from "@/components/QuestClearCelebration";

import { EditQuestDialog } from "@/features/quests/components/EditQuestDialog";
import { EditRitualSheet, RitualData } from "@/components/EditRitualSheet";
import { TaskDragProvider } from "@/contexts/TaskDragContext";
import { useDailyTasks } from "@/hooks/useDailyTasks";
import { useCalendarTasks } from "@/hooks/useCalendarTasks";
import { useStreakMultiplier } from "@/hooks/useStreakMultiplier";
import { useFirstTimeModal } from "@/hooks/useFirstTimeModal";
import { useHabitSurfacing } from "@/hooks/useHabitSurfacing";
import { useRecurringTaskSpawner } from "@/hooks/useRecurringTaskSpawner";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useStreakAtRisk } from "@/hooks/useStreakAtRisk";

import { safeLocalStorage } from "@/utils/storage";
import { useOnboardingSchedule } from "@/hooks/useOnboardingSchedule";
import { useDailyPlanOptimization } from "@/hooks/useDailyPlanOptimization";
import { useWeeklyPlanOptimization } from "@/hooks/useWeeklyPlanOptimization";
import { useWeeklyPlanGeneration } from "@/hooks/useWeeklyPlanGeneration";
import { useEpics } from "@/hooks/useEpics";
import { useDeepLink } from "@/contexts/DeepLinkContext";
import { logger } from "@/utils/logger";

import { useAIInteractionTracker } from "@/hooks/useAIInteractionTracker";
import { SmartDayPlannerWizard } from "@/components/SmartDayPlanner/SmartDayPlannerWizard";
import { QuickAdjustDrawer } from "@/components/SmartDayPlanner/components/QuickAdjustDrawer";

import { Pathfinder } from "@/components/Pathfinder";
import { CampaignCreatedAnimation } from "@/components/CampaignCreatedAnimation";
import { DraggableFAB } from "@/components/DraggableFAB";

import { Wand2 } from "lucide-react";
import type { ParsedTask } from "@/features/tasks/hooks/useNaturalLanguageParser";
import type { PlanMyWeekAnswers } from "@/features/tasks/components/PlanMyWeekClarification";

import { useTaskCompletionWithInteraction, type InteractionType } from "@/hooks/useTaskCompletionWithInteraction";
import { InteractionLogModal } from "@/components/tasks/InteractionLogModal";

interface CreatedCampaignData {
  title: string;
  habits: Array<{ title: string }>;
}

const Journeys = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showPageInfo, setShowPageInfo] = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);
  
  const [showQuestClear, setShowQuestClear] = useState(false);
  
  const [showHourlyModal, setShowHourlyModal] = useState(false);
  const [showDayPlannerWizard, setShowDayPlannerWizard] = useState(false);
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
  
  
  // Daily plan optimization & generation
  const { refetch: refetchPlan, generatePlan, isGenerating } = useDailyPlanOptimization();
  
  // Weekly plan optimization & generation
  const { refetch: refetchWeeklyPlan, optimizeWithAnswers: optimizeWeekWithAnswers } = useWeeklyPlanOptimization();
  const { generateWeeklyPlan, isGenerating: isGeneratingWeek } = useWeeklyPlanGeneration();
  
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
    addTask,
    toggleTask,
    updateTask,
    deleteTask,
    restoreTask,
    reorderTasks,
    moveTaskToSection,
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
    habit_source_id?: string | null;
    image_url?: string | null;
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
  
  // Deep link handling - open task from widget tap
  const { pendingTaskId, clearPendingTask } = useDeepLink();
  const deepLinkProcessedRef = useRef<string | null>(null);
  
  useEffect(() => {
    // Skip if no pending task or already processed this task
    if (!pendingTaskId || deepLinkProcessedRef.current === pendingTaskId) {
      return;
    }
    
    // Wait for tasks to load
    if (dailyTasks.length === 0) {
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
  }, [pendingTaskId, dailyTasks, clearPendingTask]);
  
  const tasksPerDay = useMemo(() => {
    const map: Record<string, number> = {};
    allCalendarTasks.forEach((task: any) => {
      const dateKey = task.task_date;
      map[dateKey] = (map[dateKey] || 0) + 1;
    });
    return map;
  }, [allCalendarTasks]);

  const handleAddQuest = useCallback(async (data: AddQuestData) => {
    const taskDate = data.sendToInbox ? null : format(selectedDate, 'yyyy-MM-dd');
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
      contactId: data.contactId,
      autoLogInteraction: data.autoLogInteraction,
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
    habit_source_id?: string | null;
    image_url?: string | null;
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

  // Handle task reordering from drag and drop
  const handleReorderTasks = useCallback((reorderedTasks: typeof dailyTasks) => {
    const updates = reorderedTasks.map((task, index) => ({
      id: task.id,
      sort_order: index,
    }));
    reorderTasks(updates);
  }, [reorderTasks]);

  // Handle moving task to a different date (cross-day drag)
  const handleMoveTaskToDate = useCallback((taskId: string, targetDate: Date) => {
    const targetDateStr = format(targetDate, 'yyyy-MM-dd');
    moveTaskToDate({ taskId, targetDate: targetDateStr });
  }, [moveTaskToDate]);

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
        onClick: () => {
          restoreTask(taskData);
          toast.success("Quest restored");
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

  // Format tasks for HourlyViewModal (CalendarTask format)
  const formattedTasksForModal = useMemo(() => 
    dailyTasks.map(task => ({
      id: task.id,
      task_text: task.task_text,
      task_date: task.task_date,
      scheduled_time: task.scheduled_time,
      estimated_duration: task.estimated_duration,
      completed: task.completed ?? false,
      is_main_quest: task.is_main_quest ?? false,
      difficulty: task.difficulty,
      xp_reward: task.xp_reward ?? 0,
      category: task.category,
    })),
    [dailyTasks]
  );

  // Handle task drop from modal (reschedule time and/or date)
  const handleModalTaskDrop = useCallback((taskId: string, newDate: Date, newTime?: string) => {
    const updates: Record<string, unknown> = {};
    if (newTime) {
      updates.scheduled_time = newTime;
    }
    const newDateStr = format(newDate, 'yyyy-MM-dd');
    const currentTask = dailyTasks.find(t => t.id === taskId);
    if (currentTask && currentTask.task_date !== newDateStr) {
      moveTaskToDate({ taskId, targetDate: newDateStr });
    }
    if (Object.keys(updates).length > 0) {
      updateTask({ taskId, updates });
    }
  }, [dailyTasks, moveTaskToDate, updateTask]);

  // Handle Plan My Day command - opens wizard
  const handlePlanMyDay = useCallback(() => {
    setShowDayPlannerWizard(true);
  }, []);

  // Handle wizard completion
  const handleDayPlannerComplete = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
    refetchPlan();
    toast.success('Your day is planned!');
  }, [queryClient, refetchPlan]);

  // Handle Plan My Week command with clarification answers - generates actual tasks
  const handlePlanMyWeek = useCallback(async (answers: PlanMyWeekAnswers) => {
    try {
      const result = await generateWeeklyPlan(answers);
      
      if (result?.weeklyTasks && result.weeklyTasks.length > 0) {
        const dayCount = new Set(result.weeklyTasks.map(t => t.task_date)).size;
        toast.success(`Week planned! ${result.weeklyTasks.length} tasks across ${dayCount} days`, {
          description: result.summaryMessage || `Balance score: ${result.balanceScore || 0}%`,
        });
        
        // Refresh data
        refetchWeeklyPlan();
        refetchPlan();
        queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
        queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
      } else {
        toast.info("Your week looks open. Add some tasks to plan!");
      }
    } catch (error) {
      console.error('Weekly plan generation failed:', error);
      toast.error("Couldn't generate weekly plan. Try again later.");
    }
  }, [generateWeeklyPlan, refetchWeeklyPlan, refetchPlan, queryClient]);

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
    <TaskDragProvider>
    <PageTransition>
      <StarfieldBackground />
      <div className="min-h-screen pb-nav-safe pt-safe px-4 relative z-10">
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 text-center relative"
        >
          <div className="absolute right-0 top-0">
            <PageInfoButton 
              onClick={() => setShowPageInfo(true)} 
            />
          </div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
            Quests
          </h1>
        </motion.div>

        {/* Date Selector */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.05 }}
          className="mb-4"
        >
          <DatePillsScroller
            selectedDate={selectedDate}
            onDateSelect={handleDatePillClick}
            tasksPerDay={tasksPerDay}
            onTaskDrop={handleMoveTaskToDate}
          />
        </motion.div>

        {/* Main Content Area */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          {/* Today's Agenda */}
          <TodaysAgenda
            tasks={dailyTasks}
            selectedDate={selectedDate}
            onToggle={handleToggleTask}
            onAddQuest={() => setShowAddSheet(true)}
            completedCount={completedCount}
            totalCount={totalCount}
            currentStreak={currentStreak}
            activeJourneys={[]}
            onUndoToggle={handleUndoToggle}
            onEditQuest={handleEditQuest}
            onReorderTasks={handleReorderTasks}
            hideIndicator={showTutorial}
            calendarTasks={allCalendarTasks}
            calendarMilestones={[]}
            onDateSelect={setSelectedDate}
            onQuickAdd={async (parsed) => {
              const taskDate = parsed.scheduledDate || format(selectedDate, 'yyyy-MM-dd');
              await addTask({
                taskText: parsed.text,
                difficulty: parsed.difficulty || 'medium',
                taskDate,
                isMainQuest: false,
                scheduledTime: parsed.scheduledTime,
                estimatedDuration: parsed.estimatedDuration,
                recurrencePattern: parsed.recurrencePattern,
                reminderEnabled: parsed.reminderEnabled,
                reminderMinutesBefore: parsed.reminderMinutesBefore,
                notes: parsed.notes,
                imageUrl: parsed.imageUrl,
                contactId: parsed.contactId,
                autoLogInteraction: parsed.autoLogInteraction ?? true,
              });
            }}
            onPlanMyDay={handlePlanMyDay}
            onPlanMyWeek={handlePlanMyWeek}
            activeEpics={activeEpics}
            onDeleteQuest={handleSwipeDeleteQuest}
            onMoveQuestToNextDay={handleSwipeMoveToNextDay}
          />
        </motion.div>


        {/* Add Quest Sheet */}
        <AddQuestSheet
          open={showAddSheet}
          onOpenChange={setShowAddSheet}
          selectedDate={selectedDate}
          onAdd={handleAddQuest}
          isAdding={isAdding}
          prefilledTime={null}
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
        
        
        {/* Quest Clear Celebration */}
        <QuestClearCelebration
          show={showQuestClear}
          totalXP={dailyTasks.reduce((sum, t) => sum + (t.xp_reward || 0), 0)}
          currentStreak={currentStreak}
          onDismiss={() => setShowQuestClear(false)}
        />
        
        
        {/* Hourly/Month View Modal */}
        <HourlyViewModal
          open={showHourlyModal}
          onOpenChange={setShowHourlyModal}
          selectedDate={selectedDate}
          onDateSelect={(date) => {
            setSelectedDate(date);
          }}
          tasks={formattedTasksForModal}
          milestones={[]}
          onTaskDrop={handleModalTaskDrop}
          onTimeSlotLongPress={(date, time) => {
            setSelectedDate(date);
            setShowAddSheet(true);
          }}
          onTaskLongPress={(taskId) => {
            const task = dailyTasks.find(t => t.id === taskId);
            if (task) handleEditQuest(task);
          }}
          onMilestoneClick={() => {}}
        />

        {/* Smart Day Planner Wizard */}
        <SmartDayPlannerWizard
          open={showDayPlannerWizard}
          onOpenChange={setShowDayPlannerWizard}
          planDate={selectedDate}
          onComplete={handleDayPlannerComplete}
        />

        {/* Quick Adjust Floating Button + Drawer */}
        {dailyTasks.some(t => t.ai_generated) && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="fixed bottom-24 right-4 z-40 p-3 rounded-full bg-primary shadow-lg active:scale-95 transition-transform"
            onClick={() => setShowQuickAdjust(true)}
          >
            <Wand2 className="h-5 w-5 text-primary-foreground" />
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
        <DraggableFAB onTap={() => setShowAddSheet(true)} />
      </div>

      <BottomNav />
    </PageTransition>
    </TaskDragProvider>
  );
};

export default Journeys;
