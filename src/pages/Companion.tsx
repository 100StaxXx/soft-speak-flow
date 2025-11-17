import { BottomNav } from "@/components/BottomNav";
import { CompanionDisplay } from "@/components/CompanionDisplay";
import { CompanionEvolutionHistory } from "@/components/CompanionEvolutionHistory";
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

const Companion = () => {
  const navigate = useNavigate();
  const { companion } = useCompanion();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
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
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-16 items-center px-4">
            <h1 className="text-2xl font-heading font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Companion & Progress
            </h1>
          </div>
        </header>

        <div className="container px-4 py-6 space-y-6 max-w-4xl mx-auto">
          <CompanionDisplay />

          <Tabs defaultValue="habits" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="habits">
                <Target className="h-4 w-4 mr-2" />
                Habits
              </TabsTrigger>
              <TabsTrigger value="progress">
                <Sparkles className="h-4 w-4 mr-2" />
                Progress
              </TabsTrigger>
              <TabsTrigger value="evolution">
                <History className="h-4 w-4 mr-2" />
                Evolution
              </TabsTrigger>
              <TabsTrigger value="achievements">
                <Trophy className="h-4 w-4 mr-2" />
                Achievements
              </TabsTrigger>
            </TabsList>

            <TabsContent value="progress" className="space-y-6 mt-6">
              <XPBreakdown />
              <DailyMissions />
              <WeeklyInsights />
            </TabsContent>

            <TabsContent value="evolution" className="space-y-6 mt-6">
              {companion && <CompanionEvolutionHistory companionId={companion.id} />}
            </TabsContent>

            <TabsContent value="habits" className="space-y-4 mt-6">
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
                    onComplete={() => queryClient.invalidateQueries({ queryKey: ['habit-completions'] })}
                  />
                ))}
              </div>

              {habits.length < 5 && !showAddForm && showTemplates && (
                <HabitTemplates 
                  onSelect={handleTemplateSelect}
                  onCustom={handleCustomHabit}
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

              {habits.length === 0 && !showAddForm && (
                <div className="text-center py-12">
                  <Target className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-heading font-bold text-foreground mb-2">No habits yet</h3>
                  <p className="text-sm text-muted-foreground mb-6">Start building better habits today</p>
                </div>
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
    </PageTransition>
  );
};

export default Companion;
