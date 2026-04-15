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
    expect(screen.getByText("Your annual plan is discounted to $69.99/year.")).toBeInTheDocument();
    expect(
      screen.getByText((content) =>
        content.includes("Use") && content.includes("Apple") && content.includes("redemption screen"),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("CREATOR123")).toBeInTheDocument();
    expect(screen.getByText("Redeem Discount with Apple")).toBeInTheDocument();
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
    expect(screen.queryByText("Redeem Discount with Apple")).not.toBeInTheDocument();
  });
});
