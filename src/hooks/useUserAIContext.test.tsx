import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mocks.invoke(...args),
    },
    from: (...args: unknown[]) => mocks.from(...args),
  },
}));

import { useUserAIContext } from "./useUserAIContext";

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

describe("useUserAIContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockImplementation(() => {
      throw new Error("Direct table access is not expected in this test");
    });
    mocks.invoke.mockResolvedValue({
      data: {
        activeEpics: [],
        activeHabits: [],
        pendingQuestsCount: 0,
        currentStreaks: { maxHabitStreak: 0, dailyTaskStreak: 0 },
        completionRates: { thisWeek: 80, thisMonth: 70 },
        averageHabitsPerDay: 2,
        preferredDifficulty: "medium",
        preferredEpicDuration: 30,
        preferredHabitFrequency: "daily",
        commonContexts: ["focus"],
        preferenceWeights: { story_type: {}, theme_color: {}, categories: {} },
        tonePreference: null,
        atEpicLimit: false,
        overloaded: false,
        suggestedWorkload: "normal",
        recentCompletedEpics: 1,
        recentAbandonedEpics: 0,
      },
      error: null,
    });
  });

  it("hydrates preferences from enrich-user-context without querying user_ai_learning directly", async () => {
    const { result } = renderHook(() => useUserAIContext(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledWith("enrich-user-context");
      expect(result.current.preferences.commonContexts).toEqual(["focus"]);
      expect(result.current.preferences.epicDuration).toBe(30);
    });

    expect(mocks.from).not.toHaveBeenCalled();
  });
});
