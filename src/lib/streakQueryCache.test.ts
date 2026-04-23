import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { queryKeys } from "@/lib/queryKeys";
import { invalidateStreakQueries } from "@/lib/streakQueryCache";

describe("streakQueryCache", () => {
  it("invalidates streak-at-risk queries through the helper", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateStreakQueries(queryClient, {
      userId: "user-1",
      includeAtRiskAll: true,
      includeAtRiskDetail: true,
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(2);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.streaks.atRiskAll,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.streaks.atRisk("user-1"),
    });
  });
});
