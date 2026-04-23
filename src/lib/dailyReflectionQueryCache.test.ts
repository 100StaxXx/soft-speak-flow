import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import {
  invalidateEveningReflectionQueries,
  invalidateMorningCheckInQueries,
} from "@/lib/dailyReflectionQueryCache";
import { queryKeys } from "@/lib/queryKeys";

describe("dailyReflectionQueryCache", () => {
  it("invalidates morning check-in roots and scoped detail through the helper", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateMorningCheckInQueries(queryClient, {
      date: "2026-04-23",
      userId: "user-1",
      includeAll: true,
      includeByDate: true,
      includeLatestAll: true,
      includeLatestDetail: true,
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(4);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.checkIns.morningAll,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.checkIns.morningByDate("2026-04-23", "user-1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.checkIns.morningLatestAll,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.checkIns.morningLatest("user-1"),
    });
  });

  it("invalidates evening reflection roots and scoped detail through the helper", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateEveningReflectionQueries(queryClient, {
      date: "2026-04-23",
      userId: "user-1",
      includeAll: true,
      includeDetail: true,
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(2);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.checkIns.eveningAll,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.checkIns.evening("user-1", "2026-04-23"),
    });
  });
});
