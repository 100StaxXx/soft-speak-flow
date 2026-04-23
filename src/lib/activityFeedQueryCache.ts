import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

type ActivityFeedQueryOptions = {
  userId?: string;
  includeAll?: boolean;
  includeDetail?: boolean;
};

export const invalidateActivityFeedQueries = async (
  queryClient: QueryClient,
  {
    userId,
    includeAll = false,
    includeDetail = false,
  }: ActivityFeedQueryOptions = {},
) => {
  await Promise.all([
    ...(includeAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.activityFeed.all })]
      : []),
    ...(includeDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.activityFeed.byUser(userId) })]
      : []),
  ]);
};
