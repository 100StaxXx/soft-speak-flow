import { useState, useEffect, useRef } from "react";
import { Calendar as CalendarIcon, Plus, CheckCircle2, Circle, Trash2, Target, Zap, Flame, Mountain, Swords, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { QuestsTutorialModal } from "@/components/QuestsTutorialModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TaskCard } from "@/components/TaskCard";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getHabitXP } from "@/config/xpRewards";
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


export default function Tasks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile } = useProfile();
  const { companion } = useCompanion();
  const { updateMindFromHabit, updateBodyFromActivity } = useCompanionAttributes();
  const { awardCustomXP, awardAllHabitsComplete, XP_REWARDS } = useXPRewards();
  const { checkStreakAchievements, checkFirstTimeAchievements } = useAchievements();
  
  // Tutorial state
  const [showTutorial, setShowTutorial] = useState(false);
  
  // Calendar state for quest scheduling
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 }); // Monday start
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  
  // Tasks state
  const { 
    tasks, 
    addTask, 
    toggleTask, 
    deleteTask,
    setMainQuest,
    isAdding,
    isToggling,
    canAddMore,
    completedCount,
    totalCount 
  } = useDailyTasks(selectedDate);
  const [newTaskText, setNewTaskText] = useState("");
  const [taskDifficulty, setTaskDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [showMainQuestPrompt, setShowMainQuestPrompt] = useState(false);
  const [pendingTaskData, setPendingTaskData] = useState<{
    text: string;
    difficulty: "easy" | "medium" | "hard";
    date: string;
  } | null>(null);
  
  // Calculate total XP for the day
  const totalXP = tasks.reduce((sum, task) => {
    if (task.completed) {
      return sum + (task.is_main_quest ? task.xp_reward * 2 : task.xp_reward);
    }
    return sum;
  }, 0);

  // Habits state
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [showTemplates, setShowTemplates] = useState(true);
  const [newHabitTitle, setNewHabitTitle] = useState("");
  const [habitDifficulty, setHabitDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  // Fetch habits
  const { data: habits = [] } = useQuery({
    queryKey: ['habits', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', user!.id)
        .eq('is_active', true);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: completions = [] } = useQuery({
    queryKey: ['habit-completions', user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('habit_completions')
        .select('*')
        .eq('user_id', user!.id)
        .eq('date', today);
      return data || [];
    },
    enabled: !!user,
  });

  // Add habit mutation
  const addHabitMutation = useMutation({
    mutationFn: async () => {
      if (habits.length >= 2) {
        throw new Error('Maximum 2 habits allowed');
      }
      
      const { error } = await supabase.from('habits').insert({
        user_id: user!.id,
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
      setShowTemplates(true);
      toast({ title: "Habit created successfully!" });
      haptics.success();
    },
  });

  // Toggle habit completion
  const toggleHabitMutation = useMutation({
    mutationFn: async ({ habitId, isCompleted }: { habitId: string; isCompleted: boolean }) => {
      const today = new Date().toISOString().split('T')[0];
      
      if (isCompleted) {
        // Unchecking - remove completion record but DON'T remove XP
        const { error } = await supabase
          .from('habit_completions')
          .delete()
          .eq('habit_id', habitId)
          .eq('date', today);
        if (error) throw error;
        return { isCompleting: false };
      } else {
        // Check if this habit was already completed today (to prevent XP spam)
        const { data: existingCompletion } = await supabase
          .from('habit_completions')
          .select('id')
          .eq('habit_id', habitId)
          .eq('user_id', user!.id)
          .eq('date', today)
          .maybeSingle();

        // Insert new completion
        const { error } = await supabase
          .from('habit_completions')
          .insert({ habit_id: habitId, user_id: user!.id, date: today });
        if (error) throw error;
        
        // Only award XP if this is the FIRST completion today
        if (!existingCompletion) {
          const habit = habits.find(h => h.id === habitId);
          const xpAmount = habit?.difficulty ? getHabitXP(habit.difficulty as 'easy' | 'medium' | 'hard') : 10;
          await awardCustomXP(xpAmount, 'habit_complete', 'Habit Complete!');
          
          // Update companion attributes in background without blocking
          if (companion) {
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
        
        return { isCompleting: true };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habit-completions'] });
      queryClient.invalidateQueries({ queryKey: ['habits'] });
    },
  });

  const handleAddTask = () => {
    if (!newTaskText.trim()) return;
    
    const taskDate = selectedDate.toISOString().split('T')[0];
    const hasMainQuest = tasks.some(task => task.is_main_quest);
    
    // Store task data temporarily
    setPendingTaskData({
      text: newTaskText,
      difficulty: taskDifficulty,
      date: taskDate,
    });
    
    // If no main quest exists, ask user BEFORE creating the task
    if (!hasMainQuest) {
      setShowMainQuestPrompt(true);
    } else {
      // Main quest already exists, create as side quest
      actuallyAddTask(false);
    }
  };
  
  const actuallyAddTask = async (isMainQuest: boolean) => {
    if (!pendingTaskData) return;
    
    try {
      await addTask({ 
        taskText: pendingTaskData.text, 
        difficulty: pendingTaskData.difficulty,
        taskDate: pendingTaskData.date,
        isMainQuest: isMainQuest,
      });
      
      // Clear form
      setNewTaskText("");
      setTaskDifficulty("medium");
      setPendingTaskData(null);
    } catch (error) {
      console.error('Failed to add task:', error);
      setPendingTaskData(null);
    }
  };
  
  const handleMainQuestResponse = (makeMainQuest: boolean) => {
    setShowMainQuestPrompt(false);
    actuallyAddTask(makeMainQuest);
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
    if (!user || !profile) return;
    
    const onboardingData = profile.onboarding_data as { quests_tutorial_seen?: boolean } | null;
    const tutorialSeen = onboardingData?.quests_tutorial_seen;
    
    if (!tutorialSeen) {
      // Show tutorial
      setShowTutorial(true);
      
      // Auto-generate "Join R-Evolution" quest
      const today = new Date().toISOString().split('T')[0];
      
      // Check if this quest already exists
      supabase
        .from('daily_tasks')
        .select('id')
        .eq('user_id', user.id)
        .eq('task_text', 'Join R-Evolution')
        .maybeSingle()
        .then(({ data: existingQuest }) => {
          if (!existingQuest) {
            // Create the welcome quest
            supabase
              .from('daily_tasks')
              .insert({
                user_id: user.id,
                task_text: 'Join R-Evolution',
                difficulty: 'easy',
                xp_reward: 5,
                task_date: today,
                is_main_quest: false,
              })
              .then(() => {
                queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
              });
          }
        });
    }
  }, [user, profile, queryClient]);

  const handleTutorialClose = async () => {
    setShowTutorial(false);
    
    // Mark tutorial as seen
    if (user && profile) {
      const onboardingData = (profile.onboarding_data as Record<string, unknown>) || {};
      const updatedData = {
        ...onboardingData,
        quests_tutorial_seen: true,
      };
      
      await supabase
        .from('profiles')
        .update({ onboarding_data: updatedData })
        .eq('id', user.id);
      
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 relative">
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
      
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <BrandTagline />

        <div className="flex items-center gap-3">
          <Target className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Quests & Habits</h1>
            <p className="text-muted-foreground">Build your daily momentum</p>
          </div>
        </div>

        <Tabs defaultValue="quests" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="quests" className="gap-2" data-tour="tasks-tab">
              <Swords className="h-4 w-4" />
              Daily Quests
            </TabsTrigger>
            <TabsTrigger value="habits" className="gap-2" data-tour="habits-tab">
              <CheckCircle2 className="h-4 w-4" />
              Habits
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quests" className="space-y-4 mt-4">
            {/* Week Calendar Navigation */}
            <Card data-tour="week-calendar" className="p-4 bg-gradient-to-br from-primary/5 to-accent/5">
              <div className="flex items-center justify-between mb-3">
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
            </Card>

            <Card className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 data-tour="today-quests-header" className="font-semibold">
                    {isSameDay(selectedDate, new Date()) ? "Today's Quests" : format(selectedDate, 'MMM d')}
                  </h3>
                  <p className="text-sm text-muted-foreground">Max 3 quests per day</p>
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

              {canAddMore && (
                <Card className="p-4 space-y-4">
                  <div className="space-y-3">
                    <Input
                      data-tour="add-task-input"
                      placeholder="Add a quest..."
                      value={newTaskText}
                      onChange={(e) => setNewTaskText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
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
                        <span className="sm:hidden">5</span>
                      </Button>
                      <Button
                        variant={taskDifficulty === 'medium' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTaskDifficulty('medium')}
                        className="flex-1 gap-1 px-2"
                      >
                        <Flame className="h-4 w-4" />
                        <span className="hidden sm:inline">Medium</span>
                        <span className="sm:hidden">10</span>
                      </Button>
                      <Button
                        variant={taskDifficulty === 'hard' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTaskDifficulty('hard')}
                        className="flex-1 gap-1 px-2"
                      >
                        <Mountain className="h-4 w-4" />
                        <span className="hidden sm:inline">Hard</span>
                        <span className="sm:hidden">20</span>
                      </Button>
                    </div>

                    <Button 
                      data-tour="add-task-button"
                      onClick={handleAddTask}
                      disabled={isAdding || !newTaskText.trim()}
                      className="w-full"
                    >
                      {isAdding ? (
                        <>
                          <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Quest
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              )}

              {/* Quest List */}
              <div className="space-y-6">
                {tasks.length === 0 ? (
                  <EmptyState 
                    icon={Target}
                    title="No quests yet"
                    description="Add up to 3 quests - mark one as your Main Quest for 2x XP!"
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
                                2x XP
                              </span>
                            </div>
                          </div>
                          <TaskCard
                            task={{ ...mainQuest, xp_reward: mainQuest.xp_reward * 2 }}
                            onToggle={() => toggleTask({ taskId: mainQuest.id, completed: !mainQuest.completed, xpReward: mainQuest.xp_reward * 2 })}
                            onDelete={() => deleteTask(mainQuest.id)}
                            isMainQuest={true}
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
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="habits" className="space-y-4 mt-6">
            {showAddHabit ? (
              <Card className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Create New Habit</h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowAddHabit(false)}>
                    Cancel
                  </Button>
                </div>

                <Input
                  placeholder="Habit name..."
                  value={newHabitTitle}
                  onChange={(e) => setNewHabitTitle(e.target.value)}
                />

                <HabitDifficultySelector
                  value={habitDifficulty}
                  onChange={setHabitDifficulty}
                />

                <FrequencyPicker
                  selectedDays={selectedDays}
                  onDaysChange={setSelectedDays}
                />

                <Button 
                  onClick={handleAddHabit} 
                  className="w-full"
                  disabled={addHabitMutation.isPending || !newHabitTitle.trim()}
                >
                  Create Habit
                </Button>
              </Card>
            ) : (
              <>
                {showTemplates ? (
                  <HabitTemplates
                    onSelect={(title, frequency) => {
                      setNewHabitTitle(title);
                      setSelectedDays(frequency === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : []);
                      setShowTemplates(false);
                      setShowAddHabit(true);
                    }}
                    onCustom={() => {
                      setShowTemplates(false);
                      setShowAddHabit(true);
                    }}
                    existingHabits={habits}
                  />
                ) : (
                  <>
                    <Card className="p-6 bg-gradient-to-br from-primary/5 to-accent/5">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h2 className="text-xl font-semibold">Your Habits</h2>
                          <p className="text-sm text-muted-foreground">Track daily progress</p>
                        </div>
                        {habits.length < 5 && (
                          <Button
                            onClick={() => setShowAddHabit(true)}
                            size="sm"
                            className="gap-2"
                          >
                            <Plus className="h-4 w-4" />
                            Add Habit
                          </Button>
                        )}
                      </div>

                      {habits.length > 0 && (
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              Daily Progress
                            </span>
                            <span className="text-primary font-semibold">
                              {completions.length}/{habits.length}
                            </span>
                          </div>
                          <Progress value={habitProgress * 100} className="h-2" />
                        </div>
                      )}
                    </Card>

                    <div className="space-y-3">
                      {habits.length === 0 ? (
                        <EmptyState
                          icon={CheckCircle2}
                          title="No habits yet"
                          description="Create your first habit to start building momentum"
                          actionLabel="Create Habit"
                          onAction={() => setShowAddHabit(true)}
                        />
                      ) : (
                        habits.map((habit, index) => {
                          const isCompleted = completions.some(c => c.habit_id === habit.id);
                          return (
                            <HabitCard
                              key={habit.id}
                              id={habit.id}
                              title={habit.title}
                              currentStreak={habit.current_streak || 0}
                              longestStreak={habit.longest_streak || 0}
                              completedToday={isCompleted}
                              difficulty={habit.difficulty}
                              onComplete={() => toggleHabitMutation.mutate({ 
                                habitId: habit.id, 
                                isCompleted 
                              })}
                            />
                          );
                        })
                      )}
                    </div>
                  </>
                )}
              </>
            )}

            {habits.length === 5 && !showAddHabit && (
              <Card className="p-4 bg-accent/20 border-accent">
                <p className="text-sm text-center text-muted-foreground">
                  You've reached the maximum of 5 habits. Focus on consistency!
                </p>
              </Card>
            )}
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
              Main quests award 2x XP and help you focus on what matters most today.
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

      <BottomNav />
    </div>
  );
}