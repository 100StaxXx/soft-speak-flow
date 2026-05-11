import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useTasksQuery, type DailyTask } from "@/hooks/useTasksQuery";
import { supabase } from "@/integrations/supabase/client";
import { setAppBadgeCount } from "@/utils/appBadge";
import { PLANNER_SYNC_EVENT } from "@/utils/plannerSync";
import { getEffectiveMissionDate } from "@/utils/timezone";

type BadgeTask = Pick<DailyTask, "completed">;

export const REMAINING_TODAY_BADGE_COUNT_QUERY_KEY = "remaining-today-badge-count";

export const getRemainingTodayBadgeCountQueryKey = (userId: string | undefined) =>
  [REMAINING_TODAY_BADGE_COUNT_QUERY_KEY, userId ?? "anonymous"] as const;

export function normalizeRemainingTodayBadgeCount(value: unknown): number {
  const count = Number(value ?? 0);
  return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
}

export function getRemainingDailyTaskBadgeCount(tasks: readonly BadgeTask[]): number {
  return tasks.filter((task) => task.completed !== true).length;
}

export function shouldSyncRemainingTodayBadge(input: {
  enabled: boolean;
  hasCanonicalCount: boolean;
  isLoading: boolean;
}): boolean {
  return input.enabled && input.hasCanonicalCount && !input.isLoading;
}

export async function fetchRemainingTodayBadgeCount(userId: string): Promise<number> {
  const { data, error } = await supabase.rpc("get_remaining_today_badge_count", {
    p_user_id: userId,
  });

  if (error) throw error;
  return normalizeRemainingTodayBadgeCount(data);
}

export function useRemainingTodayBadgeCount(options: { enabled?: boolean } = {}) {
  const { user, status } = useAuth();
  const { profile } = useProfile();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const enabled = options.enabled !== false && status === "authenticated" && Boolean(userId);
  const effectiveTaskDate = getEffectiveMissionDate(profile?.timezone ?? undefined);
  const fallbackTaskDate = useMemo(
    () => new Date(`${effectiveTaskDate}T12:00:00`),
    [effectiveTaskDate],
  );
  const { tasks, isLoading: isLoadingTasks } = useTasksQuery(fallbackTaskDate, { enabled });
  const localRemainingCount = useMemo(
    () => getRemainingDailyTaskBadgeCount(tasks),
    [tasks],
  );
  const taskFingerprint = useMemo(
    () => tasks.map((task) => `${task.id}:${task.completed === true ? "1" : "0"}`).join("|"),
    [tasks],
  );

  const countQuery = useQuery({
    queryKey: getRemainingTodayBadgeCountQueryKey(userId),
    enabled,
    queryFn: () => fetchRemainingTodayBadgeCount(userId!),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!enabled) return undefined;

    const invalidateRemainingCount = () => {
      void queryClient.invalidateQueries({
        queryKey: getRemainingTodayBadgeCountQueryKey(userId),
      });
    };

    window.addEventListener(PLANNER_SYNC_EVENT, invalidateRemainingCount);
    return () => window.removeEventListener(PLANNER_SYNC_EVENT, invalidateRemainingCount);
  }, [enabled, queryClient, userId]);

  useEffect(() => {
    if (!enabled || isLoadingTasks) return;

    void queryClient.invalidateQueries({
      queryKey: getRemainingTodayBadgeCountQueryKey(userId),
    });
  }, [enabled, isLoadingTasks, queryClient, taskFingerprint, userId]);

  return {
    count: countQuery.data ?? localRemainingCount,
    hasCanonicalCount: countQuery.isSuccess,
    isLoading: countQuery.isLoading,
    isError: countQuery.isError,
    refetch: countQuery.refetch,
  };
}

export function useDailyTaskBadgeSync(options: { enabled?: boolean } = {}): void {
  const { status } = useAuth();
  const { count, hasCanonicalCount, isLoading } = useRemainingTodayBadgeCount(options);
  const shouldSync = options.enabled !== false && status === "authenticated";

  useEffect(() => {
    if (status === "unauthenticated") {
      void setAppBadgeCount(0);
    }
  }, [status]);

  useEffect(() => {
    if (!shouldSyncRemainingTodayBadge({
      enabled: shouldSync,
      hasCanonicalCount,
      isLoading,
    })) {
      return;
    }

    void setAppBadgeCount(count);
  }, [count, hasCanonicalCount, isLoading, shouldSync]);
}
