import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import {
  invalidateProfileQueries,
  refetchProfileQueries,
  setProfileDetailQueryData,
} from "@/lib/profileQueryCache";
import { queryKeys } from "@/lib/queryKeys";

describe("profileQueryCache", () => {
  it("invalidates the requested profile query scopes", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateProfileQueries(queryClient, {
      userId: "user-123",
      includeAll: true,
      includeDetail: true,
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(2);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.profile.all,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.profile.detail("user-123"),
    });
  });

  it("refetches the requested profile query scopes", async () => {
    const queryClient = new QueryClient();
    const refetchSpy = vi.spyOn(queryClient, "refetchQueries").mockResolvedValue();

    await refetchProfileQueries(queryClient, {
      userId: "user-123",
      includeDetail: true,
    });

    expect(refetchSpy).toHaveBeenCalledTimes(1);
    expect(refetchSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.profile.detail("user-123"),
    });
  });

  it("updates the cached profile detail query data", () => {
    const queryClient = new QueryClient();
    const queryKey = queryKeys.profile.detail("user-123");

    queryClient.setQueryData(queryKey, {
      id: "user-123",
      daily_push_enabled: false,
    });

    setProfileDetailQueryData<{ id: string; daily_push_enabled: boolean }>(
      queryClient,
      "user-123",
      (current) => current ? { ...current, daily_push_enabled: true } : current,
    );

    expect(queryClient.getQueryData(queryKey)).toEqual({
      id: "user-123",
      daily_push_enabled: true,
    });
  });
});
