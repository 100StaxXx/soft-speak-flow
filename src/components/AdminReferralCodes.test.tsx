import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminReferralCodes } from "./AdminReferralCodes";

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

describe("AdminReferralCodes", () => {
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
                owner_type: "influencer",
                owner_user_id: null,
                influencer_name: "Creator One",
                influencer_email: "creator@example.com",
                influencer_handle: "@creator",
                payout_method: "paypal",
                payout_identifier: "creator@example.com",
                is_active: true,
                created_at: "2026-03-01T00:00:00.000Z",
                conversion_count: 3,
                total_earnings: 42.5,
              },
            ],
          },
          error: null,
        };
      }

      return { data: { success: true }, error: null };
    });
  });

  it("lists codes and toggles active state through the server function", async () => {
    render(<AdminReferralCodes />, { wrapper: createWrapper() });

    expect(await screen.findByText("CREATOR1")).toBeInTheDocument();
    expect(mocks.invoke).toHaveBeenCalledWith("manage-referral-codes", {
      body: { action: "list" },
    });

    fireEvent.click(screen.getByRole("button", { name: /deactivate/i }));

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledWith("manage-referral-codes", {
        body: {
          action: "toggle",
          codeId: "code-1",
          isActive: true,
        },
      });
    });
  });
});
