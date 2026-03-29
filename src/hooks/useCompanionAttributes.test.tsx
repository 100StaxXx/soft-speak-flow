import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpcMock: vi.fn(),
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

import { getStreakDisciplineGain, useCompanionAttributes } from "./useCompanionAttributes";

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

const rpcSuccess = {
  data: [{
    awarded_amount: 4,
    attribute_before: 300,
    attribute_after: 304,
    cap_applied: false,
    was_duplicate: false,
    echo_amount: 1,
  }],
  error: null,
};

describe("useCompanionAttributes discipline awards", () => {
  beforeEach(() => {
    mocks.rpcMock.mockReset();
    mocks.rpcMock.mockResolvedValue(rpcSuccess);
  });

  it("builds the expected habit completion source key", async () => {
    const { result } = renderHook(() => useCompanionAttributes(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.awardDisciplineForHabitCompletion({
        companionId: "companion-1",
        habitId: "habit-1",
        date: "2026-03-28",
      });
    });

    expect(mocks.rpcMock).toHaveBeenCalledWith("award_companion_attribute", {
      p_attribute: "discipline",
      p_source_event: "habit_complete",
      p_source_key: "habit_complete:habit-1:2026-03-28",
      p_amount: 4,
      p_apply_echo_gains: true,
    });
  });

  it("builds the expected planned-task source key", async () => {
    const { result } = renderHook(() => useCompanionAttributes(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.awardDisciplineForPlannedTaskOnTime({
        companionId: "companion-1",
        taskId: "task-1",
      });
    });

    expect(mocks.rpcMock).toHaveBeenCalledWith("award_companion_attribute", {
      p_attribute: "discipline",
      p_source_event: "planned_task_on_time",
      p_source_key: "planned_task_on_time:task-1",
      p_amount: 2,
      p_apply_echo_gains: true,
    });
  });

  it("maps streak milestones to the rebalanced source key and amount", async () => {
    const { result } = renderHook(() => useCompanionAttributes(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.updateFromStreakMilestone({
        companionId: "companion-1",
        streakDays: 14,
        date: "2026-03-28",
      });
    });

    expect(mocks.rpcMock).toHaveBeenCalledWith("award_companion_attribute", {
      p_attribute: "discipline",
      p_source_event: "streak_milestone",
      p_source_key: "streak_milestone:14:2026-03-28",
      p_amount: 25,
      p_apply_echo_gains: true,
    });
  });
});

describe("getStreakDisciplineGain", () => {
  it("returns the expected milestone amounts", () => {
    expect(getStreakDisciplineGain(5)).toBe(0);
    expect(getStreakDisciplineGain(7)).toBe(15);
    expect(getStreakDisciplineGain(14)).toBe(25);
    expect(getStreakDisciplineGain(21)).toBe(5);
    expect(getStreakDisciplineGain(30)).toBe(40);
  });
});
