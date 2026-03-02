import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type MissionRow = {
  id: string;
  mission_text: string;
  mission_type: string;
  category: string;
  xp_reward: number;
  completed: boolean;
  progress_target: number;
  progress_current: number;
  auto_complete: boolean;
  is_bonus: boolean;
};

const mocks = vi.hoisted(() => {
  const toast = vi.fn();
  const invoke = vi.fn();
  const from = vi.fn();
  const existingMissionResponses: Array<{ data: unknown; error: unknown }> = [];
  const awardCustomXP = vi.fn();
  const checkFirstTimeAchievements = vi.fn();

  return {
    toast,
    invoke,
    from,
    existingMissionResponses,
    awardCustomXP,
    checkFirstTimeAchievements,
    user: { id: "user-1" },
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.from,
    functions: {
      invoke: mocks.invoke,
    },
  },
}));

vi.mock("./useAuth", () => ({
  useAuth: () => ({
    user: mocks.user,
  }),
}));

vi.mock("./use-toast", () => ({
  useToast: () => ({
    toast: mocks.toast,
  }),
}));

vi.mock("./useXPRewards", () => ({
  useXPRewards: () => ({
    awardCustomXP: mocks.awardCustomXP,
  }),
}));

vi.mock("./useAchievements", () => ({
  useAchievements: () => ({
    checkFirstTimeAchievements: mocks.checkFirstTimeAchievements,
  }),
}));

vi.mock("@/utils/soundEffects", () => ({
  playMissionComplete: vi.fn(),
}));

vi.mock("@/utils/timezone", () => ({
  getEffectiveMissionDate: () => "2026-03-02",
}));

import { useDailyMissions } from "./useDailyMissions";

function buildSelectQueryResponse() {
  let eqCount = 0;
  const builder: {
    select: () => typeof builder;
    eq: (column: string, value: unknown) => typeof builder | Promise<{ data: unknown; error: unknown }>;
  } = {
    select: () => builder,
    eq: () => {
      eqCount += 1;
      if (eqCount >= 2) {
        return Promise.resolve(
          mocks.existingMissionResponses.shift() ?? { data: [], error: null },
        );
      }
      return builder;
    },
  };

  return builder;
}

function createHookWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 0,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function makeMission(id: string, category: string): MissionRow {
  return {
    id,
    mission_text: `Mission ${id}`,
    mission_type: category,
    category,
    xp_reward: 8,
    completed: false,
    progress_target: 1,
    progress_current: 0,
    auto_complete: false,
    is_bonus: false,
  };
}

describe("useDailyMissions", () => {
  beforeEach(() => {
    mocks.toast.mockClear();
    mocks.invoke.mockReset();
    mocks.from.mockImplementation((table: string) => {
      if (table === "daily_missions") {
        return buildSelectQueryResponse();
      }
      throw new Error(`Unexpected table access: ${table}`);
    });
    mocks.existingMissionResponses.length = 0;
  });

  it("maps function non-2xx errors to friendly mission refresh copy", async () => {
    mocks.existingMissionResponses.push({ data: [], error: null });
    mocks.invoke.mockResolvedValue({
      data: null,
      error: {
        name: "FunctionsHttpError",
        message: "Edge Function returned a non-2xx status code",
        context: new Response(
          JSON.stringify({
            error: "Mission generation is temporarily unavailable.",
            code: "AI_UPSTREAM_UNAVAILABLE",
          }),
          {
            status: 502,
            headers: { "Content-Type": "application/json" },
          },
        ),
      },
    });

    const { result } = renderHook(() => useDailyMissions(), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalled();
    });

    const firstToast = mocks.toast.mock.calls[0]?.[0] as { title?: string; description?: string; variant?: string };
    expect(firstToast.title).toBe("Mission refresh failed");
    expect(firstToast.variant).toBe("destructive");
    expect(firstToast.description).toContain("Mission generation is temporarily unavailable.");
    expect(firstToast.description?.toLowerCase()).not.toContain("non-2xx");
    expect(result.current.generationErrorMessage).toBe("Mission generation is temporarily unavailable.");
  });

  it("does not emit duplicate destructive toasts across retriable query retries", async () => {
    mocks.existingMissionResponses.push({ data: [], error: null });
    mocks.invoke.mockResolvedValue({
      data: null,
      error: {
        name: "FunctionsFetchError",
        message: "Failed to send a request to the Edge Function",
      },
    });

    renderHook(() => useDailyMissions(), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledTimes(1);
    });

    const destructiveToasts = mocks.toast.mock.calls.filter((call) => call[0]?.variant === "destructive");
    expect(destructiveToasts).toHaveLength(1);
    expect(mocks.invoke.mock.calls.length).toBeGreaterThan(1);
  });

  it("loads fallback missions and shows backup info toast once", async () => {
    const fallbackMissions = [
      makeMission("m1", "connection"),
      makeMission("m2", "quick_win"),
      makeMission("m3", "growth"),
    ];

    mocks.existingMissionResponses.push({ data: [], error: null });
    mocks.invoke.mockResolvedValue({
      data: {
        missions: fallbackMissions,
        generated: true,
        meta: {
          source: "fallback",
          degraded: true,
          reason: "rate_limited",
        },
      },
      error: null,
    });

    const { result, rerender } = renderHook(() => useDailyMissions(), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => {
      expect(result.current.missions).toHaveLength(3);
    });

    rerender();

    const backupToasts = mocks.toast.mock.calls.filter((call) => call[0]?.title === "Backup missions loaded");
    expect(backupToasts).toHaveLength(1);
  });
});
