import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

type AdminReferralQueryOptions = {
  includeConfig?: boolean;
  includeCodes?: boolean;
  includePayouts?: boolean;
  includeAnalytics?: boolean;
};

export const invalidateAdminReferralQueries = async (
  queryClient: QueryClient,
  {
    includeConfig = false,
    includeCodes = false,
    includePayouts = false,
    includeAnalytics = false,
  }: AdminReferralQueryOptions = {},
) => {
  await Promise.all([
    ...(includeConfig
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.adminReferral.configAll })]
      : []),
    ...(includeCodes
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.adminReferral.codesAll })]
      : []),
    ...(includePayouts
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.adminReferral.payoutsAll })]
      : []),
    ...(includeAnalytics
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.adminReferral.analyticsAll })]
      : []),
  ]);
};
