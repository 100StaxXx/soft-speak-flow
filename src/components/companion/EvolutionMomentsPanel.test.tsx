import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: "user-1" },
  companion: { id: "companion-1" } as {
    id: string;
  } | null,
  evolutions: [] as Array<Record<string, unknown>>,
  animationJobs: [] as Array<Record<string, unknown>>,
  queryFilters: [] as Array<{
    table: string;
    method: "eq" | "in";
    column: string;
    value: unknown;
  }>,
  realtimeCallback: null as null | (() => void),
  channel: vi.fn(),
  removeChannel: vi.fn(),
  renderEvolutionShareVideoMock: vi.fn(),
  shareRenderedMediaMock: vi.fn(),
  isShareCancelledMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const createListQuery = (rows: () => Array<Record<string, unknown>>) => {
        const chain = {
          eq: (column: string, value: unknown) => {
            mocks.queryFilters.push({ table, method: "eq", column, value });
            return chain;
          },
          in: (column: string, value: unknown) => {
            mocks.queryFilters.push({ table, method: "in", column, value });
            return chain;
          },
          order: () => chain,
          limit: async () => ({ data: rows(), error: null }),
        };
        return chain;
      };

      if (table === "user_companion") {
        const chain = {
          eq: () => chain,
          order: () => chain,
          limit: () => chain,
          maybeSingle: async () => ({
            data: mocks.companion,
            error: null,
          }),
        };
        return {
          select: () => chain,
        };
      }

      if (table === "companion_evolutions") {
        return {
          select: () => createListQuery(() => mocks.evolutions),
        };
      }

      if (table === "companion_animation_jobs") {
        return {
          select: () => createListQuery(() => mocks.animationJobs),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
    channel: mocks.channel,
    removeChannel: mocks.removeChannel,
  },
}));

vi.mock("@/utils/shareMedia", () => ({
  DEFAULT_EVOLUTION_SHARE_TEXT: "My companion just evolved. #Cosmiq",
  isShareCancelled: mocks.isShareCancelledMock,
  renderEvolutionShareVideo: mocks.renderEvolutionShareVideoMock,
  shareRenderedMedia: mocks.shareRenderedMediaMock,
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    success: mocks.toastSuccessMock,
    error: mocks.toastErrorMock,
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
  id: "evolution-13",
  stage: 13,
  image_url: "https://example.com/stage-13.png",
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
    mocks.queryFilters = [];
    mocks.realtimeCallback = null;
    mocks.renderEvolutionShareVideoMock.mockReset();
    mocks.renderEvolutionShareVideoMock.mockResolvedValue({
      uri: "file:///tmp/cosmiq-evolution-stage-5.mp4",
      filename: "cosmiq-evolution-stage-5.mp4",
      mimeType: "video/mp4",
      width: 1080,
      height: 1920,
      durationMs: 4200,
    });
    mocks.shareRenderedMediaMock.mockReset();
    mocks.shareRenderedMediaMock.mockResolvedValue({
      status: "shared",
      captionCopied: false,
    });
    mocks.isShareCancelledMock.mockReset();
    mocks.isShareCancelledMock.mockReturnValue(false);
    mocks.toastSuccessMock.mockReset();
    mocks.toastErrorMock.mockReset();
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

    expect(
      await screen.findByRole("button", { name: /stage 5 evolution/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Watch")).not.toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: /evolutions/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Evolutions")).toBeInTheDocument();
  });

  it("contains generated scene art in evolution thumbnails", async () => {
    renderPanel();

    const momentCard = await screen.findByRole("button", {
      name: /stage 5 evolution/i,
    });
    const thumbnail = momentCard.querySelector("img");

    expect(thumbnail).toHaveAttribute("data-companion-image-fit", "contain");
    expect(thumbnail).toHaveClass("object-contain");
  });

  it("opens a playable evolution dialog for completed animation rows", async () => {
    renderPanel();

    fireEvent.click(
      await screen.findByRole("button", { name: /stage 5 evolution/i }),
    );

    expect(
      await screen.findByRole("dialog", { name: /stage 5 evolution/i }),
    ).toBeInTheDocument();
    const video = await screen.findByTestId("evolution-moment-video");
    expect(video).toHaveAttribute("src", "https://example.com/stage-5.mp4");
    expect(video).not.toHaveAttribute("controls");
    expect(video).toHaveAttribute("autoplay");
    expect(video).toHaveAttribute("playsinline");
  });

  it("autoplays the evolution video again when the moment is reopened", async () => {
    renderPanel();

    const momentCard = await screen.findByRole("button", {
      name: /stage 5 evolution/i,
    });
    fireEvent.click(momentCard);

    expect(await screen.findByTestId("evolution-moment-video")).toHaveAttribute(
      "autoplay",
    );

    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: /stage 5 evolution/i }),
      ).not.toBeInTheDocument();
    });

    fireEvent.click(momentCard);

    const reopenedVideo = await screen.findByTestId("evolution-moment-video");
    expect(reopenedVideo).toHaveAttribute(
      "src",
      "https://example.com/stage-5.mp4",
    );
    expect(reopenedVideo).toHaveAttribute("autoplay");
    expect(reopenedVideo).toHaveAttribute("playsinline");
  });

  it("shows pending animation rows as disabled generating cards", async () => {
    mocks.evolutions = [pendingMoment];
    renderPanel();

    const generatingCard = await screen.findByRole("button", {
      name: /stage 13 evolution generating/i,
    });
    expect(generatingCard).toBeDisabled();
    expect(screen.queryByText("Generating")).not.toBeInTheDocument();

    fireEvent.click(generatingCard);
    expect(
      screen.queryByTestId("evolution-moment-video"),
    ).not.toBeInTheDocument();
  });

  it("shows share actions only for completed playable evolution videos", async () => {
    mocks.evolutions = [succeededMoment, pendingMoment];

    renderPanel();

    expect(
      await screen.findByRole("button", {
        name: /share evolution for stage 5/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: /share evolution for stage 13/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("shares a completed evolution moment as a story video", async () => {
    renderPanel();

    fireEvent.click(
      await screen.findByRole("button", {
        name: /share evolution for stage 5/i,
      }),
    );

    await waitFor(() => {
      expect(mocks.renderEvolutionShareVideoMock).toHaveBeenCalledWith({
        sourceVideoUrl: "https://example.com/stage-5.mp4",
        posterImageUrl: "https://example.com/stage-5.png",
        stage: 5,
        template: "aesthetic-reveal",
      });
    });
    expect(mocks.shareRenderedMediaMock).toHaveBeenCalledWith({
      uriOrFile: expect.objectContaining({
        filename: "cosmiq-evolution-stage-5.mp4",
        mimeType: "video/mp4",
        width: 1080,
        height: 1920,
      }),
      title: "Stage 5 Evolution",
      text: "My companion just evolved. #Cosmiq",
      dialogTitle: "Share evolution video",
    });
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

    expect(
      await screen.findByRole("button", { name: /stage 1 evolution/i }),
    ).toBeInTheDocument();
  });

  it("shows succeeded animation jobs when the evolution row has not caught up", async () => {
    mocks.evolutions = [];
    mocks.animationJobs = [succeededJobMoment];

    renderPanel();

    fireEvent.click(
      await screen.findByRole("button", { name: /stage 1 evolution/i }),
    );
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
    expect(
      screen.queryByRole("button", { name: /stage \d+ evolution/i }),
    ).not.toBeInTheDocument();
  });

  it("hides completed videos for non-boundary stages that reuse the same art", async () => {
    mocks.evolutions = [
      {
        ...succeededMoment,
        id: "evolution-10",
        stage: 10,
        image_url: "https://example.com/stage-10.png",
        animation_video_url: "https://example.com/stage-10.mp4",
      },
    ];
    mocks.animationJobs = [
      {
        ...succeededJobMoment,
        id: "job-11",
        evolution_id: "evolution-11",
        stage: 11,
        source_image_url: "https://example.com/stage-11.png",
        video_url: "https://example.com/stage-11.mp4",
      },
    ];

    renderPanel();

    expect(await screen.findByText("No Evolutions Yet")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /stage 10 evolution/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /stage 11 evolution/i }),
    ).not.toBeInTheDocument();
  });

  it("filters visual-boundary stages in the queries before limiting", async () => {
    renderPanel();

    await screen.findByRole("button", { name: /stage 5 evolution/i });

    const evolutionStageFilter = mocks.queryFilters.find(
      (filter) =>
        filter.table === "companion_evolutions" &&
        filter.method === "in" &&
        filter.column === "stage",
    );
    const jobStageFilter = mocks.queryFilters.find(
      (filter) =>
        filter.table === "companion_animation_jobs" &&
        filter.method === "in" &&
        filter.column === "stage",
    );

    expect(evolutionStageFilter?.value).toEqual([1, 5, 13, 21, 36, 56, 81]);
    expect(jobStageFilter?.value).toEqual([1, 5, 13, 21, 36, 56, 81]);
  });

  it("falls back to the still image when evolution video loading fails", async () => {
    renderPanel();

    fireEvent.click(
      await screen.findByRole("button", { name: /stage 5 evolution/i }),
    );
    fireEvent.error(await screen.findByTestId("evolution-moment-video"));

    const fallback = await screen.findByTestId(
      "evolution-moment-fallback-image",
    );
    expect(fallback).toHaveAttribute("src", "https://example.com/stage-5.png");
  });
});
