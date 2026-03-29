import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminReferralAnalytics } from "./AdminReferralAnalytics";

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

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("AdminReferralAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.invoke.mockImplementation(async (fnName: string, options?: { body?: Record<string, unknown> }) => {
      if (fnName === "manage-referral-codes" && options?.body?.action === "list") {
        return {
          data: {
            codes: [
              {
                id: "code-1",
                code: "CREATOR1",
                influencer_name: "Creator One",
                owner_user_id: null,
                total_signups: 2,
                total_conversions: 1,
                total_revenue: 9.99,
              },
            ],
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
                referral_code_id: "code-1",
                amount: 5,
                status: "paid",
                created_at: "2026-03-01T00:00:00.000Z",
              },
            ],
          },
          error: null,
        };
      }

      return { data: {}, error: null };
    });

    mocks.from.mockImplementation((table: string) => {
      if (table !== "profiles") {
        throw new Error(`Unexpected table access: ${table}`);
      }

      return {
        select: () => ({
          not: async () => ({
            data: [
              { referred_by_code: "CREATOR1", created_at: "2026-03-01T00:00:00.000Z" },
              { referred_by_code: "CREATOR1", created_at: "2026-03-15T00:00:00.000Z" },
            ],
            error: null,
          }),
        }),
      };
    });
  });

  it("loads analytics through secure functions instead of direct referral table queries", async () => {
    render(<AdminReferralAnalytics />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledWith("manage-referral-codes", {
        body: { action: "list" },
      });
      expect(mocks.invoke).toHaveBeenCalledWith("manage-referral-payouts", {
        body: { action: "list" },
      });
    });

    expect(await screen.findByText("Referral Analytics")).toBeInTheDocument();
    expect(screen.getByText("50.0% rate")).toBeInTheDocument();
    expect(mocks.from).toHaveBeenCalledWith("profiles");
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });
});
