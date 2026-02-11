import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";

export interface MorningBriefing {
  id: string;
  user_id: string;
  briefing_date: string;
  mentor_id: string | null;
  content: string;
  inferred_goals: string[];
  todays_focus: string | null;
  action_prompt: string | null;
  data_snapshot: Record<string, unknown>;
  created_at: string;
  viewed_at: string | null;
  dismissed_at: string | null;
}

export const useMorningBriefing = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const today = useMemo(() => {
    const timezone = profile?.timezone || "UTC";
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
    } catch {
      return new Date().toLocaleDateString("en-CA");
    }
  }, [profile?.timezone]);

  // Fetch today's briefing
  const { data: briefing, isLoading, error, refetch } = useQuery({
    queryKey: ['morning-briefing', today, user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data } = await supabase
        .from('morning_briefings')
        .select('*')
        .eq('user_id', user.id)
        .eq('briefing_date', today)
        .maybeSingle();
      
      return data as MorningBriefing | null;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Generate a new briefing (only if none exists for today)
  const generateBriefing = useMutation({
    mutationFn: async () => {
      // Double-check we don't already have one (prevents race conditions)
      const { data: existing } = await supabase
        .from('morning_briefings')
        .select('id')
        .eq('user_id', user?.id)
        .eq('briefing_date', today)
        .maybeSingle();
      
      if (existing) {
        // Refetch to get full data
        await refetch();
        return null;
      }
      
      const { data, error } = await supabase.functions.invoke('generate-morning-briefing');
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      return data.briefing as MorningBriefing;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['morning-briefing'] });
    },
  });

  // Mark briefing as viewed
  const markViewed = useMutation({
    mutationFn: async (briefingId: string) => {
      const { error } = await supabase
        .from('morning_briefings')
        .update({ viewed_at: new Date().toISOString() })
        .eq('id', briefingId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['morning-briefing'] });
    },
  });

  // Dismiss briefing (user clicked "Done")
  const dismissBriefing = useMutation({
    mutationFn: async (briefingId: string) => {
      const { error } = await supabase
        .from('morning_briefings')
        .update({ dismissed_at: new Date().toISOString() })
        .eq('id', briefingId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['morning-briefing'] });
    },
  });

  return {
    briefing,
    isLoading,
    error,
    refetch,
    generateBriefing,
    markViewed,
    dismissBriefing,
    isGenerating: generateBriefing.isPending,
  };
};
