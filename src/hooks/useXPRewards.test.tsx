import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  showXPToastMock: vi.fn(),
  awardXPMutateMock: vi.fn(),
  awardXPMutateAsyncMock: vi.fn(),
  updateWisdomFromLearningMock: vi.fn(),
  updateAlignmentFromReflectionMock: vi.fn(),
  updateFromStreakMilestoneMock: vi.fn(),
  awardDisciplineForHabitCompletionMock: vi.fn(),
  triggerQuestCompleteMock: vi.fn().mockResolvedValue(undefined),
  invalidateQueriesMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: mocks.rpcMock,
    from: vi.fn(),
  },
}));

vi.mock("./useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("./useCompanion", () => ({
  useCompanion: () => ({
    companion: {
      id: "companion-1",
      current_stage: 1,
      current_xp: 100,
    },
    awardXP: {
      isPending: false,
      mutate: mocks.awardXPMutateMock,
      mutateAsync: mocks.awardXPMutateAsyncMock,
    },
  }),
  XP_REWARDS: {
    HABIT_COMPLETE: 8,
    CHECK_IN: 4,
    STREAK_MILESTONE: 15,
  },
}));

vi.mock("@/contexts/XPContext", () => ({
  useXPToast: () => ({
    showXPToast: mocks.showXPToastMock,
  }),
}));

vi.mock("./useCompanionAttributes", () => ({
  useCompanionAttributes: () => ({
    updateWisdomFromLearning: mocks.updateWisdomFromLearningMock,
    updateAlignmentFromReflection: mocks.updateAlignmentFromReflectionMock,
    updateFromStreakMilestone: mocks.updateFromStreakMilestoneMock,
    awardDisciplineForHabitCompletion: mocks.awardDisciplineForHabitCompletionMock,
  }),
}));

vi.mock("./useStreakMultiplier", () => ({
  useStreakMultiplier: () => ({
    multiplier: 1,
  }),
}));

vi.mock("./useLivingCompanion", () => ({
  useLivingCompanionSafe: () => ({
    triggerQuestComplete: mocks.triggerQuestCompleteMock,
  }),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mocks.invalidateQueriesMock,
    }),
  };
});

import { useXPRewards } from "./useXPRewards";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe("useXPRewards discipline rebalance", () => {
  beforeEach(() => {
    mocks.rpcMock.mockReset();
    mocks.rpcMock.mockResolvedValue({ error: null });
    mocks.showXPToastMock.mockClear();
    mocks.awardXPMutateMock.mockClear();
    mocks.awardXPMutateAsyncMock.mockClear();
    mocks.updateWisdomFromLearningMock.mockClear();
    mocks.updateAlignmentFromReflectionMock.mockClear();
    mocks.updateFromStreakMilestoneMock.mockClear();
    mocks.awardDisciplineForHabitCompletionMock.mockClear();
    mocks.invalidateQueriesMock.mockClear();
  });

  it("keeps check-ins on the alignment path without touching discipline", async () => {
    const { result } = renderHook(() => useXPRewards(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.awardCheckInComplete();
    });

    expect(mocks.rpcMock).toHaveBeenCalledWith("mark_companion_active");
    expect(mocks.showXPToastMock).toHaveBeenCalledWith(4, "Check-In Complete!");
    expect(mocks.awardXPMutateMock).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "check_in",
      xpAmount: 4,
    }));
    expect(mocks.updateAlignmentFromReflectionMock).toHaveBeenCalledWith("companion-1");
    expect(mocks.awardDisciplineForHabitCompletionMock).not.toHaveBeenCalled();
  });
});
