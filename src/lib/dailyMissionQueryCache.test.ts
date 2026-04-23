import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { invalidateDailyMissionQueries } from "@/lib/dailyMissionQueryCache";
import { queryKeys } from "@/lib/queryKeys";

describe("dailyMissionQueryCache", () => {
  it("invalidates daily mission and pulse roots through the helper", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateDailyMissionQueries(queryClient, {
      includeMissionsAll: true,
      includePulseAll: true,
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(2);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.dailyMissions.all,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.dailyMissionPulse.all,
    });
  });

  it("supports targeted daily mission and morning briefing invalidation", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateDailyMissionQueries(queryClient, {
      missionDate: "2026-04-23",
      userId: "user-1",
      includeMissionsByDate: true,
      includeMorningBriefingByDate: true,
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(2);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.dailyMissions.byDate("2026-04-23", "user-1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.morningBriefing.byDate("2026-04-23", "user-1"),
    });
  });
});
