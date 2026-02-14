import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useXPRewards } from "@/hooks/useXPRewards";
import { format } from "date-fns";

export interface EveningReflection {
  id: string;
  user_id: string;
  reflection_date: string;
  mood: string;
  wins: string | null;
  gratitude: string | null;
  mentor_response: string | null;
  created_at: string;
}

export const useEveningReflection = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { awardCustomXP } = useXPRewards();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Use current date (recalculates on each render for accuracy)
  const today = format(new Date(), "yyyy-MM-dd");

  // Check if it's evening (after 6 PM)
  const isEvening = new Date().getHours() >= 18;

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
    mutationFn: async (data: { mood: string; wins?: string; gratitude?: string }) => {
      if (!user?.id) throw new Error("Not authenticated");

      const { data: reflection, error } = await supabase
        .from("evening_reflections")
        .insert({
          user_id: user.id,
          reflection_date: today,
          mood: data.mood,
          wins: data.wins || null,
          gratitude: data.gratitude || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Generate mentor response in background
      supabase.functions.invoke("generate-evening-response", {
        body: { reflectionId: reflection.id },
      }).catch(console.error);

      return reflection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evening-reflection"] });
      awardCustomXP(3, "evening_reflection", "Evening Reflection");
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
    submitReflection: submitMutation.mutate,
    isSubmitting: submitMutation.isPending,
  };
};
