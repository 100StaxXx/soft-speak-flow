import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAchievements } from "@/hooks/useAchievements";
import { BottomNav } from "@/components/BottomNav";
import { AchievementsPanel } from "@/components/AchievementsPanel";
import { HabitCard } from "@/components/HabitCard";
import { HabitCalendar } from "@/components/HabitCalendar";
import { WeeklyInsights } from "@/components/WeeklyInsights";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/EmptyState";
import { Plus, Target, Trophy, CheckCircle2, Calendar, TrendingUp, Dumbbell } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { toast } from "sonner";
import { format } from "date-fns";

const Progress = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { checkStreakAchievements, checkChallengeAchievements } = useAchievements();
  const [showHabitForm, setShowHabitForm] = useState(false);
  const [newHabitTitle, setNewHabitTitle] = useState("");

  const { data: habits = [] } = useQuery({
    queryKey: ["habits", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habits")
        .select("*")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: todayCompletions = [] } = useQuery({
    queryKey: ["today-completions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("habit_completions")
        .select("habit_id")
        .eq("user_id", user!.id)
        .eq("date", today);
      if (error) throw error;
      return data.map(c => c.habit_id);
    },
  });

  const { data: challenges = [] } = useQuery({
    queryKey: ["challenges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: userChallenges = [] } = useQuery({
    queryKey: ["user-challenges", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_challenges")
        .select(`
          *,
          challenges (*)
        `)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addHabitMutation = useMutation({
    mutationFn: async (title: string) => {
      const { data, error } = await supabase
        .from("habits")
        .insert({
          user_id: user!.id,
          title,
          frequency: "daily",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      setShowHabitForm(false);
      setNewHabitTitle("");
      toast.success("Habit created!");
    },
  });

  const completeHabitMutation = useMutation({
    mutationFn: async (habitId: string) => {
      const today = format(new Date(), "yyyy-MM-dd");
      const { error } = await supabase
        .from("habit_completions")
        .insert({
          user_id: user!.id,
          habit_id: habitId,
          date: today,
        });
      if (error) throw error;

      // Update streak
      const habit = habits.find(h => h.id === habitId);
      if (habit) {
        const newStreak = (habit.current_streak || 0) + 1;
        const newLongest = Math.max(newStreak, habit.longest_streak || 0);
        
        await supabase
          .from("habits")
          .update({ 
            current_streak: newStreak,
            longest_streak: newLongest,
          })
          .eq("id", habitId);

        // Check for achievements
        await checkStreakAchievements(newStreak);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      queryClient.invalidateQueries({ queryKey: ["today-completions"] });
      queryClient.invalidateQueries({ queryKey: ["habit-calendar"] });
      toast.success("Great job! Keep the streak going! 🔥");
    },
  });

  const startChallenge = async (challengeId: string, duration: number) => {
    if (!user) return;
    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + duration);

      const { error } = await supabase.from("user_challenges").insert({
        user_id: user.id,
        challenge_id: challengeId,
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
        current_day: 1,
        status: "active",
      });

      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ["user-challenges"] });
      
      // Check achievements
      const activeCount = (userChallenges?.length || 0) + 1;
      await checkChallengeAchievements(activeCount);
      
      toast.success("Challenge started! Let's do this! 💪");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-24">
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50 mb-6 pt-safe">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Progress
            </h1>
            <p className="text-sm text-muted-foreground">Track your habits, challenges, and achievements</p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 space-y-6">
          <Tabs defaultValue="habits" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="habits">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Habits
              </TabsTrigger>
              <TabsTrigger value="challenges">
                <Target className="h-4 w-4 mr-2" />
                Challenges
              </TabsTrigger>
              <TabsTrigger value="achievements">
                <Trophy className="h-4 w-4 mr-2" />
                Achievements
              </TabsTrigger>
            </TabsList>

            <TabsContent value="habits" className="space-y-4 mt-6">
              <WeeklyInsights />
              
              <HabitCalendar />

              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Daily Habits</h2>
                <Button onClick={() => setShowHabitForm(true)} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Habit
                </Button>
              </div>

              {habits.length === 0 ? (
                <EmptyState
                  icon={Target}
                  title="No Habits Yet"
                  description="Start building better habits today! Create your first habit and begin tracking your progress with visual streaks and achievements."
                  actionLabel="Create First Habit"
                  onAction={() => setShowHabitForm(true)}
                />
              ) : (
                <div className="space-y-3">
                  {habits.map((habit) => (
                    <HabitCard
                      key={habit.id}
                      id={habit.id}
                      title={habit.title}
                      currentStreak={habit.current_streak || 0}
                      longestStreak={habit.longest_streak || 0}
                      completedToday={todayCompletions.includes(habit.id)}
                      onComplete={() => completeHabitMutation.mutate(habit.id)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="challenges" className="space-y-4 mt-6">
              <Tabs defaultValue="active" className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="active" className="flex-1">Active</TabsTrigger>
                  <TabsTrigger value="available" className="flex-1">Available</TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="space-y-3 mt-4">
                  {userChallenges.length === 0 ? (
                    <Card className="p-8 text-center">
                      <Target className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                      <h3 className="font-semibold mb-2">No Active Challenges</h3>
                      <p className="text-sm text-muted-foreground">
                        Browse available challenges to get started!
                      </p>
                    </Card>
                  ) : (
                    userChallenges.map((uc: any) => (
                      <Card key={uc.id}>
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle>{uc.challenges?.title}</CardTitle>
                              <CardDescription>{uc.challenges?.description}</CardDescription>
                            </div>
                            <Badge variant={uc.status === "active" ? "default" : "secondary"}>
                              {uc.status}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              Day {uc.current_day} of {uc.challenges?.duration_days}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="available" className="space-y-3 mt-4">
                  {challenges.map((challenge) => {
                    const isStarted = userChallenges.some(
                      (uc: any) => uc.challenge_id === challenge.id
                    );
                    return (
                      <Card key={challenge.id}>
                        <CardHeader>
                          <CardTitle>{challenge.title}</CardTitle>
                          <CardDescription>{challenge.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between">
                            <div className="flex gap-2">
                              <Badge variant="outline">{challenge.duration_days} days</Badge>
                              {challenge.category && (
                                <Badge variant="secondary">{challenge.category}</Badge>
                              )}
                            </div>
                            <Button
                              size="sm"
                              onClick={() => startChallenge(challenge.id, challenge.duration_days)}
                              disabled={isStarted}
                            >
                              {isStarted ? "Started" : "Start Challenge"}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="achievements" className="mt-6">
              <AchievementsPanel />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={showHabitForm} onOpenChange={setShowHabitForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Habit</DialogTitle>
            <DialogDescription>
              Add a new daily habit to track. Keep it simple and specific!
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="E.g., Morning meditation, Read 10 pages..."
              value={newHabitTitle}
              onChange={(e) => setNewHabitTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newHabitTitle.trim()) {
                  addHabitMutation.mutate(newHabitTitle.trim());
                }
              }}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowHabitForm(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => newHabitTitle.trim() && addHabitMutation.mutate(newHabitTitle.trim())}
                disabled={!newHabitTitle.trim() || addHabitMutation.isPending}
              >
                Create Habit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </PageTransition>
  );
};

export default Progress;
