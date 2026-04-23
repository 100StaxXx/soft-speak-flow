/**
 * Realtime subscription for habits and habit completions
 * Enables instant cross-device synchronization
 */
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  campaignContextQueryFamilyGroups,
  invalidateCampaignContextQueryFamilies,
  invalidateHabitScopeQueries,
} from "@/lib/campaignContextQueryCache";
import { invalidateQuestAutocompleteQueries } from "@/lib/questAutocompleteQueryCache";
import { useAuth } from "./useAuth";
import { logger } from "@/utils/logger";
import {
  dispatchPlannerSyncFinished,
  syncLocalHabitsFromRemote,
  warmEpicsQueryFromRemote,
} from "@/utils/plannerSync";
import { getEffectiveMissionDate } from "@/utils/timezone";

export const useHabitsRealtime = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`habits-sync-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'habits',
          filter: `user_id=eq.${user.id}`,
        },
        async () => {
          await Promise.allSettled([
            syncLocalHabitsFromRemote(user.id, getEffectiveMissionDate()),
            warmEpicsQueryFromRemote(queryClient, user.id),
          ]);
          dispatchPlannerSyncFinished();
          void invalidateHabitScopeQueries(queryClient, user.id);
          void invalidateQuestAutocompleteQueries(queryClient, {
            userId: user.id,
            includeHabitsAll: true,
            includeHabitsDetail: true,
          });
          void invalidateCampaignContextQueryFamilies(
            queryClient,
            campaignContextQueryFamilyGroups.habitPlannerState,
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'habit_completions',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void invalidateHabitScopeQueries(queryClient, user.id, {
            includeCompletions: true,
          });
          void invalidateCampaignContextQueryFamilies(
            queryClient,
            campaignContextQueryFamilyGroups.habitCompletionState,
          );
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.warn('Habits realtime subscription error', { status, error: err?.message });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
};
