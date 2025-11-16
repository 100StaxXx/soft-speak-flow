import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BottomNav } from "@/components/BottomNav";
import { AchievementsPanel } from "@/components/AchievementsPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Target, Trophy, CheckCircle2, Calendar, Flame } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const Progress = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showHabitForm, setShowHabitForm] = useState(false);

  const { data: habits = [], refetch: refetchHabits } = useQuery({
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
      toast.success("Challenge started!");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-24">
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50 mb-6">
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
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Your Habits</h2>
                <Button onClick={() => setShowHabitForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Habit
                </Button>
              </div>

              {habits.length === 0 ? (
                <Card className="p-8 text-center">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <h3 className="font-semibold mb-2">No Habits Yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Start building better habits today!
                  </p>
                  <Button onClick={() => setShowHabitForm(true)}>Create Your First Habit</Button>
                </Card>
              ) : (
                <div className="space-y-3">
                  {habits.map((habit) => {
                    const today = new Date().toISOString().split("T")[0];
                    return (
                      <Card key={habit.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold">{habit.title}</h3>
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Flame className="h-4 w-4 text-orange-500" />
                                <span>{habit.current_streak} day streak</span>
                              </div>
                              <div>
                                <span>Best: {habit.longest_streak} days</span>
                              </div>
                            </div>
                          </div>
                          <Button size="sm" variant="outline">
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
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
      <BottomNav />
    </PageTransition>
  );
};

export default Progress;
