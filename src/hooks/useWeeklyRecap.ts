import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useXPRewards } from "@/hooks/useXPRewards";
import { format, startOfWeek, endOfWeek, subDays } from "date-fns";

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
  created_at: string;
  viewed_at: string | null;
}

export const useWeeklyRecap = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { awardCustomXP } = useXPRewards();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecap, setSelectedRecap] = useState<WeeklyRecap | null>(null);

  // Get current week boundaries (Sunday-based week for recap delivery)
  const currentWeekStart = useMemo(() => {
    const today = new Date();
    // Start of previous week (Mon-Sun recap delivered on Sunday)
    const lastSunday = startOfWeek(today, { weekStartsOn: 1 }); // Monday start
    return format(subDays(lastSunday, 7), "yyyy-MM-dd");
  }, []);

  const currentWeekEnd = useMemo(() => {
    const today = new Date();
    const lastSunday = startOfWeek(today, { weekStartsOn: 1 });
    return format(subDays(lastSunday, 1), "yyyy-MM-dd");
  }, []);

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
      const dismissed = localStorage.getItem(dismissedKey);
      
      if (!dismissed) {
        setSelectedRecap(currentRecap);
        setIsModalOpen(true);
      }
    }
  }, [isSunday, currentRecap, isLoading]);

  // Auto-generate recap on Sunday if it doesn't exist
  useEffect(() => {
    if (isSunday && !currentRecap && !isLoading && user?.id && !generateMutation.isPending) {
      generateMutation.mutate();
    }
  }, [isSunday, currentRecap, isLoading, user?.id, generateMutation.isPending]);

  const openRecap = (recap: WeeklyRecap) => {
    setSelectedRecap(recap);
    setIsModalOpen(true);
    
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
      localStorage.setItem(dismissedKey, "true");
      
      // Mark as viewed if not already
      if (!selectedRecap.viewed_at) {
        markViewedMutation.mutate(selectedRecap.id);
      }
    }
    setIsModalOpen(false);
    setSelectedRecap(null);
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