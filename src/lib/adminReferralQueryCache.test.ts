import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { invalidateAdminReferralQueries } from "@/lib/adminReferralQueryCache";
import { queryKeys } from "@/lib/queryKeys";

describe("adminReferralQueryCache", () => {
  it("invalidates admin referral dashboard queries through the helper", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateAdminReferralQueries(queryClient, {
      includeConfig: true,
      includeCodes: true,
      includePayouts: true,
      includeAnalytics: true,
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(4);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.adminReferral.configAll,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.adminReferral.codesAll,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.adminReferral.payoutsAll,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.adminReferral.analyticsAll,
    });
  });
});
