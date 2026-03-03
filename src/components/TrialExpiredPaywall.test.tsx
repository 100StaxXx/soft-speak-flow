import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  toast: vi.fn(),
  signOut: vi.fn(),
  handlePurchase: vi.fn(),
  handleRestore: vi.fn(),
  reloadProducts: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({}),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
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
  }),
}));

vi.mock("@/services/accountDeletion", () => ({
  deleteCurrentAccount: vi.fn(),
  isAccountDeletionAuthError: vi.fn(() => false),
}));

import { TrialExpiredPaywall } from "./TrialExpiredPaywall";

const getRootContainer = () => {
  const heading = screen.getByRole("heading");
  const root = heading.closest("div.fixed");
  expect(root).not.toBeNull();
  return root as HTMLDivElement;
};

describe("TrialExpiredPaywall layout", () => {
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
});
