import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

type ProfileQueryOptions = {
  userId?: string;
  includeAll?: boolean;
  includeDetail?: boolean;
};

export const invalidateProfileQueries = async (
  queryClient: QueryClient,
  {
    userId,
    includeAll = false,
    includeDetail = false,
  }: ProfileQueryOptions = {},
) => {
  await Promise.all([
    ...(includeAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.profile.all })]
      : []),
    ...(includeDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.profile.detail(userId ?? "") })]
      : []),
  ]);
};

export const refetchProfileQueries = async (
  queryClient: QueryClient,
  {
    userId,
    includeAll = false,
    includeDetail = false,
  }: ProfileQueryOptions = {},
) => {
  await Promise.all([
    ...(includeAll
      ? [queryClient.refetchQueries({ queryKey: queryKeys.profile.all })]
      : []),
    ...(includeDetail
      ? [queryClient.refetchQueries({ queryKey: queryKeys.profile.detail(userId ?? "") })]
      : []),
  ]);
};

export const setProfileDetailQueryData = <T>(
  queryClient: QueryClient,
  userId: string | undefined,
  updater: (current: T | undefined) => T | undefined,
) => {
  queryClient.setQueryData<T>(queryKeys.profile.detail(userId ?? ""), updater);
};
