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
  it("shows concrete subscription benefits while keeping the unlock CTA enabled on native iOS", () => {
    render(<SubscriptionManagement />);

    expect(screen.getByText("Unlock unlimited guide chat, quests, and offline access")).toBeInTheDocument();
    expect(screen.getByText("Unlimited guide chat")).toBeInTheDocument();
    expect(screen.getByText("All 15 evolution stages")).toBeInTheDocument();
    expect(screen.getByText("Unlimited Quests & Epics")).toBeInTheDocument();
    expect(screen.getByText("Offline access to downloaded content")).toBeInTheDocument();
    expect(
      screen.getByText("Both monthly and yearly plans include the same Cosmiq Pro features and renew automatically until canceled."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /unlock with yearly/i })).toBeEnabled();
  });
});
