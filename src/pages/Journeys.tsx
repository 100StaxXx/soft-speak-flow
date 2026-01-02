import { useState, useMemo, useEffect, useRef } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { 
  Compass, 
  Plus, 
  Sparkles
} from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { BottomNav } from "@/components/BottomNav";
import { TodaysAgenda } from "@/components/TodaysAgenda";
import { DatePillsScroller } from "@/components/DatePillsScroller";
import { AddQuestSheet, AddQuestData } from "@/components/AddQuestSheet";
import { PageInfoButton } from "@/components/PageInfoButton";
import { PageInfoModal } from "@/components/PageInfoModal";
import { QuestHubTutorial } from "@/components/QuestHubTutorial";
import { SmartTaskInput } from "@/features/tasks/components/SmartTaskInput";
import { StreakFreezePromptModal } from "@/components/StreakFreezePromptModal";
import { ComboCounter } from "@/components/ComboCounter";
import { QuestClearCelebration } from "@/components/QuestClearCelebration";
import { PerfectDayCelebration } from "@/components/PerfectDayCelebration";
import { EditQuestDialog } from "@/features/quests/components/EditQuestDialog";
import { EditRitualSheet, RitualData } from "@/components/EditRitualSheet";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useDailyTasks } from "@/hooks/useDailyTasks";
import { useCalendarTasks } from "@/hooks/useCalendarTasks";
import { useStreakMultiplier } from "@/hooks/useStreakMultiplier";
import { useFirstTimeModal } from "@/hooks/useFirstTimeModal";
import { useHabitSurfacing } from "@/hooks/useHabitSurfacing";
import { useRecurringTaskSpawner } from "@/hooks/useRecurringTaskSpawner";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useStreakAtRisk } from "@/hooks/useStreakAtRisk";
import { usePerfectDayTracker } from "@/hooks/usePerfectDayTracker";
import { useComboTracker } from "@/hooks/useComboTracker";
import { safeLocalStorage } from "@/utils/storage";
import { useOnboardingSchedule } from "@/hooks/useOnboardingSchedule";
import type { ParsedTask } from "@/features/tasks/hooks/useNaturalLanguageParser";
import type { SuggestedSubtask } from "@/hooks/useTaskDecomposition";

const Journeys = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showPageInfo, setShowPageInfo] = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showQuestClear, setShowQuestClear] = useState(false);
  const [showQAB, setShowQAB] = useState(false);
  
  const { showModal: showTutorial, dismissModal: dismissTutorial } = useFirstTimeModal("journeys");
  
  // Auth and profile for onboarding
  const { user } = useAuth();
  const { profile } = useProfile();
  
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
  const { comboCount, showCombo, bonusXP, recordCompletion } = useComboTracker();
  
  const { currentStreak } = useStreakMultiplier();

  const { 
    tasks: dailyTasks,
    addTask,
    toggleTask,
    updateTask,
    reorderTasks,
    moveTaskToSection,
    completedCount,
    totalCount,
    isAdding,
    isUpdating
  } = useDailyTasks(selectedDate);
  
  // Perfect Day celebration tracking
  const { 
    showPerfectDay, 
    totalXP: perfectDayXP, 
    tasksCompleted: perfectDayTasksCompleted,
    dismissPerfectDay 
  } = usePerfectDayTracker(dailyTasks, selectedDate);
  
  // Edit quest state (for regular quests)
  const [editingTask, setEditingTask] = useState<{
    id: string;
    task_text: string;
    difficulty?: string | null;
    scheduled_time?: string | null;
    estimated_duration?: number | null;
    habit_source_id?: string | null;
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
  
  // Onboarding schedule creation for new users
  const tutorialSeen = user?.id 
    ? safeLocalStorage.getItem(`tutorial_dismissed_${user.id}`) === 'true' ||
      ((profile?.onboarding_data as Record<string, unknown>)?.quests_tutorial_seen === true)
    : true;
  
  useOnboardingSchedule(user?.id, tutorialSeen);
  
  const tasksPerDay = useMemo(() => {
    const map: Record<string, number> = {};
    allCalendarTasks.forEach((task: any) => {
      const dateKey = task.task_date;
      map[dateKey] = (map[dateKey] || 0) + 1;
    });
    return map;
  }, [allCalendarTasks]);

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
  };

  const handleToggleTask = (taskId: string, completed: boolean, xpReward: number) => {
    if (completed) {
      recordCompletion(); // Track combo for consecutive completions
    }
    toggleTask({ taskId, completed, xpReward });
  };
  
  const handleUndoToggle = (taskId: string, xpReward: number) => {
    toggleTask({ taskId, completed: false, xpReward, forceUndo: true });
  };
  
  const handleEditQuest = (task: {
    id: string;
    task_text: string;
    difficulty?: string | null;
    scheduled_time?: string | null;
    estimated_duration?: number | null;
    recurrence_pattern?: string | null;
    recurrence_days?: number[] | null;
    reminder_enabled?: boolean | null;
    reminder_minutes_before?: number | null;
    category?: string | null;
    habit_source_id?: string | null;
  }) => {
    // Route to the appropriate editor based on whether it's a ritual
    if (task.habit_source_id) {
      // This is a ritual - open the unified ritual editor
      setEditingRitual({
        habitId: task.habit_source_id,
        taskId: task.id,
        title: task.task_text,
        description: null, // Task doesn't have description, but habit does
        difficulty: task.difficulty || 'medium',
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

  // Handle task reordering from drag and drop
  const handleReorderTasks = (reorderedTasks: typeof dailyTasks) => {
    const updates = reorderedTasks.map((task, index) => ({
      id: task.id,
      sort_order: index,
    }));
    reorderTasks(updates);
  };

  // Handle moving task to different time section
  const handleMoveTaskToSection = (taskId: string, targetSection: 'morning' | 'afternoon' | 'evening' | 'unscheduled') => {
    moveTaskToSection({ taskId, targetSection });
  };
  return (
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
          <p className="text-muted-foreground max-w-md mx-auto">
            Daily quests. Your path to progress.
          </p>
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
            onDateSelect={setSelectedDate}
            tasksPerDay={tasksPerDay}
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
            onMoveTaskToSection={handleMoveTaskToSection}
            hideIndicator={showTutorial}
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
        />
        
        {/* Edit Quest Dialog (for regular quests) */}
        <EditQuestDialog
          task={editingTask}
          open={!!editingTask && !editingTask.habit_source_id}
          onOpenChange={(open) => !open && setEditingTask(null)}
          onSave={handleSaveEdit}
          isSaving={isUpdating}
        />
        
        {/* Edit Ritual Sheet (for habits/rituals with two-way sync) */}
        <EditRitualSheet
          ritual={editingRitual}
          open={!!editingRitual}
          onOpenChange={(open) => !open && setEditingRitual(null)}
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
        
        {/* Combo Counter Overlay */}
        <ComboCounter
          count={comboCount}
          show={showCombo}
          bonusXP={bonusXP}
        />
        
        {/* Quest Clear Celebration */}
        <QuestClearCelebration
          show={showQuestClear}
          totalXP={dailyTasks.reduce((sum, t) => sum + (t.xp_reward || 0), 0)}
          currentStreak={currentStreak}
          onDismiss={() => setShowQuestClear(false)}
        />
        
        {/* Perfect Day Celebration */}
        <PerfectDayCelebration
          show={showPerfectDay}
          totalXP={perfectDayXP}
          tasksCompleted={perfectDayTasksCompleted}
          currentStreak={currentStreak}
          onDismiss={dismissPerfectDay}
        />
      </div>

      {/* Floating Action Button - Subtle */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowQAB(true)}
        className="fixed bottom-24 right-4 z-50 w-11 h-11 rounded-full bg-muted/60 backdrop-blur-sm border border-border/50 flex items-center justify-center hover:bg-muted/80 transition-colors"
      >
        <Plus className="w-5 h-5 text-muted-foreground" />
      </motion.button>

      {/* QAB Sheet */}
      <Sheet open={showQAB} onOpenChange={setShowQAB}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-8">
          <div className="pt-4">
            <SmartTaskInput
              onSubmit={async (parsed: ParsedTask, subtasks?: SuggestedSubtask[]) => {
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
                });
                
                if (subtasks?.length) {
                  for (const subtask of subtasks) {
                    await addTask({
                      taskText: subtask.title,
                      difficulty: 'easy',
                      taskDate,
                      isMainQuest: false,
                      estimatedDuration: subtask.durationMinutes,
                    });
                  }
                }
                
                setShowQAB(false);
              }}
              placeholder="Add a quest or ask me anything..."
            />
          </div>
        </SheetContent>
      </Sheet>

      <BottomNav />
    </PageTransition>
  );
};

export default Journeys;
