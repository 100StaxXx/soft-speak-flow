import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

type MorningCheckInQueryOptions = {
  date?: string;
  userId?: string;
  includeAll?: boolean;
  includeByDate?: boolean;
  includeLatestAll?: boolean;
  includeLatestDetail?: boolean;
};

type EveningReflectionQueryOptions = {
  date?: string;
  userId?: string;
  includeAll?: boolean;
  includeDetail?: boolean;
};

export const invalidateMorningCheckInQueries = async (
  queryClient: QueryClient,
  {
    date,
    userId,
    includeAll = false,
    includeByDate = false,
    includeLatestAll = false,
    includeLatestDetail = false,
  }: MorningCheckInQueryOptions = {},
) => {
  await Promise.all([
    ...(includeAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.checkIns.morningAll })]
      : []),
    ...(includeByDate && date
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.checkIns.morningByDate(date, userId) })]
      : []),
    ...(includeLatestAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.checkIns.morningLatestAll })]
      : []),
    ...(includeLatestDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.checkIns.morningLatest(userId) })]
      : []),
  ]);
};

export const invalidateEveningReflectionQueries = async (
  queryClient: QueryClient,
  {
    date,
    userId,
    includeAll = false,
    includeDetail = false,
  }: EveningReflectionQueryOptions = {},
) => {
  await Promise.all([
    ...(includeAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.checkIns.eveningAll })]
      : []),
    ...(includeDetail && date
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.checkIns.evening(userId, date) })]
      : []),
  ]);
};
