import { fireEvent, render, screen } from "@testing-library/react";
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
      generationError: null,
      isGenerating: false,
      isWaitingForEpicSync: false,
      isLoading: false,
      error: null,
      generateInitialPath: vi.fn(),
      retryInitialPath: vi.fn(),
      regeneratePathForMilestone: vi.fn(),
    });
  });

  it("renders the persisted/generated path immediately without a blocking loading state", () => {
    mocks.useJourneyPathImageMock.mockReturnValue({
      pathImageUrl: "https://example.supabase.co/storage/v1/object/public/journey-paths/user-1/epic-1/path.png",
      currentMilestoneIndex: 1,
      generationError: null,
      isGenerating: false,
      isWaitingForEpicSync: false,
      isLoading: false,
      error: null,
      generateInitialPath: vi.fn(),
      retryInitialPath: vi.fn(),
      regeneratePathForMilestone: vi.fn(),
    });

    render(<ConstellationTrail progress={18} targetDays={30} epicId="epic-1" />);

    expect(screen.getByTestId("journey-path-image")).toHaveAttribute(
      "src",
      "https://example.supabase.co/storage/v1/object/public/journey-paths/user-1/epic-1/path.png",
    );
    expect(screen.getByTestId("journey-path-overlay")).toHaveAttribute("data-overlay-mode", "generated");
    expect(screen.queryByText(/mapping your path/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/loading journey path/i)).not.toBeInTheDocument();
  });

  it("shows a static fallback immediately and keeps it visible while the path updates", () => {
    mocks.useJourneyPathImageMock.mockReturnValue({
      pathImageUrl: null,
      currentMilestoneIndex: -1,
      generationError: null,
      isGenerating: true,
      isWaitingForEpicSync: false,
      isLoading: false,
      error: null,
      generateInitialPath: vi.fn(),
      retryInitialPath: vi.fn(),
      regeneratePathForMilestone: vi.fn(),
    });

    render(<ConstellationTrail progress={42} targetDays={45} epicId="epic-9" />);

    expect(screen.getByTestId("journey-path-fallback")).toBeInTheDocument();
    expect(screen.getByTestId("journey-path-overlay")).toHaveAttribute("data-overlay-mode", "fallback");
    expect(screen.getByText("Updating")).toBeInTheDocument();
    expect(screen.queryByText(/mapping your path/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/loading journey path/i)).not.toBeInTheDocument();
  });

  it("replaces the fallback with the generated image once a real path becomes available", () => {
    mocks.useJourneyPathImageMock.mockReturnValue({
      pathImageUrl: null,
      currentMilestoneIndex: -1,
      generationError: null,
      isGenerating: true,
      isWaitingForEpicSync: false,
      isLoading: false,
      error: null,
      generateInitialPath: vi.fn(),
      retryInitialPath: vi.fn(),
      regeneratePathForMilestone: vi.fn(),
    });

    const { rerender } = render(<ConstellationTrail progress={42} targetDays={45} epicId="epic-9" />);

    expect(screen.getByTestId("journey-path-fallback")).toBeInTheDocument();
    expect(screen.queryByTestId("journey-path-image")).not.toBeInTheDocument();

    mocks.useJourneyPathImageMock.mockReturnValue({
      pathImageUrl: "https://example.supabase.co/storage/v1/object/public/journey-paths/user-1/epic-9/path.png",
      currentMilestoneIndex: 0,
      generationError: null,
      isGenerating: false,
      isWaitingForEpicSync: false,
      isLoading: false,
      error: null,
      generateInitialPath: vi.fn(),
      retryInitialPath: vi.fn(),
      regeneratePathForMilestone: vi.fn(),
    });

    rerender(<ConstellationTrail progress={43} targetDays={45} epicId="epic-9" />);

    expect(screen.queryByTestId("journey-path-fallback")).not.toBeInTheDocument();
    expect(screen.getByTestId("journey-path-image")).toHaveAttribute(
      "src",
      "https://example.supabase.co/storage/v1/object/public/journey-paths/user-1/epic-9/path.png",
    );
    expect(screen.getByTestId("journey-path-overlay")).toHaveAttribute("data-overlay-mode", "generated");
  });

  it("shows a retryable error state over the fallback background when generation fails", () => {
    const retryInitialPath = vi.fn();

    mocks.useJourneyPathImageMock.mockReturnValue({
      pathImageUrl: null,
      currentMilestoneIndex: -1,
      generationError: {
        code: "RATE_LIMITED",
        message: "You're making requests too quickly. Please wait about 45 seconds and try again.",
        requestId: "req-journey-429",
        retryAfterSeconds: 45,
        retryable: true,
        status: 429,
      },
      isGenerating: false,
      isWaitingForEpicSync: false,
      isLoading: false,
      error: null,
      generateInitialPath: vi.fn(),
      retryInitialPath,
      regeneratePathForMilestone: vi.fn(),
    });

    render(<ConstellationTrail progress={7} targetDays={30} epicId="epic-2" />);

    expect(screen.getByTestId("journey-path-fallback")).toBeInTheDocument();
    expect(screen.getByTestId("journey-path-error")).toBeInTheDocument();
    expect(screen.getByText("Path image unavailable")).toBeInTheDocument();
    expect(screen.getByText(/wait about 45 seconds/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /retry image/i }));

    expect(retryInitialPath).toHaveBeenCalledTimes(1);
  });

  it("shows a sync banner instead of an error while the campaign is still syncing", () => {
    mocks.useJourneyPathImageMock.mockReturnValue({
      pathImageUrl: null,
      currentMilestoneIndex: -1,
      generationError: null,
      isGenerating: false,
      isWaitingForEpicSync: true,
      isLoading: false,
      error: null,
      generateInitialPath: vi.fn(),
      retryInitialPath: vi.fn(),
      regeneratePathForMilestone: vi.fn(),
    });

    render(<ConstellationTrail progress={7} targetDays={30} epicId="epic-queued" />);

    expect(screen.getByTestId("journey-path-fallback")).toBeInTheDocument();
    expect(screen.getByTestId("journey-path-sync-pending")).toBeInTheDocument();
    expect(screen.getByText("Campaign syncing")).toBeInTheDocument();
    expect(screen.queryByTestId("journey-path-error")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry image/i })).not.toBeInTheDocument();
  });
});
