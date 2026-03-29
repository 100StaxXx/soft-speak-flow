import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const storage = new Map<string, string>();

  return {
    invokeMock: vi.fn(),
    fromMock: vi.fn(),
    storage,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: mocks.invokeMock,
    },
    from: mocks.fromMock,
  },
}));

vi.mock("@/utils/storage", () => ({
  safeLocalStorage: {
    getItem: (key: string) => mocks.storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      mocks.storage.set(key, value);
    },
    removeItem: (key: string) => {
      mocks.storage.delete(key);
    },
  },
  safeSessionStorage: {
    getItem: (key: string) => mocks.storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      mocks.storage.set(key, value);
    },
    removeItem: (key: string) => {
      mocks.storage.delete(key);
    },
  },
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => false,
  },
}));

vi.mock("@capacitor/share", () => ({
  Share: {
    share: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import InfluencerDashboard from "@/pages/InfluencerDashboard";

const createWrapper = (initialEntry: string) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe("InfluencerDashboard", () => {
  beforeEach(() => {
    mocks.invokeMock.mockReset();
    mocks.fromMock.mockReset();
    mocks.storage.clear();
  });

  it("loads creator data through get-creator-stats without direct table reads", async () => {
    mocks.invokeMock.mockResolvedValue({
      data: {
        creator: {
          code: "COSMIQ-TEST",
          name: "Creator Name",
          handle: "@creator",
          contact_email_masked: "cr*****@example.com",
          payout_destination_masked: "cr*****@example.com",
          created_at: "2026-03-01T00:00:00.000Z",
        },
        stats: {
          total_signups: 3,
          active_subscribers: 2,
          pending_earnings: 55,
          requested_earnings: 0,
          paid_earnings: 12,
          total_earnings: 67,
        },
        recent_signups: [
          {
            id: "signup-1",
            email_masked: "fr*****@example.com",
            created_at: "2026-03-02T00:00:00.000Z",
            subscription_status: "active",
          },
        ],
        payout_history: [
          {
            amount: 12,
            status: "paid",
            payout_type: "first_year",
            created_at: "2026-03-03T00:00:00.000Z",
            paid_at: "2026-03-04T00:00:00.000Z",
          },
        ],
      },
      error: null,
    });

    render(<InfluencerDashboard />, {
      wrapper: createWrapper("/creator/dashboard?code=COSMIQ-TEST&token=secure-token"),
    });

    await waitFor(() => {
      expect(screen.getByText(/Welcome back, Creator Name!/)).toBeInTheDocument();
    });

    expect(mocks.invokeMock).toHaveBeenCalledWith("get-creator-stats", {
      body: {
        referral_code: "COSMIQ-TEST",
        creator_access_token: "secure-token",
      },
    });
    expect(mocks.fromMock).not.toHaveBeenCalled();
    expect(screen.getByText("fr*****@example.com")).toBeInTheDocument();
  });
});
