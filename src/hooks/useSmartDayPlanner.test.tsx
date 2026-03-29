import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const functionsInvokeMock = vi.fn();
  const fromMock = vi.fn();
  const warmDailyTasksQueryFromRemoteMock = vi.fn().mockResolvedValue([]);
  const hapticSuccessMock = vi.fn();
  const hapticMediumMock = vi.fn();
  const toastSuccessMock = vi.fn();
  const toastErrorMock = vi.fn();

  return {
    functionsInvokeMock,
    fromMock,
    warmDailyTasksQueryFromRemoteMock,
    hapticSuccessMock,
    hapticMediumMock,
    toastSuccessMock,
    toastErrorMock,
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/hooks/useHapticFeedback", () => ({
  useHapticFeedback: () => ({
    success: mocks.hapticSuccessMock,
    medium: mocks.hapticMediumMock,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mocks.toastSuccessMock(...args),
    error: (...args: unknown[]) => mocks.toastErrorMock(...args),
  },
}));

vi.mock("@/utils/plannerSync", () => ({
  warmDailyTasksQueryFromRemote: (...args: unknown[]) => mocks.warmDailyTasksQueryFromRemoteMock(...args),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mocks.fromMock(...args),
    functions: {
      invoke: (...args: unknown[]) => mocks.functionsInvokeMock(...args),
    },
  },
}));

import { useSmartDayPlanner } from "./useSmartDayPlanner";

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

describe("useSmartDayPlanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.functionsInvokeMock.mockImplementation(async (fnName: string) => {
      if (fnName === "generate-smart-daily-plan") {
        return {
          data: {
            tasks: [
              {
                title: "AI-generated quest",
                scheduledTime: "09:00",
                estimatedDuration: 45,
                priority: "high",
                category: "mind",
              },
            ],
            insights: [],
            totalHours: 0.75,
            balanceScore: 90,
            dayShape: "auto",
          },
          error: null,
        };
      }

      if (fnName === "record-daily-planning-use") {
        return {
          data: {
            times_used: 4,
            last_used_at: "2026-02-13T12:00:00.000Z",
          },
          error: null,
        };
      }

      return { data: null, error: null };
    });

    mocks.fromMock.mockImplementation((table: string) => {
      if (table === "daily_tasks" || table === "daily_plan_sessions") {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }

      if (table === "daily_planning_preferences") {
        return {
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("warms the saved date's local task cache after saving generated quests", async () => {
    const { result } = renderHook(
      () => useSmartDayPlanner(new Date(2026, 1, 13, 12, 0, 0)),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      const plan = await result.current.generatePlan();
      expect(plan?.tasks).toHaveLength(1);
    });

    await act(async () => {
      const saved = await result.current.savePlan();
      expect(saved).toBe(true);
    });

    expect(mocks.warmDailyTasksQueryFromRemoteMock).toHaveBeenCalledWith(
      expect.any(Object),
      "user-1",
      "2026-02-13",
    );
  });

  it("records planner usage through the server function when saving preferences", async () => {
    const { result } = renderHook(
      () => useSmartDayPlanner(new Date(2026, 1, 13, 12, 0, 0)),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      await result.current.savePreferences();
    });

    expect(mocks.functionsInvokeMock).toHaveBeenCalledWith("record-daily-planning-use", {
      body: { increment: true },
    });
  });
});
