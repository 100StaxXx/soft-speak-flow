/**
 * Realtime subscription for daily tasks
 * Enables instant cross-device synchronization for task completion
 */
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { logger } from "@/utils/logger";
import {
  dispatchPlannerSyncFinished,
  warmDailyTasksQueryFromRemote,
} from "@/utils/plannerSync";

export const useDailyTasksRealtime = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`daily-tasks-sync-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_tasks',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const taskDates = new Set<string>();
          const nextTaskDate = payload?.new && typeof payload.new === "object"
            ? (payload.new as Record<string, unknown>).task_date
            : null;
          const previousTaskDate = payload?.old && typeof payload.old === "object"
            ? (payload.old as Record<string, unknown>).task_date
            : null;

          if (typeof nextTaskDate === "string" && nextTaskDate.length > 0) {
            taskDates.add(nextTaskDate);
          }
          if (typeof previousTaskDate === "string" && previousTaskDate.length > 0) {
            taskDates.add(previousTaskDate);
          }

          await Promise.all(
            Array.from(taskDates).map((taskDate) =>
              warmDailyTasksQueryFromRemote(queryClient, user.id, taskDate).catch((error) => {
                logger.warn("Failed to warm daily tasks query from realtime update", {
                  taskDate,
                  error: error instanceof Error ? error.message : String(error),
                });
              }),
            ),
          );

          dispatchPlannerSyncFinished();
          queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
          queryClient.invalidateQueries({ queryKey: ['habit-surfacing'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subtasks',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          dispatchPlannerSyncFinished();
          queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.warn('Daily tasks realtime subscription error', { status, error: err?.message });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
};
