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
      epicSyncErrorMessage: null,
      epicSyncStatus: "idle",
      isGenerating: false,
      isWaitingForEpicSync: false,
      isLoading: false,
      error: null,
      generateInitialPath: vi.fn(),
      retryInitialPath: vi.fn(),
      retryEpicSync: vi.fn(),
      regeneratePathForMilestone: vi.fn(),
    });
  });

  it("renders the persisted/generated path immediately without a blocking loading state", () => {
    mocks.useJourneyPathImageMock.mockReturnValue({
      pathImageUrl: "https://example.supabase.co/storage/v1/object/public/journey-paths/user-1/epic-1/path.png",
      currentMilestoneIndex: 1,
      generationError: null,
      epicSyncErrorMessage: null,
      epicSyncStatus: "idle",
      isGenerating: false,
      isWaitingForEpicSync: false,
      isLoading: false,
      error: null,
      generateInitialPath: vi.fn(),
      retryInitialPath: vi.fn(),
      retryEpicSync: vi.fn(),
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

  it("keeps very short journeys clean without decorative branch paths", () => {
    render(
      <ConstellationTrail
        progress={18}
        targetDays={14}
        epicId="epic-short"
        milestones={[
          { id: "milestone-1", title: "Checkpoint", milestone_percent: 100, is_postcard_milestone: true },
        ]}
      />,
    );

    expect(screen.getByTestId("trail-main-base-path")).toBeInTheDocument();
    expect(screen.getByTestId("trail-main-pulse-path")).toBeInTheDocument();
    expect(screen.queryAllByTestId("trail-branch-base-path")).toHaveLength(0);
    expect(screen.queryAllByTestId("trail-branch-pulse-path")).toHaveLength(0);
  });

  it("adds subtle split-and-rejoin branch paths for longer journeys while keeping progress on the main route", () => {
    render(
      <ConstellationTrail
        progress={52}
        targetDays={60}
        epicId="epic-branching"
        milestones={[
          { id: "milestone-1", title: "Ember", milestone_percent: 12, is_postcard_milestone: false },
          { id: "milestone-2", title: "Harbor", milestone_percent: 24, is_postcard_milestone: true },
          { id: "milestone-3", title: "Grove", milestone_percent: 38, is_postcard_milestone: false },
          { id: "milestone-4", title: "Crown", milestone_percent: 56, is_postcard_milestone: false },
          { id: "milestone-5", title: "Summit", milestone_percent: 74, is_postcard_milestone: true },
          { id: "milestone-6", title: "Nova", milestone_percent: 100, is_postcard_milestone: true },
        ]}
      />,
    );

    expect(screen.getByTestId("trail-progress-path")).toBeInTheDocument();
    expect(screen.getAllByTestId("trail-branch-base-path").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("trail-branch-pulse-path").length).toBeGreaterThan(0);
    expect(screen.queryAllByTestId("trail-branch-progress-path")).toHaveLength(0);
  });

  it("keeps companion and milestone interactions stable when branching is enabled", () => {
    render(
      <ConstellationTrail
        progress={48}
        targetDays={45}
        epicId="epic-companion"
        companionImageUrl="https://example.com/companion.png"
        milestones={[
          { id: "milestone-1", title: "Ember", milestone_percent: 20, is_postcard_milestone: false, completed_at: "2026-04-01T00:00:00.000Z" },
          { id: "milestone-2", title: "Harbor", milestone_percent: 40, is_postcard_milestone: true, completed_at: "2026-04-05T00:00:00.000Z" },
          { id: "milestone-3", title: "Grove", milestone_percent: 60, is_postcard_milestone: false },
          { id: "milestone-4", title: "Summit", milestone_percent: 80, is_postcard_milestone: true },
          { id: "milestone-5", title: "Nova", milestone_percent: 100, is_postcard_milestone: true },
        ]}
      />,
    );

    expect(screen.getByAltText("Companion")).toBeInTheDocument();
    expect(screen.getAllByLabelText(/unlock milestone at/i)).toHaveLength(3);
    expect(screen.getAllByTestId("trail-branch-base-path").length).toBeGreaterThan(0);
  });

  it("shows a static fallback immediately and keeps it visible while the path updates", () => {
    mocks.useJourneyPathImageMock.mockReturnValue({
      pathImageUrl: null,
      currentMilestoneIndex: -1,
      generationError: null,
      epicSyncErrorMessage: null,
      epicSyncStatus: "idle",
      isGenerating: true,
      isWaitingForEpicSync: false,
      isLoading: false,
      error: null,
      generateInitialPath: vi.fn(),
      retryInitialPath: vi.fn(),
      retryEpicSync: vi.fn(),
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
      epicSyncErrorMessage: null,
      epicSyncStatus: "idle",
      isGenerating: true,
      isWaitingForEpicSync: false,
      isLoading: false,
      error: null,
      generateInitialPath: vi.fn(),
      retryInitialPath: vi.fn(),
      retryEpicSync: vi.fn(),
      regeneratePathForMilestone: vi.fn(),
    });

    const { rerender } = render(<ConstellationTrail progress={42} targetDays={45} epicId="epic-9" />);

    expect(screen.getByTestId("journey-path-fallback")).toBeInTheDocument();
    expect(screen.queryByTestId("journey-path-image")).not.toBeInTheDocument();

    mocks.useJourneyPathImageMock.mockReturnValue({
      pathImageUrl: "https://example.supabase.co/storage/v1/object/public/journey-paths/user-1/epic-9/path.png",
      currentMilestoneIndex: 0,
      generationError: null,
      epicSyncErrorMessage: null,
      epicSyncStatus: "idle",
      isGenerating: false,
      isWaitingForEpicSync: false,
      isLoading: false,
      error: null,
      generateInitialPath: vi.fn(),
      retryInitialPath: vi.fn(),
      retryEpicSync: vi.fn(),
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
      epicSyncErrorMessage: null,
      epicSyncStatus: "idle",
      isGenerating: false,
      isWaitingForEpicSync: false,
      isLoading: false,
      error: null,
      generateInitialPath: vi.fn(),
      retryInitialPath,
      retryEpicSync: vi.fn(),
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
      epicSyncErrorMessage: null,
      epicSyncStatus: "pending",
      isGenerating: false,
      isWaitingForEpicSync: true,
      isLoading: false,
      error: null,
      generateInitialPath: vi.fn(),
      retryInitialPath: vi.fn(),
      retryEpicSync: vi.fn(),
      regeneratePathForMilestone: vi.fn(),
    });

    render(<ConstellationTrail progress={7} targetDays={30} epicId="epic-queued" />);

    expect(screen.getByTestId("journey-path-fallback")).toBeInTheDocument();
    expect(screen.getByTestId("journey-path-sync-pending")).toBeInTheDocument();
    expect(screen.getByText("Campaign syncing")).toBeInTheDocument();
    expect(screen.queryByTestId("journey-path-error")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry image/i })).not.toBeInTheDocument();
  });

  it("shows a retryable sync error when the campaign create failed", () => {
    const retryEpicSync = vi.fn();

    mocks.useJourneyPathImageMock.mockReturnValue({
      pathImageUrl: null,
      currentMilestoneIndex: -1,
      generationError: null,
      epicSyncErrorMessage: "duplicate key value violates unique constraint",
      epicSyncStatus: "failed",
      isGenerating: false,
      isWaitingForEpicSync: false,
      isLoading: false,
      error: null,
      generateInitialPath: vi.fn(),
      retryInitialPath: vi.fn(),
      retryEpicSync,
      regeneratePathForMilestone: vi.fn(),
    });

    render(<ConstellationTrail progress={7} targetDays={30} epicId="epic-failed" />);

    expect(screen.getByTestId("journey-path-sync-error")).toBeInTheDocument();
    expect(screen.getByText("Campaign sync failed")).toBeInTheDocument();
    expect(screen.getByText(/duplicate key value/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /retry sync/i }));

    expect(retryEpicSync).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("journey-path-sync-pending")).not.toBeInTheDocument();
  });
});
