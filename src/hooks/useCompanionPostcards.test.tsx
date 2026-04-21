import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fromMock: vi.fn(),
  invokeMock: vi.fn(),
  requestJourneyPathGenerationMock: vi.fn(),
  toastSuccessMock: vi.fn(),
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

const createMilestoneSelectBuilder = (data: Record<string, unknown>) => {
  const builder = {
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => ({
      data,
      error: null,
    })),
  };

  return builder;
};

const createCompanionSelectBuilder = (data: Record<string, unknown>) => {
  const builder = {
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => ({
      data,
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
        existing: false,
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

  it("falls back to the latest companion and sends chapterNumber for milestone postcards", async () => {
    mocks.fromMock.mockImplementation((table: string) => {
      if (table === "companion_postcards") {
        return {
          select: vi.fn(() => createPostcardsSelectBuilder()),
        };
      }

      if (table === "epic_milestones") {
        return {
          select: vi.fn(() =>
            createMilestoneSelectBuilder({
              id: "milestone-1",
              title: "Establish Workout Routine",
              milestone_percent: 25,
              is_postcard_milestone: true,
              chapter_number: 2,
            }),
          ),
        };
      }

      if (table === "user_companion") {
        return {
          select: vi.fn(() =>
            createCompanionSelectBuilder({
              id: "companion-fallback",
              spirit_animal: "Phoenix",
              favorite_color: "#22c55e",
              core_element: "air",
              eye_color: "amber",
              fur_color: "gold",
            }),
          ),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCompanionPostcards(), { wrapper });

    await act(async () => {
      await result.current.checkMilestoneForPostcard("milestone-1", "epic-7", "", {});
    });

    await waitFor(() => {
      expect(mocks.invokeMock).toHaveBeenCalledWith("generate-cosmic-postcard", {
        body: {
          companionId: "companion-fallback",
          epicId: "epic-7",
          milestonePercent: 25,
          companionData: {
            spirit_animal: "Phoenix",
            favorite_color: "#22c55e",
            core_element: "air",
            eye_color: "amber",
            fur_color: "gold",
          },
          chapterNumber: 2,
        },
      });
    });
  });
});
