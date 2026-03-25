import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  const state = {
    callback: null as null | ((payload: Record<string, unknown>) => Promise<void>),
  };

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
    state,
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

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({
    profile: null,
  }),
}));

vi.mock("@/utils/mentor", () => ({
  getResolvedMentorId: () => null,
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
  CompanionEvolution: ({ isEvolving }: { isEvolving: boolean }) =>
    isEvolving ? <div data-testid="companion-evolution" /> : null,
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
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { image_url: "https://example.com/evolved.png" },
                      error: null,
                    }),
                  })),
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
          current_stage: 2,
          current_image_url: "https://example.com/stage-2.png",
        },
        old: {
          id: "companion-1",
          current_stage: 1,
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("companion-evolution")).toBeInTheDocument();
    });

    expect(mocks.setEvolutionInProgressMock).toHaveBeenCalledWith(true);
  });
});
