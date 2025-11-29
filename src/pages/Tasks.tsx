import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar as CalendarIcon, Plus, CheckCircle2, Circle, Trash2, Target, Zap, Flame, Mountain, Swords, ChevronLeft, ChevronRight, Star, LayoutGrid, CalendarDays, Trophy, Users, Castle } from "lucide-react";
import { CalendarMonthView } from "@/components/CalendarMonthView";
import { CalendarWeekView } from "@/components/CalendarWeekView";
import { TimeConflictDetector } from "@/components/TimeConflictDetector";
import { useCalendarTasks } from "@/hooks/useCalendarTasks";
import { SchedulePowerUps } from "@/components/SchedulePowerUps";
import { ScheduleCelebration } from "@/components/ScheduleCelebration";
import { QuestsTutorialModal } from "@/components/QuestsTutorialModal";
import { Button } from "@/components/ui/button";
import { safeLocalStorage } from "@/utils/storage";
import { Input } from "@/components/ui/input";
import { TaskCard } from "@/components/TaskCard";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getHabitXP, QUEST_XP_REWARDS, getEffectiveQuestXP, getQuestXPMultiplier } from "@/config/xpRewards";
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
import { HabitCard } from "@/components/HabitCard";
import { HabitTemplates } from "@/components/HabitTemplates";
import { FrequencyPicker } from "@/components/FrequencyPicker";
import { HabitDifficultySelector } from "@/components/HabitDifficultySelector";
import { AdvancedQuestOptions } from "@/components/AdvancedQuestOptions";
import { EpicCard } from "@/components/EpicCard";
import { CreateEpicDialog } from "@/components/CreateEpicDialog";
import { JoinEpicDialog } from "@/components/JoinEpicDialog";
import { useEpics } from "@/hooks/useEpics";
import { Sliders } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { useDailyTasks } from "@/hooks/useDailyTasks";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useXPRewards } from "@/hooks/useXPRewards";
import { useAchievements } from "@/hooks/useAchievements";
import { useCompanion } from "@/hooks/useCompanion";
import { useCompanionAttributes } from "@/hooks/useCompanionAttributes";
import { useProfile } from "@/hooks/useProfile";
import confetti from "canvas-confetti";
import { haptics } from "@/utils/haptics";
import { cn } from "@/lib/utils";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StarfieldBackground } from "@/components/StarfieldBackground";


const MAIN_QUEST_MULTIPLIER = 1.5;
const getLocalDateString = (date: Date = new Date()) => format(date, "yyyy-MM-dd");
const toReferenceTime = (time: string) => {
  const [hours, minutes = "0"] = time.split(":");
  const h = Number(hours) || 0;
  const m = Number(minutes) || 0;
  return new Date(2000, 0, 1, h, m, 0, 0);
};

export default function Tasks() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile } = useProfile();
  const { companion, isLoading: companionLoading } = useCompanion();
  const { updateMindFromHabit, updateBodyFromActivity } = useCompanionAttributes();
  const { awardCustomXP, awardAllHabitsComplete, XP_REWARDS } = useXPRewards();
  const { checkStreakAchievements, checkFirstTimeAchievements } = useAchievements();
  const { activeEpics, completedEpics, isLoading: epicsLoading, createEpic, isCreating, updateEpicStatus } = useEpics();
  
  // Tutorial state
  const [showTutorial, setShowTutorial] = useState(false);
  
  // Calendar state for quest scheduling
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarView, setCalendarView] = useState<"list" | "month" | "week">("list");
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 }); // Monday start
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  
  // Tasks state - use regular hook for list view single-day tasks
  const { 
    tasks,
    addTask, 
    toggleTask, 
    deleteTask,
    setMainQuest,
    isAdding,
    isToggling,
    completedCount,
    totalCount 
  } = useDailyTasks(selectedDate);
  
  // Get all tasks for calendar views
  const { tasks: allCalendarTasks } = useCalendarTasks(selectedDate, calendarView);
  
  // Celebration states
  const [showCelebration, setShowCelebration] = useState<{
    show: boolean;
    type: "perfect_week" | "power_hour" | "deep_work" | "conflict_free";
  }>({ show: false, type: "perfect_week" });
  

  const [newTaskText, setNewTaskText] = useState("");
  const [taskDifficulty, setTaskDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [scheduledTime, setScheduledTime] = useState<string | null>(null);
  const [estimatedDuration, setEstimatedDuration] = useState<number | null>(null);
  const [recurrencePattern, setRecurrencePattern] = useState<string | null>(null);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState(15);
  const [showMainQuestPrompt, setShowMainQuestPrompt] = useState(false);
  const [pendingTaskData, setPendingTaskData] = useState<{
    text: string;
    difficulty: "easy" | "medium" | "hard";
    date: string;
    scheduledTime: string | null;
    estimatedDuration: number | null;
    recurrencePattern: string | null;
    recurrenceDays: number[];
    reminderEnabled: boolean;
    reminderMinutesBefore: number;
  } | null>(null);
  
  // Calculate total XP for the day
  const totalXP = tasks.reduce((sum, task) => {
    if (!task.completed) return sum;
    const reward = task.is_main_quest ? task.xp_reward * MAIN_QUEST_MULTIPLIER : task.xp_reward;
    return sum + reward;
  }, 0);

  // Habits state
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [newHabitTitle, setNewHabitTitle] = useState("");
  const [habitDifficulty, setHabitDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  // Epics state
  const [createEpicDialogOpen, setCreateEpicDialogOpen] = useState(false);
  const [joinEpicDialogOpen, setJoinEpicDialogOpen] = useState(false);

  // Fetch habits
  const { data: habits = [] } = useQuery({
    queryKey: ['habits', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      
      const { data } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);
      return data || [];
    },
    enabled: !!user,
  });

  // Set showTemplates based on whether user has habits
  useEffect(() => {
    if (habits.length === 0) {
      setShowTemplates(true);
    } else {
      setShowTemplates(false);
    }
  }, [habits.length]);

  const { data: completions = [] } = useQuery({
    queryKey: ['habit-completions', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data } = await supabase
        .from('habit_completions')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today);
      return data || [];
    },
    enabled: !!user,
  });

  // Add habit mutation
  const addHabitMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      
      // Re-fetch count from database to prevent race condition
      const { data: currentHabits, error: fetchError } = await supabase
        .from('habits')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_active', true);
      
      if (fetchError) {
        throw fetchError;
      }
      
      // Database-level check for max habits
      const { count } = await supabase
        .from('habits')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_active', true);
      
      if (count && count >= 2) {
        throw new Error('Maximum 2 habits allowed');
      }
      
      const { error } = await supabase.from('habits').insert({
        user_id: user.id,
        title: newHabitTitle,
        frequency: selectedDays.length === 7 ? 'daily' : 'custom',
        custom_days: selectedDays.length === 7 ? null : selectedDays,
        difficulty: habitDifficulty,
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      setNewHabitTitle("");
      setHabitDifficulty("medium");
      setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
      setShowAddHabit(false);
      // Don't show templates again - stay on the habit checking page
      toast({ title: "Habit created successfully!" });
      haptics.success();
    },
  });

  // Toggle habit completion
  const toggleHabitMutation = useMutation({
    mutationFn: async ({ habitId, isCompleted }: { habitId: string; isCompleted: boolean }) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      
      const today = format(new Date(), 'yyyy-MM-dd');
      
      if (isCompleted) {
        // Unchecking - remove completion record but DON'T remove XP
        const { error } = await supabase
          .from('habit_completions')
          .delete()
          .eq('habit_id', habitId)
          .eq('user_id', user.id)
          .eq('date', today);
        if (error) throw error;
        return { isCompleting: false, isFirstCompletion: false };
      } else {
        // ATOMIC INSERT: Use unique constraint to prevent duplicates
        // If already exists, insert will fail gracefully
        const { data: insertedData, error: insertError } = await supabase
          .from('habit_completions')
          .insert({ habit_id: habitId, user_id: user.id, date: today })
          .select();

        // If insert failed due to duplicate, this is NOT a first completion
        if (insertError) {
          // Unique constraint violation (habit already completed today)
          if (insertError.code === '23505') {
            return { isCompleting: true, isFirstCompletion: false };
          }
          throw insertError;
        }
        
        // Only award XP if this was a successful insert (first completion)
        const isFirstCompletion = insertedData && insertedData.length > 0;
        if (isFirstCompletion) {
          const habit = habits.find(h => h.id === habitId);
          if (!habit) {
            throw new Error('Habit not found');
          }
          const xpAmount = habit.difficulty ? getHabitXP(habit.difficulty as 'easy' | 'medium' | 'hard') : 10;
          await awardCustomXP(xpAmount, 'habit_complete', 'Habit Complete!');
          
          // Update companion attributes in background without blocking
          if (companion?.id) {
            updateMindFromHabit(companion.id).catch(err => 
              console.error('Mind update failed:', err)
            );
            updateBodyFromActivity(companion.id).catch(err => 
              console.error('Body update failed:', err)
            );
          }
          
          // Check for streak achievements
          if (profile?.current_habit_streak) {
            await checkStreakAchievements(profile.current_habit_streak);
          }
          
          confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
          haptics.success();
        }
        
        return { isCompleting: true, isFirstCompletion };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habit-completions'] });
      queryClient.invalidateQueries({ queryKey: ['habits'] });
    },
  });

  const handleAddTask = () => {
    if (!newTaskText.trim()) return;
    
    const taskDate = format(selectedDate, 'yyyy-MM-dd');
    const hasMainQuest = tasks.some(task => task.is_main_quest);
    
    // Create task data object
    const taskData = {
      text: newTaskText,
      difficulty: taskDifficulty,
      date: taskDate,
      scheduledTime,
      estimatedDuration,
      recurrencePattern,
      recurrenceDays,
      reminderEnabled,
      reminderMinutesBefore,
    };
    
    // If no main quest exists, ask user BEFORE creating the task
    if (!hasMainQuest) {
      setPendingTaskData(taskData);
      setShowMainQuestPrompt(true);
    } else {
      // Main quest already exists, create as side quest immediately
      actuallyAddTask(false, taskData);
    }
  };
  
  const actuallyAddTask = async (isMainQuest: boolean, dataToAdd?: typeof pendingTaskData) => {
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
      
      // Clear form
      setNewTaskText("");
      setTaskDifficulty("medium");
      setScheduledTime(null);
      setEstimatedDuration(null);
      setRecurrencePattern(null);
      setRecurrenceDays([]);
      setReminderEnabled(false);
      setReminderMinutesBefore(15);
      setShowAdvanced(false);
    } catch (error) {
      console.error('Failed to add task:', error);
    }
  };
  
  const handleMainQuestResponse = (makeMainQuest: boolean) => {
    setShowMainQuestPrompt(false);
    // Clear pending data immediately to prevent duplicate creation
    const dataToAdd = pendingTaskData;
    setPendingTaskData(null);
    actuallyAddTask(makeMainQuest, dataToAdd);
  };
  const handleDrawerClose = () => {
    // Only default to side quest if user dismissed without choosing
    if (pendingTaskData && showMainQuestPrompt) {
      handleMainQuestResponse(false);
    }
  };

  const handleAddHabit = () => {
    if (!newHabitTitle.trim()) {
      toast({ title: "Please enter a habit title", variant: "destructive" });
      return;
    }
    addHabitMutation.mutate();
  };

  const habitProgress = habits.length > 0 
    ? completions.length / habits.length 
    : 0;

  // Check if tutorial should be shown and auto-generate "Join R-Evolution" quest
  useEffect(() => {
    if (!user?.id || !profile) return;
    
    // Check localStorage first for immediate feedback
    const tutorialDismissed = safeLocalStorage.getItem(`tutorial_dismissed_${user.id}`);
    if (tutorialDismissed === 'true') {
      if (showTutorial) setShowTutorial(false);
      return;
    }
    
    const onboardingData = profile.onboarding_data as { quests_tutorial_seen?: boolean } | null;
    const tutorialSeen = onboardingData?.quests_tutorial_seen;
    
    // If database says tutorial was seen, mark localStorage and close
    if (tutorialSeen) {
      safeLocalStorage.setItem(`tutorial_dismissed_${user.id}`, 'true');
      if (showTutorial) setShowTutorial(false);
      return;
    }
    
    // Only show tutorial once when not seen
    if (!tutorialSeen && !showTutorial) {
      setShowTutorial(true);
      
      // Auto-generate "Join R-Evolution" quest (only once)
      const today = format(new Date(), 'yyyy-MM-dd');
      const questCreationKey = `tutorial_quest_created_${user.id}`;
      
      // Check if we've already attempted to create this quest in this session
      if (safeLocalStorage.getItem(questCreationKey) === 'true') {
        return;
      }
      
      // Mark as attempted to prevent duplicate creation
      safeLocalStorage.setItem(questCreationKey, 'true');
      
      // Check if this quest already exists
      const checkAndCreateQuest = async () => {
        try {
          const { data: existingQuest, error: checkError } = await supabase
            .from('daily_tasks')
            .select('id')
            .eq('user_id', user.id)
            .eq('task_text', 'Join R-Evolution')
            .maybeSingle();
          
          if (checkError) {
            console.error('Failed to check for tutorial quest:', checkError);
            return;
          }
          
          if (!existingQuest) {
            // Create the welcome quest
            const { error: insertError } = await supabase
              .from('daily_tasks')
              .insert({
                user_id: user.id,
                task_text: 'Join R-Evolution',
                difficulty: 'easy',
                xp_reward: 10,
                task_date: today,
                is_main_quest: false,
              });
            
            if (insertError) {
              console.error('Failed to create tutorial quest:', insertError);
              // Remove the flag so it can be retried
              safeLocalStorage.removeItem(questCreationKey);
            } else {
              queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
            }
          }
        } catch (error) {
          console.error('Unexpected error creating tutorial quest:', error);
          // Remove the flag so it can be retried
          safeLocalStorage.removeItem(questCreationKey);
        }
      };
      
      checkAndCreateQuest();
    }
  }, [user?.id, profile, showTutorial, queryClient]);

  const handleTutorialClose = async () => {
    if (!user?.id) return;
    
    // Immediately mark as dismissed in localStorage to prevent re-showing
    safeLocalStorage.setItem(`tutorial_dismissed_${user.id}`, 'true');
    setShowTutorial(false);
    
    // Then update database in background
    if (profile) {
      try {
        const onboardingData = (profile.onboarding_data as Record<string, unknown>) || {};
        const updatedData = {
          ...onboardingData,
          quests_tutorial_seen: true,
        };
        
        const { error } = await supabase
          .from('profiles')
          .update({ onboarding_data: updatedData })
          .eq('id', user.id);
        
        if (error) {
          console.error('Failed to update tutorial status:', error);
        } else {
          // Invalidate profile cache
          queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
        }
      } catch (error) {
        console.error('Unexpected error updating tutorial status:', error);
      }
    }
  };

  // Helper to check task conflicts
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

  // Show loading state while companion is being fetched OR if companion is not loaded yet
  // This prevents crashes after onboarding when companion query is still loading
  if (companionLoading || !companion) {
    return (
      <div className="min-h-screen bg-background pb-20 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          <p className="text-muted-foreground">Loading your adventure...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 relative">
      {/* Cosmic Starfield Background */}
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
      
      {/* Schedule Celebration */}
      <ScheduleCelebration 
        trigger={showCelebration.show}
        type={showCelebration.type}
        onComplete={() => setShowCelebration({ ...showCelebration, show: false })}
      />
      
      <div className="max-w-2xl mx-auto p-6 space-y-6 relative z-10">
        <BrandTagline />

        <div className="flex items-center gap-3">
          <Target className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Quests & Epics</h1>
            <p className="text-muted-foreground">Build your daily momentum</p>
          </div>
        </div>

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
            {/* Calendar with View Switcher */}
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
                </div>
              </div>

              {calendarView === "list" && (
                <>
                  <div className="flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedDate(addDays(selectedDate, -7))}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          className="font-semibold text-sm hover:bg-accent/50 h-8 gap-2"
                        >
                          <CalendarIcon className="h-4 w-4" />
                          {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="center">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={(date) => date && setSelectedDate(date)}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedDate(addDays(selectedDate, 7))}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    {weekDays.map((day) => {
                      const isSelected = isSameDay(day, selectedDate);
                      const isToday = isSameDay(day, new Date());
                      return (
                        <button
                          key={day.toISOString()}
                          onClick={() => setSelectedDate(day)}
                          className={cn(
                            "flex flex-col items-center justify-center p-2 rounded-lg transition-all",
                            isSelected 
                              ? "bg-primary text-primary-foreground shadow-glow" 
                              : "hover:bg-accent",
                            isToday && !isSelected && "ring-2 ring-primary/30"
                          )}
                        >
                          <span className="text-xs font-medium mb-1">
                            {format(day, 'EEE')}
                          </span>
                          <span className={cn(
                            "text-lg font-bold",
                            isSelected && "text-primary-foreground"
                          )}>
                            {format(day, 'd')}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {calendarView === "month" && (
                <CalendarMonthView
                  selectedDate={selectedDate}
                  onDateSelect={setSelectedDate}
                  tasks={allCalendarTasks}
                  onTaskClick={(task) => {
                    setCalendarView("list");
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
                        reminder_sent: false // Reset reminder flag when rescheduling
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
                      
                      // Check for celebration triggers
                      setTimeout(() => {
                        const allTasks = allCalendarTasks;
                        const scheduledTasks = allTasks.filter((t: any) => t.scheduled_time && t.estimated_duration);
                        
                        // Check for perfect week
                        if (scheduledTasks.length >= 5 && scheduledTasks.every((t: any) => !checkTaskConflicts(t, scheduledTasks))) {
                          setShowCelebration({ show: true, type: "perfect_week" });
                        }
                      }, 500);
                    }
                  }}
                />
              )}
            </Card>

            {/* Schedule Power-Ups */}
            {calendarView === "list" && (
              <SchedulePowerUps tasks={tasks} />
            )}

            {/* Time Conflict Detector */}
            {calendarView === "list" && (
              <TimeConflictDetector tasks={tasks} />
            )}

            <Card className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 data-tour="today-quests-header" className="font-semibold">
                    {isSameDay(selectedDate, new Date()) ? "Today's Quests" : format(selectedDate, 'MMM d')}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {tasks.length} Quest{tasks.length !== 1 ? 's' : ''} • First 3 earn full XP
                  </p>
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
                  <Progress 
                    value={(completedCount / totalCount) * 100} 
                    className="h-2"
                  />
                </div>
              )}

              {/* Quest List */}
              <div className="space-y-6">
                {tasks.length === 0 ? (
                  <EmptyState 
                    icon={Target}
                    title="No quests yet"
                    description="Add quests throughout your day - first 3 earn full XP!"
                  />
                ) : (() => {
                  const mainQuest = tasks.find(t => t.is_main_quest);
                  const sideQuests = tasks.filter(t => !t.is_main_quest);
                  
                  return (
                    <>
                      {/* Main Quest Section */}
                      {mainQuest && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="text-xl">⚔️</div>
                            <h3 className="font-semibold text-foreground">Main Quest</h3>
                            <div className="ml-auto">
                              <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
                                {`${MAIN_QUEST_MULTIPLIER}x XP`}
                              </span>
                            </div>
                          </div>
                          <TaskCard
                            task={{ ...mainQuest, xp_reward: mainQuest.xp_reward * MAIN_QUEST_MULTIPLIER }}
                            onToggle={() => toggleTask({ taskId: mainQuest.id, completed: !mainQuest.completed, xpReward: mainQuest.xp_reward * MAIN_QUEST_MULTIPLIER })}
                            onDelete={() => deleteTask(mainQuest.id)}
                            isMainQuest={true}
                            isTutorialQuest={mainQuest.task_text === 'Join R-Evolution'}
                          />
                        </div>
                      )}

                      {/* Side Quests */}
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
                                onSetMainQuest={() => setMainQuest(task.id)}
                                showPromoteButton={!mainQuest}
                                isTutorialQuest={task.task_text === 'Join R-Evolution'}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* XP Preview for Next Quest */}
              {tasks.length > 0 && (
                <div className={cn(
                  "flex items-center justify-between p-3 rounded-lg border",
                  tasks.length >= 3 ? "bg-amber-500/5 border-amber-500/20" : "bg-primary/5 border-primary/20"
                )}>
                  <div className="flex items-center gap-2">
                    <Zap className={cn(
                      "h-4 w-4",
                      tasks.length >= 3 ? "text-amber-500" : "text-primary"
                    )} />
                    <span className="text-sm font-medium">
                      Next Quest ({tasks.length + 1})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-xs font-semibold px-2 py-1 rounded-full",
                      tasks.length >= 3 
                        ? "text-amber-600 bg-amber-500/10" 
                        : "text-primary bg-primary/10"
                    )}>
                      {Math.round(getQuestXPMultiplier(tasks.length + 1) * 100)}% XP
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {getEffectiveQuestXP(taskDifficulty, tasks.length + 1)} XP
                    </span>
                  </div>
                </div>
              )}

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
                        <span className="text-xs font-semibold text-muted-foreground">
                          +{QUEST_XP_REWARDS.EASY} XP
                        </span>
                      </Button>
                      <Button
                        variant={taskDifficulty === 'medium' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTaskDifficulty('medium')}
                        className="flex-1 gap-1 px-2"
                      >
                        <Flame className="h-4 w-4" />
                        <span className="hidden sm:inline">Medium</span>
                        <span className="text-xs font-semibold text-muted-foreground">
                          +{QUEST_XP_REWARDS.MEDIUM} XP
                        </span>
                      </Button>
                      <Button
                        variant={taskDifficulty === 'hard' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTaskDifficulty('hard')}
                        className="flex-1 gap-1 px-2"
                      >
                        <Mountain className="h-4 w-4" />
                        <span className="hidden sm:inline">Hard</span>
                        <span className="text-xs font-semibold text-muted-foreground">
                          +{QUEST_XP_REWARDS.HARD} XP
                        </span>
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
            {/* Create Epic and Join Guild Buttons */}
            <Card className="p-4 bg-gradient-to-br from-primary/5 to-purple-500/5">
              <div className="flex gap-3">
                <Button
                  onClick={() => setCreateEpicDialogOpen(true)}
                  className="flex-1 bg-gradient-to-r from-primary via-purple-600 to-primary hover:from-primary/90 hover:via-purple-600/90 hover:to-primary/90 shadow-lg shadow-primary/50 hover:shadow-xl hover:shadow-primary/60 transition-all duration-300 hover:scale-[1.02] text-base font-bold"
                >
                  <Castle className="h-5 w-5 mr-2" />
                  Create Epic
                </Button>
                <Button
                  onClick={() => setJoinEpicDialogOpen(true)}
                  variant="outline"
                  className="h-auto py-3 px-4"
                >
                  <Users className="w-5 h-5" />
                </Button>
              </div>
            </Card>

            {/* Active Epics */}
            {epicsLoading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : activeEpics.length === 0 ? (
              <EmptyState
                icon={Trophy}
                title="No Active Epics"
                description="Create your first epic quest and link your habits to track legendary progress!"
                actionLabel="Create Epic"
                onAction={() => setCreateEpicDialogOpen(true)}
              />
            ) : (
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Active Epics
                </h3>
                {activeEpics.map((epic) => (
                  <EpicCard
                    key={epic.id}
                    epic={epic}
                    onComplete={() => updateEpicStatus({ epicId: epic.id, status: "completed" })}
                    onAbandon={() => updateEpicStatus({ epicId: epic.id, status: "abandoned" })}
                  />
                ))}
              </div>
            )}

            {/* Completed Epics */}
            {completedEpics.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Legendary Epics
                </h3>
                {completedEpics.map((epic) => (
                  <EpicCard key={epic.id} epic={epic} />
                ))}
              </div>
            )}

            {/* Create Epic Dialog */}
            <CreateEpicDialog
              open={createEpicDialogOpen}
              onOpenChange={setCreateEpicDialogOpen}
              onCreateEpic={(data) => {
                createEpic(data);
                setCreateEpicDialogOpen(false);
              }}
              isCreating={isCreating}
            />
          </TabsContent>
        </Tabs>
      </div>

      <Drawer 
        open={showMainQuestPrompt} 
        onOpenChange={(open) => {
          if (!open) {
            // Small delay to ensure button click is processed first
            setTimeout(handleDrawerClose, 50);
          }
        }}
      >
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-[hsl(45,100%,60%)]" />
              Set as Main Quest?
            </DrawerTitle>
            <DrawerDescription>
              {`Main quests award ${MAIN_QUEST_MULTIPLIER}x XP and help you focus on what matters most today.`}
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

      {/* Join Epic Dialog */}
      <JoinEpicDialog
        open={joinEpicDialogOpen}
        onOpenChange={setJoinEpicDialogOpen}
      />

      <BottomNav />
    </div>
  );
}