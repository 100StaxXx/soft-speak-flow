import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mocks.invoke(...args),
    },
    rpc: (...args: unknown[]) => mocks.rpc(...args),
  },
}));

import { usePromoCode } from "./usePromoCode";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("usePromoCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.invoke.mockResolvedValue({
      data: {
        success: true,
        status: "success",
        message: "ok",
        access_expires_at: null,
      },
      error: null,
    });
  });

  it("redeems promo codes through the edge function instead of direct RPC", async () => {
    const { result } = renderHook(() => usePromoCode(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.redeemPromoCode.mutateAsync("bigfella2026");
    });

    expect(mocks.invoke).toHaveBeenCalledWith("redeem-promo-code", {
      body: {
        promoCode: "BIGFELLA2026",
      },
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
