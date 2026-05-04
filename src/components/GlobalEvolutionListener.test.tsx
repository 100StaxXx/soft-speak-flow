import { act, render, screen, waitFor } from "@testing-library/react";
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
  const triggerManualEvolutionMock = vi.fn().mockResolvedValue(undefined);
  const toastCustomMock = vi.fn();
  const confettiMock = vi.fn();
  const hapticsImpactMock = vi.fn().mockResolvedValue(undefined);
  const state = {
    callback: null as null | ((payload: Record<string, unknown>) => Promise<void>),
    mentorId: null as string | null,
    mentorLookup: null as null | (() => Promise<{ data: unknown; error: unknown }>),
    companion: null as null | { id: string; current_stage: number; current_xp: number },
    isEvolutionBusy: false,
  };
  const companionEvolutionLookupResponses: Array<{ data: unknown; error: unknown }> = [];

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
    triggerManualEvolutionMock,
    toastCustomMock,
    confettiMock,
    hapticsImpactMock,
    state,
    companionEvolutionLookupResponses,
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
  }) => {
    mocks.companionEvolutionPropsMock(props);
    return props.isEvolving ? (
      <div
        data-testid="companion-evolution"
        data-previous-stage={props.previousStage}
        data-new-stage={props.newStage}
        data-previous-image-url={props.previousImageUrl}
        data-new-image-url={props.newImageUrl}
      />
    ) : null;
  },
}));

vi.mock("@/utils/logger", () => ({
  logger: {
    warn: mocks.loggerWarnMock,
    error: mocks.loggerErrorMock,
  },
}));

vi.mock("@/hooks/useCompanion", () => ({
  useCompanion: () => ({
    companion: mocks.state.companion,
    triggerManualEvolution: mocks.triggerManualEvolutionMock,
    isEvolutionBusy: mocks.state.isEvolutionBusy,
  }),
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    custom: mocks.toastCustomMock,
  },
}));

vi.mock("canvas-confetti", () => ({
  default: mocks.confettiMock,
}));

vi.mock("@capacitor/haptics", () => ({
  Haptics: {
    impact: mocks.hapticsImpactMock,
  },
  ImpactStyle: {
    Light: "LIGHT",
    Medium: "MEDIUM",
    Heavy: "HEAVY",
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: mocks.channelMock,
    removeChannel: mocks.removeChannelMock,
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    from: vi.fn((table: string) => {
      if (table === "companion_evolutions") {
        const maybeSingleMock = vi.fn(async () =>
          mocks.companionEvolutionLookupResponses.shift() ?? {
            data: { id: "evo-1" },
            error: null,
          });

        // The load-time animation-video replay check is the only consumer
        // that joins user_companion!inner. Route it to a no-op default so it
        // doesn't drain the queue meant for waitForEvolutionPersistence.
        const replayMaybeSingleMock = vi.fn(async () => ({ data: null, error: null }));

        const buildPassthroughBuilder = (terminalMaybeSingle: typeof maybeSingleMock) => {
          const builder: Record<string, unknown> = {};
          const passthrough = () => builder;
          builder.select = passthrough;
          builder.eq = passthrough;
          builder.lt = passthrough;
          builder.gte = passthrough;
          builder.not = passthrough;
          builder.is = passthrough;
          builder.order = passthrough;
          builder.limit = passthrough;
          builder.maybeSingle = terminalMaybeSingle;
          builder.update = vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }));
          return builder;
        };

        return {
          select: vi.fn((columns?: string) => {
            const isReplayQuery = typeof columns === "string"
              && columns.includes("user_companion!inner");
            return buildPassthroughBuilder(
              isReplayQuery ? replayMaybeSingleMock : maybeSingleMock,
            );
          }),
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
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
  },
}));

import { GlobalEvolutionListener } from "./GlobalEvolutionListener";

describe("GlobalEvolutionListener", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.callback = null;
    mocks.state.mentorId = null;
    mocks.state.mentorLookup = null;
    mocks.state.companion = null;
    mocks.state.isEvolutionBusy = false;
    mocks.companionEvolutionLookupResponses.length = 0;

    mocks.onMock.mockImplementation(
      (_event: string, config: Record<string, unknown>, callback: (payload: Record<string, unknown>) => Promise<void>) => {
        // Route callbacks per table so the new always-on companion_evolutions
        // subscription doesn't clobber the user_companion handler that the
        // existing tests fire payloads into via state.callback.
        const table = typeof config?.table === "string" ? config.table : "";
        if (table === "user_companion") {
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

    await waitFor(() => {
      expect(screen.getByTestId("companion-evolution")).toBeInTheDocument();
    });

    expect(mocks.setEvolutionInProgressMock).toHaveBeenCalledWith(true);
    expect(mocks.companionEvolutionPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        previousStage: 4,
        newStage: 5,
        previousImageUrl: "https://example.com/stage-4.png",
        newImageUrl: "https://example.com/stage-5.png",
      }),
    );
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

    await waitFor(() => {
      expect(screen.getByTestId("companion-evolution")).toBeInTheDocument();
    });

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

    await waitFor(() => {
      expect(screen.getByTestId("companion-evolution")).toBeInTheDocument();
    });

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

    await waitFor(() => {
      expect(screen.getByTestId("companion-evolution")).toBeInTheDocument();
    });

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

  it("fires the level-up toast and skips the modal for intra-tier graduations", async () => {
    render(<GlobalEvolutionListener />);

    await act(async () => {
      await mocks.state.callback?.({
        eventType: "UPDATE",
        new: {
          id: "companion-1",
          current_stage: 6,
          current_image_url: "https://example.com/stage-6.png",
        },
        old: {
          id: "companion-1",
          current_stage: 5,
          current_image_url: "https://example.com/stage-5.png",
        },
      });
    });

    // Stage 5 → 6 stays inside the initiate tier (5–12), so the dramatic modal
    // must NOT appear; the celebratory level-up toast does.
    expect(screen.queryByTestId("companion-evolution")).not.toBeInTheDocument();
    expect(mocks.toastCustomMock).toHaveBeenCalledTimes(1);
    expect(mocks.confettiMock).toHaveBeenCalledTimes(1);
    expect(mocks.hapticsImpactMock).toHaveBeenCalledTimes(1);
    expect(mocks.setEvolutionInProgressMock).not.toHaveBeenCalledWith(true);
  });

  it("auto-progresses the companion when a graduation is intra-tier", async () => {
    mocks.state.companion = {
      id: "companion-1",
      current_stage: 5,
      current_xp: 240, // earnedLevel = 6, intra-tier (initiate 5–12)
    };

    render(<GlobalEvolutionListener />);

    await waitFor(() => {
      expect(mocks.triggerManualEvolutionMock).toHaveBeenCalledTimes(1);
    });
  });

  it("does not auto-progress while an evolution is busy", async () => {
    mocks.state.companion = {
      id: "companion-1",
      current_stage: 5,
      current_xp: 240,
    };
    mocks.state.isEvolutionBusy = true;

    render(<GlobalEvolutionListener />);

    // Give the effect a chance to run.
    await act(async () => {
      await Promise.resolve();
    });

    expect(mocks.triggerManualEvolutionMock).not.toHaveBeenCalled();
  });

  it("does not auto-progress when the next stage is a tier boundary", async () => {
    mocks.state.companion = {
      id: "companion-1",
      current_stage: 4,
      current_xp: 100, // earnedLevel = 5, next stage 5 = tier boundary
    };

    render(<GlobalEvolutionListener />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mocks.triggerManualEvolutionMock).not.toHaveBeenCalled();
  });

  it("does not auto-progress eggs (current_stage 0)", async () => {
    mocks.state.companion = {
      id: "companion-1",
      current_stage: 0,
      current_xp: 14, // earnedLevel = 1
    };

    render(<GlobalEvolutionListener />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mocks.triggerManualEvolutionMock).not.toHaveBeenCalled();
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
