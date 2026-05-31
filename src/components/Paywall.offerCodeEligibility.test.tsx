import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appStateListeners: [] as Array<(state: { isActive: boolean }) => void>,
  browserFinishedListeners: [] as Array<() => void>,
  browserOpen: vi.fn(),
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
    activeYearlyOffer: null as null | { tier: string; price: string; priceCents: number; unitPrice: string },
    hasAppliedReferralCode: false,
    appliedReferralCode: null as string | null,
    offerCodePurchaseReady: false,
    handlePresentRevenueCatPaywall: vi.fn(),
    handleRecoverExistingSubscription: vi.fn(),
    recoveringExistingSubscription: false,
  },
  accessStatus: {
    hasAccess: false,
    loading: false,
  },
  toast: vi.fn(),
  signOut: vi.fn(),
  applyReferralCodeMutateAsync: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: vi.fn((eventName: string, callback: (state: { isActive: boolean }) => void) => {
      if (eventName === "appStateChange") {
        mocks.appStateListeners.push(callback);
      }
      return Promise.resolve({ remove: vi.fn() });
    }),
  },
}));

vi.mock("@capacitor/browser", () => ({
  Browser: {
    addListener: vi.fn((eventName: string, callback: () => void) => {
      if (eventName === "browserFinished") {
        mocks.browserFinishedListeners.push(callback);
      }
      return Promise.resolve({ remove: vi.fn() });
    }),
    open: (...args: unknown[]) => mocks.browserOpen(...args),
  },
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => true,
    getPlatform: () => "ios",
  },
}));

vi.mock("@/hooks/useAppleSubscription", () => ({
  APP_STORE_SUBSCRIPTION_ALREADY_LINKED_MESSAGE:
    "This App Store subscription is already linked to another Cosmiq account. Sign in to that account, or contact support if this is your purchase.",
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

vi.mock("@/hooks/useAccessStatus", () => ({
  useAccessStatus: () => mocks.accessStatus,
}));

vi.mock("@/hooks/useReferrals", () => ({
  isInvalidReferralCodeError: (error: unknown) =>
    error instanceof Error && error.message === "Invalid referral code",
  useReferrals: () => ({
    applyReferralCode: {
      mutateAsync: (...args: unknown[]) => mocks.applyReferralCodeMutateAsync(...args),
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
      activeYearlyOffer: null,
      hasAppliedReferralCode: false,
      appliedReferralCode: null,
      offerCodePurchaseReady: false,
      handlePresentRevenueCatPaywall: vi.fn(),
      handleRecoverExistingSubscription: vi.fn().mockResolvedValue("not_found"),
      recoveringExistingSubscription: false,
    };
    mocks.accessStatus = {
      hasAccess: false,
      loading: false,
    };
    mocks.appStateListeners = [];
    mocks.browserFinishedListeners = [];
    mocks.browserOpen.mockResolvedValue(undefined);
    mocks.applyReferralCodeMutateAsync.mockResolvedValue({
      success: true,
      message: "Creator code applied",
      code_type: "affiliate",
    });
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
    expect(screen.getAllByText("Cosmiq Pro Yearly").length).toBeGreaterThan(0);
    expect(screen.getByText("$5.83/month for the first year")).toBeInTheDocument();
  });

  it("shows Genesis yearly pricing for the Genesis Apple offer tier", () => {
    mocks.appleSubscription.hasAppliedReferralCode = true;
    mocks.appleSubscription.hasOfferCode = true;
    mocks.appleSubscription.activeYearlyOffer = {
      tier: "genesis",
      price: "$49.99",
      priceCents: 4999,
      unitPrice: "$4.17/month for the first year",
    };
    mocks.appleSubscription.appliedReferralCode = "GENESIS";

    render(
      <MemoryRouter>
        <Paywall />
      </MemoryRouter>,
    );

    expect(screen.getByText("Creator code applied")).toBeInTheDocument();
    expect(screen.getByText("Your annual plan is discounted to $49.99 for the first year.")).toBeInTheDocument();
    expect(screen.getByText("$49.99")).toBeInTheDocument();
    expect(screen.getByText("$4.17/month for the first year")).toBeInTheDocument();
    expect(screen.getByText("GENESIS")).toBeInTheDocument();
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
    expect(screen.queryByRole("button", { name: "View All Plans" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Cosmiq Pro Yearly").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Length: 1 year").length).toBeGreaterThan(0);
    expect(screen.getByText("$8.33/month when billed yearly")).toBeInTheDocument();
    expect(screen.queryByText("Redeem Discount with Apple")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Redeem Promo Code" })).not.toBeInTheDocument();
  });

  it("presents the cinematic Cosmiq positioning across the paywall", () => {
    const { container } = render(
      <MemoryRouter>
        <Paywall />
      </MemoryRouter>,
    );

    expect(container.querySelectorAll("main > section")).toHaveLength(3);
    expect(screen.getByTestId("paywall-overlay")).toHaveClass("z-[120]");
    expect(screen.getByText("Daily quests")).toBeInTheDocument();
    expect(screen.getByText("A companion that turns your goals into daily quests.")).toBeInTheDocument();
    expect(screen.getByText("Built for growth")).toBeInTheDocument();
    expect(screen.getByText("Your companion grows when you follow through.")).toBeInTheDocument();
    expect(screen.getByText("Start the trial. Keep the story moving.")).toBeInTheDocument();
    expect(screen.queryByText("Guidance with a pulse")).not.toBeInTheDocument();
    expect(screen.queryByText("Goals become systems")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Big goals become campaigns, rituals, milestones, and a planned day."),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("3-day free trial").length).toBeGreaterThan(0);
    expect(screen.getByTestId("paywall-trial-callout")).toBeInTheDocument();
    expect(screen.getByTestId("paywall-trial-callout")).toHaveTextContent("3-day free trial");
    expect(screen.getByTestId("paywall-trial-callout")).toHaveTextContent("No charge today.");
    expect(screen.getByText("Have a creator or Apple offer code?")).toBeInTheDocument();
    expect(
      screen.getByText("Entering a valid creator or Apple offer code unlocks discounted annual pricing."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start 3-day free trial/i })).toBeInTheDocument();
    expect(screen.getByText("Unlimited companion chat")).toBeInTheDocument();
    expect(screen.getByText("Unlimited quests and campaigns")).toBeInTheDocument();
    expect(screen.getByText("100+ levels and 12+ evolutions")).toBeInTheDocument();
    expect(
      screen.getByText("Both monthly and yearly plans include the same Cosmiq features and renew automatically until canceled."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Subscriptions renew automatically unless canceled at least 24 hours before the end/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Terms of Use" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "EULA" })).toHaveAttribute(
      "href",
      "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/",
    );
    expect(screen.getByRole("link", { name: /join our discord/i })).toHaveAttribute(
      "href",
      "https://discord.gg/rreaAn7JWn",
    );
    expect(screen.queryByText("All premium features")).not.toBeInTheDocument();
  });

  it("starts the default 3-day trial from the hero button", () => {
    render(
      <MemoryRouter>
        <Paywall />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /^3-day free trial$/i }));

    expect(mocks.appleSubscription.handlePurchase).toHaveBeenCalledWith("cosmiq_premium_yearly", "paywall");
  });

  it("applies a valid creator code through the existing referral path", async () => {
    render(
      <MemoryRouter>
        <Paywall />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText("ENTER CODE"), {
      target: { value: "creator123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply Code" }));

    await waitFor(() => {
      expect(mocks.applyReferralCodeMutateAsync).toHaveBeenCalledWith({
        code: "CREATOR123",
        suppressToast: true,
      });
    });
    expect(mocks.browserOpen).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith({
      title: "Creator code applied",
      description: "Your yearly plan is now discounted to $69.99 for the first year.",
    });
  });

  it("shows the normal invalid-code error for non-Apple code shapes", async () => {
    mocks.applyReferralCodeMutateAsync.mockRejectedValueOnce(new Error("Invalid referral code"));

    render(
      <MemoryRouter>
        <Paywall />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText("ENTER CODE"), {
      target: { value: "friend123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply Code" }));

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith({
        title: "Unable to apply code",
        description: "Invalid referral code",
        variant: "destructive",
      });
    });
    expect(mocks.browserOpen).not.toHaveBeenCalled();
  });

  it("opens Apple redemption when an invalid referral looks like a one-time offer code", async () => {
    mocks.applyReferralCodeMutateAsync.mockRejectedValueOnce(new Error("Invalid referral code"));

    render(
      <MemoryRouter>
        <Paywall />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText("ENTER CODE"), {
      target: { value: "73wjl3eplwx7wa36e6" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply Code" }));

    await waitFor(() => {
      expect(mocks.browserOpen).toHaveBeenCalledWith({
        url: "https://apps.apple.com/redeem?ctx=offercodes&id=6755738842&code=73WJL3EPLWX7WA36E6",
      });
    });
    expect(mocks.toast).toHaveBeenCalledWith({
      title: "Redeeming with Apple...",
      description: "Opening Apple's offer-code redemption flow.",
    });
  });

  it("opens Apple redemption for all-letter Apple one-time offer codes", async () => {
    mocks.applyReferralCodeMutateAsync.mockRejectedValueOnce(new Error("Invalid referral code"));

    render(
      <MemoryRouter>
        <Paywall />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText("ENTER CODE"), {
      target: { value: "abcdefghijklmnopqr" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply Code" }));

    await waitFor(() => {
      expect(mocks.applyReferralCodeMutateAsync).toHaveBeenCalledWith({
        code: "ABCDEFGHIJKLMNOPQR",
        suppressToast: true,
      });
      expect(mocks.browserOpen).toHaveBeenCalledWith({
        url: "https://apps.apple.com/redeem?ctx=offercodes&id=6755738842&code=ABCDEFGHIJKLMNOPQR",
      });
    });
  });

  it("opens Apple redemption when users paste an Apple redemption URL", async () => {
    mocks.applyReferralCodeMutateAsync.mockRejectedValueOnce(new Error("Invalid referral code"));

    render(
      <MemoryRouter>
        <Paywall />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText("ENTER CODE"), {
      target: {
        value: "https://apps.apple.com/redeem?ctx=offercodes&id=6755738842&code=73wjl3eplwx7wa36e6",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply Code" }));

    await waitFor(() => {
      expect(mocks.applyReferralCodeMutateAsync).toHaveBeenCalledWith({
        code: "73WJL3EPLWX7WA36E6",
        suppressToast: true,
      });
      expect(mocks.browserOpen).toHaveBeenCalledWith({
        url: "https://apps.apple.com/redeem?ctx=offercodes&id=6755738842&code=73WJL3EPLWX7WA36E6",
      });
    });
  });

  it("does not open Apple redemption for network or server failures", async () => {
    mocks.applyReferralCodeMutateAsync.mockRejectedValueOnce(
      new Error("Unable to apply referral code. Please try again."),
    );

    render(
      <MemoryRouter>
        <Paywall />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText("ENTER CODE"), {
      target: { value: "73wjl3eplwx7wa36e6" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply Code" }));

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith({
        title: "Unable to apply code",
        description: "Unable to apply referral code. Please try again.",
        variant: "destructive",
      });
    });
    expect(mocks.browserOpen).not.toHaveBeenCalled();
  });

  it("refreshes subscription state when returning from Apple redemption", async () => {
    mocks.applyReferralCodeMutateAsync.mockRejectedValueOnce(new Error("Invalid referral code"));
    mocks.appleSubscription.handleRecoverExistingSubscription.mockResolvedValueOnce("verified");

    render(
      <MemoryRouter>
        <Paywall />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText("ENTER CODE"), {
      target: { value: "73wjl3eplwx7wa36e6" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply Code" }));

    await waitFor(() => {
      expect(mocks.browserOpen).toHaveBeenCalled();
    });

    await act(async () => {
      mocks.appStateListeners.forEach((listener) => listener({ isActive: false }));
      mocks.appStateListeners.forEach((listener) => listener({ isActive: true }));
    });

    await waitFor(() => {
      expect(mocks.appleSubscription.handleRecoverExistingSubscription).toHaveBeenCalledWith(
        "paywall_apple_offer_code",
        { showSuccessToast: false },
      );
    });
    expect(mocks.toast).toHaveBeenCalledWith({
      title: "Cosmiq unlocked",
      description: "Your Apple offer code is active on this account.",
    });
  });

  it("refreshes subscription state when the Apple redemption browser closes", async () => {
    mocks.applyReferralCodeMutateAsync.mockRejectedValueOnce(new Error("Invalid referral code"));
    mocks.appleSubscription.handleRecoverExistingSubscription.mockResolvedValueOnce("verified");

    render(
      <MemoryRouter>
        <Paywall />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText("ENTER CODE"), {
      target: { value: "73wjl3eplwx7wa36e6" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply Code" }));

    await waitFor(() => {
      expect(mocks.browserOpen).toHaveBeenCalled();
    });

    await act(async () => {
      mocks.browserFinishedListeners.forEach((listener) => listener());
    });

    await waitFor(() => {
      expect(mocks.appleSubscription.handleRecoverExistingSubscription).toHaveBeenCalledWith(
        "paywall_apple_offer_code",
        { showSuccessToast: false },
      );
    });
  });

  it("does not contact StoreKit to recover existing access on mount", () => {
    mocks.appleSubscription.handleRecoverExistingSubscription.mockResolvedValueOnce("verified");

    render(
      <MemoryRouter>
        <Paywall />
      </MemoryRouter>,
    );

    expect(mocks.appleSubscription.handleRecoverExistingSubscription).not.toHaveBeenCalled();
    expect(screen.getByTestId("paywall-overlay")).toBeInTheDocument();
  });

  it("disables purchase CTAs while checking existing TestFlight access", () => {
    mocks.appleSubscription.recoveringExistingSubscription = true;

    render(
      <MemoryRouter>
        <Paywall />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /^3-day free trial$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /start 3-day free trial/i })).toBeDisabled();
  });

  it("does not render when refreshed access is already active", () => {
    mocks.accessStatus = {
      hasAccess: true,
      loading: false,
    };

    render(
      <MemoryRouter>
        <Paywall />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId("paywall-overlay")).not.toBeInTheDocument();
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
    expect(screen.queryByTestId("paywall-trial-callout")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start 3-day free trial/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Start the trial. Keep the story moving.")).not.toBeInTheDocument();
  });
});
