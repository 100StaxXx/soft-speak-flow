import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  rpc: vi.fn(),
  user: { id: "user-1" },
  session: { access_token: "access-token" },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mocks.user,
    session: mocks.session,
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

import { PromoCodeRedeemError, usePromoCode } from "./usePromoCode";

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
    mocks.user = { id: "user-1" };
    mocks.session = { access_token: "access-token" };
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
      headers: {
        Authorization: "Bearer access-token",
      },
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("maps Edge Function transport failures to a friendly retry message", async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: {
        name: "FunctionsFetchError",
        message: "Failed to send a request to the Edge Function",
      },
    });

    const { result } = renderHook(() => usePromoCode(), {
      wrapper: createWrapper(),
    });

    let thrown: unknown;

    await act(async () => {
      try {
        await result.current.redeemPromoCode.mutateAsync("bigfella2026");
      } catch (error) {
        thrown = error;
      }
    });

    expect(thrown).toBeInstanceOf(PromoCodeRedeemError);
    expect((thrown as PromoCodeRedeemError).message).toBe(
      "We couldn't reach the server to redeem your promo code. Check your connection and try again.",
    );
    expect((thrown as PromoCodeRedeemError).reason).toBe("unknown");
  });

  it("preserves backend promo failure reasons from function payloads", async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: {
        name: "FunctionsHttpError",
        message: "Edge Function returned a non-2xx status code",
        context: {
          json: async () => ({
            message: "This promo code has expired.",
            status: "expired",
          }),
        },
      },
    });

    const { result } = renderHook(() => usePromoCode(), {
      wrapper: createWrapper(),
    });

    let thrown: unknown;

    await act(async () => {
      try {
        await result.current.redeemPromoCode.mutateAsync("bigfella2026");
      } catch (error) {
        thrown = error;
      }
    });

    expect(thrown).toBeInstanceOf(PromoCodeRedeemError);
    expect((thrown as PromoCodeRedeemError).message).toBe("This promo code has expired.");
    expect((thrown as PromoCodeRedeemError).reason).toBe("expired");
  });
});
