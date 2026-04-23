import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { invalidateEpicRewardQueries } from "@/lib/epicRewardQueryCache";
import { queryKeys } from "@/lib/queryKeys";

describe("epicRewardQueryCache", () => {
  it("invalidates global and user reward caches through the helper", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateEpicRewardQueries(queryClient, {
      userId: "user-1",
      includeAllRewards: true,
      includeUserRewardsAll: true,
      includeUserRewardsDetail: true,
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(3);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.epicRewards.all,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.epicRewards.userAll,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.epicRewards.user("user-1"),
    });
  });
});
