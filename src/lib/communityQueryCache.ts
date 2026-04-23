import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

type CommunityQueryOptions = {
  communityId?: string;
  includeCommunitiesAll?: boolean;
  includeCommunityDetail?: boolean;
  includeMembersAll?: boolean;
  includeMembersDetail?: boolean;
};

export const invalidateCommunityQueries = async (
  queryClient: QueryClient,
  {
    communityId,
    includeCommunitiesAll = false,
    includeCommunityDetail = false,
    includeMembersAll = false,
    includeMembersDetail = false,
  }: CommunityQueryOptions = {},
) => {
  await Promise.all([
    ...(includeCommunitiesAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.communities.all })]
      : []),
    ...(includeCommunityDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.community.detail(communityId) })]
      : []),
    ...(includeMembersAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.community.membersAll })]
      : []),
    ...(includeMembersDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.community.members(communityId) })]
      : []),
  ]);
};
