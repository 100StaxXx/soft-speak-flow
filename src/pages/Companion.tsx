import { BottomNav } from "@/components/BottomNav";
import { CompanionDisplay } from "@/components/CompanionDisplay";
import { CompanionEvolutionHistory } from "@/components/CompanionEvolutionHistory";
import { CompanionErrorBoundary } from "@/components/CompanionErrorBoundary";
import { CompanionOnboarding } from "@/components/CompanionOnboarding";
import { NextEvolutionPreview } from "@/components/NextEvolutionPreview";
import { XPBreakdown } from "@/components/XPBreakdown";
import { DailyMissions } from "@/components/DailyMissions";
import { HabitCalendar } from "@/components/HabitCalendar";
import { WeeklyInsights } from "@/components/WeeklyInsights";
import { AchievementsPanel } from "@/components/AchievementsPanel";
import { PageTransition } from "@/components/PageTransition";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Sparkles, History, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCompanion } from "@/hooks/useCompanion";
import { HabitCard } from "@/components/HabitCard";
import { HabitTemplates } from "@/components/HabitTemplates";
import { FrequencyPicker } from "@/components/FrequencyPicker";
import { HabitDifficultySelector } from "@/components/HabitDifficultySelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Plus, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import confetti from "canvas-confetti";
import { useXPRewards } from "@/hooks/useXPRewards";
import { useActivityFeed } from "@/hooks/useActivityFeed";
import { playHabitComplete } from "@/utils/soundEffects";

const Companion = () => {
  const navigate = useNavigate();
  const { companion, nextEvolutionXP, progressToNext } = useCompanion();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { awardCustomXP, awardAllHabitsComplete } = useXPRewards();
  const { logActivity } = useActivityFeed();
  const [showAddForm, setShowAddForm] = useState(false);
  const [showTemplates, setShowTemplates] = useState(true);
  const [newHabitTitle, setNewHabitTitle] = useState("");
  const [habitDifficulty, setHabitDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

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
      
      // Award XP based on difficulty
      const difficultyXP = { easy: 5, medium: 10, hard: 20 };
      const xpAmount = difficultyXP[habit?.difficulty || 'medium'];
      await awardCustomXP(xpAmount, 'habit_complete');
      
      // Log activity
      if (habit) {
        logActivity({
          type: 'habit_completed',
          data: { habit_id: habitId, habit_title: habit.title }
        });
      }
      
      return { habitId, habit };
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['habit-completions'] });
      await queryClient.invalidateQueries({ queryKey: ['habits'] });
      
      // Play success sound
      playHabitComplete();
      
      // Check if all habits complete
      const allComplete = habits.every(h => 
        completions.some(c => c.habit_id === h.id) || h.id === data.habitId
      );
      
      if (allComplete && habits.length > 0) {
        awardAllHabitsComplete();
        confetti({
          particleCount: 200,
          spread: 120,
          origin: { y: 0.6 },
        });
        toast({
          title: "🎉 All Habits Complete!",
          description: "Bonus XP! Your companion grows stronger!",
        });
      } else {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
        });
      }
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
      queryClient.invalidateQueries({ queryKey: ['habits'] });
    },
  });

  const handleToggleHabit = async (habitId: string) => {
    const isCompleted = completions.some(c => c.habit_id === habitId);
    if (isCompleted) {
      uncompleteHabitMutation.mutate(habitId);
    } else {
      completeHabitMutation.mutate(habitId);
    }
  };

  const addHabitMutation = useMutation({
    mutationFn: async () => {
      if (habits.length >= 5) {
        throw new Error('Maximum 5 habits allowed');
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
      setShowAddForm(false);
      setShowTemplates(true);
      toast({
        title: "Habit created!",
        description: "Start completing it to earn XP and grow your companion.",
      });
    },
    onError: (error: any) => {
      toast({ title: 'Could not create habit', description: error.message || 'Please try again.', variant: 'destructive' });
    },
  });

  const handleTemplateSelect = (title: string, frequency: string) => {
    setNewHabitTitle(title);
    setShowTemplates(false);
    setShowAddForm(true);
  };

  const handleCustomHabit = () => {
    setNewHabitTitle("");
    setShowTemplates(false);
    setShowAddForm(true);
  };

  const handleAddHabit = () => {
    if (!newHabitTitle.trim()) {
      toast({ title: 'Habit title required', variant: 'destructive' });
      return;
    }
    addHabitMutation.mutate();
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setShowTemplates(true);
    setNewHabitTitle("");
    setHabitDifficulty("medium");
    setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
  };

  return (
    <PageTransition>
      <CompanionErrorBoundary>
        <CompanionOnboarding />
        <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-accent/10 pb-20">
          <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 md:h-16 items-center px-4">
              <h1 className="text-xl md:text-2xl font-heading font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Companion & Progress
              </h1>
            </div>
          </header>

          <div className="container px-3 md:px-4 py-4 md:py-6 space-y-4 md:space-y-6 max-w-4xl mx-auto">
            <CompanionDisplay />

          <Tabs defaultValue="habits" className="w-full">
            <TabsList className="grid w-full grid-cols-4 h-auto">
              <TabsTrigger value="habits" className="flex-col md:flex-row gap-1 md:gap-2 py-2 md:py-2.5 text-xs md:text-sm">
                <Target className="h-4 w-4" />
                <span className="hidden sm:inline">Habits</span>
              </TabsTrigger>
              <TabsTrigger value="progress" className="flex-col md:flex-row gap-1 md:gap-2 py-2 md:py-2.5 text-xs md:text-sm">
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">Progress</span>
              </TabsTrigger>
              <TabsTrigger value="evolution" className="flex-col md:flex-row gap-1 md:gap-2 py-2 md:py-2.5 text-xs md:text-sm">
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">Evolution</span>
              </TabsTrigger>
              <TabsTrigger value="achievements" className="flex-col md:flex-row gap-1 md:gap-2 py-2 md:py-2.5 text-xs md:text-sm">
                <Trophy className="h-4 w-4" />
                <span className="hidden sm:inline">Achievements</span>
              </TabsTrigger>
            </TabsList>

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

            <TabsContent value="evolution" className="space-y-6 mt-6">
              {companion && <CompanionEvolutionHistory companionId={companion.id} />}
            </TabsContent>

            <TabsContent value="habits" className="space-y-4 mt-6">
              {habits.length === 0 && !showAddForm ? (
                <Card className="p-8 text-center bg-gradient-to-br from-primary/5 to-accent/5 border-dashed border-2">
                  <Target className="h-16 w-16 mx-auto text-primary/50 mb-4" />
                  <h3 className="text-xl font-heading font-bold text-foreground mb-2">
                    Build Better Habits
                  </h3>
                  <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                    Every habit you complete earns XP and helps your companion evolve. 
                    Start small, stay consistent, and watch your progress compound.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-background/50">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Earn XP</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-background/50">
                      <Target className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Track Progress</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-background/50">
                      <Trophy className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Grow Companion</span>
                    </div>
                  </div>
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
                <HabitTemplates 
                  onSelect={handleTemplateSelect}
                  onCustom={handleCustomHabit}
                  existingHabits={habits}
                />
              )}

              {showAddForm && (
                <Card className="p-6 space-y-4 border-primary/20">
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
                      placeholder="Enter habit name..."
                      value={newHabitTitle}
                      onChange={(e) => setNewHabitTitle(e.target.value)}
                    />
                  </div>

                  <HabitDifficultySelector 
                    value={habitDifficulty}
                    onChange={setHabitDifficulty}
                  />

                  <FrequencyPicker
                    selectedDays={selectedDays}
                    onDaysChange={setSelectedDays}
                  />

                  <div className="flex gap-2">
                    <Button 
                      onClick={handleAddHabit}
                      disabled={!newHabitTitle.trim() || addHabitMutation.isPending}
                      className="flex-1"
                    >
                      {addHabitMutation.isPending ? "Creating..." : "Create Habit"}
                    </Button>
                  </div>
                </Card>
              )}

              <HabitCalendar />
            </TabsContent>

            <TabsContent value="achievements" className="space-y-6 mt-6">
              <AchievementsPanel />
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
