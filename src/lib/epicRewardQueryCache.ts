import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

type EpicRewardQueryOptions = {
  userId?: string;
  includeAllRewards?: boolean;
  includeUserRewardsAll?: boolean;
  includeUserRewardsDetail?: boolean;
};

export const invalidateEpicRewardQueries = async (
  queryClient: QueryClient,
  {
    userId,
    includeAllRewards = false,
    includeUserRewardsAll = false,
    includeUserRewardsDetail = false,
  }: EpicRewardQueryOptions = {},
) => {
  await Promise.all([
    ...(includeAllRewards
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.epicRewards.all })]
      : []),
    ...(includeUserRewardsAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.epicRewards.userAll })]
      : []),
    ...(includeUserRewardsDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.epicRewards.user(userId) })]
      : []),
  ]);
};
