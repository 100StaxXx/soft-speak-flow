import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fromMock: vi.fn(),
  invokeMock: vi.fn(),
  requestJourneyPathGenerationMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mocks.fromMock(...args),
    functions: {
      invoke: (...args: unknown[]) => mocks.invokeMock(...args),
    },
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/utils/journeyPathCache", () => ({
  requestJourneyPathGeneration: (...args: unknown[]) => mocks.requestJourneyPathGenerationMock(...args),
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mocks.toastSuccessMock(...args),
    error: (...args: unknown[]) => mocks.toastErrorMock(...args),
  },
}));

import { useCompanionPostcards } from "./useCompanionPostcards";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
};

const createPostcardsSelectBuilder = () => {
  const builder = {
    eq: vi.fn(() => builder),
    order: vi.fn(async () => ({
      data: [],
      error: null,
    })),
  };

  return builder;
};

describe("useCompanionPostcards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fromMock.mockImplementation((table: string) => {
      if (table === "companion_postcards") {
        return {
          select: vi.fn(() => createPostcardsSelectBuilder()),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.invokeMock.mockResolvedValue({
      data: {
        cached: false,
        postcard: {
          chapter_number: 3,
          epic_id: "epic-7",
          location_name: "Moonrise Pass",
        },
      },
      error: null,
    });
    mocks.requestJourneyPathGenerationMock.mockResolvedValue(null);
  });

  it("regenerates the journey path via the shared helper after postcard generation", async () => {
    const { queryClient, wrapper } = createWrapper();
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCompanionPostcards(), { wrapper });

    await act(async () => {
      await result.current.generatePostcard.mutateAsync({
        companionId: "companion-1",
        epicId: "epic-7",
        milestonePercent: 75,
        companionData: {
          spirit_animal: "Fox",
          favorite_color: "#7c3aed",
        },
        milestoneTitle: "Cross the pass",
        chapterNumber: 3,
      });
    });

    await waitFor(() => {
      expect(mocks.requestJourneyPathGenerationMock).toHaveBeenCalledWith({
        epicId: "epic-7",
        milestoneIndex: 3,
        queryClient,
        userId: "user-1",
      });
    });

    expect(mocks.invokeMock).toHaveBeenCalledWith("generate-cosmic-postcard", {
      body: {
        companionId: "companion-1",
        epicId: "epic-7",
        milestonePercent: 75,
        companionData: {
          spirit_animal: "Fox",
          favorite_color: "#7c3aed",
        },
        chapterNumber: 3,
      },
    });
    expect(mocks.invokeMock).not.toHaveBeenCalledWith(
      "generate-journey-path",
      expect.objectContaining({
        body: expect.objectContaining({
          userId: "user-1",
        }),
      }),
    );
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ["companion-postcards", "user-1"],
    });
  });

  it("does not celebrate or regenerate paths for a cached postcard", async () => {
    mocks.invokeMock.mockResolvedValueOnce({
      data: {
        cached: true,
        postcard: {
          chapter_number: 3,
          epic_id: "epic-7",
          location_name: "Moonrise Pass",
        },
      },
      error: null,
    });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCompanionPostcards(), { wrapper });

    await act(async () => {
      await result.current.generatePostcard.mutateAsync({
        companionId: "companion-1",
        epicId: "epic-7",
        milestonePercent: 75,
        companionData: { spirit_animal: "Fox" },
        chapterNumber: 3,
      });
    });

    expect(mocks.toastSuccessMock).not.toHaveBeenCalled();
    expect(mocks.requestJourneyPathGenerationMock).not.toHaveBeenCalled();
    expect(result.current.postcardJustUnlocked).toBeNull();
  });

  it("passes the milestone chapter number into postcard generation", async () => {
    mocks.fromMock.mockImplementation((table: string) => {
      if (table === "companion_postcards") {
        return { select: vi.fn(() => createPostcardsSelectBuilder()) };
      }
      if (table === "epic_milestones") {
        const builder = {
          eq: vi.fn(() => builder),
          maybeSingle: vi.fn(async () => ({
            data: {
              id: "milestone-4",
              title: "Open the observatory",
              milestone_percent: 40,
              is_postcard_milestone: true,
              chapter_number: 4,
            },
            error: null,
          })),
        };
        return { select: vi.fn(() => builder) };
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCompanionPostcards(), { wrapper });

    await act(async () => {
      await result.current.checkMilestoneForPostcard(
        "milestone-4",
        "epic-7",
        "companion-1",
        { spirit_animal: "Fox" },
      );
    });

    await waitFor(() => {
      expect(mocks.invokeMock).toHaveBeenCalledWith("generate-cosmic-postcard", {
        body: expect.objectContaining({
          milestonePercent: 40,
          chapterNumber: 4,
        }),
      });
    });
  });
});
