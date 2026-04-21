import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
  upsert: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: mocks.maybeSingle,
        }),
      }),
      upsert: mocks.upsert,
    }),
  },
}));

import { useCompanionModeSettings } from "./useCompanionModeSettings";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
};

describe("useCompanionModeSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.maybeSingle.mockResolvedValue({
      data: {
        companion_mode: "mentor",
        companion_mode_adaptation_enabled: false,
      },
      error: null,
    });
  });

  it("loads persisted companion mode settings", async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCompanionModeSettings(), { wrapper });

    await waitFor(() => {
      expect(result.current.mode).toBe("mentor");
    });

    expect(result.current.adaptationEnabled).toBe(false);
  });

  it("persists mode updates to user_ai_preferences", async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCompanionModeSettings(), { wrapper });

    await waitFor(() => {
      expect(result.current.mode).toBe("mentor");
    });

    await act(async () => {
      await result.current.setMode("calm");
      await result.current.setAdaptationEnabled(true);
    });

    expect(mocks.upsert).toHaveBeenNthCalledWith(
      1,
      {
        user_id: "user-1",
        companion_mode: "calm",
        companion_mode_adaptation_enabled: false,
      },
      { onConflict: "user_id" },
    );
    expect(mocks.upsert).toHaveBeenNthCalledWith(
      2,
      {
        user_id: "user-1",
        companion_mode: "calm",
        companion_mode_adaptation_enabled: true,
      },
      { onConflict: "user_id" },
    );
  });
});
