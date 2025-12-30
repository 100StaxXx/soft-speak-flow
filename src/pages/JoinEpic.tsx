import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageTransition } from "@/components/PageTransition";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Target, Calendar, Zap, Users, Loader2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { getHabitLimitForTier } from "@/config/habitLimits";

const JoinEpic = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch epic details by invite code
  const { data: epic, isLoading } = useQuery({
    queryKey: ["epic-preview", code],
    queryFn: async () => {
      if (!code) throw new Error("No invite code provided");

      const { data, error } = await supabase
        .from("epics")
        .select(`
          *,
          epic_habits(
            habit_id,
            habits(id, title, difficulty, frequency, custom_days)
          )
        `)
        .eq("invite_code", code)
        .eq("is_public", true)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Epic not found");
      
      // Get member count separately
      const { count } = await supabase
        .from("epic_members")
        .select("*", { count: 'exact', head: true })
        .eq("epic_id", data.id);
      
      return { ...data, member_count: count || 0 };
    },
    enabled: !!code,
  });

  const MAX_EPICS = 2;

  // Join epic mutation
  const joinEpic = useMutation({
    mutationFn: async () => {
      if (!user || !epic) throw new Error("Not authenticated or epic not found");

      // Check epic limit (owned + joined)
      const { data: ownedEpics } = await supabase
        .from('epics')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active');
      
      const { data: joinedEpics } = await supabase
        .from('epic_members')
        .select('epic_id, epics!inner(user_id, status)')
        .eq('user_id', user.id)
        .neq('epics.user_id', user.id)
        .eq('epics.status', 'active');

      const totalActiveEpics = (ownedEpics?.length || 0) + (joinedEpics?.length || 0);
      
      if (totalActiveEpics >= MAX_EPICS) {
        throw new Error(`You can only have ${MAX_EPICS} active epics at a time. Complete or abandon an epic to join a new one.`);
      }

      // Check if already a member
      const { data: existingMember } = await supabase
        .from("epic_members")
        .select("id")
        .eq("epic_id", epic.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingMember) {
        throw new Error("You're already part of this epic!");
      }

      // Add user as member
      const { error: memberError } = await supabase
        .from("epic_members")
        .insert({
          epic_id: epic.id,
          user_id: user.id,
        });

      if (memberError) throw memberError;

      // Copy epic's habits to user's habits (respect tier-based limit)
      if (epic.epic_habits && epic.epic_habits.length > 0) {
        // Infer tier from target_days as a heuristic
        let tier: string = 'beginner';
        if (epic.target_days >= 45) tier = 'advanced';
        else if (epic.target_days >= 21) tier = 'intermediate';
        
        const habitLimit = getHabitLimitForTier(tier);
        const limitedHabits = epic.epic_habits.slice(0, habitLimit);
        
        const { data: copiedHabits, error: habitError } = await supabase
          .from("habits")
          .insert(
            limitedHabits.map((eh: any) => ({
              user_id: user.id,
              title: eh.habits.title,
              difficulty: eh.habits.difficulty,
              frequency: eh.habits.frequency || "daily",
              custom_days: eh.habits.custom_days || null,
            }))
          )
          .select();

        if (habitError) throw habitError;

        // Link copied habits to the epic for this user
        const { error: linkError } = await supabase
          .from("epic_habits")
          .insert(
            copiedHabits.map((habit) => ({
              epic_id: epic.id,
              habit_id: habit.id,
            }))
          );

        if (linkError) throw linkError;
      }

      return epic;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["epics"] });
      toast.success("Epic Joined! ⚔️", {
        description: "You're now part of this legendary quest!",
      });
      navigate("/epics");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to join epic");
    },
  });

  if (!user) {
    return (
      <PageTransition>
        <div className="min-h-screen flex items-center justify-center px-4">
          <Card className="max-w-md w-full p-8 text-center">
            <Target className="w-16 h-16 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Join This Epic Quest</h2>
            <p className="text-muted-foreground mb-6">
              Sign in to join this shared epic and embark on the journey with the community!
            </p>
            <Button onClick={() => navigate("/auth")} className="w-full">
              Sign In to Join
            </Button>
          </Card>
        </div>
      </PageTransition>
    );
  }

  if (isLoading) {
    return (
      <PageTransition>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PageTransition>
    );
  }

  if (!epic) {
    return (
      <PageTransition>
        <div className="min-h-screen flex items-center justify-center px-4">
          <Card className="max-w-md w-full p-8 text-center">
            <Target className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h2 className="text-2xl font-bold mb-2">Epic Not Found</h2>
            <p className="text-muted-foreground mb-6">
              This invite code is invalid or the epic is no longer available.
            </p>
            <Button onClick={() => navigate("/epics")} variant="outline">
              View Your Epics
            </Button>
          </Card>
        </div>
      </PageTransition>
    );
  }

  const memberCount = epic?.member_count || 0;

  return (
    <PageTransition>
      <div className="min-h-screen pb-nav-safe pt-safe-lg px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <Badge className="mb-4 px-4 py-2 text-sm">
              <Users className="w-4 h-4 mr-2" />
              Community Epic
            </Badge>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              Join the Quest
            </h1>
            <p className="text-muted-foreground">
              You've been invited to join a shared epic challenge
            </p>
          </div>

          {/* Epic Preview Card */}
          <Card className="p-8 bg-gradient-to-br from-background to-secondary/20 border-2 border-primary/20 mb-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-3xl font-bold mb-2">{epic.title}</h2>
                {epic.description && (
                  <p className="text-muted-foreground">{epic.description}</p>
                )}
              </div>
              <Target className="w-8 h-8 text-primary flex-shrink-0" />
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-background/50 rounded-lg p-4 text-center">
                <Calendar className="w-5 h-5 text-primary mx-auto mb-2" />
                <div className="text-2xl font-bold mb-1">{epic.target_days}</div>
                <div className="text-xs text-muted-foreground">Days</div>
              </div>
              
              <div className="bg-background/50 rounded-lg p-4 text-center">
                <Users className="w-5 h-5 text-purple-500 mx-auto mb-2" />
                <div className="text-2xl font-bold mb-1">{memberCount}</div>
                <div className="text-xs text-muted-foreground">Members</div>
              </div>
              
              <div className="bg-background/50 rounded-lg p-4 text-center">
                <Zap className="w-5 h-5 text-yellow-500 mx-auto mb-2" />
                <div className="text-2xl font-bold mb-1">{epic.xp_reward}</div>
                <div className="text-xs text-muted-foreground">XP Reward</div>
              </div>
            </div>

            {/* Habits */}
            {epic.epic_habits && epic.epic_habits.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
                  Habits You'll Track ({epic.epic_habits.length})
                </h3>
                <div className="space-y-2">
                  {epic.epic_habits.map((eh: any) => (
                    <div
                      key={eh.habit_id}
                      className="flex items-center justify-between bg-background/50 rounded-lg p-3"
                    >
                      <span className="font-medium">{eh.habits.title}</span>
                      <Badge variant="outline" className="text-xs">
                        {eh.habits.difficulty}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Join Button */}
            <Button
              onClick={() => joinEpic.mutate()}
              disabled={joinEpic.isPending}
              className="w-full h-14 text-lg bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
            >
              {joinEpic.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Joining...
                </>
              ) : (
                <>
                  Join This Epic
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </Card>

          {/* Info Box */}
          <Card className="p-4 bg-primary/5 border-primary/20">
            <p className="text-sm text-muted-foreground text-center">
              By joining, you'll track the same habits as other members and compete on the leaderboard!
            </p>
          </Card>
        </motion.div>
      </div>
    </PageTransition>
  );
};

export default JoinEpic;
