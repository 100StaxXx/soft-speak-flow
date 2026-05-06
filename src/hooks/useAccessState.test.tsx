import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: {
    user: { id: "user-1" } as { id: string } | null,
    loading: false,
  },
  storeKit: {
    isPro: false,
    activePlan: null as "monthly" | "yearly" | null,
    currentEntitlement: null as { productId: string; expirationDate?: string } | null,
    isLoading: false,
  },
  query: {
    data: undefined as unknown,
    isLoading: false,
    isError: false,
    error: null as Error | null,
    refetch: vi.fn(),
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => mocks.query,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

vi.mock("./useAuth", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("./useStoreKit", () => ({
  useStoreKit: () => mocks.storeKit,
}));

import { useAccessState } from "./useAccessState";

describe("useAccessState", () => {
  beforeEach(() => {
    mocks.auth = {
      user: { id: "user-1" },
      loading: false,
    };
    mocks.storeKit = {
      isPro: false,
      activePlan: null,
      currentEntitlement: null,
      isLoading: false,
    };
    mocks.query = {
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
  });

  it("keeps the server response authoritative when it cleanly denies access", () => {
    mocks.query.data = {
      has_access: false,
      access_source: "none",
      trial_ends_at: null,
      subscribed: false,
    };
    mocks.storeKit = {
      isPro: true,
      activePlan: "yearly",
      currentEntitlement: {
        productId: "cosmiq_premium_yearly",
        expirationDate: "2999-01-01T00:00:00.000Z",
      },
      isLoading: false,
    };

    const { result } = renderHook(() => useAccessState());

    expect(result.current.accessState.has_access).toBe(false);
    expect(result.current.accessState.access_source).toBe("none");
  });

  it("uses StoreKit as an outage fallback when the entitlement check errors", () => {
    mocks.query.isError = true;
    mocks.query.error = new Error("check failed");
    mocks.storeKit = {
      isPro: true,
      activePlan: "monthly",
      currentEntitlement: {
        productId: "cosmiq_premium_monthly",
        expirationDate: "2999-01-01T00:00:00.000Z",
      },
      isLoading: false,
    };

    const { result } = renderHook(() => useAccessState());

    expect(result.current.accessState.has_access).toBe(true);
    expect(result.current.accessState.access_source).toBe("subscription");
    expect(result.current.accessState.plan).toBe("monthly");
  });
});
