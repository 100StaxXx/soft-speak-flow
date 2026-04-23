import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

type WeeklyRecapQueryOptions = {
  userId?: string;
  weekStart?: string;
  includeCurrentAll?: boolean;
  includeCurrentDetail?: boolean;
  includeHistoryAll?: boolean;
  includeHistoryDetail?: boolean;
};

export const invalidateWeeklyRecapQueries = async (
  queryClient: QueryClient,
  {
    userId,
    weekStart,
    includeCurrentAll = false,
    includeCurrentDetail = false,
    includeHistoryAll = false,
    includeHistoryDetail = false,
  }: WeeklyRecapQueryOptions = {},
) => {
  await Promise.all([
    ...(includeCurrentAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.weeklyRecaps.currentAll })]
      : []),
    ...(includeCurrentDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.weeklyRecaps.current(userId, weekStart ?? "") })]
      : []),
    ...(includeHistoryAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.weeklyRecaps.historyAll })]
      : []),
    ...(includeHistoryDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.weeklyRecaps.history(userId) })]
      : []),
  ]);
};
