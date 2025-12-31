import { useState, useMemo, useEffect, useRef } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { 
  Compass, 
  Trophy, 
  Plus, 
  Sparkles, 
  Wand2,
  Target,
  Calendar,
  Loader2
} from "lucide-react";
import { HourlyViewModal } from "@/components/HourlyViewModal";
import { PageTransition } from "@/components/PageTransition";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { JourneyCard } from "@/components/JourneyCard";
import { TodaysAgenda } from "@/components/TodaysAgenda";
import { Pathfinder } from "@/components/Pathfinder";
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
import { CampaignCreatedAnimation } from "@/components/CampaignCreatedAnimation";
import { useEpics } from "@/hooks/useEpics";
import { useDailyTasks } from "@/hooks/useDailyTasks";
import { useCalendarTasks } from "@/hooks/useCalendarTasks";
import { useCalendarMilestones } from "@/hooks/useCalendarMilestones";
import { useStreakMultiplier } from "@/hooks/useStreakMultiplier";
import { useFirstTimeModal } from "@/hooks/useFirstTimeModal";
import { useHabitSurfacing } from "@/hooks/useHabitSurfacing";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useStreakAtRisk } from "@/hooks/useStreakAtRisk";
import { usePerfectDayTracker } from "@/hooks/usePerfectDayTracker";
import { useComboTracker } from "@/hooks/useComboTracker";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { safeLocalStorage } from "@/utils/storage";
import type { StoryTypeSlug } from "@/types/narrativeTypes";
import type { ParsedTask } from "@/features/tasks/hooks/useNaturalLanguageParser";
import type { SuggestedSubtask } from "@/hooks/useTaskDecomposition";
import { cn } from "@/lib/utils";

const MAX_JOURNEYS = 2;

const Journeys = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [smartWizardOpen, setSmartWizardOpen] = useState(false);
  const [showPageInfo, setShowPageInfo] = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showHourlyModal, setShowHourlyModal] = useState(false);
  const [showQuestClear, setShowQuestClear] = useState(false);
  
  // Campaign creation animation state
  const [showCampaignAnimation, setShowCampaignAnimation] = useState(false);
  const [newCampaignData, setNewCampaignData] = useState<{
    title: string;
    habits: Array<{ title: string }>;
  } | null>(null);
  
  const { showModal: showTutorial, dismissModal: dismissTutorial } = useFirstTimeModal("journeys");
  
  // Auth and profile for tutorial quest
  const { user } = useAuth();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const tutorialCheckRef = useRef(false);
  
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
    activeEpics: activeJourneys,
    completedEpics: completedJourneys,
    isLoading: journeysLoading,
    createEpic: createJourney,
    isCreating,
    isCreateSuccess,
    updateEpicStatus: updateJourneyStatus,
  } = useEpics();
  
  // Trigger animation when campaign is created successfully
  useEffect(() => {
    if (isCreateSuccess && newCampaignData) {
      setShowCampaignAnimation(true);
    }
  }, [isCreateSuccess, newCampaignData]);

  const { 
    tasks: dailyTasks,
    addTask,
    toggleTask,
    updateTask,
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
  const { milestones: calendarMilestones } = useCalendarMilestones(selectedDate);
  
  // Habit surfacing - auto-surface active epic habits as daily tasks
  const { surfaceAllEpicHabits, unsurfacedEpicHabitsCount } = useHabitSurfacing(selectedDate);
  
  // Auto-surface habits when there are unsurfaced ones (with ref to prevent infinite loop)
  const hasSurfacedRef = useRef(false);
  const dateKeyRef = useRef(format(selectedDate, 'yyyy-MM-dd'));

  useEffect(() => {
    const currentDateKey = format(selectedDate, 'yyyy-MM-dd');
    
    // Reset if date changed
    if (dateKeyRef.current !== currentDateKey) {
      dateKeyRef.current = currentDateKey;
      hasSurfacedRef.current = false;
    }
    
    // Only surface once per date
    if (unsurfacedEpicHabitsCount > 0 && !hasSurfacedRef.current) {
      hasSurfacedRef.current = true;
      surfaceAllEpicHabits();
    }
  }, [unsurfacedEpicHabitsCount, selectedDate, surfaceAllEpicHabits]);
  
  // Tutorial quest creation for new users - "Join Cosmiq" quest
  useEffect(() => {
    if (!user?.id || !profile) return;
    
    const tutorialSeen = safeLocalStorage.getItem(`tutorial_dismissed_${user.id}`) === 'true';
    const onboardingData = (profile.onboarding_data as Record<string, unknown>) || {};
    const profileTutorialSeen = onboardingData.quests_tutorial_seen === true;
    
    if ((tutorialSeen || profileTutorialSeen) || tutorialCheckRef.current) return;
    
    tutorialCheckRef.current = true;
    
    const today = format(new Date(), 'yyyy-MM-dd');
    const questCreationKey = `tutorial_quest_created_${user.id}`;
    const questAlreadyCreated = safeLocalStorage.getItem(questCreationKey) === 'true';
    
    if (questAlreadyCreated) {
      tutorialCheckRef.current = false;
      return;
    }
    
    safeLocalStorage.setItem(questCreationKey, 'true');
    
    const checkAndCreateQuest = async () => {
      try {
        const { data: existingQuest } = await supabase
          .from('daily_tasks')
          .select('id')
          .eq('user_id', user.id)
          .eq('task_text', 'Join Cosmiq')
          .maybeSingle();
        
        if (!existingQuest) {
          const { error: insertError } = await supabase
            .from('daily_tasks')
            .insert({
              user_id: user.id,
              task_text: 'Join Cosmiq',
              difficulty: 'easy',
              xp_reward: 10,
              task_date: today,
              is_main_quest: false,
            });
          
          if (insertError) {
            safeLocalStorage.removeItem(questCreationKey);
          } else {
            queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
          }
        }
      } catch {
        safeLocalStorage.removeItem(questCreationKey);
      } finally {
        tutorialCheckRef.current = false;
      }
    };
    
    checkAndCreateQuest();
  }, [user?.id, profile, queryClient]);
  
  const tasksPerDay = useMemo(() => {
    const map: Record<string, number> = {};
    allCalendarTasks.forEach((task: any) => {
      const dateKey = task.task_date;
      map[dateKey] = (map[dateKey] || 0) + 1;
    });
    return map;
  }, [allCalendarTasks]);

  const hasReachedLimit = activeJourneys.length >= MAX_JOURNEYS;

  const handleCreateJourney = (data: {
    title: string;
    description?: string;
    target_days: number;
    story_type_slug?: StoryTypeSlug;
    theme_color?: string;
    is_public?: boolean;
    habits: Array<{
      title: string;
      description?: string;
      difficulty: string;
      frequency: string;
      custom_days: number[];
      estimated_minutes?: number;
    }>;
    milestones?: Array<{
      title: string;
      description?: string;
      target_date: string;
      milestone_percent: number;
      is_postcard_milestone: boolean;
    }>;
    phases?: Array<{
      name: string;
      description: string;
      start_date: string;
      end_date: string;
      phase_order: number;
    }>;
  }) => {
    console.log('[Journeys] Creating journey with milestones:', data.milestones?.length || 0);
    // Store campaign data for animation
    setNewCampaignData({
      title: data.title,
      habits: data.habits.map(h => ({ title: h.title })),
    });
    createJourney(data);
    setSmartWizardOpen(false);
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
            Quests & Campaigns
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Daily quests. Epic campaigns. All in one place.
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
          <Button
            variant="ghost"
            onClick={() => setShowHourlyModal(true)}
            className="w-full mt-3 text-sky-400 hover:text-sky-300 hover:bg-sky-400/10 touch-manipulation"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Calendar View
          </Button>
        </motion.div>

        {/* Smart Natural Language Input */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-4"
        >
          <SmartTaskInput
            onSubmit={async (parsed: ParsedTask, subtasks?: SuggestedSubtask[]) => {
              const taskDate = parsed.scheduledDate || format(selectedDate, 'yyyy-MM-dd');
              
              // Create the main task
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
              
              // If subtasks were generated, create those too
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
            }}
            placeholder="Add a quest or ask me anything..."
          />
        </motion.div>

        {/* Today's Agenda Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-6"
        >
          <TodaysAgenda
            tasks={dailyTasks}
            selectedDate={selectedDate}
            onToggle={handleToggleTask}
            onAddQuest={() => setShowAddSheet(true)}
            completedCount={completedCount}
            totalCount={totalCount}
            currentStreak={currentStreak}
            activeJourneys={activeJourneys}
            onUndoToggle={handleUndoToggle}
            onEditQuest={handleEditQuest}
            hideIndicator={showTutorial}
          />
        </motion.div>

        {/* Active Journeys Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4 mb-8"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Active Campaigns
            </h2>
          </div>
          
          {journeysLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : isCreating ? (
            // Campaign creation loading state
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-12 bg-gradient-to-br from-primary/10 via-purple-500/10 to-primary/5 rounded-2xl border-2 border-primary/30 relative overflow-hidden"
            >
              {/* Animated sparkles background */}
              <div className="absolute inset-0 pointer-events-none">
                <Sparkles className="absolute top-4 left-8 w-4 h-4 text-primary/40 animate-pulse" />
                <Sparkles className="absolute top-8 right-12 w-3 h-3 text-purple-400/40 animate-pulse" style={{ animationDelay: '0.5s' }} />
                <Sparkles className="absolute bottom-6 left-16 w-3 h-3 text-primary/30 animate-pulse" style={{ animationDelay: '1s' }} />
                <Sparkles className="absolute bottom-10 right-8 w-4 h-4 text-purple-400/30 animate-pulse" style={{ animationDelay: '0.3s' }} />
              </div>
              
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="inline-block"
              >
                <Loader2 className="w-16 h-16 text-primary mx-auto mb-4" />
              </motion.div>
              <h3 className="text-xl font-bold mb-2">Creating Your Campaign...</h3>
              <p className="text-muted-foreground mb-4 max-w-xs mx-auto">
                Setting up rituals, milestones, and your adventure awaits
              </p>
              <div className="flex justify-center gap-1">
                <motion.div
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
                  className="w-2 h-2 rounded-full bg-primary"
                />
                <motion.div
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                  className="w-2 h-2 rounded-full bg-primary"
                />
                <motion.div
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}
                  className="w-2 h-2 rounded-full bg-primary"
                />
              </div>
            </motion.div>
          ) : activeJourneys.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 bg-gradient-to-br from-primary/10 via-purple-500/10 to-primary/5 rounded-2xl border-2 border-primary/30 relative overflow-hidden"
            >
              {/* Animated sparkles background */}
              <div className="absolute inset-0 pointer-events-none">
                <Sparkles className="absolute top-4 left-8 w-4 h-4 text-primary/40 animate-pulse" />
                <Sparkles className="absolute top-8 right-12 w-3 h-3 text-purple-400/40 animate-pulse" style={{ animationDelay: '0.5s' }} />
                <Sparkles className="absolute bottom-6 left-16 w-3 h-3 text-primary/30 animate-pulse" style={{ animationDelay: '1s' }} />
                <Sparkles className="absolute bottom-10 right-8 w-4 h-4 text-purple-400/30 animate-pulse" style={{ animationDelay: '0.3s' }} />
              </div>
              
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <Wand2 className="w-16 h-16 text-primary mx-auto mb-4" />
              </motion.div>
              <h3 className="text-xl font-bold mb-2">Begin Your Journey</h3>
              <p className="text-muted-foreground mb-6 max-w-xs mx-auto">
                Create a campaign with personalized rituals and milestones
              </p>
              
              {/* Hero CTA Button */}
              <motion.div
                animate={{ scale: [1, 1.02, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="relative inline-block"
              >
                {/* Glow effect */}
                <div className="absolute -inset-1 bg-gradient-to-r from-primary via-purple-500 to-primary rounded-xl blur-lg opacity-50 animate-pulse" />
                <Button
                  onClick={() => setSmartWizardOpen(true)}
                  size="lg"
                  className="relative h-14 px-8 text-lg font-semibold bg-gradient-to-r from-primary via-purple-500 to-primary bg-[length:200%_100%] hover:bg-[length:100%_100%] transition-all duration-500 shadow-lg hover:shadow-primary/25"
                >
                  <Wand2 className="w-5 h-5 mr-2" />
                  Start a Campaign
                  <Sparkles className="w-4 h-4 ml-2" />
                </Button>
              </motion.div>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {activeJourneys.map((journey) => (
                <JourneyCard
                  key={journey.id}
                  journey={journey}
                  onComplete={() =>
                    updateJourneyStatus({ epicId: journey.id, status: "completed" })
                  }
                  onAbandon={() =>
                    updateJourneyStatus({ epicId: journey.id, status: "abandoned" })
                  }
                />
              ))}
              
              {/* Subtle add campaign button with proper touch target */}
              {!hasReachedLimit && (
                <div className="flex justify-center pt-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSmartWizardOpen(true)}
                    className="h-11 w-11 rounded-full opacity-40 hover:opacity-70 text-muted-foreground touch-manipulation"
                  >
                    <Plus className="w-5 h-5" />
                  </Button>
                </div>
              )}
            </div>
          )}
          
          {hasReachedLimit && (
            <p className="text-xs text-amber-500 text-center">
              Max {MAX_JOURNEYS} active campaigns. Complete one to start another.
            </p>
          )}
        </motion.div>

        {/* Legendary Journeys */}
        {completedJourneys.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Legendary Campaigns
            </h2>
            <div className="space-y-4">
              {completedJourneys.map((journey) => (
                <JourneyCard key={journey.id} journey={journey} />
              ))}
            </div>
          </motion.div>
        )}

        {/* Pathfinder */}
        <Pathfinder
          open={smartWizardOpen}
          onOpenChange={setSmartWizardOpen}
          onCreateEpic={handleCreateJourney}
          isCreating={isCreating}
        />

        
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
          title="About Quests & Campaigns"
          icon={Compass}
          description="Quests and Campaigns unite your daily tasks and recurring rituals into one powerful view."
          features={[
            "Complete daily quests to earn XP",
            "Rituals repeat automatically to build habits",
            "Link rituals to campaigns for bonus progress",
            "Track your streak and maintain momentum",
            "Join guilds to campaign with others"
          ]}
          tip="Create campaigns to link your daily rituals to bigger goals!"
        />

        <HourlyViewModal
          open={showHourlyModal}
          onOpenChange={setShowHourlyModal}
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          tasks={allCalendarTasks.map(task => ({
            id: task.id,
            task_text: task.task_text,
            completed: task.completed || false,
            scheduled_time: task.scheduled_time,
            estimated_duration: task.estimated_duration,
            task_date: task.task_date,
            difficulty: task.difficulty,
            xp_reward: task.xp_reward,
            is_main_quest: task.is_main_quest || false,
          }))}
          milestones={calendarMilestones}
          onTaskDrop={() => {}}
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
        
        {/* Campaign Created Animation */}
        <CampaignCreatedAnimation
          isVisible={showCampaignAnimation}
          campaignTitle={newCampaignData?.title || ''}
          habits={newCampaignData?.habits || []}
          onComplete={() => {
            setShowCampaignAnimation(false);
            setNewCampaignData(null);
          }}
        />
      </div>


      <BottomNav />
    </PageTransition>
  );
};

export default Journeys;
