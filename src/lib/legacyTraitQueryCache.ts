import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

type LegacyTraitQueryOptions = {
  userId?: string;
  includeCurrentAll?: boolean;
  includeCurrentDetail?: boolean;
  includeInheritableAll?: boolean;
  includeInheritableDetail?: boolean;
};

export const invalidateLegacyTraitQueries = async (
  queryClient: QueryClient,
  {
    userId,
    includeCurrentAll = false,
    includeCurrentDetail = false,
    includeInheritableAll = false,
    includeInheritableDetail = false,
  }: LegacyTraitQueryOptions = {},
) => {
  await Promise.all([
    ...(includeCurrentAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.legacyTraits.currentAll })]
      : []),
    ...(includeCurrentDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.legacyTraits.current(userId) })]
      : []),
    ...(includeInheritableAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.legacyTraits.inheritableAll })]
      : []),
    ...(includeInheritableDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.legacyTraits.inheritable(userId) })]
      : []),
  ]);
};
