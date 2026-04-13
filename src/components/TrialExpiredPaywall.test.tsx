import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: {
    pathname: "/companion",
    search: "?view=full",
    hash: "#today",
  },
  toast: vi.fn(),
  signOut: vi.fn(),
  handlePurchase: vi.fn(),
  handleRestore: vi.fn(),
  reloadProducts: vi.fn(),
  deleteCurrentAccount: vi.fn(),
  isAccountDeletionAuthError: vi.fn(() => false),
  loggerError: vi.fn(),
  applyReferralCodeMutateAsync: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({}),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useLocation: () => mocks.location,
  };
});

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mocks.toast,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
    signOut: mocks.signOut,
  }),
}));

vi.mock("@/hooks/useAppleSubscription", () => ({
  useAppleSubscription: () => ({
    handlePurchase: mocks.handlePurchase,
    handleRestore: mocks.handleRestore,
    loading: false,
    isAvailable: true,
    products: [],
    productsLoading: false,
    productError: null,
    reloadProducts: mocks.reloadProducts,
    hasLoadedProducts: true,
    hasReferralPricing: false,
  }),
}));

vi.mock("@/hooks/useReferrals", () => ({
  useReferrals: () => ({
    referralStats: { referred_by: null },
    applyReferralCode: {
      mutateAsync: mocks.applyReferralCodeMutateAsync,
      isPending: false,
    },
  }),
}));

vi.mock("@/services/accountDeletion", () => ({
  deleteCurrentAccount: mocks.deleteCurrentAccount,
  isAccountDeletionAuthError: mocks.isAccountDeletionAuthError,
  getAccountDeletionErrorMetadata: (error: unknown) => {
    if (!error || typeof error !== "object") return {};
    const candidate = error as Record<string, unknown>;
    return {
      ...(typeof candidate.code === "string" ? { code: candidate.code } : {}),
      ...(typeof candidate.status === "number" ? { status: candidate.status } : {}),
      ...(typeof candidate.requestId === "string" ? { requestId: candidate.requestId } : {}),
      ...(typeof candidate.stage === "string" ? { stage: candidate.stage } : {}),
    };
  },
  getAccountDeletionFailureMessage: (error: unknown) => {
    const stage =
      error && typeof error === "object" && typeof (error as { stage?: unknown }).stage === "string"
        ? (error as { stage: string }).stage
        : undefined;
    if (stage === "storage_cleanup") {
      return "We couldn't finish deleting your uploaded files, so your account wasn't removed. Please try again.";
    }
    return error instanceof Error ? error.message : "Failed to delete account. Please try again.";
  },
}));

vi.mock("@/utils/logger", () => ({
  logger: {
    error: mocks.loggerError,
  },
}));

import { TrialExpiredPaywall } from "./TrialExpiredPaywall";

const getRootContainer = () => {
  const heading = screen.getByRole("heading", { level: 1 });
  const root = heading.closest("div.fixed");
  expect(root).not.toBeNull();
  return root as HTMLDivElement;
};

const openDeleteDialog = () => {
  fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
  return screen.getByRole("textbox");
};

describe("TrialExpiredPaywall layout", () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.location = {
      pathname: "/companion",
      search: "?view=full",
      hash: "#today",
    };
    mocks.toast.mockReset();
    mocks.signOut.mockReset();
    mocks.handlePurchase.mockReset();
    mocks.handleRestore.mockReset();
    mocks.reloadProducts.mockReset();
    mocks.deleteCurrentAccount.mockReset();
    mocks.deleteCurrentAccount.mockResolvedValue({ warnings: [] });
    mocks.isAccountDeletionAuthError.mockReset();
    mocks.isAccountDeletionAuthError.mockReturnValue(false);
    mocks.loggerError.mockReset();
    mocks.applyReferralCodeMutateAsync.mockReset();
    mocks.applyReferralCodeMutateAsync.mockResolvedValue({ success: true });
  });

  it("uses top-aligned scroll layout instead of centered overflow layout", () => {
    render(<TrialExpiredPaywall variant="pre_trial_signup" />);

    const root = getRootContainer();
    expect(root.className).toContain("pt-safe");
    expect(root.className).toContain("overflow-y-auto");
    expect(root.className).toContain("justify-start");
    expect(root.className).not.toContain("justify-center");
  });

  it("reserves runtime bottom-nav space so footer actions stay above the nav", () => {
    render(<TrialExpiredPaywall variant="trial_expired" />);

    const root = getRootContainer();
    expect(root.className).toContain("pb-[var(--bottom-nav-runtime-offset,var(--bottom-nav-safe-offset))]");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete account" })).toBeInTheDocument();
  });

  it("passes the blocked route through to promo redemption", () => {
    render(<TrialExpiredPaywall variant="pre_trial_signup" />);

    fireEvent.click(screen.getByRole("button", { name: "Redeem Promo Code" }));

    expect(mocks.navigate).toHaveBeenCalledWith("/promo-code", {
      state: { returnTo: "/companion?view=full#today" },
    });
  });

  it("lets users skip referral entry and continue to the subscription paywall", () => {
    render(<TrialExpiredPaywall variant="pre_trial_signup" />);

    fireEvent.click(screen.getByRole("button", { name: "Skip and Continue" }));

    expect(mocks.navigate).toHaveBeenCalledWith("/premium");
  });

  it("submits account deletion on the first focused-input activation", async () => {
    render(<TrialExpiredPaywall variant="trial_expired" />);

    const input = openDeleteDialog();
    const activeElementSpy = vi.spyOn(document, "activeElement", "get").mockReturnValue(input);
    const blurSpy = vi.spyOn(input, "blur");
    fireEvent.change(input, { target: { value: "DELETE" } });

    await waitFor(() => {
      expect(blurSpy).toHaveBeenCalled();
    });

    const deleteButton = screen.getByRole("button", { name: "Delete Account" });
    fireEvent.pointerDown(deleteButton);
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(mocks.deleteCurrentAccount).toHaveBeenCalledTimes(1);
    });
    activeElementSpy.mockRestore();
  });

  it("closes and clears the dialog after a successful deletion", async () => {
    render(<TrialExpiredPaywall variant="trial_expired" />);

    const input = openDeleteDialog();
    fireEvent.change(input, { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("button", { name: "Delete Account" }));

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith("/auth", {
        replace: true,
        state: { message: "Your account has been deleted." },
      });
    });
    await waitFor(() => {
      expect(screen.queryByText("Delete your account?")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("keeps the dialog open and preserves confirmation text after a deletion failure", async () => {
    mocks.deleteCurrentAccount.mockRejectedValueOnce(
      Object.assign(new Error("Account deletion is temporarily unavailable. Please try again later."), {
        code: "ACCOUNT_DELETION_STORAGE_CLEANUP_FAILED",
        status: 500,
        requestId: "req-delete-paywall-1",
        stage: "storage_cleanup",
      }),
    );

    render(<TrialExpiredPaywall variant="trial_expired" />);

    const input = openDeleteDialog();
    fireEvent.change(input, { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("button", { name: "Delete Account" }));

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith({
        title: "Error",
        description: "We couldn't finish deleting your uploaded files, so your account wasn't removed. Please try again.",
        variant: "destructive",
      });
    });
    expect(mocks.loggerError).toHaveBeenCalledWith("[Account Deletion] Trial paywall deletion failed", {
      surface: "trial_expired",
      userId: "user-1",
      code: "ACCOUNT_DELETION_STORAGE_CLEANUP_FAILED",
      status: 500,
      requestId: "req-delete-paywall-1",
      stage: "storage_cleanup",
      message: "Account deletion is temporarily unavailable. Please try again later.",
    });

    expect(screen.getByText("Delete your account?")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("DELETE");
  });

  it("blocks deletion when the confirmation text is invalid", async () => {
    render(<TrialExpiredPaywall variant="trial_expired" />);

    const input = openDeleteDialog();
    fireEvent.change(input, { target: { value: "delete" } });

    const deleteForm = input.closest("form");
    expect(deleteForm).not.toBeNull();
    fireEvent.submit(deleteForm!);

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith({
        title: "Confirmation required",
        description: "Please type DELETE to confirm account deletion.",
        variant: "destructive",
      });
    });
    expect(mocks.deleteCurrentAccount).not.toHaveBeenCalled();
  });
});
