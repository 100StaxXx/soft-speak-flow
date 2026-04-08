import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/queryKeys";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  invalidateQueries: vi.fn(),
  invoke: vi.fn(),
  purchaseProduct: vi.fn(),
  restorePurchases: vi.fn(),
  getProducts: vi.fn(),
  openManageSubscriptions: vi.fn(),
  user: { id: "11111111-1111-4111-8111-111111111111" },
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mocks.invalidateQueries,
    }),
  };
});

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mocks.toast,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mocks.user,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mocks.invoke(...args),
    },
  },
}));

vi.mock("@/utils/appleIAP", () => ({
  IAP_PRODUCTS: {
    MONTHLY: "cosmiq_premium_monthly",
    YEARLY: "cosmiq_premium_yearly",
  },
  purchaseProduct: (...args: unknown[]) => mocks.purchaseProduct(...args),
  restorePurchases: (...args: unknown[]) => mocks.restorePurchases(...args),
  isIAPAvailable: () => true,
  getProducts: (...args: unknown[]) => mocks.getProducts(...args),
  openManageSubscriptions: (...args: unknown[]) => mocks.openManageSubscriptions(...args),
  getAllIAPProductIds: () => ["cosmiq_premium_monthly", "cosmiq_premium_yearly"],
  getProductIdsForPlan: (plan: "monthly" | "yearly") =>
    plan === "monthly" ? ["cosmiq_premium_monthly"] : ["cosmiq_premium_yearly"],
  resolvePlanFromProductId: (productId: string | null | undefined) => {
    if (productId === "cosmiq_premium_yearly") return "yearly";
    if (productId === "cosmiq_premium_monthly") return "monthly";
    return null;
  },
}));

import { useAppleSubscription } from "./useAppleSubscription";

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

const mockProduct = {
  identifier: "cosmiq_premium_monthly",
  title: "Monthly",
  description: "Monthly subscription",
  price: 9.99,
  priceString: "$9.99",
  currencyCode: "USD",
};

describe("useAppleSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { id: "11111111-1111-4111-8111-111111111111" };
    mocks.getProducts.mockResolvedValue([mockProduct]);
    mocks.purchaseProduct.mockResolvedValue({
      transactionId: "tx-1",
      receipt: null,
    });
    mocks.restorePurchases.mockResolvedValue([
      {
        transactionId: "tx-restore-1",
        productId: "cosmiq_premium_monthly",
      },
    ]);
    mocks.invoke.mockResolvedValue({
      data: {
        success: true,
      },
      error: null,
    });
    mocks.invalidateQueries.mockResolvedValue(undefined);
  });

  it("maps Apple provider failures to the generic subscription unavailable copy during purchase", async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: {
        name: "FunctionsHttpError",
        message: "Edge Function returned a non-2xx status code",
        context: new Response(
          JSON.stringify({
            error: "Subscription verification is temporarily unavailable. Please try again later.",
            code: "APPLE_API_AUTH_FAILED",
            upstream_status: 401,
            upstream_error: "Apple API error: 401 - unauthorized",
          }),
          {
            status: 502,
            headers: { "Content-Type": "application/json" },
          },
        ),
      },
    });

    const { result } = renderHook(() => useAppleSubscription(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.handlePurchase("cosmiq_premium_monthly");
    });

    expect(mocks.toast).toHaveBeenCalledWith({
      title: "Purchase Failed",
      description: "Premium subscriptions are temporarily unavailable. Please try again later.",
      variant: "destructive",
    });
  });

  it("refreshes the access-state query after a successful purchase", async () => {
    const { result } = renderHook(() => useAppleSubscription(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.handlePurchase("cosmiq_premium_monthly");
    });

    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.access.detail("11111111-1111-4111-8111-111111111111"),
    });
    expect(mocks.invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: queryKeys.subscription.all,
    });
  });

  it("preserves actionable Apple binding errors during purchase", async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: {
        name: "FunctionsHttpError",
        message: "Edge Function returned a non-2xx status code",
        context: new Response(
          JSON.stringify({
            error: "This purchase is already linked to another account.",
            code: "APPLE_BINDING_CONFLICT",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          },
        ),
      },
    });

    const { result } = renderHook(() => useAppleSubscription(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.handlePurchase("cosmiq_premium_monthly");
    });

    expect(mocks.toast).toHaveBeenCalledWith({
      title: "Purchase Failed",
      description: "This purchase is already linked to another account.",
      variant: "destructive",
    });
  });

  it("sanitizes provider failures during restore", async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: {
        name: "FunctionsHttpError",
        message: "Edge Function returned a non-2xx status code",
        context: new Response(
          JSON.stringify({
            error: "Subscription verification is temporarily unavailable. Please try again later.",
            code: "APPLE_API_CONFIG_MISSING",
            upstream_error:
              "Missing Apple API configuration: APPLE_KEY_ID, APPLE_ISSUER_ID, APPLE_PRIVATE_KEY, or APPLE_IOS_BUNDLE_ID",
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        ),
      },
    });

    const { result } = renderHook(() => useAppleSubscription(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.handleRestore();
    });

    expect(mocks.toast).toHaveBeenCalledWith({
      title: "Restore Failed",
      description: "Premium subscriptions are temporarily unavailable. Please try again later.",
      variant: "destructive",
    });
  });

  it("refreshes the access-state query after a successful restore", async () => {
    const { result } = renderHook(() => useAppleSubscription(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.handleRestore();
    });

    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.access.detail("11111111-1111-4111-8111-111111111111"),
    });
    expect(mocks.invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: queryKeys.subscription.all,
    });
  });
});
