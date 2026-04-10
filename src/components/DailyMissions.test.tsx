import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseDailyMissions = vi.fn();
const mockUseDailyMissionPulse = vi.fn();
const mockUseProfile = vi.fn();

vi.mock("canvas-confetti", () => ({
  default: vi.fn(),
}));

vi.mock("@/utils/haptics", () => ({
  haptics: {
    medium: vi.fn(),
    light: vi.fn(),
  },
}));

vi.mock("@/hooks/useMissionAutoComplete", () => ({
  useMissionAutoComplete: vi.fn(),
}));

vi.mock("@/hooks/useDailyMissions", () => ({
  useDailyMissions: () => mockUseDailyMissions(),
}));

vi.mock("@/hooks/useDailyMissionPulse", () => ({
  useDailyMissionPulse: () => mockUseDailyMissionPulse(),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => mockUseProfile(),
}));

import { DailyMissions } from "./DailyMissions";

describe("DailyMissions", () => {
  beforeEach(() => {
    mockUseDailyMissions.mockReturnValue({
      missionDate: "2026-04-09",
      missions: [
        {
          id: "mission-1",
          mission_text: "Send a quick encouragement text",
          xp_reward: 8,
          completed: false,
          progress_target: 1,
          progress_current: 0,
          auto_complete: false,
          is_bonus: false,
          difficulty: "easy",
        },
      ],
      isLoading: false,
      completeMission: vi.fn(),
      isCompleting: false,
      completedCount: 1,
      totalCount: 3,
      allComplete: false,
      regenerateMissions: vi.fn(),
      isRegenerating: false,
      generationErrorMessage: null,
      missionTheme: {
        name: "Momentum Monday",
        emoji: "🚀",
      },
    });

    mockUseDailyMissionPulse.mockReturnValue({
      pulse: {
        mission_date: "2026-04-09",
        caller_faction: "starfall",
        faction_participants: 25,
        faction_completed_users: 18,
        faction_completion_percentage: 72,
        faction_missions_total: 75,
        faction_missions_completed: 46,
        global_participants: 140,
        global_completed_users: 85,
        global_completion_percentage: 61,
        global_missions_total: 420,
        global_missions_completed: 237,
      },
      isLoading: false,
      error: null,
    });

    mockUseProfile.mockReturnValue({
      profile: {
        faction: "starfall",
      },
    });
  });

  it("renders faction-themed telemetry with faction and global completion totals", () => {
    render(<DailyMissions />);

    expect(screen.getByText("Guild Missions")).toBeInTheDocument();
    expect(screen.getByText(/STARFALL FLEET Dispatch/i)).toBeInTheDocument();
    expect(screen.getByText("Global Network")).toBeInTheDocument();
    expect(screen.getByText("72%")).toBeInTheDocument();
    expect(screen.getByText("61%")).toBeInTheDocument();
    expect(screen.getByText(/18 \/ 25 adventurers have cleared at least one mission/i)).toBeInTheDocument();
    expect(screen.getByText(/237 \/ 420 missions marked complete/i)).toBeInTheDocument();
    expect(screen.getByText("Send a quick encouragement text")).toBeInTheDocument();
  });
});
