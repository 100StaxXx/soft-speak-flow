import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDocuments, getDocument, setDocument } from "@/lib/firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { PageTransition } from "@/components/PageTransition";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Target, Calendar, Zap, Users, Loader2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

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

      // Fetch epic by invite code
      const epics = await getDocuments(
        "epics",
        [
          ["invite_code", "==", code],
          ["is_public", "==", true],
        ]
      );

      if (epics.length === 0) throw new Error("Epic not found");
      const epicData = epics[0];

      // Fetch epic_habits for this epic
      const epicHabits = await getDocuments(
        "epic_habits",
        [["epic_id", "==", epicData.id]]
      );

      // Fetch habit details for each epic_habit
      const habits = await Promise.all(
        epicHabits.map(async (eh) => {
          const habit = await getDocument("habits", eh.habit_id);
          return habit ? {
            habit_id: eh.habit_id,
            habits: {
              id: habit.id,
              title: habit.title,
              difficulty: habit.difficulty,
              frequency: habit.frequency,
              custom_days: habit.custom_days,
            },
          } : null;
        })
      );

      // Get member count
      const members = await getDocuments(
        "epic_members",
        [["epic_id", "==", epicData.id]]
      );
      
      return {
        ...epicData,
        epic_habits: habits.filter(h => h !== null),
        member_count: members.length,
      };
    },
    enabled: !!code,
  });

  const MAX_EPICS = 2;

  // Join epic mutation
  const joinEpic = useMutation({
    mutationFn: async () => {
      if (!user || !epic) throw new Error("Not authenticated or epic not found");

      // Check epic limit (owned + joined)
      const ownedEpics = await getDocuments(
        'epics',
        [
          ['user_id', '==', user.uid],
          ['status', '==', 'active'],
        ]
      );
      
      // Fetch joined epics (where user is a member but not the owner)
      const allMemberships = await getDocuments(
        'epic_members',
        [['user_id', '==', user.uid]]
      );
      
      // Filter to only active epics where user is not the owner
      const joinedEpicIds = await Promise.all(
        allMemberships.map(async (membership) => {
          const epicData = await getDocument('epics', membership.epic_id);
          if (epicData && epicData.status === 'active' && epicData.user_id !== user.uid) {
            return membership.epic_id;
          }
          return null;
        })
      );
      const joinedEpics = joinedEpicIds.filter(id => id !== null);

      const totalActiveEpics = ownedEpics.length + joinedEpics.length;
      
      if (totalActiveEpics >= MAX_EPICS) {
        throw new Error(`You can only have ${MAX_EPICS} active epics at a time. Complete or abandon an epic to join a new one.`);
      }

      // Check if already a member
      const existingMemberships = await getDocuments(
        "epic_members",
        [
          ["epic_id", "==", epic.id],
          ["user_id", "==", user.uid],
        ]
      );

      if (existingMemberships.length > 0) {
        throw new Error("You're already part of this epic!");
      }

      // Add user as member
      const memberId = `${epic.id}_${user.uid}`;
      await setDocument("epic_members", memberId, {
        id: memberId,
        epic_id: epic.id,
        user_id: user.uid,
      }, false);

      // Copy epic's habits to user's habits
      if (epic.epic_habits && epic.epic_habits.length > 0) {
        const { batchWrite } = await import("@/lib/firebase/firestore");
        const operations: Array<{ type: "set"; collection: string; docId: string; data: any }> = [];

        for (const eh of epic.epic_habits) {
          const habitId = `${user.uid}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          operations.push({
            type: "set",
            collection: "habits",
            docId: habitId,
            data: {
              id: habitId,
              user_id: user.uid,
              title: eh.habits.title,
              difficulty: eh.habits.difficulty,
              frequency: eh.habits.frequency || "daily",
              custom_days: eh.habits.custom_days || null,
            },
          });

          // Link copied habit to the epic for this user
          const linkId = `${epic.id}_${habitId}`;
          operations.push({
            type: "set",
            collection: "epic_habits",
            docId: linkId,
            data: {
              id: linkId,
              epic_id: epic.id,
              habit_id: habitId,
            },
          });
        }

        await batchWrite(operations);
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
      <div className="min-h-screen pb-24 pt-12 px-4">
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
