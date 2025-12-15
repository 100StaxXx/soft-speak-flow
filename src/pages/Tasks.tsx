import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar as CalendarIcon, Target, Zap, Flame, Mountain, Swords, LayoutGrid, CalendarDays, Trophy, Star, Sliders, ArrowDown } from "lucide-react";
import { CalendarMonthView } from "@/components/CalendarMonthView";
import { CalendarWeekView } from "@/components/CalendarWeekView";
import { CalendarDayView } from "@/components/CalendarDayView";
import { useCalendarTasks } from "@/hooks/useCalendarTasks";
import { ScheduleCelebration } from "@/components/ScheduleCelebration";
import { QuestsTutorialModal } from "@/components/QuestsTutorialModal";
import { StreakFreezePromptModal } from "@/components/StreakFreezePromptModal";
import { useStreakAtRisk } from "@/hooks/useStreakAtRisk";
import { Button } from "@/components/ui/button";
import { safeLocalStorage } from "@/utils/storage";
import { Input } from "@/components/ui/input";
import { TaskCard } from "@/components/TaskCard";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QUEST_XP_REWARDS, getEffectiveQuestXP, getQuestXPMultiplier } from "@/config/xpRewards";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Progress } from "@/components/ui/progress";
import { BrandTagline } from "@/components/BrandTagline";
import { BottomNav } from "@/components/BottomNav";
import { AdvancedQuestOptions } from "@/components/AdvancedQuestOptions";
import { useDailyTasks } from "@/hooks/useDailyTasks";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useCompanion } from "@/hooks/useCompanion";
import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { StarfieldBackground } from "@/components/StarfieldBackground";
import { PageInfoButton } from "@/components/PageInfoButton";
import { PageInfoModal } from "@/components/PageInfoModal";
import { QuestSectionTooltip } from "@/components/QuestSectionTooltip";
import { EditQuestDialog } from "@/features/quests/components/EditQuestDialog";
import { EpicsTab } from "@/features/epics/components/EpicsTab";
import { EmptyState } from "@/components/EmptyState";

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
  
  // Tutorial state
  const [showTutorial, setShowTutorial] = useState(false);
  const tutorialCheckRef = useRef(false);
  const tutorialScrollHandledRef = useRef(false);
  
  // Page info state
  const [showPageInfo, setShowPageInfo] = useState(false);
  
  // Calendar state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarView, setCalendarView] = useState<"list" | "month" | "week">("list");
  
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
  const { tasks: allCalendarTasks } = useCalendarTasks(selectedDate, calendarView);
  
  // Celebration states
  const [showCelebration, setShowCelebration] = useState<{
    show: boolean;
    type: "perfect_week" | "power_hour" | "deep_work" | "conflict_free";
  }>({ show: false, type: "perfect_week" });

  // Quest form state
  const [newTaskText, setNewTaskText] = useState("");
  const [taskDifficulty, setTaskDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [scheduledTime, setScheduledTime] = useState<string | null>(null);
  const [estimatedDuration, setEstimatedDuration] = useState<number | null>(null);
  const [recurrencePattern, setRecurrencePattern] = useState<string | null>(null);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState(15);
  const [moreInformation, setMoreInformation] = useState<string | null>(null);
  const [showMainQuestPrompt, setShowMainQuestPrompt] = useState(false);
  const [pendingTaskData, setPendingTaskData] = useState<PendingTaskData | null>(null);
  const drawerActionHandledRef = useRef(false);
  
  // Edit quest state
  const [editingTask, setEditingTask] = useState<typeof tasks[0] | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Calculate total XP for the day
  const totalXP = useMemo(() => {
    return tasks.reduce((sum, task) => {
      if (!task.completed) return sum;
      const reward = task.is_main_quest ? task.xp_reward * MAIN_QUEST_MULTIPLIER : task.xp_reward;
      return sum + reward;
    }, 0);
  }, [tasks]);

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

  const handleAddTask = () => {
    if (!newTaskText.trim()) return;
    
    const taskDate = format(selectedDate, 'yyyy-MM-dd');
    const hasMainQuest = tasks.some(task => task.is_main_quest);
    
    const taskData: PendingTaskData = {
      text: newTaskText,
      difficulty: taskDifficulty,
      date: taskDate,
      scheduledTime,
      estimatedDuration,
      recurrencePattern,
      recurrenceDays,
      reminderEnabled,
      reminderMinutesBefore,
      moreInformation,
    };
    
    if (!hasMainQuest) {
      setPendingTaskData(taskData);
      drawerActionHandledRef.current = false;
      setShowMainQuestPrompt(true);
    } else {
      actuallyAddTask(false, taskData);
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
        notes: dataToAdd.moreInformation,
      });

      // Clear form
      setNewTaskText("");
      setTaskDifficulty("medium");
      setScheduledTime(null);
      setEstimatedDuration(null);
      setRecurrencePattern(null);
      setRecurrenceDays([]);
      setReminderEnabled(false);
      setReminderMinutesBefore(15);
      setMoreInformation(null);
      setShowAdvanced(false);
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
    notes: string | null;
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

  // Check task conflicts
  const checkTaskConflicts = (task: any, allTasks: any[]) => {
    for (const other of allTasks) {
      if (task.id === other.id || !task.scheduled_time || !other.scheduled_time) continue;
      if (task.task_date !== other.task_date) continue;
      
      const t1Start = new Date(`2000-01-01T${task.scheduled_time}:00`);
      const t1End = new Date(t1Start.getTime() + ((task.estimated_duration || 0) * 60000));
      const t2Start = new Date(`2000-01-01T${other.scheduled_time}:00`);
      const t2End = new Date(t2Start.getTime() + ((other.estimated_duration || 0) * 60000));
      
      if (t1Start < t2End && t2Start < t1End) return true;
    }
    return false;
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

  // Loading state
  if (companionLoading) {
    return (
      <div className="min-h-screen bg-background pb-20 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          <p className="text-muted-foreground">Loading your adventure...</p>
        </div>
      </div>
    );
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

  const mainQuest = tasks.find(t => t.is_main_quest);
  const sideQuests = tasks.filter(t => !t.is_main_quest);

  return (
    <div className="min-h-screen pb-20 relative">
      <StarfieldBackground />
      
      <QuestsTutorialModal open={showTutorial} onClose={handleTutorialClose} />
      
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
          <BrandTagline />
          <div className="flex items-center gap-3">
            <Target className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Quests & Epics</h1>
              <p className="text-muted-foreground">Build your daily momentum</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-6 space-y-6 relative z-10">
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
            {/* Calendar Card */}
            <Card data-tour="week-calendar" className="p-4 bg-gradient-to-br from-primary/5 to-accent/5 space-y-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-lg">Calendar</h2>
                <div className="flex gap-2">
                  <Button
                    variant={calendarView === "list" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCalendarView("list")}
                    className="gap-2"
                  >
                    <LayoutGrid className="h-4 w-4" />
                    <span className="hidden sm:inline">List</span>
                  </Button>
                  <Button
                    variant={calendarView === "week" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCalendarView("week")}
                    className="gap-2"
                  >
                    <CalendarDays className="h-4 w-4" />
                    <span className="hidden sm:inline">Week</span>
                  </Button>
                  <Button
                    variant={calendarView === "month" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCalendarView("month")}
                    className="gap-2"
                  >
                    <CalendarIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">Month</span>
                  </Button>
                  <PageInfoButton onClick={() => setShowPageInfo(true)} />
                </div>
              </div>

              {calendarView === "list" && (
                <CalendarDayView
                  selectedDate={selectedDate}
                  onDateSelect={setSelectedDate}
                  tasks={allCalendarTasks}
                  onTaskDrop={async (taskId, newDate, newTime) => {
                    const { error } = await supabase
                      .from('daily_tasks')
                      .update({
                        task_date: format(newDate, 'yyyy-MM-dd'),
                        scheduled_time: newTime,
                        reminder_sent: false
                      })
                      .eq('id', taskId);

                    if (!error) {
                      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
                      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
                      toast({
                        title: "Quest scheduled",
                        description: newTime
                          ? `Scheduled for ${format(newDate, 'MMM d')} at ${newTime}`
                          : `Moved to ${format(newDate, 'MMM d')}`
                      });
                    }
                  }}
                  onTimeSlotLongPress={(date, time) => {
                    setScheduledTime(time);
                    setSelectedDate(date);
                    setTimeout(() => {
                      const input = document.querySelector('[data-tour="add-task-input"]') as HTMLInputElement;
                      input?.focus();
                      input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 100);
                  }}
                />
              )}

              {calendarView === "month" && (
                <CalendarMonthView
                  selectedDate={selectedDate}
                  onDateSelect={setSelectedDate}
                  tasks={allCalendarTasks}
                  onTaskClick={() => setCalendarView("list")}
                  onDateLongPress={(date) => {
                    setSelectedDate(date);
                    setCalendarView("list");
                    setTimeout(() => {
                      const input = document.querySelector('[data-tour="add-task-input"]') as HTMLInputElement;
                      input?.focus();
                      input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 100);
                  }}
                />
              )}

              {calendarView === "week" && (
                <CalendarWeekView
                  selectedDate={selectedDate}
                  onDateSelect={setSelectedDate}
                  tasks={allCalendarTasks}
                  onTaskDrop={async (taskId, newDate, newTime) => {
                    const { error } = await supabase
                      .from('daily_tasks')
                      .update({
                        task_date: format(newDate, 'yyyy-MM-dd'),
                        scheduled_time: newTime,
                        reminder_sent: false
                      })
                      .eq('id', taskId);

                    if (!error) {
                      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
                      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
                      toast({
                        title: "Quest rescheduled",
                        description: newTime
                          ? `Moved to ${format(newDate, 'MMM d')} at ${newTime}`
                          : `Moved to ${format(newDate, 'MMM d')}`
                      });

                      setTimeout(() => {
                        const scheduledTasks = allCalendarTasks.filter((t: any) => t.scheduled_time && t.estimated_duration);
                        if (scheduledTasks.length >= 5 && scheduledTasks.every((t: any) => !checkTaskConflicts(t, scheduledTasks))) {
                          setShowCelebration({ show: true, type: "perfect_week" });
                        }
                      }, 500);
                    }
                  }}
                  onTimeSlotLongPress={(date, time) => {
                    setScheduledTime(time);
                    setSelectedDate(date);
                    setTimeout(() => {
                      const input = document.querySelector('[data-tour="add-task-input"]') as HTMLInputElement;
                      input?.focus();
                      input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 100);
                  }}
                />
              )}
            </Card>

            {/* Quest List */}
            <Card className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div>
                    <h3 data-tour="today-quests-header" className="font-semibold inline-flex items-center">
                      {isSameDay(selectedDate, new Date()) ? "Today's Quests" : format(selectedDate, 'MMM d')}
                    </h3>
                    <QuestSectionTooltip />
                    <p className="text-sm text-muted-foreground">
                      {tasks.length} Quest{tasks.length !== 1 ? 's' : ''} • First 3 earn full XP
                    </p>
                  </div>
                </div>
                <div className="text-sm font-medium text-primary">
                  {completedCount}/{totalCount}
                </div>
              </div>

              {/* Progress Bar */}
              {totalCount > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Progress: {completedCount}/{totalCount} Complete
                    </span>
                    <span className="text-primary font-semibold">
                      +{totalXP} XP Today
                    </span>
                  </div>
                  <Progress value={(completedCount / totalCount) * 100} className="h-2" />
                </div>
              )}

              {/* Quest List Content */}
              <div className="space-y-6">
                {tasks.length === 0 ? (
                  <EmptyState 
                    icon={Target}
                    title="No quests yet"
                    description="Add quests throughout your day - first 3 earn full XP!"
                  />
                ) : (
                  <>
                    {mainQuest && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="text-xl">⚔️</div>
                          <h3 className="font-semibold text-foreground">Main Quest</h3>
                          <div className="ml-auto">
                            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
                              {MAIN_QUEST_MULTIPLIER}x XP
                            </span>
                          </div>
                        </div>
                        <TaskCard
                          task={{ ...mainQuest, xp_reward: mainQuest.xp_reward * MAIN_QUEST_MULTIPLIER }}
                          onToggle={() => toggleTask({ taskId: mainQuest.id, completed: !mainQuest.completed, xpReward: mainQuest.xp_reward * MAIN_QUEST_MULTIPLIER })}
                          onDelete={() => deleteTask(mainQuest.id)}
                          onEdit={() => setEditingTask(mainQuest)}
                          isMainQuest={true}
                          isTutorialQuest={mainQuest.id === tutorialQuestId}
                        />
                      </div>
                    )}

                    {sideQuests.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="text-lg">📜</div>
                          <h3 className="font-semibold text-muted-foreground">Side Quests</h3>
                        </div>
                        <div className="space-y-3">
                          {sideQuests.map((task) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              onToggle={() => toggleTask({ taskId: task.id, completed: !task.completed, xpReward: task.xp_reward })}
                              onDelete={() => deleteTask(task.id)}
                              onEdit={() => setEditingTask(task)}
                              onSetMainQuest={() => setMainQuest(task.id)}
                              showPromoteButton={!mainQuest}
                              isTutorialQuest={task.id === tutorialQuestId}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* XP Preview */}
              {tasks.length > 0 && (
                <div className={cn(
                  "flex items-center justify-between p-3 rounded-lg border",
                  tasks.length >= 3 ? "bg-amber-500/5 border-amber-500/20" : "bg-primary/5 border-primary/20"
                )}>
                  <div className="flex items-center gap-2">
                    <Zap className={cn("h-4 w-4", tasks.length >= 3 ? "text-amber-500" : "text-primary")} />
                    <span className="text-sm font-medium">Next Quest ({tasks.length + 1})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-xs font-semibold px-2 py-1 rounded-full",
                      tasks.length >= 3 ? "text-amber-600 bg-amber-500/10" : "text-primary bg-primary/10"
                    )}>
                      {Math.round(getQuestXPMultiplier(tasks.length + 1) * 100)}% XP
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {getEffectiveQuestXP(taskDifficulty, tasks.length + 1)} XP
                    </span>
                  </div>
                </div>
              )}

              {/* Add Quest Form */}
              <Card className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Add New Quest</p>
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors border border-primary/20 rounded-lg hover:bg-primary/5"
                  >
                    <Sliders className="w-3 h-3" />
                    {showAdvanced ? "Hide" : "Advanced"}
                  </button>
                </div>
                  
                <div className="space-y-3">
                  <Input
                    data-tour="add-task-input"
                    placeholder="Add a quest..."
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !showAdvanced && handleAddTask()}
                    disabled={isAdding}
                  />
                  
                  <div className="flex gap-2" data-tour="task-difficulty">
                    <Button
                      variant={taskDifficulty === 'easy' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTaskDifficulty('easy')}
                      className="flex-1 gap-1 px-2"
                    >
                      <Zap className="h-4 w-4" />
                      <span className="hidden sm:inline">Easy</span>
                      <span className="text-xs font-semibold text-muted-foreground">+{QUEST_XP_REWARDS.EASY} XP</span>
                    </Button>
                    <Button
                      variant={taskDifficulty === 'medium' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTaskDifficulty('medium')}
                      className="flex-1 gap-1 px-2"
                    >
                      <Flame className="h-4 w-4" />
                      <span className="hidden sm:inline">Medium</span>
                      <span className="text-xs font-semibold text-muted-foreground">+{QUEST_XP_REWARDS.MEDIUM} XP</span>
                    </Button>
                    <Button
                      variant={taskDifficulty === 'hard' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTaskDifficulty('hard')}
                      className="flex-1 gap-1 px-2"
                    >
                      <Mountain className="h-4 w-4" />
                      <span className="hidden sm:inline">Hard</span>
                      <span className="text-xs font-semibold text-muted-foreground">+{QUEST_XP_REWARDS.HARD} XP</span>
                    </Button>
                  </div>

                  {showAdvanced && (
                    <AdvancedQuestOptions
                      scheduledTime={scheduledTime}
                      estimatedDuration={estimatedDuration}
                      recurrencePattern={recurrencePattern}
                      recurrenceDays={recurrenceDays}
                      reminderEnabled={reminderEnabled}
                      reminderMinutesBefore={reminderMinutesBefore}
                      onScheduledTimeChange={setScheduledTime}
                      onEstimatedDurationChange={setEstimatedDuration}
                      onRecurrencePatternChange={setRecurrencePattern}
                      onRecurrenceDaysChange={setRecurrenceDays}
                      onReminderEnabledChange={setReminderEnabled}
                      onReminderMinutesBeforeChange={setReminderMinutesBefore}
                      moreInformation={moreInformation}
                      onMoreInformationChange={setMoreInformation}
                    />
                  )}

                  <Button 
                    data-tour="add-task-button"
                    onClick={handleAddTask}
                    disabled={isAdding || !newTaskText.trim()}
                    className="w-full"
                  >
                    {isAdding ? "Adding..." : "Add Quest"}
                  </Button>
                </div>
              </Card>
            </Card>
          </TabsContent>

          <TabsContent value="epics" className="space-y-4 mt-6">
            <EpicsTab />
          </TabsContent>
        </Tabs>
      </div>

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
        tip="Tap the calendar icon to see your weekly view and plan ahead!"
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
