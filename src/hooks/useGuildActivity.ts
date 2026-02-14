import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { logger } from "@/utils/logger";

export interface GuildActivity {
  id: string;
  epic_id: string;
  user_id: string;
  activity_type: string;
  activity_data: Record<string, any>;
  created_at: string;
}

export const useGuildActivity = (epicId?: string) => {
  const queryClient = useQueryClient();

  const { data: activities, isLoading } = useQuery<GuildActivity[]>({
    queryKey: ["guild-activity", epicId],
    queryFn: async () => {
      if (!epicId) return [];

      const { data, error } = await supabase
        .from("epic_activity_feed")
        .select("*")
        .eq("epic_id", epicId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as GuildActivity[];
    },
    enabled: !!epicId,
    staleTime: 30 * 1000,
  });

  // Real-time subscription for new activity
  useEffect(() => {
    if (!epicId) return;

    const channel = supabase
      .channel(`guild-activity-${epicId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "epic_activity_feed",
          filter: `epic_id=eq.${epicId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["guild-activity", epicId] });
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.warn('Guild activity subscription error', { status, error: err?.message });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [epicId, queryClient]);

  return {
    activities,
    isLoading,
  };
};
