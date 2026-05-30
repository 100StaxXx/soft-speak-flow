import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function createSupabaseQuery(table: string) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
    maybeSingle: vi.fn(() =>
      Promise.resolve({
        data: table === "profiles"
          ? { referral_code: "MINE123", referral_count: 0, referred_by_code: null }
          : null,
        error: null,
      })
    ),
    update: vi.fn(() => query),
  };

  return query;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => createSupabaseQuery(table),
    functions: {
      invoke: (...args: unknown[]) => mocks.invoke(...args),
    },
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mocks.toastSuccess(...args),
    error: (...args: unknown[]) => mocks.toastError(...args),
  },
}));

import { useReferrals } from "./useReferrals";

describe("useReferrals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.invoke.mockResolvedValue({
      data: {
        success: true,
        message: "Code applied",
        code_type: "affiliate",
      },
      error: null,
    });
  });

  it("applies the local Genesis code through Supabase", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        success: true,
        message: "Genesis code applied",
        code_type: "special",
      },
      error: null,
    });

    const { result } = renderHook(() => useReferrals(), {
      wrapper: createQueryWrapper(),
    });

    await act(async () => {
      await result.current.applyReferralCode.mutateAsync("genesis");
    });

    expect(mocks.invoke).toHaveBeenCalledWith("claim-referral-code", {
      body: {
        code: "GENESIS",
      },
    });
  });

  it("applies normal creator codes through Supabase only", async () => {
    const { result } = renderHook(() => useReferrals(), {
      wrapper: createQueryWrapper(),
    });

    await act(async () => {
      await result.current.applyReferralCode.mutateAsync("creator123");
    });

    expect(mocks.invoke).toHaveBeenCalledWith("claim-referral-code", {
      body: {
        code: "CREATOR123",
      },
    });
  });

  it("preserves backend invalid-code messages and can suppress hook toasts", async () => {
    const invalidReferralError = Object.assign(new Error("Edge Function returned a non-2xx status code"), {
      context: new Response(JSON.stringify({ message: "Invalid referral code" }), { status: 404 }),
    });
    mocks.invoke.mockResolvedValueOnce({
      data: null,
      error: invalidReferralError,
    });

    const { result } = renderHook(() => useReferrals(), {
      wrapper: createQueryWrapper(),
    });

    await act(async () => {
      await expect(
        result.current.applyReferralCode.mutateAsync({
          code: "73WJL3EPLWX7WA36E6",
          suppressToast: true,
        }),
      ).rejects.toThrow("Invalid referral code");
    });

    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});
