import { useState } from "react";
import { Calendar as CalendarIcon, Plus, CheckCircle2, Circle, Trash2, Target, Zap, Flame, Mountain, Swords, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useToast } from "@/components/ui/use-toast";
import { useXPRewards } from "@/hooks/useXPRewards";
import { useActivityFeed } from "@/hooks/useActivityFeed";
import { useCompanion } from "@/hooks/useCompanion";
import { useCompanionAttributes } from "@/hooks/useCompanionAttributes";
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
  const { logActivity } = useActivityFeed();
  const { companion } = useCompanion();
  const { updateMindFromHabit, updateBodyFromActivity } = useCompanionAttributes();
  const { awardCustomXP, awardAllHabitsComplete, XP_REWARDS } = useXPRewards();
  
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
    isAdding,
    isToggling,
    canAddMore 
  } = useDailyTasks(selectedDate);
  const [newTaskText, setNewTaskText] = useState("");
  const [taskDifficulty, setTaskDifficulty] = useState<"easy" | "medium" | "hard">("medium");

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
          const xpAmount = habit?.difficulty === 'easy' ? 5 : habit?.difficulty === 'hard' ? 20 : 10;
          await awardCustomXP(xpAmount, 'habit_complete', 'Habit Complete!');
          
          // Update companion attributes
          if (companion) {
            await updateMindFromHabit(companion.id);
            await updateBodyFromActivity(companion.id);
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
    addTask({ 
      taskText: newTaskText, 
      difficulty: taskDifficulty,
      taskDate: selectedDate.toISOString().split('T')[0]
    });
    setNewTaskText("");
    setTaskDifficulty("medium");
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

  return (
    <div className="min-h-screen bg-background pb-20 relative">
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
                <h3 className="font-semibold text-sm">
                  {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
                </h3>
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
                  {tasks.filter(t => t.completed).length}/{tasks.length}
                </div>
              </div>

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
                        <span className="sm:hidden">15</span>
                      </Button>
                      <Button
                        variant={taskDifficulty === 'hard' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTaskDifficulty('hard')}
                        className="flex-1 gap-1 px-2"
                      >
                        <Mountain className="h-4 w-4" />
                        <span className="hidden sm:inline">Hard</span>
                        <span className="sm:hidden">25</span>
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

              <div className="space-y-2">
                {tasks.length === 0 ? (
                  <EmptyState 
                    icon={Target}
                    title="No quests yet"
                    description="Add up to 3 quests to focus on today"
                  />
                ) : (
                  tasks.map((task, index) => (
                    <Card 
                      key={task.id}
                      data-tour={index === 0 ? "first-task" : undefined}
                      className={cn(
                        "p-4 flex items-center gap-3 transition-all hover:bg-accent/50",
                        task.completed && "opacity-60",
                        isToggling ? "pointer-events-none opacity-50" : "cursor-pointer"
                      )}
                      onClick={() => {
                        if (!isToggling) {
                          toggleTask({ taskId: task.id, completed: !task.completed, xpReward: task.xp_reward });
                        }
                      }}
                    >
                      {task.completed ? (
                        <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                      )}
                      <div className="flex-1">
                        <span className={cn(
                          task.completed && "line-through text-muted-foreground"
                        )}>
                          {task.task_text}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          {task.difficulty === 'easy' && <Zap className="h-3 w-3 text-muted-foreground" />}
                          {task.difficulty === 'medium' && <Flame className="h-3 w-3 text-muted-foreground" />}
                          {task.difficulty === 'hard' && <Mountain className="h-3 w-3 text-muted-foreground" />}
                          <span className="text-xs text-muted-foreground">{task.xp_reward} XP</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTask(task.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </Card>
                  ))
                )}
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
                {habits.length === 0 ? (
                  showTemplates ? (
                    <HabitTemplates
                      onSelect={(title, frequency) => {
                        setNewHabitTitle(title);
                        setShowTemplates(false);
                        setShowAddHabit(true);
                      }}
                      onCustom={() => setShowAddHabit(true)}
                      existingHabits={habits}
                    />
                  ) : (
                    <EmptyState
                      icon={Target}
                      title="No habits yet"
                      description="Create your first habit to start building momentum"
                      actionLabel="Add Habit"
                      onAction={() => setShowAddHabit(true)}
                    />
                  )
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">Your Habits</h3>
                        <p className="text-sm text-muted-foreground">
                          {habits.length}/5 habits
                        </p>
                      </div>
                      {habits.length < 5 && (
                        <Button onClick={() => setShowAddHabit(true)} size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Add
                        </Button>
                      )}
                    </div>

                    <div className="space-y-3">
                      {habits.map((habit) => {
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
                            onComplete={() => toggleHabitMutation.mutate({ habitId: habit.id, isCompleted })}
                          />
                        );
                      })}
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

      <BottomNav />
    </div>
  );
}
