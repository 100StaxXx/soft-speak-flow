import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useXPRewards } from "@/hooks/useXPRewards";
import { isEveningReflectionAvailableAtHour } from "@/utils/eveningReflectionSchedule";
import { getEffectiveDailyDate, getLocalHour, getUserTimezone } from "@/utils/timezone";
import { updateDailyGuideThread } from "@/services/dailyGuideThread";
import { trackProductExperience } from "@/lib/productAnalytics";

const CLOCK_REFRESH_MS = 60_000;

export interface EveningReflection {
  id: string;
  user_id: string;
  reflection_date: string;
  mood: string;
  wins: string | null;
  additional_reflection: string | null;
  tomorrow_adjustment: string | null;
  gratitude: string | null;
  mentor_response: string | null;
  created_at: string;
}

export const useEveningReflection = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { awardReflectionComplete } = useXPRewards();
  const queryClient = useQueryClient();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const refreshClock = () => setNow(new Date());
    const interval = window.setInterval(refreshClock, CLOCK_REFRESH_MS);
    window.addEventListener("focus", refreshClock);
    document.addEventListener("visibilitychange", refreshClock);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshClock);
      document.removeEventListener("visibilitychange", refreshClock);
    };
  }, []);

  const timezone = profile?.timezone || getUserTimezone();
  const localHour = getLocalHour(timezone, now);
  const today = getEffectiveDailyDate(timezone);

  // Keep the reflection available after 6 PM and through the app's 2 AM reset.
  const isEvening = isEveningReflectionAvailableAtHour(localHour);

  // Check if reflection exists for today
  const { data: todaysReflection, isLoading } = useQuery({
    queryKey: ["evening-reflection", user?.id, today],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from("evening_reflections")
        .select("*")
        .eq("user_id", user.id)
        .eq("reflection_date", today)
        .maybeSingle();
      
      if (error) throw error;
      return data as EveningReflection | null;
    },
    enabled: !!user?.id,
  });

  const hasCompletedToday = !!todaysReflection;
  const shouldShowBanner = isEvening && !hasCompletedToday && !isLoading;

  // Submit reflection mutation
  const submitMutation = useMutation({
    mutationFn: async (data: {
      mood: string;
      wins?: string;
      additionalReflection?: string;
      tomorrowAdjustment?: string;
      gratitude?: string;
    }) => {
      if (!user?.id) throw new Error("Not authenticated");

      const { data: reflection, error } = await supabase
        .from("evening_reflections")
        .insert({
          user_id: user.id,
          reflection_date: today,
          mood: data.mood,
          wins: data.wins || null,
          additional_reflection: data.additionalReflection || null,
          tomorrow_adjustment: data.tomorrowAdjustment || null,
          gratitude: data.gratitude || null,
        })
        .select()
        .single();

      if (error) throw error;

      await updateDailyGuideThread(user.id, today, {
        evening_reflection_id: reflection.id,
        evening_reflected_at: reflection.created_at,
        companion_response: "You made room to notice the day instead of only moving through it. We can let it rest now.",
        companion_acknowledged_at: null,
      });

      // Generate a bounded AI acknowledgment in the background.
      supabase.functions.invoke("generate-evening-response", {
        body: { reflectionId: reflection.id },
      }).catch(console.error);

      return reflection;
    },
    onSuccess: (reflection) => {
      queryClient.invalidateQueries({ queryKey: ["evening-reflection"] });
      void awardReflectionComplete({ date: today, reflectionId: reflection.id });
      window.dispatchEvent(new CustomEvent("evening-reflection-completed", {
        detail: { reflectionId: reflection.id },
      }));
      void trackProductExperience("evening_reflection_completed", {
        surface: "today",
        properties: { has_guide_thread: true },
      });
      setIsDrawerOpen(false);
    },
  });

  return {
    isEvening,
    hasCompletedToday,
    shouldShowBanner,
    todaysReflection,
    isLoading,
    isDrawerOpen,
    setIsDrawerOpen,
    submitReflection: submitMutation.mutateAsync,
    isSubmitting: submitMutation.isPending,
  };
};
