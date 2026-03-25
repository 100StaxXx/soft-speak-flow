import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
          queryClient.invalidateQueries({ queryKey: ["profile"] });
          queryClient.invalidateQueries({ queryKey: ["mentor"] });
          queryClient.invalidateQueries({ queryKey: ["mentor-page-data"] });
          queryClient.invalidateQueries({ queryKey: ["mentor-personality"] });
          queryClient.invalidateQueries({ queryKey: ["selected-mentor"] });
          queryClient.invalidateQueries({ queryKey: ["streak-freezes"] });
          queryClient.invalidateQueries({ queryKey: ["subscription"] });
          queryClient.invalidateQueries({ queryKey: ["referral-stats"] });
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
