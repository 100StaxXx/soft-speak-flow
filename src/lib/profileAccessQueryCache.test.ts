import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { invalidateProfileAccessQueries } from "@/lib/profileAccessQueryCache";
import { queryKeys } from "@/lib/queryKeys";

describe("profileAccessQueryCache", () => {
  it("invalidates the scoped profile and referral-access queries", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateProfileAccessQueries(queryClient, {
      userId: "user-123",
      includeProfileDetail: true,
      includeReferralStatsDetail: true,
      includeAppliedReferralCodeStateDetail: true,
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(3);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.profile.detail("user-123"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.referrals.stats("user-123"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.referrals.appliedCodeState("user-123"),
    });
  });

  it("can invalidate the broad profile and referral-access families", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateProfileAccessQueries(queryClient, {
      includeProfileAll: true,
      includeSubscriptionAll: true,
      includeReferralStatsAll: true,
      includeAppliedReferralCodeStateAll: true,
      includeUnlockedSkinsAll: true,
      includeAvailableSkins: true,
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(6);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.profile.all,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.subscription.all,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.referrals.statsAll,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.referrals.appliedCodeStateAll,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.referrals.unlockedSkinsAll,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.referrals.availableSkins(),
    });
  });
});
