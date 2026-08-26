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
  const actual = await vi.importActual<typeof import("@/services/companionCinemaInteractions")>(
    "@/services/companionCinemaInteractions",
  );
  return {
    ...actual,
    getCompanionCinemaHistory: (...args: unknown[]) => mocks.history(...args),
    getCompanionCinemaInteractionStatus: (...args: unknown[]) => mocks.status(...args),
    startCompanionCinemaInteraction: (...args: unknown[]) => mocks.start(...args),
    completeCompanionCinemaInteraction: (...args: unknown[]) => mocks.complete(...args),
  };
});
vi.mock("./CompanionCinemaPlayer", () => ({
  CompanionCinemaPlayer: ({ eventId, open }: { eventId: string | null; open: boolean }) =>
    open ? <div data-testid="cinema-player">{eventId}</div> : null,
}));

import { CompanionCinemaActions } from "./CompanionCinemaActions";

const renderActions = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CompanionCinemaActions />
    </QueryClientProvider>,
  );
};

describe("CompanionCinemaActions", () => {
  beforeEach(() => {
    mocks.history.mockReset();
    mocks.status.mockReset();
    mocks.start.mockReset();
    mocks.complete.mockReset();
    mocks.history.mockResolvedValue({ available: true, runs: [] });
    mocks.status.mockResolvedValue({ run: null });
  });

  it("recovers a ready cinematic from durable server history", async () => {
    const run = {
      id: "run-1",
      interaction_type: "hunt" as const,
      status: "active",
      title: "The Hunt",
      cinema_event_id: "event-1",
      start_event: {
        id: "event-1",
        status: "ready",
        title: "Hunt Return",
        revealed_at: null,
      },
    };
    mocks.history.mockResolvedValue({ runs: [run] });
    mocks.status.mockResolvedValue({ run });
    renderActions();

    expect(await screen.findByText("Cinema history")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /hunt return/i }));
    expect(await screen.findByTestId("cinema-player")).toHaveTextContent("event-1");
  });

  it("sends the exact user-named Forge intention", async () => {
    mocks.start.mockResolvedValue({
      run: {
        id: "run-forge",
        interaction_type: "forge",
        status: "active",
        title: "The Forge",
      },
      quota: { dailyRemaining: 0, monthlyRemaining: 7 },
    });
    renderActions();

    fireEvent.click(await screen.findByRole("button", { name: /the forge/i }));
    fireEvent.change(await screen.findByPlaceholderText("Close four website clients"), {
      target: { value: "Ship the beta without cutting accessibility" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enter the Forge" }));
    await waitFor(() => {
      expect(mocks.start).toHaveBeenCalledWith({
        interactionType: "forge",
        intention: "Ship the beta without cutting accessibility",
      });
    });
  });

  it("keeps new paid interaction actions hidden outside the server rollout", async () => {
    mocks.history.mockResolvedValue({ available: false, runs: [] });
    renderActions();

    await waitFor(() => {
      expect(screen.queryByTestId("companion-cinema-actions")).not.toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /the hunt/i })).not.toBeInTheDocument();
    expect(mocks.start).not.toHaveBeenCalled();
  });
});
