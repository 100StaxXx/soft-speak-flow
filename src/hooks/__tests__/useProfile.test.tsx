import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock useAuth
vi.mock("../useAuth", () => ({
  useAuth: () => ({
    user: { id: "test-user-123", email: "test@example.com" },
    session: { access_token: "token" },
    loading: false,
  }),
}));

// Mock supabase with chainable methods
const mockMaybeSingle = vi.fn();
const mockUpsertMaybeSingle = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: mockMaybeSingle,
        })),
      })),
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          maybeSingle: mockUpsertMaybeSingle,
        })),
      })),
    })),
  },
}));

// Import after mocks are set up
import { isPostgresSchemaError, useProfile } from "../useProfile";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// Helper to wait for condition
const waitForCondition = async (condition: () => boolean, timeout = 1000) => {
  const start = Date.now();
  while (!condition() && Date.now() - start < timeout) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
};

describe("useProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns profile when user exists", async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        id: "test-user-123",
        email: "test@example.com",
        is_premium: false,
        onboarding_completed: true,
      },
      error: null,
    });

    const { result } = renderHook(() => useProfile(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await waitForCondition(() => !result.current.loading);
    });

    expect(result.current.profile).toBeTruthy();
    expect(result.current.profile?.id).toBe("test-user-123");
  });

  it("creates profile when none exists (new user)", async () => {
    // First call returns null (no profile)
    mockMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    // Upsert creates new profile
    mockUpsertMaybeSingle.mockResolvedValueOnce({
      data: {
        id: "test-user-123",
        email: "test@example.com",
        is_premium: false,
      },
      error: null,
    });

    const { result } = renderHook(() => useProfile(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await waitForCondition(() => !result.current.loading);
    });

    // Profile should be created via upsert
    expect(result.current.profile).toBeTruthy();
  });

  it("handles loading state correctly", () => {
    mockMaybeSingle.mockImplementation(() => new Promise(() => {})); // Never resolves

    const { result } = renderHook(() => useProfile(), {
      wrapper: createWrapper(),
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.profile).toBeNull();
  });

  it("does not retry deterministic Postgres schema errors", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const schemaError = {
      code: "42703",
      message: "column profiles.readable_quest_cards_enabled does not exist",
    };
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: schemaError,
    });

    const { result } = renderHook(() => useProfile(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.error).toBe(schemaError);
    });

    expect(isPostgresSchemaError(schemaError)).toBe(true);
    expect(mockMaybeSingle).toHaveBeenCalledTimes(1);
    consoleErrorSpy.mockRestore();
  });
});
