import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  fromMock: vi.fn(),
  showXPToastMock: vi.fn(),
  awardXPMutateMock: vi.fn(),
  awardXPMutateAsyncMock: vi.fn(),
  updateWisdomFromLearningMock: vi.fn(),
  awardWisdomForHabitLearningMock: vi.fn(),
  awardAlignmentForMorningCheckInMock: vi.fn(),
  awardAlignmentForEveningReflectionMock: vi.fn(),
  updateFromStreakMilestoneMock: vi.fn(),
  awardDisciplineForHabitCompletionMock: vi.fn(),
  invalidateQueriesMock: vi.fn().mockResolvedValue(undefined),
  loggerErrorMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: mocks.rpcMock,
    from: mocks.fromMock,
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
    EVENING_REFLECTION: 6,
    STREAK_MILESTONE: 15,
    PEP_TALK_LISTEN: 8,
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
    awardWisdomForHabitLearning: mocks.awardWisdomForHabitLearningMock,
    awardAlignmentForMorningCheckIn: mocks.awardAlignmentForMorningCheckInMock,
    awardAlignmentForEveningReflection: mocks.awardAlignmentForEveningReflectionMock,
    updateFromStreakMilestone: mocks.updateFromStreakMilestoneMock,
    awardDisciplineForHabitCompletion: mocks.awardDisciplineForHabitCompletionMock,
  }),
}));

vi.mock("./useStreakMultiplier", () => ({
  useStreakMultiplier: () => ({
    multiplier: 1,
  }),
}));

vi.mock("@/utils/logger", () => ({
  logger: {
    error: mocks.loggerErrorMock,
    log: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
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
    mocks.fromMock.mockReset();
    mocks.showXPToastMock.mockClear();
    mocks.awardXPMutateMock.mockClear();
    mocks.awardXPMutateAsyncMock.mockReset();
    mocks.awardXPMutateAsyncMock.mockResolvedValue({
      xpAwarded: 4,
      capApplied: false,
      nextThreshold: 120,
      shouldEvolve: false,
    });
    mocks.updateWisdomFromLearningMock.mockClear();
    mocks.awardWisdomForHabitLearningMock.mockClear();
    mocks.awardAlignmentForMorningCheckInMock.mockClear();
    mocks.awardAlignmentForEveningReflectionMock.mockClear();
    mocks.updateFromStreakMilestoneMock.mockClear();
    mocks.awardDisciplineForHabitCompletionMock.mockClear();
    mocks.invalidateQueriesMock.mockClear();
    mocks.loggerErrorMock.mockClear();
    mocks.updateWisdomFromLearningMock.mockResolvedValue(undefined);
    mocks.awardWisdomForHabitLearningMock.mockResolvedValue(undefined);
    mocks.awardAlignmentForMorningCheckInMock.mockResolvedValue(undefined);
    mocks.awardAlignmentForEveningReflectionMock.mockResolvedValue(undefined);
    mocks.updateFromStreakMilestoneMock.mockResolvedValue(undefined);
    mocks.awardDisciplineForHabitCompletionMock.mockResolvedValue(undefined);

    mocks.fromMock.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(async () => ({ count: 0, error: null })),
          })),
        })),
      })),
    });
  });

  it("keeps check-ins on the alignment path without touching discipline", async () => {
    const { result } = renderHook(() => useXPRewards(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.awardCheckInComplete();
    });

    expect(mocks.rpcMock).toHaveBeenCalledWith("mark_companion_active");
    expect(mocks.showXPToastMock).toHaveBeenCalledWith(4, "Prayer complete");
    expect(mocks.awardXPMutateAsyncMock).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "check_in",
      xpAmount: 4,
      idempotencyKey: expect.stringMatching(/^morning-prayer:/),
    }));
    expect(mocks.awardAlignmentForMorningCheckInMock).toHaveBeenCalledWith({
      companionId: "companion-1",
      date: expect.any(String),
    });
    expect(mocks.awardDisciplineForHabitCompletionMock).not.toHaveBeenCalled();
  });

  it("routes habit completions through tracked wisdom and discipline awards when context is available", async () => {
    const { result } = renderHook(() => useXPRewards(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.awardHabitCompletion({
        habitId: "habit-1",
        date: "2026-03-28",
      });
    });

    expect(mocks.awardWisdomForHabitLearningMock).toHaveBeenCalledWith({
      companionId: "companion-1",
      habitId: "habit-1",
      date: "2026-03-28",
    });
    expect(mocks.awardDisciplineForHabitCompletionMock).toHaveBeenCalledWith({
      companionId: "companion-1",
      habitId: "habit-1",
      date: "2026-03-28",
    });
    expect(mocks.updateWisdomFromLearningMock).not.toHaveBeenCalled();
  });

  it("routes evening reflections through tracked alignment awards", async () => {
    mocks.awardXPMutateAsyncMock.mockResolvedValueOnce({
      xpAwarded: 6,
      capApplied: false,
      nextThreshold: 120,
      shouldEvolve: false,
    });
    const { result } = renderHook(() => useXPRewards(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.awardReflectionComplete();
    });

    expect(mocks.awardAlignmentForEveningReflectionMock).toHaveBeenCalledWith({
      companionId: "companion-1",
      date: expect.any(String),
    });
    expect(mocks.awardXPMutateAsyncMock).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "evening_reflection",
      xpAmount: 6,
      idempotencyKey: expect.stringMatching(/^evening-reflection:/),
    }));
  });

  it("returns pep talk award results and only toasts on successful XP awards", async () => {
    mocks.awardXPMutateAsyncMock.mockResolvedValueOnce({
      xpAwarded: 8,
      capApplied: false,
      nextThreshold: 120,
      shouldEvolve: false,
    });
    mocks.awardXPMutateAsyncMock.mockResolvedValueOnce({
      xpAwarded: 0,
      capApplied: false,
      nextThreshold: 120,
      shouldEvolve: false,
    });

    const { result } = renderHook(() => useXPRewards(), {
      wrapper: createWrapper(),
    });

    let awardResult: Awaited<ReturnType<typeof result.current.awardPepTalkListenedAsync>>;
    let duplicateResult: Awaited<ReturnType<typeof result.current.awardPepTalkListenedAsync>>;

    await act(async () => {
      awardResult = await result.current.awardPepTalkListenedAsync({ pep_talk_id: "pep-talk-1" });
      duplicateResult = await result.current.awardPepTalkListenedAsync({ pep_talk_id: "pep-talk-1" });
    });

    expect(mocks.awardXPMutateAsyncMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      eventType: "pep_talk_listen",
      xpAmount: 8,
      metadata: { pep_talk_id: "pep-talk-1" },
    }));
    expect(awardResult).toEqual({
      xpAwarded: 8,
      capApplied: false,
      nextThreshold: 120,
      shouldEvolve: false,
      duplicate: false,
    });
    expect(duplicateResult).toEqual({
      xpAwarded: 0,
      capApplied: false,
      nextThreshold: 120,
      shouldEvolve: false,
      duplicate: true,
    });
    expect(mocks.showXPToastMock).toHaveBeenCalledTimes(1);
    expect(mocks.showXPToastMock).toHaveBeenCalledWith(8, "Pep Talk Listened!");
  });

  it("rethrows custom XP award failures after logging them", async () => {
    const xpError = new Error("Unsupported event_type: mission_growth");
    mocks.awardXPMutateAsyncMock.mockRejectedValueOnce(xpError);

    const { result } = renderHook(() => useXPRewards(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(
        result.current.awardCustomXP(8, "mission_complete", "Mission Complete!", {
          mission_id: "mission-1",
          mission_type: "growth",
        }),
      ).rejects.toThrow(xpError.message);
    });

    expect(mocks.showXPToastMock).toHaveBeenCalledWith(8, "Mission Complete!");
    expect(mocks.loggerErrorMock).toHaveBeenCalledWith("Error awarding custom XP:", xpError);
  });
});
