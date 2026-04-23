import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { queryKeys } from "@/lib/queryKeys";
import { invalidateWeeklyRecapQueries } from "@/lib/weeklyRecapQueryCache";

describe("weeklyRecapQueryCache", () => {
  it("invalidates current and history recap caches through the helper", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateWeeklyRecapQueries(queryClient, {
      userId: "user-1",
      weekStart: "2026-04-13",
      includeCurrentAll: true,
      includeCurrentDetail: true,
      includeHistoryAll: true,
      includeHistoryDetail: true,
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(4);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.weeklyRecaps.currentAll,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.weeklyRecaps.current("user-1", "2026-04-13"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.weeklyRecaps.historyAll,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.weeklyRecaps.history("user-1"),
    });
  });
});
