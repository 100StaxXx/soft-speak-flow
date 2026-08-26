import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import {
  fetchDailyGuideThread,
  fetchPreviousDailyGuideThread,
  updateDailyGuideThread,
  type DailyGuideThreadPatch,
} from "@/services/dailyGuideThread";
import { getEffectiveDailyDate } from "@/utils/timezone";

export const DAILY_GUIDE_THREAD_QUERY_KEY = "daily-guide-thread";

export function useDailyGuideThread({ enabled = true }: { enabled?: boolean } = {}) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const date = useMemo(
    () => getEffectiveDailyDate(profile?.timezone ?? undefined),
    [profile?.timezone],
  );
  const queryKey = useMemo(
    () => [DAILY_GUIDE_THREAD_QUERY_KEY, user?.id ?? null, date] as const,
    [date, user?.id],
  );

  const query = useQuery({
    queryKey,
    enabled: enabled && Boolean(user?.id),
    staleTime: 30_000,
    queryFn: async () => {
      if (!user?.id) return { current: null, previous: null };
      const [current, previous] = await Promise.all([
        fetchDailyGuideThread(user.id, date),
        fetchPreviousDailyGuideThread(user.id, date),
      ]);
      return { current, previous };
    },
  });

  const mutation = useMutation({
    mutationFn: async (patch: DailyGuideThreadPatch) => {
      if (!user?.id) throw new Error("Not authenticated");
      return updateDailyGuideThread(user.id, date, patch);
    },
    onSuccess: (current) => {
      queryClient.setQueryData(queryKey, (existing: typeof query.data) => ({
        current,
        previous: existing?.previous ?? null,
      }));
    },
  });

  const mutateThread = mutation.mutateAsync;
  const updateThread = useCallback(
    (patch: DailyGuideThreadPatch) => mutateThread(patch),
    [mutateThread],
  );

  return {
    date,
    thread: query.data?.current ?? null,
    previousThread: query.data?.previous ?? null,
    isLoading: query.isLoading,
    isUpdating: mutation.isPending,
    updateThread,
    refetch: query.refetch,
  };
}
