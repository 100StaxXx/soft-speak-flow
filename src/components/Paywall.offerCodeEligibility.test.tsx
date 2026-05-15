import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appleSubscription: {
    handlePurchase: vi.fn(),
    handleRestore: vi.fn(),
    loading: false,
    isAvailable: true,
    products: [],
    productsLoading: false,
    productError: null,
    reloadProducts: vi.fn(),
    hasOfferCode: false,
    hasAppliedReferralCode: false,
    appliedReferralCode: null as string | null,
    offerCodePurchaseReady: false,
    handlePresentRevenueCatPaywall: vi.fn(),
  },
  toast: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock("@/hooks/useAppleSubscription", () => ({
  useAppleSubscription: () => mocks.appleSubscription,
}));

vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
    signOut: mocks.signOut,
  }),
}));

vi.mock("@/hooks/useReferrals", () => ({
  useReferrals: () => ({
    applyReferralCode: {
      mutateAsync: vi.fn(),
      isPending: false,
    },
  }),
}));

vi.mock("@/services/accountDeletion", () => ({
  deleteCurrentAccount: vi.fn(),
  isAccountDeletionAuthError: vi.fn(() => false),
  getAccountDeletionErrorMetadata: vi.fn(() => ({})),
  getAccountDeletionFailureMessage: vi.fn(() => "Failed to delete account. Please try again."),
}));

vi.mock("@/utils/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("@/utils/paywallTelemetry", () => ({
  trackPaywallEvent: vi.fn(),
}));

import { Paywall } from "./Paywall";

describe("Paywall creator offer-code eligibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.appleSubscription = {
      handlePurchase: vi.fn(),
      handleRestore: vi.fn(),
      loading: false,
      isAvailable: true,
      products: [],
      productsLoading: false,
      productError: null,
      reloadProducts: vi.fn(),
      hasOfferCode: false,
      hasAppliedReferralCode: false,
      appliedReferralCode: null,
      offerCodePurchaseReady: false,
      handlePresentRevenueCatPaywall: vi.fn(),
    };
  });

  it("shows discounted yearly pricing only for Apple-eligible creator codes", () => {
    mocks.appleSubscription.hasAppliedReferralCode = true;
    mocks.appleSubscription.hasOfferCode = true;
    mocks.appleSubscription.appliedReferralCode = "CREATOR123";

    render(
      <MemoryRouter>
        <Paywall />
      </MemoryRouter>,
    );

    expect(screen.getByText("Creator code applied")).toBeInTheDocument();
    expect(screen.getByText("Your annual plan is discounted to $69.99 for the first year.")).toBeInTheDocument();
    expect(
      screen.getByText((content) =>
        content.includes("Use") && content.includes("Apple") && content.includes("redemption screen"),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("CREATOR123")).toBeInTheDocument();
    expect(screen.getByText("Redeem Discount with Apple")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View All Plans" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Redeem Promo Code" })).not.toBeInTheDocument();
  });

  it("keeps standard pricing when a saved referral code is not Apple-offer eligible", () => {
    mocks.appleSubscription.hasAppliedReferralCode = true;
    mocks.appleSubscription.hasOfferCode = false;
    mocks.appleSubscription.appliedReferralCode = "FRIEND123";

    render(
      <MemoryRouter>
        <Paywall />
      </MemoryRouter>,
    );

    expect(screen.getByText("Referral code applied")).toBeInTheDocument();
    expect(
      screen.getByText("This code is saved to your account, but it does not unlock the Apple creator discount."),
    ).toBeInTheDocument();
    expect(screen.getByText("$99.99")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View All Plans" })).toBeInTheDocument();
    expect(screen.queryByText("Redeem Discount with Apple")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Redeem Promo Code" })).not.toBeInTheDocument();
  });

  it("presents the cinematic Cosmiq positioning across the paywall", () => {
    render(
      <MemoryRouter>
        <Paywall />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("paywall-overlay")).toHaveClass("z-[120]");
    expect(screen.getByText("Daily quests")).toBeInTheDocument();
    expect(screen.getByText("A companion that turns your goals into daily quests.")).toBeInTheDocument();
    expect(
      screen.getByText("Big goals become campaigns, rituals, milestones, and a planned day."),
    ).toBeInTheDocument();
    expect(screen.getByText("Built for growth")).toBeInTheDocument();
    expect(screen.getByText("Your companion grows when you follow through.")).toBeInTheDocument();
    expect(screen.getByText("Start the trial. Keep the story moving.")).toBeInTheDocument();
    expect(screen.getByText("3-day free trial")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start 3-day free trial/i })).toBeInTheDocument();
    expect(screen.getByText("Unlimited companion chat")).toBeInTheDocument();
    expect(screen.getByText("Unlimited quests and campaigns")).toBeInTheDocument();
    expect(screen.getByText("100+ levels and 12+ evolutions")).toBeInTheDocument();
    expect(
      screen.getByText("Both monthly and yearly plans include the same Cosmiq features and renew automatically until canceled."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /join our discord/i })).toHaveAttribute(
      "href",
      "https://discord.gg/rreaAn7JWn",
    );
    expect(screen.queryByText("All premium features")).not.toBeInTheDocument();
  });

  it("uses continuation copy after a trial has expired", () => {
    render(
      <MemoryRouter>
        <Paywall variant="trial_expired" />
      </MemoryRouter>,
    );

    expect(screen.getByText("Your journey is ready to continue.")).toBeInTheDocument();
    expect(
      screen.getByText("Subscribe to keep your companion, unlimited quests, campaigns, companion chat, and the full growth path active."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /subscribe yearly/i })).toBeInTheDocument();
    expect(screen.getByText("Continue with Cosmiq")).toBeInTheDocument();
    expect(screen.queryByText("3-day free trial")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start 3-day free trial/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Start the trial. Keep the story moving.")).not.toBeInTheDocument();
  });
});
