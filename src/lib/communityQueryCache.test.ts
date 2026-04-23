import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { invalidateCommunityQueries } from "@/lib/communityQueryCache";
import { queryKeys } from "@/lib/queryKeys";

describe("communityQueryCache", () => {
  it("invalidates broad community roots through the shared helper", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateCommunityQueries(queryClient, {
      includeCommunitiesAll: true,
      includeMembersAll: true,
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(2);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.communities.all,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.community.membersAll,
    });
  });

  it("supports targeted community detail invalidation", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateCommunityQueries(queryClient, {
      communityId: "community-1",
      includeCommunityDetail: true,
      includeMembersDetail: true,
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(2);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.community.detail("community-1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.community.members("community-1"),
    });
  });
});
