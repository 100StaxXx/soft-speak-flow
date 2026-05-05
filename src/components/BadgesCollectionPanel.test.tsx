import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: "user-1" },
  achievements: [] as Array<{ achievement_type: string; earned_at: string }>,
  achievementsError: null as null | { code?: string; message?: string; details?: string | null; hint?: string | null },
  companion: { id: "companion-1", current_stage: 6, current_xp: 240 } as {
    id: string;
    current_stage: number;
    current_xp?: number;
  } | null,
  evolutions: [] as Array<Record<string, unknown>>,
  evolutionStageUpperBound: null as number | null,
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
      if (table === "achievements") {
        return {
          select: () => ({
            eq: async () => ({ data: mocks.achievements, error: mocks.achievementsError }),
          }),
        };
      }

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
              lte: (_column: string, stageUpperBound: number) => {
                mocks.evolutionStageUpperBound = stageUpperBound;
                return {
                  in: () => ({
                    order: () => ({
                      limit: async () => ({
                        data: mocks.evolutions.filter((row) => (
                          typeof row.stage !== "number" || row.stage <= stageUpperBound
                        )),
                        error: null,
                      }),
                    }),
                  }),
                };
              },
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

import { BadgesCollectionPanel } from "@/components/BadgesCollectionPanel";

const succeededReplay = {
  id: "evolution-5",
  stage: 5,
  image_url: "https://example.com/stage-5.png",
  evolved_at: "2026-05-01T12:00:00.000Z",
  animation_status: "succeeded",
  animation_video_url: "https://example.com/stage-5.mp4",
  animation_completed_at: "2026-05-01T12:02:00.000Z",
};

const pendingReplay = {
  id: "evolution-6",
  stage: 6,
  image_url: "https://example.com/stage-6.png",
  evolved_at: "2026-05-02T12:00:00.000Z",
  animation_status: "processing",
  animation_video_url: null,
  animation_completed_at: null,
};

const renderPanel = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BadgesCollectionPanel />
    </QueryClientProvider>,
  );
};

describe("BadgesCollectionPanel evolution replays", () => {
  beforeEach(() => {
    mocks.achievements = [];
    mocks.achievementsError = null;
    mocks.companion = { id: "companion-1", current_stage: 6, current_xp: 240 };
    mocks.evolutions = [succeededReplay];
    mocks.evolutionStageUpperBound = null;
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

  it("shows the replay strip on all and companion badge filters", async () => {
    renderPanel();

    expect(await screen.findByRole("button", { name: /replay stage 5 evolution/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /evolution replays/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Companion" }));
    expect(screen.getByRole("region", { name: /evolution replays/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Streaks" }));
    expect(screen.queryByRole("region", { name: /evolution replays/i })).not.toBeInTheDocument();
  });

  it("opens a playable replay dialog for completed animation rows", async () => {
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: /replay stage 5 evolution/i }));

    const video = await screen.findByTestId("evolution-replay-video");
    expect(video).toHaveAttribute("src", "https://example.com/stage-5.mp4");
    expect(video).toHaveAttribute("controls");
    expect(video).toHaveAttribute("playsinline");
  });

  it("shows pending animation rows as disabled generating cards", async () => {
    mocks.evolutions = [pendingReplay];
    renderPanel();

    const generatingCard = await screen.findByRole("button", { name: /stage 6 evolution generating/i });
    expect(generatingCard).toBeDisabled();
    expect(screen.getByText("Generating")).toBeInTheDocument();

    fireEvent.click(generatingCard);
    expect(screen.queryByTestId("evolution-replay-video")).not.toBeInTheDocument();
  });

  it("shows a hatch-ready stage-one prewarm before the egg is claimed", async () => {
    mocks.companion = { id: "companion-1", current_stage: 0, current_xp: 10 };
    mocks.evolutions = [
      {
        ...succeededReplay,
        id: "evolution-1",
        stage: 1,
      },
    ];

    renderPanel();

    expect(await screen.findByRole("button", { name: /replay stage 1 evolution/i })).toBeInTheDocument();
    expect(mocks.evolutionStageUpperBound).toBe(1);
  });

  it("keeps stage-one prewarms hidden until the egg is hatch-ready", async () => {
    mocks.companion = { id: "companion-1", current_stage: 0, current_xp: 9 };
    mocks.evolutions = [
      {
        ...succeededReplay,
        id: "evolution-1",
        stage: 1,
      },
    ];

    renderPanel();

    await screen.findByText("Your Badges");
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /replay stage 1 evolution/i })).not.toBeInTheDocument();
    });
    expect(mocks.evolutionStageUpperBound).toBe(0);
  });

  it("does not show an empty replay section when no evolution videos exist", async () => {
    mocks.evolutions = [];
    renderPanel();

    await screen.findByText("Your Badges");
    await waitFor(() => {
      expect(screen.queryByRole("region", { name: /evolution replays/i })).not.toBeInTheDocument();
    });
  });

  it("still renders when the achievements table has not reached the schema cache yet", async () => {
    mocks.achievementsError = {
      code: "PGRST205",
      message: "Could not find the table 'public.achievements' in the schema cache",
      details: null,
      hint: null,
    };

    renderPanel();

    expect(await screen.findByText("Your Badges")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /replay stage 5 evolution/i })).toBeInTheDocument();
  });

  it("falls back to the still image when replay video loading fails", async () => {
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: /replay stage 5 evolution/i }));
    fireEvent.error(await screen.findByTestId("evolution-replay-video"));

    const fallback = await screen.findByTestId("evolution-replay-fallback-image");
    expect(fallback).toHaveAttribute("src", "https://example.com/stage-5.png");
  });
});
