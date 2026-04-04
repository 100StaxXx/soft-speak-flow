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
  const state = {
    callback: null as null | ((payload: Record<string, unknown>) => Promise<void>),
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
    mentorId: null,
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

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: mocks.channelMock,
    removeChannel: mocks.removeChannelMock,
    from: vi.fn((table: string) => {
      if (table === "companion_evolutions") {
        const maybeSingleMock = vi.fn(async () =>
          mocks.companionEvolutionLookupResponses.shift() ?? {
            data: { id: "evo-1" },
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
    mocks.companionEvolutionLookupResponses.length = 0;

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
