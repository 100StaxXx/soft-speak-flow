import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

type StreakQueryOptions = {
  userId?: string;
  includeAtRiskAll?: boolean;
  includeAtRiskDetail?: boolean;
};

export const invalidateStreakQueries = async (
  queryClient: QueryClient,
  {
    userId,
    includeAtRiskAll = false,
    includeAtRiskDetail = false,
  }: StreakQueryOptions = {},
) => {
  await Promise.all([
    ...(includeAtRiskAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.streaks.atRiskAll })]
      : []),
    ...(includeAtRiskDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.streaks.atRisk(userId) })]
      : []),
  ]);
};
