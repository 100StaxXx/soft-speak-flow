import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import {
  campaignContextQueryFamilyGroups,
  campaignContextQueryFamilies,
  invalidateHabitScopeQueries,
  invalidateCampaignContextQueryFamilies,
} from "@/lib/campaignContextQueryCache";
import { queryKeys } from "@/lib/queryKeys";

describe("campaignContextQueryCache", () => {
  it("invalidates grouped campaign context families through the shared helper", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();

    await invalidateCampaignContextQueryFamilies(
      queryClient,
      campaignContextQueryFamilyGroups.campaignPlanner,
    );

    expect(invalidateSpy).toHaveBeenCalledTimes(
      campaignContextQueryFamilyGroups.campaignPlanner.length,
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: campaignContextQueryFamilies.epics,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: campaignContextQueryFamilies.habits,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: campaignContextQueryFamilies.habitSurfacing,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: campaignContextQueryFamilies.userAiContext,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: campaignContextQueryFamilies.epicProgress,
    });
  });

  it("supports targeted invalidation for single-family refreshes", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();

    await invalidateCampaignContextQueryFamilies(queryClient, ["habitCompletions"]);

    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: campaignContextQueryFamilies.habitCompletions,
    });
  });

  it("invalidates scoped habit queries for a specific user", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();

    await invalidateHabitScopeQueries(queryClient, "user-123", {
      includeCompletions: true,
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(2);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.habits.byUser("user-123"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.habits.completions("user-123"),
    });
  });
});
