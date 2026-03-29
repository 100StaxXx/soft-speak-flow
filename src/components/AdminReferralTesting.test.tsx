import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminReferralTesting } from "./AdminReferralTesting";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mocks.invoke(...args),
    },
    from: (...args: unknown[]) => mocks.from(...args),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("AdminReferralTesting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockImplementation(() => {
      throw new Error("Direct table access is not expected in this component");
    });

    mocks.invoke.mockImplementation(async (fnName: string, options?: { body?: Record<string, unknown> }) => {
      if (fnName === "manage-referral-codes" && options?.body?.action === "list") {
        return {
          data: {
            codes: [
              {
                id: "code-1",
                code: "CREATOR1",
                is_active: true,
                total_signups: 2,
                total_conversions: 1,
                total_revenue: 9.99,
                payout_identifier: "creator@example.com",
              },
            ],
          },
          error: null,
        };
      }

      if (fnName === "process-referral") {
        return {
          data: { success: true },
          error: null,
        };
      }

      if (fnName === "manage-referral-payouts" && options?.body?.action === "create_test_conversion") {
        return {
          data: {
            success: true,
            payout: { id: "payout-1" },
            payout_amount: 5,
          },
          error: null,
        };
      }

      if (fnName === "manage-referral-payouts" && options?.body?.action === "list") {
        return {
          data: {
            payouts: [
              {
                id: "payout-1",
                amount: 5,
                status: "pending",
                referral_code: {
                  code: "CREATOR1",
                  payout_identifier: "creator@example.com",
                },
              },
            ],
          },
          error: null,
        };
      }

      if (fnName === "manage-referral-payouts" && options?.body?.action === "approve") {
        return { data: { success: true }, error: null };
      }

      return { data: { success: true }, error: null };
    });
  });

  it("tracks signup simulations through process-referral instead of direct code mutations", async () => {
    render(<AdminReferralTesting />);

    fireEvent.change(screen.getByPlaceholderText("Referral code (auto-filled)"), {
      target: { value: "CREATOR1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /test signup/i }));

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledWith("process-referral", {
        body: {
          referral_code: "CREATOR1",
          source_app: "admin-referral-testing",
        },
      });
    });

    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("routes synthetic conversions and approvals through admin server functions", async () => {
    render(<AdminReferralTesting />);

    fireEvent.change(screen.getByPlaceholderText("Referral code (auto-filled)"), {
      target: { value: "CREATOR1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /test conversion/i }));

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledWith("manage-referral-payouts", {
        body: {
          action: "create_test_conversion",
          code: "CREATOR1",
          amount: 9.99,
          plan: "monthly",
          refereeId: undefined,
        },
      });
    });

    fireEvent.click(screen.getByRole("button", { name: /test approval/i }));

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledWith("manage-referral-payouts", {
        body: {
          action: "approve",
          payoutId: "payout-1",
        },
      });
    });

    expect(mocks.from).not.toHaveBeenCalled();
  });
});
