import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  history: vi.fn(),
  status: vi.fn(),
  start: vi.fn(),
  complete: vi.fn(),
}));

vi.mock("@/services/companionCinemaInteractions", async () => {
  const actual = await vi.importActual<
    typeof import("@/services/companionCinemaInteractions")
  >("@/services/companionCinemaInteractions");
  return {
    ...actual,
    getCompanionCinemaHistory: (...args: unknown[]) => mocks.history(...args),
    getCompanionCinemaInteractionStatus: (...args: unknown[]) =>
      mocks.status(...args),
    startCompanionCinemaInteraction: (...args: unknown[]) =>
      mocks.start(...args),
    completeCompanionCinemaInteraction: (...args: unknown[]) =>
      mocks.complete(...args),
  };
});

const focusSession = {
  id: "focus-1",
  user_id: "user-1",
  task_id: null,
  duration_type: "pomodoro" as const,
  planned_duration: 25,
  actual_duration: 25,
  started_at: "2026-08-18T10:00:00.000Z",
  completed_at: "2026-08-18T10:25:00.000Z",
  paused_at: null,
  status: "completed" as const,
  distractions_count: 0,
  xp_earned: 25,
  notes: null,
};

vi.mock("@/features/tasks/components/FocusTimer", () => ({
  FocusTimer: ({
    onStart,
    onComplete,
    onCancel,
  }: {
    onStart?: (session: typeof focusSession) => void;
    onComplete?: (session: typeof focusSession) => void;
    onCancel?: (session: typeof focusSession) => void;
  }) => (
    <div>
      <button onClick={() => onStart?.(focusSession)}>Start focus</button>
      <button onClick={() => onComplete?.(focusSession)}>Complete focus</button>
      <button onClick={() => onCancel?.(focusSession)}>Cancel focus</button>
    </div>
  ),
}));

vi.mock("./ResistModePanel", () => ({ ResistModePanel: () => null }));
vi.mock("./CompanionCinemaPlayer", () => ({
  CompanionCinemaPlayer: () => <div data-testid="cinema-player" />,
}));

import { FocusTab } from "./FocusTab";

const renderFocusTab = (enableCosmiqCinema: boolean) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <FocusTab enableCosmiqCinema={enableCosmiqCinema} />
    </QueryClientProvider>,
  );
};

describe("FocusTab product isolation", () => {
  beforeEach(() => {
    mocks.history.mockReset();
    mocks.status.mockReset();
    mocks.start.mockReset();
    mocks.complete.mockReset();
    mocks.history.mockResolvedValue({ runs: [] });
    mocks.status.mockResolvedValue({ run: null });
    mocks.start.mockResolvedValue({
      run: {
        id: "watch-1",
        interaction_type: "watch",
        status: "active",
        cinema_event_id: "event-1",
      },
    });
  });

  it("makes zero cinema requests for Graceward focus sessions", async () => {
    renderFocusTab(false);

    fireEvent.click(screen.getByRole("button", { name: "Start focus" }));
    fireEvent.click(screen.getByRole("button", { name: "Complete focus" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel focus" }));

    await Promise.resolve();
    expect(mocks.history).not.toHaveBeenCalled();
    expect(mocks.status).not.toHaveBeenCalled();
    expect(mocks.start).not.toHaveBeenCalled();
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(screen.queryByTestId("cinema-player")).not.toBeInTheDocument();
  });

  it("starts and recovers Watch cinema for Cosmiq focus sessions", async () => {
    renderFocusTab(true);

    await waitFor(() => expect(mocks.history).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Start focus" }));

    await waitFor(() => {
      expect(mocks.start).toHaveBeenCalledWith({
        interactionType: "watch",
        intention: "Protect this deep-work session",
        expectedMinutes: 25,
      });
    });
    expect(screen.getByTestId("cinema-player")).toBeInTheDocument();
  });
});
