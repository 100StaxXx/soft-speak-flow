import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BottomNav } from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/EmptyState";
import { Target, TrendingUp, Calendar, CheckCircle2, Circle, ArrowLeft, Trophy, Dumbbell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function Challenges() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"active" | "available">("active");

  // Fetch available challenges
  const { data: availableChallenges } = useQuery({
    queryKey: ["challenges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch user's active challenges
  const { data: userChallenges, refetch: refetchUserChallenges } = useQuery({
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
      return data || [];
    },
  });

  // Fetch challenge progress
  const { data: challengeProgress } = useQuery({
    queryKey: ["challenge-progress", user?.id],
    enabled: !!user && !!userChallenges,
    queryFn: async () => {
      if (!userChallenges || userChallenges.length === 0) return [];

      const challengeIds = userChallenges.map((uc) => uc.id);
      const { data, error } = await supabase
        .from("challenge_progress")
        .select("*")
        .in("user_challenge_id", challengeIds);

      if (error) throw error;
      return data || [];
    },
  });

  const handleStartChallenge = async (challengeId: string, totalDays: number) => {
    if (!user) return;

    try {
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + totalDays);

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
      refetchUserChallenges();
      setActiveTab("active");
    } catch (error: any) {
      toast.error("Failed to start challenge");
      console.error(error);
    }
  };

  const getProgressPercentage = (userChallengeId: string, totalDays: number) => {
    const progress = challengeProgress?.filter((p) => p.user_challenge_id === userChallengeId) || [];
    const completedDays = progress.filter((p) => p.completed).length;
    return Math.round((completedDays / totalDays) * 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-accent/10 pb-24 pt-safe">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" onClick={() => navigate("/")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="font-heading text-5xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Challenges
          </h1>
          <p className="text-muted-foreground text-lg mt-2">
            Transform your life with structured challenges
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8 bg-card/50 backdrop-blur-xl border border-border/50">
            <TabsTrigger
              value="active"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-primary-foreground"
            >
              <Target className="h-4 w-4 mr-2" />
              Active
            </TabsTrigger>
            <TabsTrigger
              value="available"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-primary-foreground"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Available
            </TabsTrigger>
          </TabsList>

          {/* Active Challenges */}
          <TabsContent value="active" className="space-y-6">
            {userChallenges && userChallenges.length > 0 ? (
              userChallenges.map((userChallenge) => {
                const challenge = userChallenge.challenges;
                if (!challenge) return null;

                const progressPercentage = getProgressPercentage(
                  userChallenge.id,
                  challenge.total_days
                );

                return (
                  <Card
                    key={userChallenge.id}
                    className="p-6 bg-card/50 backdrop-blur-sm border-primary/20 hover:border-primary/40 transition-all"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold mb-2">{challenge.title}</h3>
                        <p className="text-muted-foreground text-sm mb-4">
                          {challenge.description}
                        </p>
                        <div className="flex flex-wrap gap-2 mb-4">
                          <Badge variant="outline" className="border-primary/30">
                            <Calendar className="h-3 w-3 mr-1" />
                            Day {userChallenge.current_day} of {challenge.total_days}
                          </Badge>
                          <Badge
                            variant={userChallenge.status === "active" ? "default" : "secondary"}
                          >
                            {userChallenge.status}
                          </Badge>
                        </div>
                      </div>
                      <Trophy className="h-8 w-8 text-accent" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-semibold">{progressPercentage}%</span>
                      </div>
                      <Progress value={progressPercentage} className="h-2" />
                    </div>
                  </Card>
                );
              })
            ) : (
              <EmptyState
                icon={Dumbbell}
                title="No Active Challenges"
                description="Ready to level up? Start a challenge from the Available tab and begin your transformation journey today!"
                actionLabel="Browse Challenges"
                onAction={() => setActiveTab("available")}
              />
            )}
          </TabsContent>

          {/* Available Challenges */}
          <TabsContent value="available" className="space-y-6">
            {availableChallenges && availableChallenges.length > 0 ? (
              <div className="grid gap-6">
                {availableChallenges.map((challenge) => {
                  const isActive = userChallenges?.some(
                    (uc) => uc.challenge_id === challenge.id && uc.status === "active"
                  );

                  return (
                    <Card
                      key={challenge.id}
                      className="p-6 bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/30 transition-all"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold mb-2">{challenge.title}</h3>
                          <p className="text-muted-foreground mb-4">{challenge.description}</p>
                          <div className="flex flex-wrap gap-2">
                            {challenge.category && (
                              <Badge variant="outline">{challenge.category}</Badge>
                            )}
                            <Badge variant="outline" className="border-accent/30">
                              {challenge.total_days} Days
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {isActive ? (
                        <Badge className="w-full justify-center py-2">
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Active Challenge
                        </Badge>
                      ) : (
                        <Button
                          onClick={() => handleStartChallenge(challenge.id, challenge.total_days)}
                          className="w-full bg-gradient-to-r from-primary to-accent hover:shadow-glow"
                        >
                          Start Challenge
                        </Button>
                      )}
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="p-12 text-center bg-card/50 backdrop-blur-sm border-border/50">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No challenges available</h3>
                <p className="text-muted-foreground">Check back soon for new challenges</p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav />
    </div>
  );
}
