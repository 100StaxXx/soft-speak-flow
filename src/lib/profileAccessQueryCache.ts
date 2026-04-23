import type { QueryClient } from "@tanstack/react-query";

import {
  invalidateProfileQueries,
} from "@/lib/profileQueryCache";
import { queryKeys } from "@/lib/queryKeys";

type ProfileAccessQueryOptions = {
  userId?: string;
  includeProfileAll?: boolean;
  includeProfileDetail?: boolean;
  includeSubscriptionAll?: boolean;
  includeSubscriptionDetail?: boolean;
  includeReferralStatsAll?: boolean;
  includeReferralStatsDetail?: boolean;
  includeAppliedReferralCodeStateAll?: boolean;
  includeAppliedReferralCodeStateDetail?: boolean;
  includeUnlockedSkinsAll?: boolean;
  includeUnlockedSkinsDetail?: boolean;
  includeAvailableSkins?: boolean;
};

export const invalidateProfileAccessQueries = async (
  queryClient: QueryClient,
  {
    userId,
    includeProfileAll = false,
    includeProfileDetail = false,
    includeSubscriptionAll = false,
    includeSubscriptionDetail = false,
    includeReferralStatsAll = false,
    includeReferralStatsDetail = false,
    includeAppliedReferralCodeStateAll = false,
    includeAppliedReferralCodeStateDetail = false,
    includeUnlockedSkinsAll = false,
    includeUnlockedSkinsDetail = false,
    includeAvailableSkins = false,
  }: ProfileAccessQueryOptions = {},
) => {
  await Promise.all([
    invalidateProfileQueries(queryClient, {
      userId,
      includeAll: includeProfileAll,
      includeDetail: includeProfileDetail,
    }),
    ...(includeSubscriptionAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.subscription.all })]
      : []),
    ...(includeSubscriptionDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.subscription.detail(userId ?? "") })]
      : []),
    ...(includeReferralStatsAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.referrals.statsAll })]
      : []),
    ...(includeReferralStatsDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.referrals.stats(userId) })]
      : []),
    ...(includeAppliedReferralCodeStateAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.referrals.appliedCodeStateAll })]
      : []),
    ...(includeAppliedReferralCodeStateDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.referrals.appliedCodeState(userId) })]
      : []),
    ...(includeUnlockedSkinsAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.referrals.unlockedSkinsAll })]
      : []),
    ...(includeUnlockedSkinsDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.referrals.unlockedSkins(userId) })]
      : []),
    ...(includeAvailableSkins
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.referrals.availableSkins() })]
      : []),
  ]);
};
