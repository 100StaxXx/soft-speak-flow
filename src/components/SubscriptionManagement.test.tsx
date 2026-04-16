import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SubscriptionManagement } from "./SubscriptionManagement";

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({
    subscription: null,
    isLoading: false,
    isActive: false,
    nextBillingDate: null,
    planPrice: null,
    plan: null,
    isCancelled: false,
  }),
}));

const appleSubscriptionMocks = vi.hoisted(() => ({
  handlePurchase: vi.fn(),
  handleRestore: vi.fn(),
  handleManageSubscriptions: vi.fn(),
  reloadProducts: vi.fn(),
}));

vi.mock("@/hooks/useAppleSubscription", () => ({
  useAppleSubscription: () => ({
    handlePurchase: appleSubscriptionMocks.handlePurchase,
    handleRestore: appleSubscriptionMocks.handleRestore,
    handleManageSubscriptions: appleSubscriptionMocks.handleManageSubscriptions,
    loading: false,
    manageLoading: false,
    isAvailable: true,
    products: [],
    productsLoading: false,
    productError: null,
    reloadProducts: appleSubscriptionMocks.reloadProducts,
  }),
}));

describe("SubscriptionManagement", () => {
  it("keeps the unlock CTA enabled on native iOS when products have not loaded", () => {
    render(<SubscriptionManagement />);

    expect(screen.getByRole("button", { name: /unlock with yearly/i })).toBeEnabled();
  });
});
