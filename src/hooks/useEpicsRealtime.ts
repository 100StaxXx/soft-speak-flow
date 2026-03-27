/**
 * Realtime subscription for epics
 * Enables instant cross-device synchronization for epic progress and status
 */
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { logger } from "@/utils/logger";
import { warmEpicsQueryFromRemote } from "@/utils/plannerSync";

export const useEpicsRealtime = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`epics-sync-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'epics',
          filter: `user_id=eq.${user.id}`,
        },
        async () => {
          await warmEpicsQueryFromRemote(queryClient, user.id).catch((error) => {
            logger.warn("Failed to warm epics query from realtime update", {
              error: error instanceof Error ? error.message : String(error),
            });
          });
          queryClient.invalidateQueries({ queryKey: ['epics'] });
          queryClient.invalidateQueries({ queryKey: ['epic-progress'] });
          queryClient.invalidateQueries({ queryKey: ['habit-surfacing'] });
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.warn('Epics realtime subscription error', { status, error: err?.message });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
};
