import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: "user-1" },
  companion: { id: "companion-1" } as {
    id: string;
  } | null,
  evolutions: [] as Array<Record<string, unknown>>,
  animationJobs: [] as Array<Record<string, unknown>>,
  realtimeCallback: null as null | (() => void),
  channel: vi.fn(),
  removeChannel: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "user_companion") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: mocks.companion, error: null }),
                }),
              }),
            }),
          }),
        };
      }

      if (table === "companion_evolutions") {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                order: () => ({
                  limit: async () => ({ data: mocks.evolutions, error: null }),
                }),
              }),
            }),
          }),
        };
      }

      if (table === "companion_animation_jobs") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                in: () => ({
                  order: () => ({
                    limit: async () => ({ data: mocks.animationJobs, error: null }),
                  }),
                }),
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
    channel: mocks.channel,
    removeChannel: mocks.removeChannel,
  },
}));

import { EvolutionMomentsPanel } from "@/components/companion/EvolutionMomentsPanel";

const succeededMoment = {
  id: "evolution-5",
  stage: 5,
  image_url: "https://example.com/stage-5.png",
  evolved_at: "2026-05-01T12:00:00.000Z",
  animation_status: "succeeded",
  animation_video_url: "https://example.com/stage-5.mp4",
  animation_completed_at: "2026-05-01T12:02:00.000Z",
};

const pendingMoment = {
  id: "evolution-6",
  stage: 6,
  image_url: "https://example.com/stage-6.png",
  evolved_at: "2026-05-02T12:00:00.000Z",
  animation_status: "processing",
  animation_video_url: null,
  animation_completed_at: null,
};

const succeededJobMoment = {
  id: "job-1",
  evolution_id: "evolution-1",
  stage: 1,
  source_image_url: "https://example.com/stage-1.png",
  status: "succeeded",
  video_url: "https://example.com/stage-1.mp4",
  completed_at: "2026-05-03T12:03:00.000Z",
  requested_at: "2026-05-03T12:00:00.000Z",
  updated_at: "2026-05-03T12:03:00.000Z",
};

const renderPanel = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <EvolutionMomentsPanel />
    </QueryClientProvider>,
  );
};

describe("EvolutionMomentsPanel", () => {
  beforeEach(() => {
    mocks.companion = { id: "companion-1" };
    mocks.evolutions = [succeededMoment];
    mocks.animationJobs = [];
    mocks.realtimeCallback = null;
    mocks.removeChannel.mockReset();
    mocks.channel.mockReset();
    mocks.channel.mockImplementation(() => {
      const channel = {
        on: vi.fn((_event, _config, callback) => {
          mocks.realtimeCallback = callback;
          return channel;
        }),
        subscribe: vi.fn(() => channel),
      };
      return channel;
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows evolutions as first-class moments", async () => {
    renderPanel();

    expect(await screen.findByRole("button", { name: /watch stage 5 evolution/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /evolutions/i })).toBeInTheDocument();
    expect(screen.getByText("Evolutions")).toBeInTheDocument();
  });

  it("opens a playable evolution dialog for completed animation rows", async () => {
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: /watch stage 5 evolution/i }));

    expect(await screen.findByRole("dialog", { name: /stage 5 evolution/i })).toBeInTheDocument();
    const video = await screen.findByTestId("evolution-moment-video");
    expect(video).toHaveAttribute("src", "https://example.com/stage-5.mp4");
    expect(video).toHaveAttribute("controls");
    expect(video).toHaveAttribute("playsinline");
  });

  it("shows pending animation rows as disabled generating cards", async () => {
    mocks.evolutions = [pendingMoment];
    renderPanel();

    const generatingCard = await screen.findByRole("button", { name: /stage 6 evolution generating/i });
    expect(generatingCard).toBeDisabled();
    expect(screen.getByText("Generating")).toBeInTheDocument();

    fireEvent.click(generatingCard);
    expect(screen.queryByTestId("evolution-moment-video")).not.toBeInTheDocument();
  });

  it("shows a stage-one prewarm before the egg is claimed", async () => {
    mocks.evolutions = [
      {
        ...succeededMoment,
        id: "evolution-1",
        stage: 1,
      },
    ];

    renderPanel();

    expect(await screen.findByRole("button", { name: /watch stage 1 evolution/i })).toBeInTheDocument();
  });

  it("shows succeeded animation jobs when the evolution row has not caught up", async () => {
    mocks.evolutions = [];
    mocks.animationJobs = [succeededJobMoment];

    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: /watch stage 1 evolution/i }));
    expect(await screen.findByTestId("evolution-moment-video")).toHaveAttribute(
      "src",
      "https://example.com/stage-1.mp4",
    );
  });

  it("shows an empty state when no evolution videos exist yet", async () => {
    mocks.evolutions = [];
    mocks.animationJobs = [];

    renderPanel();

    expect(await screen.findByText("No Evolutions Yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /watch stage/i })).not.toBeInTheDocument();
  });

  it("falls back to the still image when evolution video loading fails", async () => {
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: /watch stage 5 evolution/i }));
    fireEvent.error(await screen.findByTestId("evolution-moment-video"));

    const fallback = await screen.findByTestId("evolution-moment-fallback-image");
    expect(fallback).toHaveAttribute("src", "https://example.com/stage-5.png");
  });
});
