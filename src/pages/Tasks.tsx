import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Target, Swords, Trophy, Star, Plus, ArrowDown, Clock } from "lucide-react";
import { useCalendarTasks } from "@/hooks/useCalendarTasks";
import { ScheduleCelebration } from "@/components/ScheduleCelebration";
import { QuestsTutorialModal } from "@/components/QuestsTutorialModal";
import { StreakFreezePromptModal } from "@/components/StreakFreezePromptModal";
import { useStreakAtRisk } from "@/hooks/useStreakAtRisk";
import { Button } from "@/components/ui/button";
import { safeLocalStorage } from "@/utils/storage";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { BottomNav } from "@/components/BottomNav";
import { useDailyTasks } from "@/hooks/useDailyTasks";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useCompanion } from "@/hooks/useCompanion";
import { useProfile } from "@/hooks/useProfile";
import { useStreakMultiplier } from "@/hooks/useStreakMultiplier";
import { format, isSameDay } from "date-fns";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { PageInfoButton } from "@/components/PageInfoButton";
import { PageInfoModal } from "@/components/PageInfoModal";
import { EditQuestDialog } from "@/features/quests/components/EditQuestDialog";
import { EpicsTab } from "@/features/epics/components/EpicsTab";
import { ComboCounter } from "@/components/ComboCounter";
import { QuestClearCelebration } from "@/components/QuestClearCelebration";
import { useComboTracker } from "@/hooks/useComboTracker";
import { TasksPageSkeleton } from "@/components/skeletons";

// New components
import { AddQuestSheet, AddQuestData } from "@/components/AddQuestSheet";
import { MiniCalendar } from "@/components/MiniCalendar";
import { DatePillsScroller } from "@/components/DatePillsScroller";
import { QuestAgenda } from "@/components/QuestAgenda";
import { HourlyViewModal } from "@/components/HourlyViewModal";
import { CalendarTask } from "@/types/quest";

const MAIN_QUEST_MULTIPLIER = 1.5;

type PendingTaskData = {
  text: string;
  difficulty: "easy" | "medium" | "hard";
  date: string;
  scheduledTime: string | null;
  estimatedDuration: number | null;
  recurrencePattern: string | null;
  recurrenceDays: number[];
  reminderEnabled: boolean;
  reminderMinutesBefore: number;
  moreInformation: string | null;
};

export default function Tasks() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile } = useProfile();
  const { companion, isLoading: companionLoading, error: companionError } = useCompanion();
  
  // Streak freeze prompt state
  const { needsStreakDecision, currentStreak, freezesAvailable, useFreeze, resetStreak, isResolving } = useStreakAtRisk();
  const { currentStreak: streakCount } = useStreakMultiplier();
  
  // Combo and celebration state
  const { comboCount, showCombo, bonusXP, recordCompletion } = useComboTracker();
  const [showQuestClear, setShowQuestClear] = useState(false);
  const prevCompletedRef = useRef(0);
  
  // Tutorial state
  const [showTutorial, setShowTutorial] = useState(false);
  const tutorialCheckRef = useRef(false);
  const tutorialScrollHandledRef = useRef(false);
  
  // Page info state
  const [showPageInfo, setShowPageInfo] = useState(false);
  
  // Calendar state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarCollapsed, setCalendarCollapsed] = useState(true);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [prefilledTime, setPrefilledTime] = useState<string | null>(null);
  const [showHourlyModal, setShowHourlyModal] = useState(false);
  
  // Tasks state
  const { 
    tasks,
    addTask, 
    toggleTask, 
    deleteTask,
    setMainQuest,
    isAdding,
    completedCount,
    totalCount 
  } = useDailyTasks(selectedDate);
  
  // Calendar tasks for multi-day views
  const { tasks: allCalendarTasks } = useCalendarTasks(selectedDate, "month");
  
  // Create tasks per day map for calendar/pills indicators
  const tasksPerDay = useMemo(() => {
    const map: Record<string, number> = {};
    allCalendarTasks.forEach((task: any) => {
      const dateKey = task.task_date;
      map[dateKey] = (map[dateKey] || 0) + 1;
    });
    return map;
  }, [allCalendarTasks]);
  
  // Celebration states
  const [showCelebration, setShowCelebration] = useState<{
    show: boolean;
    type: "perfect_week" | "power_hour" | "deep_work" | "conflict_free";
  }>({ show: false, type: "perfect_week" });

  // Main quest prompt state
  const [showMainQuestPrompt, setShowMainQuestPrompt] = useState(false);
  const [pendingTaskData, setPendingTaskData] = useState<PendingTaskData | null>(null);
  const drawerActionHandledRef = useRef(false);
  
  // Edit quest state
  const [editingTask, setEditingTask] = useState<typeof tasks[0] | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const tutorialQuestId = useMemo(() => {
    const normalizedTutorial = tasks.find((task) =>
      task.task_text?.trim().toLowerCase() === 'join cosmiq'
    );
    if (normalizedTutorial) return normalizedTutorial.id;
    if (showTutorial) {
      return tasks.find((task) => !task.completed)?.id;
    }
    return undefined;
  }, [tasks, showTutorial]);

  const tutorialQuestPending = useMemo(() => {
    if (!tutorialQuestId) return false;
    const quest = tasks.find((task) => task.id === tutorialQuestId);
    return !!quest && !quest.completed;
  }, [tasks, tutorialQuestId]);

  const scrollToTutorialQuest = useCallback(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const tutorialCard = document.querySelector('[data-tutorial-quest="true"]') as HTMLElement | null;
    if (!tutorialCard) return;

    tutorialCard.scrollIntoView({ behavior: "smooth", block: "center" });

    if (typeof tutorialCard.animate === "function") {
      tutorialCard.animate(
        [
          { boxShadow: "0 0 0 0 rgba(129, 140, 248, 0.45)" },
          { boxShadow: "0 0 0 24px rgba(129, 140, 248, 0)" },
        ],
        {
          duration: 1200,
          easing: "ease-out",
        }
      );
    }
  }, []);

  // Tutorial auto-generation
  useEffect(() => {
    if (!user?.id || !profile) return;
    
    const tutorialSeen = safeLocalStorage.getItem(`tutorial_dismissed_${user.id}`) === 'true';
    const onboardingData = (profile.onboarding_data as Record<string, unknown>) || {};
    const profileTutorialSeen = onboardingData.quests_tutorial_seen === true;
    
    if ((tutorialSeen || profileTutorialSeen) || tutorialCheckRef.current) {
      return;
    }
    
    if (!tutorialSeen && !showTutorial) {
      tutorialCheckRef.current = true;
      setShowTutorial(true);
      
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
    }
  }, [user?.id, profile, showTutorial, queryClient]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!tutorialQuestPending) {
      tutorialScrollHandledRef.current = false;
      return;
    }

    if (tutorialScrollHandledRef.current) return;

    tutorialScrollHandledRef.current = true;
    const timeoutId = window.setTimeout(() => scrollToTutorialQuest(), 450);

    return () => window.clearTimeout(timeoutId);
  }, [tutorialQuestPending, scrollToTutorialQuest]);

  const handleTutorialClose = async () => {
    if (!user?.id) return;
    safeLocalStorage.setItem(`tutorial_dismissed_${user.id}`, 'true');
    setShowTutorial(false);
    
    if (profile) {
      const onboardingData = (profile.onboarding_data as Record<string, unknown>) || {};
      const updatedData = { ...onboardingData, quests_tutorial_seen: true };
      await supabase
        .from('profiles')
        .update({ onboarding_data: updatedData })
        .eq('id', user.id);
      queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
    }
  };

  const handleAddQuest = async (data: AddQuestData) => {
    const taskDate = format(selectedDate, 'yyyy-MM-dd');
    const hasMainQuest = tasks.some(task => task.is_main_quest);
    
    const taskData: PendingTaskData = {
      text: data.text,
      difficulty: data.difficulty,
      date: taskDate,
      scheduledTime: data.scheduledTime,
      estimatedDuration: data.estimatedDuration,
      recurrencePattern: data.recurrencePattern,
      recurrenceDays: data.recurrenceDays,
      reminderEnabled: data.reminderEnabled,
      reminderMinutesBefore: data.reminderMinutesBefore,
      moreInformation: data.moreInformation,
    };
    
    if (!hasMainQuest) {
      setPendingTaskData(taskData);
      drawerActionHandledRef.current = false;
      setShowMainQuestPrompt(true);
    } else {
      await actuallyAddTask(false, taskData);
    }
  };
  
  const actuallyAddTask = async (isMainQuest: boolean, dataToAdd?: PendingTaskData | null) => {
    if (!dataToAdd) return;
    
    try {
      await addTask({ 
        taskText: dataToAdd.text, 
        difficulty: dataToAdd.difficulty,
        taskDate: dataToAdd.date,
        isMainQuest: isMainQuest,
        scheduledTime: dataToAdd.scheduledTime,
        estimatedDuration: dataToAdd.estimatedDuration,
        recurrencePattern: dataToAdd.recurrencePattern,
        recurrenceDays: dataToAdd.recurrenceDays,
        reminderEnabled: dataToAdd.reminderEnabled,
        reminderMinutesBefore: dataToAdd.reminderMinutesBefore,
      });
    } catch (error) {
      // Error handled by mutation
    }
  };
  
  const handleMainQuestResponse = (makeMainQuest: boolean) => {
    if (!pendingTaskData) {
      setShowMainQuestPrompt(false);
      return;
    }

    drawerActionHandledRef.current = true;
    setShowMainQuestPrompt(false);
    const dataToAdd = pendingTaskData;
    setPendingTaskData(null);
    actuallyAddTask(makeMainQuest, dataToAdd);
  };

  const handleDrawerClose = () => {
    setShowMainQuestPrompt(false);
    if (drawerActionHandledRef.current) {
      drawerActionHandledRef.current = false;
      return;
    }
    if (!pendingTaskData) return;
    const dataToAdd = pendingTaskData;
    setPendingTaskData(null);
    actuallyAddTask(false, dataToAdd);
  };

  const handleUpdateTask = async (taskId: string, updates: {
    task_text: string;
    difficulty: string;
    scheduled_time: string | null;
    estimated_duration: number | null;
  }) => {
    if (!user?.id) return;
    setIsUpdating(true);
    
    try {
      const { error } = await supabase
        .from('daily_tasks')
        .update(updates)
        .eq('id', taskId)
        .eq('user_id', user.id);

      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
      toast({ title: "Quest updated!" });
    } catch {
      toast({ title: "Failed to update quest", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const openAddSheet = (time?: string) => {
    setPrefilledTime(time ?? null);
    setShowAddSheet(true);
  };

  // Error state
  if (companionError) {
    return (
      <div className="min-h-screen bg-background pb-20 flex items-center justify-center">
        <div className="text-center space-y-4 p-6">
          <Target className="h-16 w-16 mx-auto text-destructive" />
          <h2 className="text-2xl font-bold">Error Loading Data</h2>
          <p className="text-muted-foreground max-w-md">
            {companionError instanceof Error ? companionError.message : 'Unable to load your companion data.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  // Loading state with skeleton
  if (companionLoading) {
    return <TasksPageSkeleton />;
  }

  // No companion - redirect to onboarding
  if (!companion) {
    return (
      <div className="min-h-screen bg-background pb-20 flex items-center justify-center">
        <div className="text-center space-y-4 p-6">
          <Target className="h-16 w-16 mx-auto text-primary" />
          <h2 className="text-2xl font-bold">No Companion Found</h2>
          <p className="text-muted-foreground max-w-md">
            It looks like you haven't created your companion yet.
          </p>
          <button
            onClick={() => navigate('/onboarding')}
            className="mt-4 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity"
          >
            Start Onboarding
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 relative">
      <StarfieldBackground />
      
      <QuestsTutorialModal open={showTutorial} onClose={handleTutorialClose} />
      
      {/* Combo Counter */}
      <ComboCounter count={comboCount} show={showCombo} bonusXP={bonusXP} />
      
      {/* Quest Clear Celebration */}
      <QuestClearCelebration
        show={showQuestClear}
        totalXP={tasks.reduce((sum, t) => t.completed ? sum + t.xp_reward : sum, 0)}
        currentStreak={streakCount}
        onDismiss={() => setShowQuestClear(false)}
      />
      
      {/* Loading Overlay */}
      {isAdding && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="h-12 w-12 mx-auto animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-lg font-medium">Adding your quest...</p>
          </div>
        </div>
      )}
      
      <ScheduleCelebration 
        trigger={showCelebration.show}
        type={showCelebration.type}
        onComplete={() => setShowCelebration({ ...showCelebration, show: false })}
      />
      
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-top">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Target className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold">Quests & Epics</h1>
                <p className="text-muted-foreground">Build your daily momentum</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <PageInfoButton onClick={() => setShowPageInfo(true)} />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-6 pb-24 space-y-4 relative z-10">
        <Tabs defaultValue="quests" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="quests" className="gap-2" data-tour="tasks-tab">
              <Swords className="h-4 w-4" />
              Daily Quests
            </TabsTrigger>
            <TabsTrigger value="epics" className="gap-2" data-tour="epics-tab">
              <Trophy className="h-4 w-4" />
              Epics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quests" className="space-y-4 mt-4">
            {tutorialQuestPending && (
              <Card className="p-4 border-primary/40 bg-primary/5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shadow-sm">
                <div>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide">Starter quest ready</p>
                  <p className="text-sm text-muted-foreground">
                    Tap the glowing checkbox below to complete your first quest.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={scrollToTutorialQuest}
                  className="w-full sm:w-auto gap-2"
                >
                  <ArrowDown className="h-4 w-4" />
                  Jump to quest
                </Button>
              </Card>
            )}

            {/* Mini Calendar (Collapsed by default) */}
            <MiniCalendar
              selectedDate={selectedDate}
              onDateSelect={(date) => {
                setSelectedDate(date);
                setCalendarCollapsed(true);
              }}
              tasksPerDay={tasksPerDay}
              collapsed={calendarCollapsed}
              onToggleCollapse={() => setCalendarCollapsed(!calendarCollapsed)}
            />

            {/* Date Pills Scroller */}
            <DatePillsScroller
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
              tasksPerDay={tasksPerDay}
            />

            {/* Quest Agenda */}
            <Card className="p-4">
              <QuestAgenda
                tasks={tasks}
                selectedDate={selectedDate}
                onToggle={(taskId, completed, xpReward) => {
                  if (completed) recordCompletion();
                  toggleTask({ taskId, completed, xpReward });
                }}
                onDelete={deleteTask}
                onEdit={(task) => setEditingTask(task)}
                onSetMainQuest={setMainQuest}
                onAddQuest={() => openAddSheet()}
                tutorialQuestId={tutorialQuestId}
              />
            </Card>

            {/* Hourly View Trigger - Enhanced */}
            <button
              onClick={() => setShowHourlyModal(true)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg border border-border/60 bg-muted/30 hover:bg-muted/50 transition-all text-sm text-muted-foreground hover:text-foreground animate-cosmic-glow"
            >
              <Clock className="h-4 w-4" />
              <span>View Full Schedule</span>
              {tasks.filter(t => t.scheduled_time).length > 0 && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {tasks.filter(t => t.scheduled_time).length} scheduled
                </span>
              )}
            </button>
          </TabsContent>

          <TabsContent value="epics" className="space-y-4 mt-6">
            <EpicsTab />
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Quest Sheet */}
      <AddQuestSheet
        open={showAddSheet}
        onOpenChange={setShowAddSheet}
        selectedDate={selectedDate}
        prefilledTime={prefilledTime}
        onAdd={handleAddQuest}
        isAdding={isAdding}
      />

      {/* Hourly View Modal */}
      <HourlyViewModal
        open={showHourlyModal}
        onOpenChange={setShowHourlyModal}
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        tasks={allCalendarTasks as CalendarTask[]}
        onTaskDrop={async (taskId, newDate, newTime) => {
          if (!user?.id) return;
          const updates: { scheduled_time?: string | null; task_date?: string } = {};
          if (newTime) updates.scheduled_time = newTime;
          updates.task_date = format(newDate, 'yyyy-MM-dd');
          
          await supabase
            .from('daily_tasks')
            .update(updates)
            .eq('id', taskId)
            .eq('user_id', user.id);
          
          queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
          queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
        }}
        onTimeSlotLongPress={(date, time) => {
          setShowHourlyModal(false);
          setTimeout(() => openAddSheet(time), 150);
        }}
      />

      {/* Main Quest Prompt Drawer */}
      <Drawer 
        open={showMainQuestPrompt} 
        onOpenChange={(open) => {
          if (!open) handleDrawerClose();
          else setShowMainQuestPrompt(true);
        }}
      >
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-[hsl(45,100%,60%)]" />
              Set as Main Quest?
            </DrawerTitle>
            <DrawerDescription>
              Main quests award {MAIN_QUEST_MULTIPLIER}x XP and help you focus on what matters most today.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFooter className="pt-4">
            <Button 
              onClick={() => handleMainQuestResponse(true)}
              className="w-full gap-2 bg-gradient-to-r from-[hsl(45,100%,60%)] to-primary hover:opacity-90 text-background font-semibold"
            >
              <Star className="h-4 w-4" />
              Set as Main Quest
            </Button>
            <DrawerClose asChild>
              <Button 
                variant="outline" 
                onClick={() => handleMainQuestResponse(false)}
                className="w-full"
              >
                Add as Side Quest
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <PageInfoModal
        open={showPageInfo}
        onClose={() => setShowPageInfo(false)}
        title="About Quests"
        icon={Swords}
        description="Quests are your daily tasks that help you level up and grow your companion."
        features={[
          "Add quests throughout your day to build your routine",
          "First 3 quests earn full XP, then rewards decrease",
          "Main Quest gives you a 1.5x XP boost",
          "Use advanced options to schedule quests with time blocking",
          "Create Epics to link quests to long-term goals"
        ]}
        tip="Tap + to add quests, or expand the calendar to see your month!"
      />

      <StreakFreezePromptModal
        open={needsStreakDecision}
        currentStreak={currentStreak}
        freezesAvailable={freezesAvailable}
        onUseFreeze={useFreeze}
        onResetStreak={resetStreak}
        isResolving={isResolving}
      />

      <EditQuestDialog
        task={editingTask}
        open={!!editingTask}
        onOpenChange={(open) => !open && setEditingTask(null)}
        onSave={handleUpdateTask}
        isSaving={isUpdating}
      />

      <BottomNav />
    </div>
  );
}
