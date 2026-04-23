import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { invalidateActivityFeedQueries } from "@/lib/activityFeedQueryCache";
import { queryKeys } from "@/lib/queryKeys";

describe("activityFeedQueryCache", () => {
  it("invalidates both activity feed roots when requested", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateActivityFeedQueries(queryClient, {
      userId: "user-1",
      includeAll: true,
      includeDetail: true,
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(2);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.activityFeed.all,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.activityFeed.byUser("user-1"),
    });
  });
});
