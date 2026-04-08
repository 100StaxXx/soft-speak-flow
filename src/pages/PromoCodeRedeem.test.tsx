import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  mutateAsync: vi.fn(),
  toastSuccess: vi.fn(),
  isPending: false,
  location: {
    pathname: "/promo-code",
    search: "",
    hash: "",
    state: null as { returnTo?: string } | null,
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useLocation: () => mocks.location,
  };
});

vi.mock("@/hooks/usePromoCode", () => {
  class PromoCodeRedeemError extends Error {
    reason: string;

    constructor(message: string, reason: string) {
      super(message);
      this.name = "PromoCodeRedeemError";
      this.reason = reason;
    }
  }

  return {
    usePromoCode: () => ({
      redeemPromoCode: {
        mutateAsync: mocks.mutateAsync,
        isPending: mocks.isPending,
      },
    }),
    PromoCodeRedeemError,
  };
});

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
  },
}));

import PromoCodeRedeem from "./PromoCodeRedeem";

describe("PromoCodeRedeem", () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.mutateAsync.mockReset();
    mocks.mutateAsync.mockResolvedValue({
      success: true,
      status: "success",
      message: "ok",
      access_expires_at: null,
    });
    mocks.toastSuccess.mockReset();
    mocks.isPending = false;
    mocks.location = {
      pathname: "/promo-code",
      search: "",
      hash: "",
      state: null,
    };
  });

  it("returns to the blocked route after a successful redemption", async () => {
    mocks.location.state = {
      returnTo: "/companion?view=full#today",
    };

    render(<PromoCodeRedeem />);

    fireEvent.change(screen.getByPlaceholderText("PROMO-XXXX"), {
      target: { value: "bigfella2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Redeem Promo Code" }));

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith("/companion?view=full#today", {
        replace: true,
      });
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Promo code applied. Access unlocked.");
  });

  it("falls back to profile when no return path is provided", async () => {
    render(<PromoCodeRedeem />);

    fireEvent.change(screen.getByPlaceholderText("PROMO-XXXX"), {
      target: { value: "bigfella2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Redeem Promo Code" }));

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith("/profile", {
        replace: true,
      });
    });
  });
});
