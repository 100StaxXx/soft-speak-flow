import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import {
  COMPANION_EVOLUTION_REVEAL_REQUESTED_EVENT,
  COMPANION_HATCH_STARTED_EVENT,
} from "@/lib/companionEvolutionEvents";

const mocks = vi.hoisted(() => {
  const invalidateQueriesMock = vi.fn().mockResolvedValue(undefined);
  const channelMock = vi.fn();
  const removeChannelMock = vi.fn();
  const onMock = vi.fn();
  const subscribeMock = vi.fn();
  const setIsEvolvingLoadingMock = vi.fn();
  const setPendingEvolutionRevealMock = vi.fn();
  const onEvolutionCompleteMock = vi.fn();
  const setEvolutionInProgressMock = vi.fn();
  const loggerWarnMock = vi.fn();
  const loggerErrorMock = vi.fn();
  const companionEvolutionPropsMock = vi.fn();
  const toastInfoMock = vi.fn();
  const rpcMock = vi.fn();
  const companionMemoriesInsertMock = vi.fn();
  const state = {
    callback: null as null | ((payload: Record<string, unknown>) => Promise<void>),
    mentorId: null as string | null,
    mentorLookup: null as null | (() => Promise<{ data: unknown; error: unknown }>),
    pendingEvolutionReveal: null as null | Record<string, unknown>,
    userCompanionLookup: null as null | Record<string, unknown>,
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
    setPendingEvolutionRevealMock,
    onEvolutionCompleteMock,
    setEvolutionInProgressMock,
    loggerWarnMock,
    loggerErrorMock,
    companionEvolutionPropsMock,
    toastInfoMock,
    rpcMock,
    companionMemoriesInsertMock,
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
    pendingEvolutionReveal: mocks.state.pendingEvolutionReveal,
    setPendingEvolutionReveal: (next: unknown) => {
      mocks.state.pendingEvolutionReveal =
        typeof next === "function"
          ? next(mocks.state.pendingEvolutionReveal)
          : next;
      mocks.setPendingEvolutionRevealMock(mocks.state.pendingEvolutionReveal);
    },
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
    onAnimationError?: () => void;
    onComplete?: () => void;
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
      >
        <button type="button" onClick={props.onComplete}>Complete evolution</button>
        <button type="button" onClick={props.onAnimationError}>Fail evolution</button>
      </div>
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
                data: mocks.state.userCompanionLookup ?? { core_element: "fire" },
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
          insert: mocks.companionMemoriesInsertMock,
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
    rpc: mocks.rpcMock,
    functions: {
      invoke: mocks.functionsInvokeMock,
    },
  },
}));

import {
  clearLocalEvolutionPresentationGuardsForTest,
  GlobalEvolutionListener,
} from "./GlobalEvolutionListener";

const renderListener = () => render(
  <MemoryRouter>
    <GlobalEvolutionListener />
  </MemoryRouter>,
);

const preloadPlayablePendingAnimation = async () => {
  const preloader = screen.getByTestId("evolution-animation-preloader");
  await act(async () => {
    fireEvent.canPlay(preloader);
    await flushMicrotasks();
  });
  expect(mocks.state.pendingEvolutionReveal).toEqual(
    expect.objectContaining({ status: "ready" }),
  );
  expect(screen.queryByTestId("companion-evolution")).not.toBeInTheDocument();
};

const requestReadyEvolutionReveal = async () => {
  const pending = mocks.state.pendingEvolutionReveal as {
    companionId?: string;
    newStage?: number;
  } | null;
  await act(async () => {
    window.dispatchEvent(new CustomEvent(COMPANION_EVOLUTION_REVEAL_REQUESTED_EVENT, {
      detail: {
        companionId: pending?.companionId,
        stage: pending?.newStage,
      },
    }));
  });
};

const openPlayablePendingAnimation = async () => {
  await preloadPlayablePendingAnimation();
  await requestReadyEvolutionReveal();
  expect(screen.getByTestId("companion-evolution")).toBeInTheDocument();
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
    mocks.state.pendingEvolutionReveal = null;
    mocks.state.userCompanionLookup = null;
    mocks.companionEvolutionLookupResponses.length = 0;
    mocks.animationJobLookupResponses.length = 0;
    mocks.rpcMock.mockResolvedValue({ data: [], error: null });
    mocks.companionMemoriesInsertMock.mockResolvedValue({ error: null });
    mocks.functionsInvokeMock.mockResolvedValue({ data: { status: "processing", jobId: "job-1" }, error: null });
    clearLocalEvolutionPresentationGuardsForTest();
    try {
      window.localStorage.removeItem("companion-evolution-presented:user-1:evo-1");
      window.localStorage.removeItem("companion-evolution-presented:user-1:evo-5");
    } catch {
      // Some test localStorage shims are intentionally partial.
    }

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
    renderListener();

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
    renderListener();

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
    expect(mocks.companionMemoriesInsertMock).toHaveBeenCalledTimes(1);
    expect(mocks.companionMemoriesInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        companion_id: "companion-1",
        memory_context: expect.objectContaining({
          details: expect.objectContaining({
            evolutionId: "evo-1",
            previousLevel: 4,
            level: 5,
          }),
        }),
      }),
    );
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

    fireEvent.click(screen.getByRole("button", { name: "Complete evolution" }));

    await waitFor(() => {
      expect(mocks.rpcMock).toHaveBeenCalledWith(
        "mark_companion_evolution_animation_presented",
        { p_evolution_id: "evo-1" },
      );
    });
    expect(mocks.state.pendingEvolutionReveal).toBeNull();
    expect(mocks.onEvolutionCompleteMock).toHaveBeenCalledTimes(1);
  });

  it("uses a local presented guard when the mark-presented RPC fails", async () => {
    mocks.rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "network down" },
    });
    const firstRender = renderListener();

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

    await openPlayablePendingAnimation();
    fireEvent.click(screen.getByRole("button", { name: "Complete evolution" }));

    await waitFor(() => {
      expect(mocks.rpcMock).toHaveBeenCalledWith(
        "mark_companion_evolution_animation_presented",
        { p_evolution_id: "evo-1" },
      );
    });

    firstRender.unmount();
    mocks.state.pendingEvolutionReveal = null;
    mocks.setPendingEvolutionRevealMock.mockClear();
    mocks.toastInfoMock.mockClear();
    mocks.state.userCompanionLookup = {
      id: "companion-1",
      current_stage: 5,
      current_image_url: "https://example.com/stage-5.png",
      initial_image_url: "https://example.com/egg.png",
      core_element: "fire",
    };
    mocks.companionEvolutionLookupResponses.push(
      {
        data: {
          id: "evo-1",
          image_url: "https://example.com/stage-5.png",
          animation_video_url: "https://example.com/evolution.mp4",
          animation_status: "succeeded",
          animation_presented_at: null,
        },
        error: null,
      },
      {
        data: {
          image_url: "https://example.com/stage-4.png",
        },
        error: null,
      },
      {
        data: {
          id: "evo-1",
          image_url: "https://example.com/stage-5.png",
          animation_video_url: "https://example.com/evolution.mp4",
          animation_status: "succeeded",
          animation_presented_at: null,
        },
        error: null,
      },
    );

    renderListener();

    await waitFor(() => {
      expect(mocks.setPendingEvolutionRevealMock).toHaveBeenLastCalledWith(null);
    });
    expect(screen.queryByTestId("evolution-animation-preloader")).not.toBeInTheDocument();
    expect(mocks.toastInfoMock).not.toHaveBeenCalledWith(
      "Your companion's evolution is ready.",
      expect.anything(),
    );
  });

  it("shows same-tier stage advances so every generated evolution can reveal", async () => {
    renderListener();

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

  it("defers the modal after preload and invites the user back to Companion", async () => {
    renderListener();

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

    await preloadPlayablePendingAnimation();

    expect(mocks.toastInfoMock).toHaveBeenCalledWith(
      "Your companion's evolution is ready.",
      expect.objectContaining({
        action: expect.objectContaining({ label: "Reveal" }),
      }),
    );
    expect(screen.queryByTestId("companion-evolution")).not.toBeInTheDocument();

    await requestReadyEvolutionReveal();

    await waitFor(() => {
      expect(screen.getByTestId("companion-evolution")).toBeInTheDocument();
    });
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

    renderListener();

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
      renderListener();

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
        await flushMicrotasks();
      });

      await act(async () => {
        vi.runOnlyPendingTimers();
        await flushMicrotasks();
        vi.runOnlyPendingTimers();
        await flushMicrotasks();
      });
      void callbackPromise;

      expect(screen.queryByTestId("companion-evolution")).not.toBeInTheDocument();
      await openPlayablePendingAnimation();

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
      renderListener();

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
        await flushMicrotasks();
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
        await flushMicrotasks();
      });
      expect(screen.queryByTestId("companion-evolution")).not.toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
        await flushMicrotasks();
      });
      await callbackPromise;

      expect(screen.queryByTestId("companion-evolution")).not.toBeInTheDocument();
      await openPlayablePendingAnimation();

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
      renderListener();

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

      await openPlayablePendingAnimation();

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
      renderListener();

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

      await openPlayablePendingAnimation();

      expect(screen.getByTestId("companion-evolution")).toHaveAttribute(
        "data-animation-video-url",
        "https://example.com/recovered-evolution.mp4",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("starts the first hatch animation from a local hatch event", async () => {
    renderListener();

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

    renderListener();

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
    renderListener();

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

  it("hydrates an unpresented ready evolution after app reload", async () => {
    mocks.state.userCompanionLookup = {
      id: "companion-1",
      current_stage: 5,
      current_image_url: "https://example.com/stage-5.png",
      preset_id: "phoenix",
      core_element: "fire",
      initial_image_url: "https://example.com/egg.png",
    };
    mocks.companionEvolutionLookupResponses.push(
      {
        data: {
          id: "evo-5",
          image_url: "https://example.com/stage-5.png",
          animation_video_url: "https://example.com/evolution.mp4",
          animation_status: "succeeded",
          animation_presented_at: null,
        },
        error: null,
      },
      {
        data: {
          image_url: "https://example.com/stage-4.png",
        },
        error: null,
      },
      {
        data: {
          id: "evo-5",
          image_url: "https://example.com/stage-5.png",
          animation_video_url: "https://example.com/evolution.mp4",
          animation_status: "succeeded",
          animation_presented_at: null,
        },
        error: null,
      },
    );

    renderListener();

    await waitFor(() => {
      expect(screen.getByTestId("evolution-animation-preloader")).toBeInTheDocument();
    });
    await openPlayablePendingAnimation();

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

  it("ignores raw stage jumps when no persisted evolution row exists", async () => {
    mocks.companionEvolutionLookupResponses.push(
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
    );

    renderListener();

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
