import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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
  const toastErrorMock = vi.fn();
  const rpcMock = vi.fn();
  const companionMemoriesInsertMock = vi.fn();
  const state = {
    callback: null as
      | null
      | ((payload: Record<string, unknown>) => Promise<void>),
    jobCallback: null as
      | null
      | ((payload: Record<string, unknown>) => Promise<void>),
    mentorId: null as string | null,
    mentorLookup: null as
      | null
      | (() => Promise<{ data: unknown; error: unknown }>),
    pendingEvolutionReveal: null as null | Record<string, unknown>,
    userCompanionLookup: null as null | Record<string, unknown>,
  };
  const companionEvolutionLookupResponses: Array<{
    data: unknown;
    error: unknown;
  }> = [];
  const animationJobLookupResponses: Array<{ data: unknown; error: unknown }> =
    [];
  const evolutionJobLookupResponses: Array<{ data: unknown; error: unknown }> =
    [];
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
    toastErrorMock,
    rpcMock,
    companionMemoriesInsertMock,
    functionsInvokeMock,
    state,
    companionEvolutionLookupResponses,
    animationJobLookupResponses,
    evolutionJobLookupResponses,
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

vi.mock("@/hooks/useAchievements", () => ({
  useAchievements: () => ({
    checkCompanionAchievements: vi.fn().mockResolvedValue(undefined),
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
        <button type="button" onClick={props.onComplete}>
          Complete evolution
        </button>
        <button type="button" onClick={props.onAnimationError}>
          Fail evolution
        </button>
      </div>
    ) : null;
  },
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    info: mocks.toastInfoMock,
    error: mocks.toastErrorMock,
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
        const maybeSingleMock = vi.fn(
          async () =>
            mocks.companionEvolutionLookupResponses.shift() ?? {
              data: {
                id: "evo-1",
                animation_video_url: "https://example.com/evolution.mp4",
                animation_status: "succeeded",
              },
              error: null,
            },
        );

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
        const maybeSingleMock = vi.fn(
          async () =>
            mocks.animationJobLookupResponses.shift() ?? {
              data: { id: "job-1" },
              error: null,
            },
        );

        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({
                  maybeSingle: maybeSingleMock,
                })),
              })),
            })),
          })),
        };
      }

      if (table === "companion_evolution_jobs") {
        const maybeSingleMock = vi.fn(
          async () =>
            mocks.evolutionJobLookupResponses.shift() ?? {
              data: null,
              error: null,
            },
        );

        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({
                  maybeSingle: maybeSingleMock,
                })),
              })),
            })),
          })),
        };
      }

      if (table === "user_companion") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: mocks.state.userCompanionLookup ?? {
                  core_element: "fire",
                },
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
              maybeSingle: vi.fn(
                () =>
                  mocks.state.mentorLookup?.() ??
                  Promise.resolve({
                    data: { slug: "atlas" },
                    error: null,
                  }),
              ),
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

const renderListener = () =>
  render(
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
    window.dispatchEvent(
      new CustomEvent(COMPANION_EVOLUTION_REVEAL_REQUESTED_EVENT, {
        detail: {
          companionId: pending?.companionId,
          stage: pending?.newStage,
        },
      }),
    );
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
    mocks.state.jobCallback = null;
    mocks.state.mentorId = null;
    mocks.state.mentorLookup = null;
    mocks.state.pendingEvolutionReveal = null;
    mocks.state.userCompanionLookup = null;
    mocks.companionEvolutionLookupResponses.length = 0;
    mocks.animationJobLookupResponses.length = 0;
    mocks.evolutionJobLookupResponses.length = 0;
    mocks.rpcMock.mockResolvedValue({ data: [], error: null });
    mocks.companionMemoriesInsertMock.mockResolvedValue({ error: null });
    mocks.functionsInvokeMock.mockResolvedValue({
      data: { status: "processing", jobId: "job-1" },
      error: null,
    });
    clearLocalEvolutionPresentationGuardsForTest();
    try {
      window.localStorage.removeItem(
        "companion-evolution-presented:user-1:evo-1",
      );
      window.localStorage.removeItem(
        "companion-evolution-presented:user-1:evo-5",
      );
      window.localStorage.removeItem(
        "companion-evolution-job-failed:user-1:evolution-job-1",
      );
    } catch {
      // Some test localStorage shims are intentionally partial.
    }

    mocks.onMock.mockImplementation(
      (
        _event: string,
        config: Record<string, unknown>,
        callback: (payload: Record<string, unknown>) => Promise<void>,
      ) => {
        if (config.table === "companion_evolution_jobs") {
          mocks.state.jobCallback = callback;
        } else {
          mocks.state.callback = callback;
        }
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

  it("hydrates an active queued evolution job on mount", async () => {
    mocks.state.userCompanionLookup = {
      id: "companion-1",
      current_stage: 4,
      current_image_url: "https://example.com/stage-4.png",
      initial_image_url: "https://example.com/egg.png",
      core_element: "fire",
    };
    mocks.evolutionJobLookupResponses.push({
      data: {
        id: "evolution-job-1",
        companion_id: "companion-1",
        requested_stage: 5,
        status: "queued",
        requested_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
    });

    renderListener();

    await waitFor(() => {
      expect(mocks.setIsEvolvingLoadingMock).toHaveBeenCalledWith(true);
    });
    expect(mocks.state.pendingEvolutionReveal).toEqual(
      expect.objectContaining({
        status: "preparing",
        companionId: "companion-1",
        previousStage: 4,
        newStage: 5,
        previousImageUrl: "https://example.com/stage-4.png",
      }),
    );
    expect(mocks.functionsInvokeMock).toHaveBeenCalledWith(
      "process-companion-evolution-job",
      { body: { jobId: "evolution-job-1" } },
    );
  });

  it("clears loading and notifies when a queued evolution job fails", async () => {
    renderListener();

    await act(async () => {
      await mocks.state.jobCallback?.({
        eventType: "UPDATE",
        new: {
          id: "evolution-job-1",
          companion_id: "companion-1",
          requested_stage: 5,
          status: "failed",
          error_code: "image_generation_failed",
          error_message: "provider failed",
          requested_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });
    });

    expect(mocks.setIsEvolvingLoadingMock).toHaveBeenCalledWith(false);
    expect(mocks.toastErrorMock).toHaveBeenCalledWith(
      "Unable to evolve your companion. Please try again.",
    );
  });

  it("hydrates a missed queued evolution job when the app resumes", async () => {
    renderListener();
    await flushMicrotasks();

    mocks.state.userCompanionLookup = {
      id: "companion-1",
      current_stage: 4,
      current_image_url: "https://example.com/stage-4.png",
      initial_image_url: "https://example.com/egg.png",
      core_element: "fire",
    };
    mocks.evolutionJobLookupResponses.push({
      data: {
        id: "evolution-job-resume",
        companion_id: "companion-1",
        requested_stage: 5,
        status: "queued",
        requested_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
    });
    mocks.functionsInvokeMock.mockClear();

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await flushMicrotasks();
    });

    await waitFor(() => {
      expect(mocks.setIsEvolvingLoadingMock).toHaveBeenCalledWith(true);
    });
    expect(mocks.state.pendingEvolutionReveal).toEqual(
      expect.objectContaining({
        status: "preparing",
        companionId: "companion-1",
        previousStage: 4,
        newStage: 5,
      }),
    );
    expect(mocks.functionsInvokeMock).toHaveBeenCalledWith(
      "process-companion-evolution-job",
      { body: { jobId: "evolution-job-resume" } },
    );
  });

  it("hydrates the ready reveal after an evolution job completes", async () => {
    renderListener();
    await flushMicrotasks();

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

    await act(async () => {
      await mocks.state.jobCallback?.({
        eventType: "UPDATE",
        new: {
          id: "evolution-job-1",
          companion_id: "companion-1",
          requested_stage: 5,
          status: "succeeded",
          requested_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });
    });

    await waitFor(() => {
      expect(
        screen.getByTestId("evolution-animation-preloader"),
      ).toBeInTheDocument();
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

    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["companion"],
    });
    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["companion-health"],
    });
    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["companion-care-signals"],
    });
    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["current-evolution-card"],
    });
    expect(mocks.invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["evolution-cards"],
    });
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

  it("removes the hidden preloader when the prepared reveal starts", async () => {
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

    expect(
      screen.getByTestId("evolution-animation-preloader"),
    ).toBeInTheDocument();

    await requestReadyEvolutionReveal();

    expect(screen.getByTestId("companion-evolution")).toBeInTheDocument();
    expect(
      screen.queryByTestId("evolution-animation-preloader"),
    ).not.toBeInTheDocument();
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
      expect(mocks.setPendingEvolutionRevealMock).toHaveBeenLastCalledWith(
        null,
      );
    });
    expect(
      screen.queryByTestId("evolution-animation-preloader"),
    ).not.toBeInTheDocument();
    expect(mocks.toastInfoMock).not.toHaveBeenCalledWith(
      "Your companion's evolution is ready.",
      expect.anything(),
    );
  });

  it("ignores non-boundary stage advances so intermediate levels do not open reveal UI", async () => {
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
    expect(
      screen.queryByTestId("evolution-animation-preloader"),
    ).not.toBeInTheDocument();
    expect(mocks.setPendingEvolutionRevealMock).not.toHaveBeenCalled();
    expect(mocks.companionEvolutionPropsMock).not.toHaveBeenCalled();
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

  it("uses the succeeded animation job when the evolution row has not caught up", async () => {
    mocks.companionEvolutionLookupResponses.push({
      data: {
        id: "evo-1",
        animation_video_url: null,
        animation_status: "queued",
        animation_presented_at: null,
      },
      error: null,
    });
    mocks.animationJobLookupResponses.push({
      data: {
        status: "succeeded",
        video_url: "https://example.com/job-evolution.mp4",
        completed_at: "2026-05-03T12:03:00.000Z",
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

    expect(screen.getByTestId("evolution-animation-preloader")).toHaveAttribute(
      "src",
      "https://example.com/job-evolution.mp4",
    );
    await openPlayablePendingAnimation();
    expect(screen.getByTestId("companion-evolution")).toHaveAttribute(
      "data-animation-video-url",
      "https://example.com/job-evolution.mp4",
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

      const callbackPromise =
        mocks.state.callback?.({
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
      expect(
        screen.queryByTestId("companion-evolution"),
      ).not.toBeInTheDocument();
      expect(mocks.functionsInvokeMock).toHaveBeenCalledWith(
        "prewarm-companion-animation",
        {
          body: {
            companionId: "companion-1",
            stage: 5,
            force: false,
            reason: "status_queued",
          },
        },
      );
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

      expect(
        screen.queryByTestId("companion-evolution"),
      ).not.toBeInTheDocument();
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

      const callbackPromise =
        mocks.state.callback?.({
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

      expect(
        screen.queryByTestId("companion-evolution"),
      ).not.toBeInTheDocument();
      expect(mocks.functionsInvokeMock).not.toHaveBeenCalled();
      await act(async () => {
        await flushMicrotasks();
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
        await flushMicrotasks();
      });
      expect(
        screen.queryByTestId("companion-evolution"),
      ).not.toBeInTheDocument();
      expect(mocks.functionsInvokeMock).toHaveBeenCalledWith(
        "prewarm-companion-animation",
        {
          body: {
            companionId: "companion-1",
            stage: 5,
            force: false,
            reason: "status_queued",
          },
        },
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
        await flushMicrotasks();
      });
      await callbackPromise;

      expect(
        screen.queryByTestId("companion-evolution"),
      ).not.toBeInTheDocument();
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

      const callbackPromise =
        mocks.state.callback?.({
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

      expect(
        screen.queryByTestId("companion-evolution"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("evolution-animation-preloader"),
      ).not.toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
        await flushMicrotasks();
      });

      const preloader = screen.getByTestId("evolution-animation-preloader");
      expect(preloader).toHaveAttribute(
        "src",
        "https://example.com/evolution.mp4",
      );

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

      const callbackPromise =
        mocks.state.callback?.({
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

      expect(
        screen.queryByTestId("companion-evolution"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("evolution-animation-preloader"),
      ).not.toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
        await flushMicrotasks();
      });

      const preloader = screen.getByTestId("evolution-animation-preloader");
      expect(preloader).toHaveAttribute(
        "src",
        "https://example.com/recovered-evolution.mp4",
      );

      await openPlayablePendingAnimation();

      expect(screen.getByTestId("companion-evolution")).toHaveAttribute(
        "data-animation-video-url",
        "https://example.com/recovered-evolution.mp4",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("settles non-retryable skipped animation rows without retrying forever", async () => {
    const now = new Date().toISOString();
    mocks.companionEvolutionLookupResponses.push({
      data: {
        id: "evo-5",
        image_url: "https://example.com/stage-5.png",
        animation_video_url: null,
        animation_status: "skipped",
        animation_error_code: "image_unchanged",
        animation_requested_at: now,
        animation_completed_at: now,
        animation_presented_at: null,
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
      await flushMicrotasks();
    });

    expect(mocks.functionsInvokeMock).not.toHaveBeenCalledWith(
      "prewarm-companion-animation",
      expect.anything(),
    );
    expect(screen.queryByTestId("companion-evolution")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("evolution-animation-preloader"),
    ).not.toBeInTheDocument();
    expect(mocks.state.pendingEvolutionReveal).toBeNull();
    expect(mocks.rpcMock).toHaveBeenCalledWith(
      "mark_companion_evolution_animation_presented",
      { p_evolution_id: "evo-5" },
    );
    expect(mocks.setIsEvolvingLoadingMock).toHaveBeenLastCalledWith(false);
  });

  it("starts the first hatch animation from a local hatch event", async () => {
    renderListener();

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(COMPANION_HATCH_STARTED_EVENT, {
          detail: {
            companionId: "companion-1",
            previousStage: 0,
            newStage: 1,
            previousImageUrl: "https://example.com/egg.png",
            newImageUrl: "https://example.com/hatchling.png",
            element: "fire",
          },
        }),
      );
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

  it("keeps the first hatch reveal preparing until the generated animation is complete", async () => {
    vi.useFakeTimers();
    mocks.companionEvolutionLookupResponses.push(
      {
        data: {
          id: "evo-1",
          animation_video_url: null,
          animation_status: "processing",
          animation_presented_at: null,
        },
        error: null,
      },
      {
        data: {
          id: "evo-1",
          animation_video_url: "https://example.com/hatch-kling.mp4",
          animation_status: "succeeded",
          animation_presented_at: null,
        },
        error: null,
      },
    );

    try {
      renderListener();

      await act(async () => {
        window.dispatchEvent(
          new CustomEvent(COMPANION_HATCH_STARTED_EVENT, {
            detail: {
              companionId: "companion-1",
              previousStage: 0,
              newStage: 1,
              previousImageUrl: "https://example.com/egg.png",
              newImageUrl: "https://example.com/hatchling.png",
              presetId: "fox",
              element: "fire",
            },
          }),
        );
        await flushMicrotasks();
      });

      expect(mocks.state.pendingEvolutionReveal).toEqual(
        expect.objectContaining({
          status: "preparing",
          animationVideoUrl: null,
        }),
      );
      expect(
        screen.queryByTestId("evolution-animation-preloader"),
      ).not.toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000);
        await flushMicrotasks();
      });

      expect(
        screen.getByTestId("evolution-animation-preloader"),
      ).toHaveAttribute("src", "https://example.com/hatch-kling.mp4");
      await openPlayablePendingAnimation();

      expect(screen.getByTestId("companion-evolution")).toHaveAttribute(
        "data-animation-video-url",
        "https://example.com/hatch-kling.mp4",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens the hatch overlay without waiting for mentor lookup", async () => {
    mocks.state.mentorId = "mentor-1";
    mocks.state.mentorLookup = () => new Promise(() => {});

    renderListener();

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(COMPANION_HATCH_STARTED_EVENT, {
          detail: {
            companionId: "companion-1",
            previousStage: 0,
            newStage: 1,
            previousImageUrl: "https://example.com/egg.png",
            newImageUrl: "https://example.com/hatchling.png",
            element: "fire",
          },
        }),
      );
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
      window.dispatchEvent(
        new CustomEvent(COMPANION_HATCH_STARTED_EVENT, {
          detail: {
            companionId: "companion-1",
            previousStage: 0,
            newStage: 1,
            previousImageUrl: "https://example.com/egg.png",
            newImageUrl: "https://example.com/hatchling.png",
            element: "fire",
          },
        }),
      );
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
      expect(
        screen.getByTestId("evolution-animation-preloader"),
      ).toBeInTheDocument();
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

  it("does not hydrate intermediate level rows into a pending reveal", async () => {
    mocks.state.userCompanionLookup = {
      id: "companion-1",
      current_stage: 2,
      current_image_url: "https://example.com/stage-2.png",
      preset_id: "phoenix",
      core_element: "fire",
      initial_image_url: "https://example.com/egg.png",
    };

    renderListener();

    await act(async () => {
      await flushMicrotasks();
    });

    expect(mocks.setPendingEvolutionRevealMock).not.toHaveBeenCalled();
    expect(
      screen.queryByTestId("evolution-animation-preloader"),
    ).not.toBeInTheDocument();
  });

  it("does not hydrate old evolution rows that have no animation work", async () => {
    mocks.state.userCompanionLookup = {
      id: "companion-1",
      current_stage: 5,
      current_image_url: "https://example.com/stage-5.png",
      preset_id: "phoenix",
      core_element: "fire",
      initial_image_url: "https://example.com/egg.png",
    };
    mocks.companionEvolutionLookupResponses.push({
      data: {
        id: "evo-5",
        image_url: "https://example.com/stage-5.png",
        animation_video_url: null,
        animation_status: null,
        animation_requested_at: null,
        animation_completed_at: null,
        animation_presented_at: null,
      },
      error: null,
    });

    renderListener();

    await act(async () => {
      await flushMicrotasks();
    });

    expect(mocks.setPendingEvolutionRevealMock).not.toHaveBeenCalled();
    expect(
      screen.queryByTestId("evolution-animation-preloader"),
    ).not.toBeInTheDocument();
    expect(mocks.functionsInvokeMock).not.toHaveBeenCalledWith(
      "prewarm-companion-animation",
      expect.anything(),
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
      expect(
        screen.queryByTestId("companion-evolution"),
      ).not.toBeInTheDocument();
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
