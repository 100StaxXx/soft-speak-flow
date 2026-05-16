import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  handlePresentRevenueCatPaywall: vi.fn(),
  reloadProducts: vi.fn(),
  hasOfferCode: false,
  activeYearlyOffer: null as null | { tier: string; price: string; priceCents: number; unitPrice: string },
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
    hasOfferCode: appleSubscriptionMocks.hasOfferCode,
    activeYearlyOffer: appleSubscriptionMocks.activeYearlyOffer,
    handlePresentRevenueCatPaywall: appleSubscriptionMocks.handlePresentRevenueCatPaywall,
  }),
}));

describe("SubscriptionManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appleSubscriptionMocks.hasOfferCode = false;
    appleSubscriptionMocks.activeYearlyOffer = null;
  });

  it("shows concrete subscription benefits while keeping the unlock CTA enabled on native iOS", () => {
    render(<SubscriptionManagement />);

    expect(screen.getByText("Unlock unlimited companion chat, quests, and offline access")).toBeInTheDocument();
    expect(screen.getByText("Unlimited companion chat")).toBeInTheDocument();
    expect(screen.getByText("100+ levels and 12+ evolutions")).toBeInTheDocument();
    expect(screen.getByText("Unlimited Quests & Epics")).toBeInTheDocument();
    expect(screen.getByText("Offline access to downloaded content")).toBeInTheDocument();
    expect(
      screen.getByText("Both monthly and yearly plans include the same Cosmiq features and renew automatically until canceled."),
    ).toBeInTheDocument();
    expect(screen.getByText("Cosmiq Pro Monthly")).toBeInTheDocument();
    expect(screen.getAllByText("Cosmiq Pro Yearly").length).toBeGreaterThan(0);
    expect(screen.getByText("Length: 1 year")).toBeInTheDocument();
    expect(screen.getByText("$8.33/month when billed yearly")).toBeInTheDocument();
    expect(
      screen.getByText(/Subscriptions renew automatically unless canceled at least 24 hours before the end/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Terms of Use" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "EULA" })).toHaveAttribute(
      "href",
      "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/",
    );
    expect(screen.getByRole("button", { name: /unlock with yearly/i })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "View All Plans" })).not.toBeInTheDocument();
  });

  it("hides the RevenueCat paywall bypass when a creator Apple offer code is active", () => {
    appleSubscriptionMocks.hasOfferCode = true;

    render(<SubscriptionManagement />);

    expect(screen.getByText("$69.99")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /unlock with yearly/i })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "View All Plans" })).not.toBeInTheDocument();
  });

  it("shows Genesis pricing when the active Apple offer tier is Genesis", () => {
    appleSubscriptionMocks.hasOfferCode = true;
    appleSubscriptionMocks.activeYearlyOffer = {
      tier: "genesis",
      price: "$49.99",
      priceCents: 4999,
      unitPrice: "$4.17/month for the first year",
    };

    render(<SubscriptionManagement />);

    expect(screen.getByText("$49.99")).toBeInTheDocument();
    expect(screen.getByText("$4.17/month for the first year")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View All Plans" })).not.toBeInTheDocument();
  });
});
