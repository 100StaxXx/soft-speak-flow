import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminPayouts } from "./AdminPayouts";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mocks.invoke(...args),
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("AdminPayouts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.invoke.mockImplementation(async (fnName: string, options?: { body?: Record<string, unknown> }) => {
      if (fnName === "manage-referral-payouts" && options?.body?.action === "list") {
        return {
          data: {
            payouts: [
              {
                id: "payout-1",
                referrer_id: "user-1",
                referee_id: "user-2",
                referral_code_id: "code-1",
                amount: 25,
                status: "pending",
                payout_type: "first_month",
                apple_transaction_id: null,
                created_at: "2026-03-01T00:00:00.000Z",
                approved_at: null,
                paid_at: null,
                rejected_at: null,
                admin_notes: null,
                paypal_transaction_id: null,
                retry_count: 0,
                last_retry_at: null,
                failure_reason: null,
                next_retry_at: null,
                referral_code: {
                  code: "CODE1",
                  owner_type: "influencer",
                  owner_user_id: null,
                  influencer_name: "Creator One",
                  influencer_email: "creator@example.com",
                  influencer_handle: "@creator",
                  payout_identifier: "creator@example.com",
                },
                referee: {
                  email: "signup@example.com",
                },
              },
            ],
          },
          error: null,
        };
      }

      return { data: { success: true }, error: null };
    });
  });

  it("loads payouts and bulk-approves through the server function", async () => {
    render(<AdminPayouts />, { wrapper: createWrapper() });

    expect(await screen.findByText("Creator One")).toBeInTheDocument();
    expect(mocks.invoke).toHaveBeenCalledWith("manage-referral-payouts", {
      body: { action: "list" },
    });

    fireEvent.click(screen.getByText("Creator One"));
    fireEvent.click(await screen.findByRole("button", { name: /approve all pending/i }));

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledWith("manage-referral-payouts", {
        body: {
          action: "bulk_approve",
          referralCodeId: "code-1",
          notes: null,
        },
      });
    });
  });
});
