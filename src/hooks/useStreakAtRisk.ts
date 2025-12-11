import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDocument } from "@/lib/firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface StreakAtRiskData {
  streak_at_risk: boolean;
  streak_at_risk_since: string | null;
  current_habit_streak: number;
  streak_freezes_available: number;
}

export function useStreakAtRisk() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["streak-at-risk", user?.uid],
    queryFn: async (): Promise<StreakAtRiskData | null> => {
      if (!user?.uid) return null;

      const profile = await getDocument<{
        streak_at_risk: boolean;
        streak_at_risk_since: string | null;
        current_habit_streak: number;
        streak_freezes_available: number;
      }>("profiles", user.uid);

      if (!profile) return null;

      return {
        streak_at_risk: profile.streak_at_risk ?? false,
        streak_at_risk_since: profile.streak_at_risk_since,
        current_habit_streak: profile.current_habit_streak ?? 0,
        streak_freezes_available: profile.streak_freezes_available ?? 0,
      };
    },
    enabled: !!user?.uid,
    staleTime: 30000, // 30 seconds
  });

  const resolveStreakMutation = useMutation({
    mutationFn: async (action: "use_freeze" | "reset_streak") => {
      // TODO: Migrate to Firebase Cloud Function
      // const response = await fetch('https://YOUR-FIREBASE-FUNCTION/resolve-streak-freeze', {
      //   method: 'POST',
      //   body: JSON.stringify({ action }),
      // });
      // const data = await response.json();
      // return data;
      throw new Error("Streak freeze resolution needs Firebase Cloud Function migration");
    },
    onSuccess: (result, action) => {
      queryClient.invalidateQueries({ queryKey: ["streak-at-risk"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });

      if (action === "use_freeze") {
        toast({
          title: "Streak Preserved! ❄️",
          description: `Your ${result.newStreak}-day streak is safe. ${result.freezesRemaining} freeze${result.freezesRemaining === 1 ? "" : "s"} remaining.`,
        });
      } else {
        toast({
          title: "Fresh Start",
          description: "Your streak has been reset. Time to build a new one!",
        });
      }
    },
    onError: (error) => {
      console.error("Error resolving streak:", error);
      toast({
        title: "Error",
        description: "Failed to process your choice. Please try again.",
        variant: "destructive",
      });
    },
  });

  return {
    needsStreakDecision: data?.streak_at_risk ?? false,
    currentStreak: data?.current_habit_streak ?? 0,
    freezesAvailable: data?.streak_freezes_available ?? 0,
    streakAtRiskSince: data?.streak_at_risk_since,
    isLoading,
    useFreeze: () => resolveStreakMutation.mutateAsync("use_freeze"),
    resetStreak: () => resolveStreakMutation.mutateAsync("reset_streak"),
    isResolving: resolveStreakMutation.isPending,
  };
}
