import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fromMock: vi.fn(),
  awardCustomXPMock: vi.fn(),
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

vi.mock("./useXPRewards", () => ({
  useXPRewards: () => ({
    awardCustomXP: mocks.awardCustomXPMock,
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
    mocks.awardCustomXPMock.mockReset();
    mocks.toastMock.mockReset();
    mocks.invalidateQueriesMock.mockClear();
    mocks.playMissionCompleteMock.mockReset();
    mocks.confettiMock.mockReset();
  });

  it("awards auto-completed missions with mission_complete and preserves mission metadata", async () => {
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
        const builder = {
          update: () => builder,
          eq: () => builder,
          select: () => Promise.resolve({ data: [{ ...mission, completed: true }], error: null }),
        };
        return builder;
      }

      throw new Error(`Unexpected daily_missions access #${dailyMissionCallCount}`);
    });
    mocks.awardCustomXPMock.mockResolvedValue({ xpAwarded: mission.xp_reward });

    renderHook(() => useMissionAutoComplete());

    await waitFor(() => {
      expect(mocks.awardCustomXPMock).toHaveBeenCalledWith(
        mission.xp_reward,
        "mission_complete",
        `Mission Complete! ${mission.mission_text}`,
        {
          mission_id: mission.id,
          mission_type: mission.mission_type,
          mission_category: mission.category,
          source: "auto_complete",
        },
      );
    });
  });
});
