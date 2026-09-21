import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseDailyMissions = vi.fn();
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

    mockUseProfile.mockReturnValue({
      profile: {
        faction: "starfall",
      },
    });
  });

  it("renders the Christian Path practice header without the comparison module", () => {
    render(<DailyMissions />);

    expect(screen.getByText("Path Practices")).toBeInTheDocument();
    expect(screen.getByText(/THE STEADFAST Practice/i)).toBeInTheDocument();
    expect(screen.queryByText("Today's Competition")).not.toBeInTheDocument();
    expect(screen.queryByText("Network Average")).not.toBeInTheDocument();
    expect(screen.queryByText(/pts above average/i)).not.toBeInTheDocument();
    expect(screen.getByText("Send a quick encouragement text")).toBeInTheDocument();
  });

  it("renders the generic mission header when the user has no faction", () => {
    mockUseProfile.mockReturnValue({
      profile: {
        faction: null,
      },
    });

    render(<DailyMissions />);

    expect(screen.getByText("Daily Practices")).toBeInTheDocument();
    expect(screen.queryByText("Path Practices")).not.toBeInTheDocument();
    expect(screen.queryByText(/THE STEADFAST Practice/i)).not.toBeInTheDocument();
  });

  it("renders mission progress and mission content", () => {
    render(<DailyMissions />);

    expect(screen.getByText("1/3 complete")).toBeInTheDocument();
    expect(screen.getByText("Momentum Monday")).toBeInTheDocument();
    expect(screen.getByText("Send a quick encouragement text")).toBeInTheDocument();
  });

  it("renders a completion button for incomplete manual missions", () => {
    render(<DailyMissions />);

    expect(screen.getByRole("button", { name: "Complete" })).toBeInTheDocument();
  });
});
