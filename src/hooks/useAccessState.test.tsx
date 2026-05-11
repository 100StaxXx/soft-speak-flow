import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: "11111111-1111-4111-8111-111111111111" } as { id: string } | null,
  authLoading: false,
  functionsInvoke: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mocks.user,
    loading: mocks.authLoading,
  }),
}));

vi.mock("@/hooks/useStoreKit", () => ({
  useStoreKit: () => ({
    isPro: true,
    activePlan: "yearly",
    currentEntitlement: {
      productId: "cosmiq_premium_yearly",
      expirationDate: "2099-01-01T00:00:00.000Z",
      transactionId: "local-tx",
      appAccountToken: "11111111-1111-4111-8111-111111111111",
    },
    isLoading: false,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mocks.functionsInvoke(...args),
    },
  },
}));

import { useAccessState } from "./useAccessState";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return Wrapper;
};

describe("useAccessState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { id: "11111111-1111-4111-8111-111111111111" };
    mocks.authLoading = false;
    mocks.functionsInvoke.mockResolvedValue({
      data: {
        has_access: false,
        access_source: "none",
        trial_ends_at: null,
        subscribed: false,
      },
      error: null,
    });
  });

  it("does not grant access from local StoreKit entitlement without backend access", async () => {
    const { result } = renderHook(() => useAccessState(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.accessState).toMatchObject({
      has_access: false,
      access_source: "none",
      subscribed: false,
    });
    expect(mocks.functionsInvoke).toHaveBeenCalledWith("check-apple-subscription");
  });
});
