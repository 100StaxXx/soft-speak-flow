import { BottomNav } from "@/components/BottomNav";
import { CompanionDisplay } from "@/components/CompanionDisplay";
import { CompanionEvolutionHistory } from "@/components/CompanionEvolutionHistory";
import { CompanionErrorBoundary } from "@/components/CompanionErrorBoundary";
import { CompanionOnboarding } from "@/components/CompanionOnboarding";
import { CompanionPageTour } from "@/components/CompanionPageTour";
import { NextEvolutionPreview } from "@/components/NextEvolutionPreview";
import { XPBreakdown } from "@/components/XPBreakdown";
import { DailyMissions } from "@/components/DailyMissions";
import { HabitCalendar } from "@/components/HabitCalendar";
import { WeeklyInsights } from "@/components/WeeklyInsights";
import { AchievementsPanel } from "@/components/AchievementsPanel";
import { PageTransition } from "@/components/PageTransition";
import { CompanionBadge } from "@/components/CompanionBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, History, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCompanion } from "@/hooks/useCompanion";

const Companion = () => {
  const navigate = useNavigate();
  const { companion, nextEvolutionXP, progressToNext } = useCompanion();

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

  const completeHabitMutation = useMutation({
    mutationFn: async (habitId: string) => {
      const habit = habits.find(h => h.id === habitId);
      const today = new Date().toISOString().split('T')[0];
      
      const { error } = await supabase.from('habit_completions').insert({
        habit_id: habitId,
        user_id: user!.id,
        date: today,
      });
      
      if (error) throw error;
      
      const difficultyXP = { easy: 5, medium: 10, hard: 20 };
      const xpAmount = difficultyXP[habit?.difficulty || 'medium'];
      await awardCustomXP(xpAmount, 'habit_complete');
      
      if (habit) {
        logActivity({
          type: 'habit_complete',
          data: { habit: habit.title, xp: xpAmount }
        });
      }

      return { habit, xpAmount };
    },
    onSuccess: ({ habit, xpAmount }) => {
      queryClient.invalidateQueries({ queryKey: ['habit-completions'] });
      
      playHabitComplete();
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 }
      });
      
      toast({
        title: "Habit Completed! 🎉",
        description: `+${xpAmount} XP earned`,
      });

      const totalCompleted = completions.length + 1;
      if (totalCompleted === habits.length) {
        awardAllHabitsComplete();
      }

      // Dispatch event for walkthrough
      window.dispatchEvent(new CustomEvent('habit-completed'));
    },
  });

  const uncompleteHabitMutation = useMutation({
    mutationFn: async (habitId: string) => {
      const today = new Date().toISOString().split('T')[0];
      const { error } = await supabase
        .from('habit_completions')
        .delete()
        .eq('habit_id', habitId)
        .eq('user_id', user!.id)
        .eq('date', today);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habit-completions'] });
    },
  });

  const handleToggleHabit = async (habitId: string) => {
    const isCompleted = completions.some((c) => c.habit_id === habitId);
    
    if (isCompleted) {
      uncompleteHabitMutation.mutate(habitId);
    } else {
      completeHabitMutation.mutate(habitId);
    }
  };

  const addHabitMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      difficulty: string;
      frequency: string;
      customDays?: number[];
    }) => {
      const { error } = await supabase.from('habits').insert({
        user_id: user!.id,
        title: data.title,
        difficulty: data.difficulty,
        frequency: data.frequency,
        custom_days: data.customDays,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      setShowAddForm(false);
      setNewHabitTitle("");
      toast({
        title: "Habit Added!",
        description: "Complete it daily to earn XP",
      });

      // Dispatch event for walkthrough
      window.dispatchEvent(new CustomEvent('habit-created'));
    },
  });

  const handleTemplateSelect = (title: string) => {
    setNewHabitTitle(title);
    setShowAddForm(true);
  };

  const handleCustomHabit = () => {
    setShowAddForm(true);
  };

  const handleAddHabit = () => {
    if (!newHabitTitle.trim()) return;

    const frequency = selectedDays.length === 7 
      ? 'daily' 
      : selectedDays.length === 0 
      ? 'custom' 
      : 'custom';

    addHabitMutation.mutate({
      title: newHabitTitle,
      difficulty: habitDifficulty,
      frequency,
      customDays: frequency === 'custom' ? selectedDays : undefined,
    });
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setNewHabitTitle("");
    setHabitDifficulty("medium");
    setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
  };

  if (!companion) {
    return <CompanionOnboarding />;
  }

  return (
    <PageTransition>
      <CompanionPageTour />
      <CompanionErrorBoundary>
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 md:h-16 items-center px-4">
            <h1 className="text-xl md:text-2xl font-heading font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Companion & Progress
            </h1>
          </div>
        </header>

        <div className="container px-3 md:px-4 py-5 md:py-7 space-y-6 md:space-y-8 max-w-4xl mx-auto">
          <div data-tour="companion-display" className="space-y-4">
            <CompanionDisplay />
            {companion && (
              <div className="flex justify-center">
                <CompanionBadge 
                  element={companion.core_element} 
                  stage={companion.current_stage}
                  showStage={true}
                />
              </div>
            )}
          </div>

          <Tabs defaultValue="habits" className="w-full">
            <TabsList className="grid w-full grid-cols-4 h-auto">
              <TabsTrigger value="habits" className="flex-col md:flex-row gap-1 md:gap-2 py-2 md:py-2.5 text-xs md:text-sm" data-tour="habits-tab">
                <Target className="h-4 w-4" />
                <span className="hidden sm:inline">Habits</span>
              </TabsTrigger>
              <TabsTrigger value="progress" className="flex-col md:flex-row gap-1 md:gap-2 py-2 md:py-2.5 text-xs md:text-sm" data-tour="progress-tab">
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">Progress</span>
              </TabsTrigger>
              <TabsTrigger value="achievements" className="flex-col md:flex-row gap-1 md:gap-2 py-2 md:py-2.5 text-xs md:text-sm" data-tour="achievements-tab">
                <Trophy className="h-4 w-4" />
                <span className="hidden sm:inline">Achievements</span>
              </TabsTrigger>
              <TabsTrigger value="evolution" className="flex-col md:flex-row gap-1 md:gap-2 py-2 md:py-2.5 text-xs md:text-sm" data-tour="evolution-tab">
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">Evolution</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="habits" className="space-y-4 mt-6">
              {habits.length === 0 && !showAddForm ? (
                <Card className="p-8 text-center bg-gradient-to-br from-primary/5 to-accent/5 border-dashed border-2">
                  <Target className="h-16 w-16 mx-auto text-primary/50 mb-4" />
                  <h3 className="text-xl font-heading font-bold text-foreground mb-2">
                    Build Better Habits
                  </h3>
                  <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                    Every habit you complete earns XP and helps your companion evolve.
                  </p>
                </Card>
              ) : (
                <div className="space-y-4">
                  {habits.map((habit) => (
                    <HabitCard
                      key={habit.id}
                      id={habit.id}
                      title={habit.title}
                      currentStreak={habit.current_streak || 0}
                      longestStreak={habit.longest_streak || 0}
                      completedToday={completions.some((c) => c.habit_id === habit.id)}
                      difficulty={habit.difficulty || "medium"}
                      onComplete={() => handleToggleHabit(habit.id)}
                    />
                  ))}
                </div>
              )}

              {habits.length < 5 && !showAddForm && showTemplates && (
                <div data-tour="habit-templates">
                  <HabitTemplates 
                    onSelect={handleTemplateSelect}
                    onCustom={handleCustomHabit}
                    existingHabits={habits}
                  />
                </div>
              )}

              {!showTemplates && habits.length < 5 && !showAddForm && (
                <Button 
                  data-tour="create-habit-button"
                  onClick={() => setShowTemplates(true)}
                  variant="outline" 
                  className="w-full border-dashed border-2"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Habit ({habits.length}/5)
                </Button>
              )}

              {showAddForm && (
                <Card data-tour="habit-form" className="p-6 space-y-4 border-primary/20">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-heading font-bold text-foreground">
                      {newHabitTitle || "New Habit"}
                    </h3>
                    <Button variant="ghost" size="icon" onClick={handleCancel}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Habit Name</label>
                    <Input
                      value={newHabitTitle}
                      onChange={(e) => setNewHabitTitle(e.target.value)}
                      placeholder="e.g., Morning meditation"
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2" data-tour="habit-difficulty">
                    <label className="text-sm font-medium text-foreground">Difficulty</label>
                    <HabitDifficultySelector
                      value={habitDifficulty}
                      onChange={setHabitDifficulty}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Frequency</label>
                    <FrequencyPicker
                      selectedDays={selectedDays}
                      onDaysChange={setSelectedDays}
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button onClick={handleAddHabit} className="flex-1">
                      Add Habit
                    </Button>
                    <Button onClick={handleCancel} variant="outline">
                      Cancel
                    </Button>
                  </div>
                </Card>
              )}

              <HabitCalendar />
            </TabsContent>

            <TabsContent value="progress" className="space-y-6 mt-6">
              <NextEvolutionPreview 
                currentStage={companion?.current_stage || 0}
                currentXP={companion?.current_xp || 0}
                nextEvolutionXP={companion ? nextEvolutionXP : 0}
                progressPercent={companion ? progressToNext : 0}
              />
              <XPBreakdown />
              <DailyMissions />
              <WeeklyInsights />
            </TabsContent>

            <TabsContent value="achievements" className="space-y-6 mt-6">
              <AchievementsPanel />
            </TabsContent>

            <TabsContent value="evolution" className="space-y-6 mt-6">
              {companion && <CompanionEvolutionHistory companionId={companion.id} />}
            </TabsContent>
          </Tabs>
        </div>

        <BottomNav />
      </div>
      </CompanionErrorBoundary>
    </PageTransition>
  );
};

export default Companion;
