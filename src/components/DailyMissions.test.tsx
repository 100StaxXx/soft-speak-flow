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

interface TestPulse {
  mission_date: string;
  caller_faction: string | null;
  faction_completion_percentage: number;
  network_average_completion_percentage: number;
  faction_vs_network_average_pp: number;
}

const buildPulse = (overrides: Partial<TestPulse> = {}): TestPulse => ({
  mission_date: "2026-04-09",
  caller_faction: "starfall",
  faction_completion_percentage: 72,
  network_average_completion_percentage: 61,
  faction_vs_network_average_pp: 11,
  ...overrides,
});

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
      pulse: buildPulse(),
      isLoading: false,
      error: null,
    });

    mockUseProfile.mockReturnValue({
      profile: {
        faction: "starfall",
      },
    });
  });

  it("renders faction-themed percentage comparisons without exposing raw counts", () => {
    render(<DailyMissions />);

    expect(screen.getByText("Guild Missions")).toBeInTheDocument();
    expect(screen.getByText(/STARFALL FLEET Dispatch/i)).toBeInTheDocument();
    expect(screen.getByText("Network Average")).toBeInTheDocument();
    expect(screen.getByText("72%")).toBeInTheDocument();
    expect(screen.getByText("61%")).toBeInTheDocument();
    expect(screen.getByText("11 pts above average")).toBeInTheDocument();
    expect(screen.getByText("Average mission completion across guilds today")).toBeInTheDocument();
    expect(screen.getByText("Daily mission completion rate compared with other guilds")).toBeInTheDocument();
    expect(screen.queryByText(/adventurers have cleared at least one mission/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/missions marked complete/i)).not.toBeInTheDocument();
    expect(screen.getByText("Send a quick encouragement text")).toBeInTheDocument();
  });

  it("renders below-average comparison copy", () => {
    mockUseDailyMissionPulse.mockReturnValue({
      pulse: buildPulse({
        faction_completion_percentage: 43,
        network_average_completion_percentage: 58,
        faction_vs_network_average_pp: -15,
      }),
      isLoading: false,
      error: null,
    });

    render(<DailyMissions />);

    expect(screen.getByText("15 pts below average")).toBeInTheDocument();
  });

  it("renders at-average comparison copy", () => {
    mockUseDailyMissionPulse.mockReturnValue({
      pulse: buildPulse({
        faction_completion_percentage: 58,
        network_average_completion_percentage: 58,
        faction_vs_network_average_pp: 0,
      }),
      isLoading: false,
      error: null,
    });

    render(<DailyMissions />);

    expect(screen.getByText("At guild average")).toBeInTheDocument();
  });

  it("shows only the network benchmark when the user has no faction", () => {
    mockUseDailyMissionPulse.mockReturnValue({
      pulse: buildPulse({
        caller_faction: null,
        faction_completion_percentage: 0,
        network_average_completion_percentage: 64,
        faction_vs_network_average_pp: 0,
      }),
      isLoading: false,
      error: null,
    });

    mockUseProfile.mockReturnValue({
      profile: {
        faction: null,
      },
    });

    render(<DailyMissions />);

    expect(screen.getByText("Daily Missions")).toBeInTheDocument();
    expect(screen.getByText("Network Average")).toBeInTheDocument();
    expect(screen.queryByText("Guild Missions")).not.toBeInTheDocument();
    expect(screen.queryByText(/STARFALL FLEET Dispatch/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Your Guild")).not.toBeInTheDocument();
  });
});
