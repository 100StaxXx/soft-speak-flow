import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invalidateMentorContextQueries } from "@/lib/mentorContextQueryCache";
import { invalidateProfileAccessQueries } from "@/lib/profileAccessQueryCache";
import { useAuth } from "./useAuth";
import { logger } from "@/utils/logger";

export const useProfileRealtime = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`profile-sync-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        () => {
          void invalidateProfileAccessQueries(queryClient, {
            includeProfileAll: true,
            includeSubscriptionAll: true,
            includeReferralStatsAll: true,
          });
          void invalidateMentorContextQueries(queryClient, {
            includeStreakFreezes: true,
          });
        },
      )
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          logger.warn("Profile realtime subscription error", { status, error: err?.message });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, user?.id]);
};
