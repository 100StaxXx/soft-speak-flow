import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useJourneyPathImageMock: vi.fn(),
}));

vi.mock("@/hooks/useJourneyPathImage", () => ({
  useJourneyPathImage: (...args: unknown[]) => mocks.useJourneyPathImageMock(...args),
}));

import { ConstellationTrail } from "./ConstellationTrail";

describe("ConstellationTrail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useJourneyPathImageMock.mockReturnValue({
      pathImageUrl: null,
      currentMilestoneIndex: -1,
      isGenerating: false,
      isLoading: false,
      error: null,
      generateInitialPath: vi.fn(),
      regeneratePathForMilestone: vi.fn(),
    });
  });

  it("renders the persisted/generated path immediately without a blocking loading state", () => {
    mocks.useJourneyPathImageMock.mockReturnValue({
      pathImageUrl: "https://example.com/persisted-path.png",
      currentMilestoneIndex: 1,
      isGenerating: false,
      isLoading: false,
      error: null,
      generateInitialPath: vi.fn(),
      regeneratePathForMilestone: vi.fn(),
    });

    render(<ConstellationTrail progress={18} targetDays={30} epicId="epic-1" />);

    expect(screen.getByTestId("journey-path-image")).toHaveAttribute("src", "https://example.com/persisted-path.png");
    expect(screen.queryByText(/mapping your path/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/loading journey path/i)).not.toBeInTheDocument();
  });

  it("shows a static fallback immediately and keeps it visible while the path updates", () => {
    mocks.useJourneyPathImageMock.mockReturnValue({
      pathImageUrl: null,
      currentMilestoneIndex: -1,
      isGenerating: true,
      isLoading: false,
      error: null,
      generateInitialPath: vi.fn(),
      regeneratePathForMilestone: vi.fn(),
    });

    render(<ConstellationTrail progress={42} targetDays={45} epicId="epic-9" />);

    expect(screen.getByTestId("journey-path-fallback")).toBeInTheDocument();
    expect(screen.getByText("Updating")).toBeInTheDocument();
    expect(screen.queryByText(/mapping your path/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/loading journey path/i)).not.toBeInTheDocument();
  });
});
