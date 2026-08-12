import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoreKitProduct } from "@/types/subscription";

const mocks = vi.hoisted(() => ({
  appleSubscription: {
    handlePurchase: vi.fn(),
    handleRestore: vi.fn(),
    loading: false,
    isAvailable: true,
    products: [
      { identifier: "graceward_plus_monthly", displayName: "Graceward Plus Monthly", description: "", price: 8.99, displayPrice: "$8.99", type: "autoRenewable", introductoryOffer: { displayPrice: "$0.00", price: 0, paymentMode: "freeTrial", periodUnit: 1, periodValue: 1 } },
      { identifier: "graceward_plus_yearly", displayName: "Graceward Plus Yearly", description: "", price: 49.99, displayPrice: "$49.99", type: "autoRenewable", introductoryOffer: { displayPrice: "$0.00", price: 0, paymentMode: "freeTrial", periodUnit: 1, periodValue: 1 } },
      { identifier: "graceward_plus_founder_yearly", displayName: "Graceward Plus Founding", description: "", price: 29.99, displayPrice: "$29.99", type: "autoRenewable" },
    ] as StoreKitProduct[],
    productsLoading: false,
    productError: null as string | null,
    reloadProducts: vi.fn(),
    hasOfferCode: false,
    activeYearlyOffer: null as null | { tier: string; price: string; priceCents: number; unitPrice: string },
    hasAppliedReferralCode: false,
    appliedReferralCode: null as string | null,
    recoveringExistingSubscription: false,
  },
  accessStatus: { hasAccess: false, loading: false },
  toast: vi.fn(),
  signOut: vi.fn(),
  applyReferralCodeMutateAsync: vi.fn(),
  invalidateQueries: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: (...args: unknown[]) => mocks.invalidateQueries(...args) }),
}));

vi.mock("@/hooks/useAppleSubscription", () => ({
  APP_STORE_SUBSCRIPTION_ALREADY_LINKED_MESSAGE:
    "This App Store subscription is already linked to another Graceward account. Sign in to that account, or contact support if this is your purchase.",
  useAppleSubscription: () => mocks.appleSubscription,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1" }, signOut: mocks.signOut }),
}));

vi.mock("@/hooks/useAccessStatus", () => ({
  useAccessStatus: () => mocks.accessStatus,
}));

vi.mock("@/hooks/useReferrals", () => ({
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
  logger: { warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/utils/paywallTelemetry", () => ({
  trackPaywallEvent: vi.fn(),
}));

import { Paywall } from "./Paywall";

describe("Paywall Apple-only checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.appleSubscription.loading = false;
    mocks.appleSubscription.isAvailable = true;
    mocks.appleSubscription.productsLoading = false;
    mocks.appleSubscription.products = [
      { identifier: "graceward_plus_monthly", displayName: "Graceward Plus Monthly", description: "", price: 8.99, displayPrice: "$8.99", type: "autoRenewable", introductoryOffer: { displayPrice: "$0.00", price: 0, paymentMode: "freeTrial", periodUnit: 1, periodValue: 1 } },
      { identifier: "graceward_plus_yearly", displayName: "Graceward Plus Yearly", description: "", price: 49.99, displayPrice: "$49.99", type: "autoRenewable", introductoryOffer: { displayPrice: "$0.00", price: 0, paymentMode: "freeTrial", periodUnit: 1, periodValue: 1 } },
      { identifier: "graceward_plus_founder_yearly", displayName: "Graceward Plus Founding", description: "", price: 29.99, displayPrice: "$29.99", type: "autoRenewable" },
    ];
    mocks.appleSubscription.productError = null;
    mocks.appleSubscription.hasOfferCode = false;
    mocks.appleSubscription.activeYearlyOffer = null;
    mocks.appleSubscription.hasAppliedReferralCode = false;
    mocks.appleSubscription.appliedReferralCode = null;
    mocks.appleSubscription.recoveringExistingSubscription = false;
    mocks.accessStatus = { hasAccess: false, loading: false };
    mocks.applyReferralCodeMutateAsync.mockResolvedValue({
      success: true,
      message: "Founding rate unlocked",
      code_type: "affiliate",
    });
  });

  it("shows the simplified Graceward plans and seven-day trial", () => {
    render(<MemoryRouter><Paywall /></MemoryRouter>);

    expect(screen.getAllByText("7-day free trial").length).toBeGreaterThan(0);
    expect(screen.getByText("$8.99")).toBeInTheDocument();
    expect(screen.getByText("$49.99")).toBeInTheDocument();
    expect(screen.getByText("Have a founding or referral code?")).toBeInTheDocument();
    expect(screen.getAllByText("Scripture and prayer").length).toBeGreaterThan(0);
    expect(screen.getByText("Prepared daily formation")).toBeInTheDocument();
    expect(screen.getByText("Guided reflections")).toBeInTheDocument();
  });

  it("uses the standard Apple yearly product by default", () => {
    render(<MemoryRouter><Paywall /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: /^7-day free trial$/i }));
    expect(mocks.appleSubscription.handlePurchase).toHaveBeenCalledWith("graceward_plus_yearly", "paywall");
  });

  it("does not claim a free trial when StoreKit does not return one", () => {
    mocks.appleSubscription.products = mocks.appleSubscription.products.map((product) => ({
      ...product,
      introductoryOffer: null,
    }));

    render(<MemoryRouter><Paywall /></MemoryRouter>);

    expect(screen.queryByText("7-day free trial")).not.toBeInTheDocument();
    expect(screen.queryByTestId("paywall-trial-callout")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /subscribe yearly/i }).length).toBeGreaterThan(0);
    expect(screen.getByText(/Payment will be charged to your Apple ID account at confirmation/i)).toBeInTheDocument();
  });

  it("shows and purchases the locked founding Apple product for an eligible account", () => {
    mocks.appleSubscription.hasAppliedReferralCode = true;
    mocks.appleSubscription.hasOfferCode = true;
    mocks.appleSubscription.activeYearlyOffer = {
      tier: "referrals",
      price: "$29.99",
      priceCents: 2999,
      unitPrice: "$2.50/month, locked while active",
    };
    mocks.appleSubscription.appliedReferralCode = "FOUNDING";

    render(<MemoryRouter><Paywall /></MemoryRouter>);

    expect(screen.getByText("Founding rate unlocked")).toBeInTheDocument();
    expect(screen.getByText("$29.99")).toBeInTheDocument();
    expect(screen.getByText("$2.50/month, locked while active")).toBeInTheDocument();
    expect(screen.getByText("FOUNDING")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /start founding membership/i }));
    expect(mocks.appleSubscription.handlePurchase).toHaveBeenCalledWith(
      "graceward_plus_founder_yearly",
      "paywall",
    );
  });

  it("applies an eligible founding code before Apple checkout", async () => {
    render(<MemoryRouter><Paywall /></MemoryRouter>);

    fireEvent.change(screen.getByPlaceholderText("ENTER CODE"), { target: { value: "founding" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply Code" }));

    await waitFor(() => expect(mocks.applyReferralCodeMutateAsync).toHaveBeenCalledWith({
      code: "FOUNDING",
      suppressToast: true,
    }));
    expect(mocks.toast).toHaveBeenCalledWith({
      title: "Founding rate unlocked",
      description: "Your $29.99 yearly rate stays locked while your subscription remains active.",
    });
  });

  it("shows a direct error for an invalid founding code", async () => {
    mocks.applyReferralCodeMutateAsync.mockRejectedValueOnce(new Error("Invalid referral code"));
    render(<MemoryRouter><Paywall /></MemoryRouter>);

    fireEvent.change(screen.getByPlaceholderText("ENTER CODE"), { target: { value: "badcode" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply Code" }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({
      title: "Unable to apply code",
      description: "Invalid referral code",
      variant: "destructive",
    }));
  });

  it("disables purchase actions while StoreKit is recovering an existing subscription", () => {
    mocks.appleSubscription.recoveringExistingSubscription = true;
    render(<MemoryRouter><Paywall /></MemoryRouter>);

    expect(screen.getByRole("button", { name: /^7-day free trial$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /start free trial/i })).toBeDisabled();
  });

  it("uses continuation copy without a trial claim after trial expiry", () => {
    render(<MemoryRouter><Paywall variant="trial_expired" /></MemoryRouter>);

    expect(screen.getByText("Keep Graceward close each day.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /subscribe yearly/i })).toBeInTheDocument();
    expect(screen.getByText("Continue with Graceward")).toBeInTheDocument();
    expect(screen.queryByTestId("paywall-trial-callout")).not.toBeInTheDocument();
  });

  it("keeps Apple-required legal and renewal disclosures visible", () => {
    render(<MemoryRouter><Paywall /></MemoryRouter>);

    expect(screen.getByText(/Subscriptions renew automatically unless canceled at least 24 hours before the end/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Terms of Use" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "EULA" })).toHaveAttribute(
      "href",
      "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/",
    );
  });
});
