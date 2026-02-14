import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useXPRewards } from "@/hooks/useXPRewards";
import { useWeeklyRecapContext } from "@/contexts/WeeklyRecapContext";
import { format } from "date-fns";
import { safeLocalStorage } from "@/utils/storage";

export interface WeeklyRecap {
  id: string;
  user_id: string;
  week_start_date: string;
  week_end_date: string;
  mood_data: {
    morning: Array<{ date: string; mood: string }>;
    evening: Array<{ date: string; mood: string }>;
    trend: "improving" | "stable" | "declining";
  };
  gratitude_themes: string[];
  win_highlights: string[];
  stats: {
    checkIns: number;
    reflections: number;
    quests: number;
    habits: number;
  };
  mentor_insight: string | null;
  mentor_story: string | null;
  created_at: string;
  viewed_at: string | null;
}

export const useWeeklyRecap = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { awardCustomXP } = useXPRewards();
  const { isModalOpen, selectedRecap, openRecap: contextOpenRecap, closeRecap: contextCloseRecap } = useWeeklyRecapContext();

  // Get previous week boundaries (Mon-Sun), recalculates for accuracy
  const getWeekBoundaries = () => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, etc.
    
    // Get Monday of current week
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const currentMonday = new Date(today);
    currentMonday.setDate(today.getDate() - daysToMonday);
    
    // Get Monday of previous week
    const weekStart = new Date(currentMonday);
    weekStart.setDate(currentMonday.getDate() - 7);
    
    // Get Sunday of previous week (Mon + 6 days)
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    return {
      start: format(weekStart, "yyyy-MM-dd"),
      end: format(weekEnd, "yyyy-MM-dd"),
    };
  };

  const { start: currentWeekStart } = getWeekBoundaries();

  // Recalculates on each render for accuracy
  const isSunday = new Date().getDay() === 0;

  // Fetch current week's recap
  const { data: currentRecap, isLoading } = useQuery({
    queryKey: ["weekly-recap", user?.id, currentWeekStart],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("weekly_recaps")
        .select("*")
        .eq("user_id", user.id)
        .eq("week_start_date", currentWeekStart)
        .maybeSingle();

      if (error) throw error;
      return data as WeeklyRecap | null;
    },
    enabled: !!user?.id,
  });

  // Fetch all past recaps
  const { data: pastRecaps } = useQuery({
    queryKey: ["weekly-recaps-all", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("weekly_recaps")
        .select("*")
        .eq("user_id", user.id)
        .order("week_start_date", { ascending: false });

      if (error) throw error;
      return data as WeeklyRecap[];
    },
    enabled: !!user?.id,
  });

  // Generate recap mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("generate-weekly-recap", {
        body: { userId: user.id },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weekly-recap"] });
      queryClient.invalidateQueries({ queryKey: ["weekly-recaps-all"] });
    },
  });

  // Mark as viewed mutation
  const markViewedMutation = useMutation({
    mutationFn: async (recapId: string) => {
      const { error } = await supabase
        .from("weekly_recaps")
        .update({ viewed_at: new Date().toISOString() })
        .eq("id", recapId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weekly-recap"] });
      queryClient.invalidateQueries({ queryKey: ["weekly-recaps-all"] });
    },
  });

  // Auto-open modal on Sunday if recap exists and not viewed
  useEffect(() => {
    if (isSunday && currentRecap && !currentRecap.viewed_at && !isLoading) {
      // Check localStorage to prevent showing multiple times per session
      const dismissedKey = `recap-dismissed-${currentRecap.week_start_date}`;
      const dismissed = safeLocalStorage.getItem(dismissedKey);
      
      if (!dismissed) {
        contextOpenRecap(currentRecap);
      }
    }
  }, [isSunday, currentRecap, isLoading, contextOpenRecap]);

  // Auto-generate recap on Sunday if it doesn't exist AND user has activity
  useEffect(() => {
    const checkAndGenerate = async () => {
      if (!isSunday || currentRecap || isLoading || !user?.id || generateMutation.isPending) {
        return;
      }
      
      // Check if user has any prior check-ins before triggering generation
      const { count } = await supabase
        .from("daily_check_ins")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      
      // Only generate if user has at least 1 check-in ever
      if (count && count > 0) {
        generateMutation.mutate();
      }
    };
    
    checkAndGenerate();
  }, [isSunday, currentRecap, isLoading, user?.id, generateMutation.isPending]);

  const openRecap = (recap: WeeklyRecap) => {
    contextOpenRecap(recap);
    
    // Award XP if not viewed before
    if (!recap.viewed_at) {
      awardCustomXP(5, "weekly_recap_viewed", "Weekly Recap");
      markViewedMutation.mutate(recap.id);
    }
  };

  const closeRecap = () => {
    if (selectedRecap) {
      // Mark dismissed in localStorage
      const dismissedKey = `recap-dismissed-${selectedRecap.week_start_date}`;
      safeLocalStorage.setItem(dismissedKey, "true");
      
      // Mark as viewed if not already
      if (!selectedRecap.viewed_at) {
        markViewedMutation.mutate(selectedRecap.id);
      }
    }
    contextCloseRecap();
  };

  return {
    isSunday,
    currentRecap,
    pastRecaps: pastRecaps || [],
    isLoading,
    isModalOpen,
    selectedRecap,
    openRecap,
    closeRecap,
    isGenerating: generateMutation.isPending,
    generateRecap: generateMutation.mutate,
  };
};
