import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
  showXPToastMock: vi.fn(),
  toastMock: vi.fn(),
  invalidateQueriesMock: vi.fn().mockResolvedValue(undefined),
  playMissionCompleteMock: vi.fn(),
  confettiMock: vi.fn(),
  user: { id: "user-1" },
  activities: [
    {
      id: "activity-1",
      activity_type: "library_visited",
      activity_data: {},
      mentor_comment: null,
      mentor_voice_url: null,
      created_at: "2026-04-12T12:00:00.000Z",
      is_read: false,
    },
  ],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.fromMock,
    rpc: mocks.rpcMock,
  },
}));

vi.mock("./useAuth", () => ({
  useAuth: () => ({
    user: mocks.user,
  }),
}));

vi.mock("./useActivityFeed", () => ({
  useActivityFeed: () => ({
    activities: mocks.activities,
  }),
}));

vi.mock("@/contexts/XPContext", () => ({
  useXPToast: () => ({
    showXPToast: mocks.showXPToastMock,
  }),
}));

vi.mock("./use-toast", () => ({
  useToast: () => ({
    toast: mocks.toastMock,
  }),
}));

vi.mock("@/utils/soundEffects", () => ({
  playMissionComplete: mocks.playMissionCompleteMock,
}));

vi.mock("canvas-confetti", () => ({
  default: mocks.confettiMock,
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

import { useMissionAutoComplete } from "./useMissionAutoComplete";

describe("useMissionAutoComplete", () => {
  beforeEach(() => {
    mocks.fromMock.mockReset();
    mocks.rpcMock.mockReset();
    mocks.showXPToastMock.mockReset();
    mocks.toastMock.mockReset();
    mocks.invalidateQueriesMock.mockClear();
    mocks.playMissionCompleteMock.mockReset();
    mocks.confettiMock.mockReset();
  });

  it("auto-completes missions through the atomic RPC and preserves reward feedback", async () => {
    const mission = {
      id: "mission-1",
      mission_text: "Explore the library",
      mission_type: "library_explore",
      category: "growth",
      xp_reward: 8,
      completed: false,
      auto_complete: true,
      progress_target: 1,
      progress_current: 1,
    };

    let dailyMissionCallCount = 0;
    mocks.fromMock.mockImplementation((table: string) => {
      if (table !== "daily_missions") {
        throw new Error(`Unexpected table access: ${table}`);
      }

      dailyMissionCallCount += 1;

      if (dailyMissionCallCount === 1) {
        let eqCount = 0;
        const builder = {
          select: () => builder,
          eq: () => {
            eqCount += 1;
            if (eqCount >= 4) {
              return Promise.resolve({ data: [mission], error: null });
            }
            return builder;
          },
        };
        return builder;
      }

      if (dailyMissionCallCount === 2) {
        let eqCount = 0;
        const builder = {
          update: () => builder,
          eq: () => {
            eqCount += 1;
            if (eqCount >= 2) {
              return Promise.resolve({ error: null });
            }
            return builder;
          },
        };
        return builder;
      }

      throw new Error(`Unexpected daily_missions access #${dailyMissionCallCount}`);
    });
    mocks.rpcMock.mockResolvedValue({
      data: [{
        status: "completed",
        message: null,
        mission_id: mission.id,
        completed_at: "2026-04-12T12:00:00.000Z",
        xp_awarded: mission.xp_reward,
        xp_before: 100,
        xp_after: 108,
        should_evolve: false,
        next_threshold: 120,
        cap_applied: false,
        level_before: 10,
        level_after: 10,
        tier_before: "base",
        tier_after: "base",
        earned_level_after: 10,
        earned_tier_after: "base",
        claimed_stage_after: 10,
        pending_evolution_count: 0,
      }],
      error: null,
    });

    renderHook(() => useMissionAutoComplete());

    await waitFor(() => {
      expect(mocks.rpcMock).toHaveBeenCalledWith("complete_daily_mission_with_xp", {
        p_completion_source: "auto_complete",
        p_mission_id: mission.id,
        p_progress_current: mission.progress_target,
      });
    });

    expect(mocks.showXPToastMock).toHaveBeenCalledWith(
      mission.xp_reward,
      `Mission Complete! ${mission.mission_text}`,
    );
    expect(mocks.toastMock).toHaveBeenCalledWith({
      title: "Mission Auto-Completed! 🎯",
      description: `${mission.mission_text} (+${mission.xp_reward} XP)`,
    });
  });

  it("does not emit reward feedback when the mission was already completed elsewhere", async () => {
    const mission = {
      id: "mission-2",
      mission_text: "Explore the archive",
      mission_type: "library_explore",
      category: "growth",
      xp_reward: 8,
      completed: false,
      auto_complete: true,
      progress_target: 1,
      progress_current: 1,
    };

    let dailyMissionCallCount = 0;
    mocks.fromMock.mockImplementation((table: string) => {
      if (table !== "daily_missions") {
        throw new Error(`Unexpected table access: ${table}`);
      }

      dailyMissionCallCount += 1;

      if (dailyMissionCallCount === 1) {
        let eqCount = 0;
        const builder = {
          select: () => builder,
          eq: () => {
            eqCount += 1;
            if (eqCount >= 4) {
              return Promise.resolve({ data: [mission], error: null });
            }
            return builder;
          },
        };
        return builder;
      }

      if (dailyMissionCallCount === 2) {
        let eqCount = 0;
        const builder = {
          update: () => builder,
          eq: () => {
            eqCount += 1;
            if (eqCount >= 2) {
              return Promise.resolve({ error: null });
            }
            return builder;
          },
        };
        return builder;
      }

      throw new Error(`Unexpected daily_missions access #${dailyMissionCallCount}`);
    });
    mocks.rpcMock.mockResolvedValue({
      data: [{
        status: "already_completed",
        message: "XP has already been claimed for this mission.",
        mission_id: mission.id,
        completed_at: "2026-04-12T12:00:00.000Z",
        xp_awarded: 0,
        xp_before: null,
        xp_after: null,
        should_evolve: false,
        next_threshold: null,
        cap_applied: false,
        level_before: null,
        level_after: null,
        tier_before: null,
        tier_after: null,
        earned_level_after: null,
        earned_tier_after: null,
        claimed_stage_after: null,
        pending_evolution_count: 0,
      }],
      error: null,
    });

    renderHook(() => useMissionAutoComplete());

    await waitFor(() => {
      expect(mocks.rpcMock).toHaveBeenCalledTimes(1);
    });

    expect(mocks.showXPToastMock).not.toHaveBeenCalled();
    expect(mocks.toastMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: "Mission Auto-Completed! 🎯" }),
    );
    expect(mocks.playMissionCompleteMock).not.toHaveBeenCalled();
  });
});
