import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
    queryKey: ["streak-at-risk", user?.id],
    queryFn: async (): Promise<StreakAtRiskData | null> => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("streak_at_risk, streak_at_risk_since, current_habit_streak, streak_freezes_available")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching streak at risk:", error);
        return null;
      }

      return {
        streak_at_risk: data.streak_at_risk ?? false,
        streak_at_risk_since: data.streak_at_risk_since,
        current_habit_streak: data.current_habit_streak ?? 0,
        streak_freezes_available: data.streak_freezes_available ?? 0,
      };
    },
    enabled: !!user?.id,
    staleTime: 30000, // 30 seconds
  });

  const resolveStreakMutation = useMutation({
    mutationFn: async (action: "use_freeze" | "reset_streak") => {
      const { data, error } = await supabase.functions.invoke("resolve-streak-freeze", {
        body: { action },
      });

      if (error) throw error;
      return data;
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
