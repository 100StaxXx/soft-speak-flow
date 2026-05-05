import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { COMPANION_HATCH_STARTED_EVENT } from "@/lib/companionEvolutionEvents";

const mocks = vi.hoisted(() => {
  const invalidateQueriesMock = vi.fn().mockResolvedValue(undefined);
  const channelMock = vi.fn();
  const removeChannelMock = vi.fn();
  const onMock = vi.fn();
  const subscribeMock = vi.fn();
  const setIsEvolvingLoadingMock = vi.fn();
  const onEvolutionCompleteMock = vi.fn();
  const setEvolutionInProgressMock = vi.fn();
  const loggerWarnMock = vi.fn();
  const loggerErrorMock = vi.fn();
  const companionEvolutionPropsMock = vi.fn();
  const toastInfoMock = vi.fn();
  const state = {
    callback: null as null | ((payload: Record<string, unknown>) => Promise<void>),
    mentorId: null as string | null,
    mentorLookup: null as null | (() => Promise<{ data: unknown; error: unknown }>),
  };
  const companionEvolutionLookupResponses: Array<{ data: unknown; error: unknown }> = [];
  const animationJobLookupResponses: Array<{ data: unknown; error: unknown }> = [];
  const functionsInvokeMock = vi.fn();

  return {
    invalidateQueriesMock,
    channelMock,
    removeChannelMock,
    onMock,
    subscribeMock,
    setIsEvolvingLoadingMock,
    onEvolutionCompleteMock,
    setEvolutionInProgressMock,
    loggerWarnMock,
    loggerErrorMock,
    companionEvolutionPropsMock,
    toastInfoMock,
    functionsInvokeMock,
    state,
    companionEvolutionLookupResponses,
    animationJobLookupResponses,
  };
});

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueriesMock,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/contexts/MentorConnectionContext", () => ({
  useMentorConnection: () => ({
    mentorId: mocks.state.mentorId,
    status: "ready",
    refreshConnection: vi.fn(),
  }),
}));

vi.mock("@/contexts/EvolutionContext", () => ({
  useEvolution: () => ({
    setIsEvolvingLoading: mocks.setIsEvolvingLoadingMock,
    onEvolutionComplete: mocks.onEvolutionCompleteMock,
  }),
}));

vi.mock("@/contexts/CelebrationContext", () => ({
  useCelebration: () => ({
    setEvolutionInProgress: mocks.setEvolutionInProgressMock,
  }),
}));

vi.mock("@/components/CompanionEvolution", () => ({
  CompanionEvolution: (props: {
    isEvolving: boolean;
    previousStage: number;
    newStage: number;
    previousImageUrl: string;
    newImageUrl: string;
    animationVideoUrl?: string | null;
  }) => {
    mocks.companionEvolutionPropsMock(props);
    return props.isEvolving ? (
      <div
        data-testid="companion-evolution"
        data-previous-stage={props.previousStage}
        data-new-stage={props.newStage}
        data-previous-image-url={props.previousImageUrl}
        data-new-image-url={props.newImageUrl}
        data-animation-video-url={props.animationVideoUrl ?? ""}
      />
    ) : null;
  },
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    info: mocks.toastInfoMock,
  },
}));

vi.mock("@/utils/logger", () => ({
  logger: {
    warn: mocks.loggerWarnMock,
    error: mocks.loggerErrorMock,
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: mocks.channelMock,
    removeChannel: mocks.removeChannelMock,
    from: vi.fn((table: string) => {
      if (table === "companion_evolutions") {
        const maybeSingleMock = vi.fn(async () =>
          mocks.companionEvolutionLookupResponses.shift() ?? {
            data: {
              id: "evo-1",
              animation_video_url: "https://example.com/evolution.mp4",
              animation_status: "succeeded",
            },
            error: null,
          });

        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: maybeSingleMock,
              })),
            })),
          })),
        };
      }

      if (table === "companion_animation_jobs") {
        const maybeSingleMock = vi.fn(async () =>
          mocks.animationJobLookupResponses.shift() ?? {
            data: { id: "job-1" },
            error: null,
          });

        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: maybeSingleMock,
            })),
          })),
        };
      }

      if (table === "user_companion") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { core_element: "fire" },
                error: null,
              }),
            })),
          })),
        };
      }

      if (table === "mentors") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() => (
                mocks.state.mentorLookup?.() ?? Promise.resolve({
                  data: { slug: "atlas" },
                  error: null,
                })
              )),
            })),
          })),
        };
      }

      if (table === "companion_memories") {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      };
    }),
    functions: {
      invoke: mocks.functionsInvokeMock,
    },
  },
}));

import { GlobalEvolutionListener } from "./GlobalEvolutionListener";

const openPlayablePendingAnimation = async () => {
  const preloader = await screen.findByTestId("evolution-animation-preloader");
  await act(async () => {
    fireEvent.canPlay(preloader);
  });
  await waitFor(() => {
    expect(screen.getByTestId("companion-evolution")).toBeInTheDocument();
  });
};

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("GlobalEvolutionListener", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.callback = null;
    mocks.state.mentorId = null;
    mocks.state.mentorLookup = null;
    mocks.companionEvolutionLookupResponses.length = 0;
    mocks.animationJobLookupResponses.length = 0;
    mocks.functionsInvokeMock.mockResolvedValue({ data: { status: "processing", jobId: "job-1" }, error: null });

    mocks.onMock.mockImplementation(
      (_event: string, _config: Record<string, unknown>, callback: (payload: Record<string, unknown>) => Promise<void>) => {
        mocks.state.callback = callback;
        return {
          subscribe: mocks.subscribeMock,
        };
      },
    );

    mocks.subscribeMock.mockReturnValue({
      unsubscribe: vi.fn(),
    });

    mocks.channelMock.mockReturnValue({
      on: mocks.onMock,
    });
  });

  it("invalidates companion-derived queries for non-evolution updates without showing the evolution UI", async () => {
    render(<GlobalEvolutionListener />);

    await act(async () => {
      await mocks.state.callback?.({
        eventType: "UPDATE",
        new: {
          id: "companion-1",
          current_stage: 1,
          current_image_url: "https://example.com/same-stage.png",
        },
        old: {
          id: "companion-1",
          current_stage: 1,
        },
      });
    });

    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["companion"] });
    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["companion-health"] });
    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["companion-care-signals"] });
    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["current-evolution-card"] });
    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["evolution-cards"] });
    expect(screen.queryByTestId("companion-evolution")).not.toBeInTheDocument();
  });

  it("keeps the evolution flow when companion stage increases", async () => {
    render(<GlobalEvolutionListener />);

    await act(async () => {
      await mocks.state.callback?.({
        eventType: "UPDATE",
        new: {
          id: "companion-1",
          current_stage: 5,
          current_image_url: "https://example.com/stage-5.png",
        },
        old: {
          id: "companion-1",
          current_stage: 4,
          current_image_url: "https://example.com/stage-4.png",
        },
      });
    });

    expect(screen.queryByTestId("companion-evolution")).not.toBeInTheDocument();
    await openPlayablePendingAnimation();

    expect(mocks.setEvolutionInProgressMock).toHaveBeenCalledWith(true);
    expect(mocks.companionEvolutionPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        previousStage: 4,
        newStage: 5,
        previousImageUrl: "https://example.com/stage-4.png",
        newImageUrl: "https://example.com/stage-5.png",
        animationVideoUrl: "https://example.com/evolution.mp4",
      }),
    );
  });

  it("shows same-tier stage advances so every generated evolution can reveal", async () => {
    render(<GlobalEvolutionListener />);

    await act(async () => {
      await mocks.state.callback?.({
        eventType: "UPDATE",
        new: {
          id: "companion-1",
          current_stage: 2,
          current_image_url: "https://example.com/stage-2.png",
        },
        old: {
          id: "companion-1",
          current_stage: 1,
          current_image_url: "https://example.com/stage-1.png",
        },
      });
    });

    expect(screen.queryByTestId("companion-evolution")).not.toBeInTheDocument();
    await openPlayablePendingAnimation();

    expect(mocks.companionEvolutionPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        previousStage: 1,
        newStage: 2,
        previousImageUrl: "https://example.com/stage-1.png",
        newImageUrl: "https://example.com/stage-2.png",
      }),
    );
  });

  it("passes ready animation videos from the persisted evolution row into the modal", async () => {
    mocks.companionEvolutionLookupResponses.push({
      data: {
        id: "evo-1",
        animation_video_url: "https://example.com/evolution.mp4",
        animation_status: "succeeded",
      },
      error: null,
    });

    render(<GlobalEvolutionListener />);

    await act(async () => {
      await mocks.state.callback?.({
        eventType: "UPDATE",
        new: {
          id: "companion-1",
          current_stage: 5,
          current_image_url: "https://example.com/stage-5.png",
        },
        old: {
          id: "companion-1",
          current_stage: 4,
          current_image_url: "https://example.com/stage-4.png",
        },
      });
    });

    expect(screen.queryByTestId("companion-evolution")).not.toBeInTheDocument();
    expect(screen.getByTestId("evolution-animation-preloader")).toHaveAttribute(
      "src",
      "https://example.com/evolution.mp4",
    );
    await openPlayablePendingAnimation();
    expect(screen.getByTestId("companion-evolution")).toHaveAttribute(
      "data-animation-video-url",
      "https://example.com/evolution.mp4",
    );

    expect(mocks.companionEvolutionPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        animationVideoUrl: "https://example.com/evolution.mp4",
      }),
    );
  });

  it("waits for queued animation jobs before opening the modal", async () => {
    vi.useFakeTimers();
    mocks.companionEvolutionLookupResponses.push(
      {
        data: {
          id: "evo-1",
          animation_video_url: null,
          animation_status: "queued",
        },
        error: null,
      },
      {
        data: {
          id: "evo-1",
          animation_video_url: "https://example.com/evolution.mp4",
          animation_status: "succeeded",
        },
        error: null,
      },
    );
    mocks.animationJobLookupResponses.push({
      data: { id: "job-1" },
      error: null,
    });

    try {
      render(<GlobalEvolutionListener />);

      const callbackPromise = mocks.state.callback?.({
        eventType: "UPDATE",
        new: {
          id: "companion-1",
          current_stage: 5,
          current_image_url: "https://example.com/stage-5.png",
        },
        old: {
          id: "companion-1",
          current_stage: 4,
          current_image_url: "https://example.com/stage-4.png",
        },
      }) ?? Promise.resolve();

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.queryByTestId("companion-evolution")).not.toBeInTheDocument();
      expect(mocks.functionsInvokeMock).toHaveBeenCalledWith("process-companion-animation-job", {
        body: { jobId: "job-1" },
      });

      await act(async () => {
        vi.advanceTimersByTime(2000);
        await callbackPromise;
      });

      expect(screen.queryByTestId("companion-evolution")).not.toBeInTheDocument();
      const preloader = screen.getByTestId("evolution-animation-preloader");
      await act(async () => {
        fireEvent.canPlay(preloader);
      });

      expect(screen.getByTestId("companion-evolution")).toHaveAttribute(
        "data-animation-video-url",
        "https://example.com/evolution.mp4",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("waits through stale skipped animation metadata while a new Kling job is queued", async () => {
    vi.useFakeTimers();
    const staleTimestamp = new Date(Date.now() - 60_000).toISOString();
    mocks.companionEvolutionLookupResponses.push(
      {
        data: {
          id: "evo-1",
          animation_video_url: null,
          animation_status: "skipped",
          animation_requested_at: staleTimestamp,
          animation_completed_at: staleTimestamp,
        },
        error: null,
      },
      {
        data: {
          id: "evo-1",
          animation_video_url: null,
          animation_status: "queued",
          animation_requested_at: new Date(Date.now()).toISOString(),
          animation_completed_at: null,
        },
        error: null,
      },
      {
        data: {
          id: "evo-1",
          animation_video_url: "https://example.com/evolution.mp4",
          animation_status: "succeeded",
          animation_requested_at: new Date(Date.now()).toISOString(),
          animation_completed_at: new Date(Date.now() + 1_000).toISOString(),
        },
        error: null,
      },
    );
    mocks.animationJobLookupResponses.push({
      data: { id: "job-1" },
      error: null,
    });

    try {
      render(<GlobalEvolutionListener />);

      const callbackPromise = mocks.state.callback?.({
        eventType: "UPDATE",
        new: {
          id: "companion-1",
          current_stage: 5,
          current_image_url: "https://example.com/stage-5.png",
        },
        old: {
          id: "companion-1",
          current_stage: 4,
          current_image_url: "https://example.com/stage-4.png",
        },
      }) ?? Promise.resolve();

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(screen.queryByTestId("companion-evolution")).not.toBeInTheDocument();
      expect(mocks.functionsInvokeMock).toHaveBeenCalledWith("process-companion-animation-job", {
        body: { jobId: "job-1" },
      });

      await act(async () => {
        vi.advanceTimersByTime(2000);
        await Promise.resolve();
      });
      expect(screen.queryByTestId("companion-evolution")).not.toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(2000);
        await callbackPromise;
      });

      expect(screen.queryByTestId("companion-evolution")).not.toBeInTheDocument();
      const preloader = screen.getByTestId("evolution-animation-preloader");
      await act(async () => {
        fireEvent.canPlay(preloader);
      });

      expect(screen.getByTestId("companion-evolution")).toHaveAttribute(
        "data-animation-video-url",
        "https://example.com/evolution.mp4",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps retrying when the evolution row is late, then opens after the MP4 preloads", async () => {
    vi.useFakeTimers();
    mocks.companionEvolutionLookupResponses.push(
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
      {
        data: {
          id: "evo-1",
          animation_video_url: "https://example.com/evolution.mp4",
          animation_status: "succeeded",
        },
        error: null,
      },
    );

    try {
      render(<GlobalEvolutionListener />);

      const callbackPromise = mocks.state.callback?.({
        eventType: "UPDATE",
        new: {
          id: "companion-1",
          current_stage: 5,
          current_image_url: "https://example.com/stage-5.png",
        },
        old: {
          id: "companion-1",
          current_stage: 4,
          current_image_url: "https://example.com/stage-4.png",
        },
      }) ?? Promise.resolve();

      await act(async () => {
        await flushMicrotasks();
        await vi.advanceTimersByTimeAsync(225);
      });
      await callbackPromise;

      expect(screen.queryByTestId("companion-evolution")).not.toBeInTheDocument();
      expect(screen.queryByTestId("evolution-animation-preloader")).not.toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
        await flushMicrotasks();
      });

      const preloader = screen.getByTestId("evolution-animation-preloader");
      expect(preloader).toHaveAttribute("src", "https://example.com/evolution.mp4");

      await act(async () => {
        fireEvent.canPlay(preloader);
      });

      expect(screen.getByTestId("companion-evolution")).toHaveAttribute(
        "data-animation-video-url",
        "https://example.com/evolution.mp4",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps retrying after a failed animation retry cannot immediately queue", async () => {
    vi.useFakeTimers();
    mocks.functionsInvokeMock.mockResolvedValueOnce({
      data: { status: "skipped", reason: "fal_key_missing" },
      error: null,
    });
    mocks.companionEvolutionLookupResponses.push(
      {
        data: {
          id: "evo-1",
          animation_video_url: null,
          animation_status: "failed",
        },
        error: null,
      },
      {
        data: {
          id: "evo-1",
          animation_video_url: "https://example.com/recovered-evolution.mp4",
          animation_status: "succeeded",
        },
        error: null,
      },
    );

    try {
      render(<GlobalEvolutionListener />);

      const callbackPromise = mocks.state.callback?.({
        eventType: "UPDATE",
        new: {
          id: "companion-1",
          current_stage: 5,
          current_image_url: "https://example.com/stage-5.png",
        },
        old: {
          id: "companion-1",
          current_stage: 4,
          current_image_url: "https://example.com/stage-4.png",
        },
      }) ?? Promise.resolve();

      await act(async () => {
        await flushMicrotasks();
        await callbackPromise;
      });

      expect(screen.queryByTestId("companion-evolution")).not.toBeInTheDocument();
      expect(screen.queryByTestId("evolution-animation-preloader")).not.toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
        await flushMicrotasks();
      });

      const preloader = screen.getByTestId("evolution-animation-preloader");
      expect(preloader).toHaveAttribute("src", "https://example.com/recovered-evolution.mp4");

      await act(async () => {
        fireEvent.canPlay(preloader);
      });

      expect(screen.getByTestId("companion-evolution")).toHaveAttribute(
        "data-animation-video-url",
        "https://example.com/recovered-evolution.mp4",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("starts the first hatch animation from a local hatch event", async () => {
    render(<GlobalEvolutionListener />);

    await act(async () => {
      window.dispatchEvent(new CustomEvent(COMPANION_HATCH_STARTED_EVENT, {
        detail: {
          companionId: "companion-1",
          previousStage: 0,
          newStage: 1,
          previousImageUrl: "https://example.com/egg.png",
          newImageUrl: "https://example.com/hatchling.png",
          element: "fire",
        },
      }));
    });

    await openPlayablePendingAnimation();

    expect(mocks.setEvolutionInProgressMock).toHaveBeenCalledTimes(1);
    expect(mocks.companionEvolutionPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        previousStage: 0,
        newStage: 1,
        previousImageUrl: "https://example.com/egg.png",
        newImageUrl: "https://example.com/hatchling.png",
      }),
    );
  });

  it("opens the hatch overlay without waiting for mentor lookup", async () => {
    mocks.state.mentorId = "mentor-1";
    mocks.state.mentorLookup = () => new Promise(() => {});

    render(<GlobalEvolutionListener />);

    await act(async () => {
      window.dispatchEvent(new CustomEvent(COMPANION_HATCH_STARTED_EVENT, {
        detail: {
          companionId: "companion-1",
          previousStage: 0,
          newStage: 1,
          previousImageUrl: "https://example.com/egg.png",
          newImageUrl: "https://example.com/hatchling.png",
          element: "fire",
        },
      }));
    });

    await openPlayablePendingAnimation();

    expect(mocks.companionEvolutionPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        previousStage: 0,
        newStage: 1,
        previousImageUrl: "https://example.com/egg.png",
        newImageUrl: "https://example.com/hatchling.png",
      }),
    );
  });

  it("dedupes the realtime 0 to 1 update after a local hatch start", async () => {
    render(<GlobalEvolutionListener />);

    await act(async () => {
      window.dispatchEvent(new CustomEvent(COMPANION_HATCH_STARTED_EVENT, {
        detail: {
          companionId: "companion-1",
          previousStage: 0,
          newStage: 1,
          previousImageUrl: "https://example.com/egg.png",
          newImageUrl: "https://example.com/hatchling.png",
          element: "fire",
        },
      }));
    });

    await openPlayablePendingAnimation();

    await act(async () => {
      await mocks.state.callback?.({
        eventType: "UPDATE",
        new: {
          id: "companion-1",
          current_stage: 1,
          current_image_url: "https://example.com/hatchling.png",
          core_element: "fire",
          preset_id: "dragon",
        },
        old: {
          id: "companion-1",
          current_stage: 0,
          current_image_url: "https://example.com/egg.png",
          core_element: "fire",
          preset_id: "dragon",
        },
      });
    });

    expect(mocks.setEvolutionInProgressMock).toHaveBeenCalledTimes(1);
    expect(mocks.companionEvolutionPropsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        previousStage: 0,
        newStage: 1,
        previousImageUrl: "https://example.com/egg.png",
        newImageUrl: "https://example.com/hatchling.png",
      }),
    );
  });

  it("ignores raw stage jumps when no persisted evolution row exists", async () => {
    mocks.companionEvolutionLookupResponses.push(
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
    );

    render(<GlobalEvolutionListener />);

    await act(async () => {
      await mocks.state.callback?.({
        eventType: "UPDATE",
        new: {
          id: "companion-1",
          current_stage: 5,
          current_image_url: "https://example.com/stage-5.png",
        },
        old: {
          id: "companion-1",
          current_stage: 4,
          current_image_url: "https://example.com/stage-4.png",
        },
      });
    });

    await waitFor(() => {
      expect(screen.queryByTestId("companion-evolution")).not.toBeInTheDocument();
    });

    expect(mocks.setEvolutionInProgressMock).not.toHaveBeenCalledWith(true);
    expect(mocks.loggerWarnMock).toHaveBeenCalledWith(
      "Evolution listener: Ignoring stage update without persisted evolution row",
      expect.objectContaining({
        companionId: "companion-1",
        oldLevel: 4,
        newLevel: 5,
      }),
    );
  });
});
