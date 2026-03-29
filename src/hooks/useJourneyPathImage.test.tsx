import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const buildJourneyPathSnapshot = (overrides: Partial<{
  epic_id: string;
  generated_at: string;
  image_url: string;
  milestone_index: number;
  user_id: string;
}> = {}) => {
  const userId = overrides.user_id ?? "user-1";
  const epicId = overrides.epic_id ?? "epic-1";

  return {
    id: `${userId}:${epicId}`,
    user_id: userId,
    epic_id: epicId,
    milestone_index: overrides.milestone_index ?? 0,
    image_url: overrides.image_url ?? "https://example.com/path-0.png",
    generated_at: overrides.generated_at ?? "2026-03-28T00:00:00.000Z",
    prompt_context: null,
  };
};

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, reject, resolve };
};

const mocks = vi.hoisted(() => ({
  fetchRemoteLatestJourneyPathMock: vi.fn(),
  getPersistedJourneyPathSnapshotMock: vi.fn(),
  requestJourneyPathGenerationMock: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/hooks/epicsQuery", () => ({
  getEpicsQueryKey: (userId: string | undefined) => ["epics", userId] as const,
}));

vi.mock("@/utils/journeyPathCache", () => {
  const preferNewerJourneyPathSnapshot = <
    TSnapshot extends { generated_at: string; milestone_index: number } | null | undefined,
  >(
    current: TSnapshot,
    candidate: TSnapshot,
  ) => {
    if (!candidate) return current ?? null;
    if (!current) return candidate;
    if (candidate.milestone_index !== current.milestone_index) {
      return candidate.milestone_index > current.milestone_index ? candidate : current;
    }
    return candidate.generated_at > current.generated_at ? candidate : current;
  };

  const getJourneyPathQueryKey = (epicId: string | undefined, userId: string | undefined) =>
    ["journey-path", epicId, userId] as const;

  const getJourneyPathGenerationKey = (epicId: string | undefined, userId: string | undefined) =>
    ["journey-path-generation", epicId, userId] as const;

  const getJourneyPathSnapshotFromEpic = (
    epic: {
      id: string;
      latest_journey_path_generated_at?: string | null;
      latest_journey_path_milestone_index?: number | null;
      latest_journey_path_url?: string | null;
    } | null | undefined,
    userId: string,
  ) => {
    if (
      !epic
      || typeof epic.latest_journey_path_url !== "string"
      || epic.latest_journey_path_url.length === 0
      || typeof epic.latest_journey_path_milestone_index !== "number"
    ) {
      return null;
    }

    return {
      id: `${userId}:${epic.id}`,
      user_id: userId,
      epic_id: epic.id,
      milestone_index: epic.latest_journey_path_milestone_index,
      image_url: epic.latest_journey_path_url,
      generated_at: epic.latest_journey_path_generated_at ?? "",
      prompt_context: null,
    };
  };

  const patchJourneyPathQueryCache = (
    queryClient: QueryClient,
    userId: string,
    snapshot: {
      epic_id: string;
      generated_at: string;
      image_url: string;
      milestone_index: number;
      user_id: string;
    },
  ) => {
    queryClient.setQueryData(getJourneyPathQueryKey(snapshot.epic_id, userId), snapshot);
    queryClient.setQueryData<Array<Record<string, unknown>> | undefined>(
      ["epics", userId],
      (currentEpics) =>
        currentEpics?.map((epic) =>
          epic.id === snapshot.epic_id
            ? {
              ...epic,
              latest_journey_path_generated_at: snapshot.generated_at,
              latest_journey_path_milestone_index: snapshot.milestone_index,
              latest_journey_path_url: snapshot.image_url,
            }
            : epic,
        ),
    );
    return snapshot;
  };

  return {
    fetchRemoteLatestJourneyPath: (...args: unknown[]) => mocks.fetchRemoteLatestJourneyPathMock(...args),
    getJourneyPathGenerationKey,
    getJourneyPathQueryKey,
    getJourneyPathSnapshotFromEpic,
    getPersistedJourneyPathSnapshot: (...args: unknown[]) => mocks.getPersistedJourneyPathSnapshotMock(...args),
    patchJourneyPathQueryCache,
    persistAndPatchJourneyPathSnapshot: async (
      queryClient: QueryClient,
      snapshot: {
        epic_id: string;
        generated_at: string;
        image_url: string;
        milestone_index: number;
        user_id: string;
      },
    ) => patchJourneyPathQueryCache(queryClient, snapshot.user_id, snapshot),
    preferNewerJourneyPathSnapshot,
    requestJourneyPathGeneration: (...args: unknown[]) => mocks.requestJourneyPathGenerationMock(...args),
  };
});

import { useJourneyPathImage } from "./useJourneyPathImage";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { queryClient, wrapper };
};

describe("useJourneyPathImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchRemoteLatestJourneyPathMock.mockResolvedValue(null);
    mocks.getPersistedJourneyPathSnapshotMock.mockResolvedValue(null);
    mocks.requestJourneyPathGenerationMock.mockResolvedValue(null);
  });

  it("returns the persisted local image before remote revalidation completes", async () => {
    const localSnapshot = buildJourneyPathSnapshot();
    const remoteSnapshot = buildJourneyPathSnapshot({
      generated_at: "2026-03-28T01:00:00.000Z",
      image_url: "https://example.com/path-1.png",
      milestone_index: 1,
    });
    const remoteDeferred = createDeferred<typeof remoteSnapshot | null>();

    mocks.getPersistedJourneyPathSnapshotMock.mockResolvedValue(localSnapshot);
    mocks.fetchRemoteLatestJourneyPathMock.mockReturnValue(remoteDeferred.promise);

    const { result } = renderHook(() => useJourneyPathImage("epic-1"), {
      wrapper: createWrapper().wrapper,
    });

    await waitFor(() => {
      expect(result.current.pathImageUrl).toBe(localSnapshot.image_url);
    });

    await act(async () => {
      remoteDeferred.resolve(remoteSnapshot);
      await remoteDeferred.promise;
    });

    await waitFor(() => {
      expect(result.current.pathImageUrl).toBe(remoteSnapshot.image_url);
    });
  });

  it("deduplicates automatic initial generation across rerenders", async () => {
    const generationDeferred = createDeferred<ReturnType<typeof buildJourneyPathSnapshot> | null>();

    mocks.requestJourneyPathGenerationMock.mockImplementation(({ epicId, milestoneIndex, queryClient, userId }) => {
      queryClient.setQueryData(["journey-path-generation", epicId, userId], {
        pending: true,
        milestoneIndex,
      });

      return generationDeferred.promise.finally(() => {
        queryClient.setQueryData(["journey-path-generation", epicId, userId], {
          pending: false,
          milestoneIndex: null,
        });
      });
    });

    const { rerender } = renderHook(({ epicId }) => useJourneyPathImage(epicId), {
      initialProps: { epicId: "epic-1" },
      wrapper: createWrapper().wrapper,
    });

    await waitFor(() => {
      expect(mocks.requestJourneyPathGenerationMock).toHaveBeenCalledTimes(1);
    });

    rerender({ epicId: "epic-1" });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mocks.requestJourneyPathGenerationMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      generationDeferred.resolve(buildJourneyPathSnapshot());
      await generationDeferred.promise;
    });
  });

  it("keeps the previous image visible while a new milestone path is generating", async () => {
    const localSnapshot = buildJourneyPathSnapshot();
    const generationDeferred = createDeferred<ReturnType<typeof buildJourneyPathSnapshot> | null>();

    mocks.getPersistedJourneyPathSnapshotMock.mockResolvedValue(localSnapshot);
    mocks.requestJourneyPathGenerationMock.mockImplementation(({ epicId, milestoneIndex, queryClient, userId }) => {
      queryClient.setQueryData(["journey-path-generation", epicId, userId], {
        pending: true,
        milestoneIndex,
      });

      return generationDeferred.promise.finally(() => {
        queryClient.setQueryData(["journey-path-generation", epicId, userId], {
          pending: false,
          milestoneIndex: null,
        });
      });
    });

    const { result } = renderHook(() => useJourneyPathImage("epic-1"), {
      wrapper: createWrapper().wrapper,
    });

    await waitFor(() => {
      expect(result.current.pathImageUrl).toBe(localSnapshot.image_url);
    });

    act(() => {
      result.current.regeneratePathForMilestone(2);
    });

    await waitFor(() => {
      expect(result.current.isGenerating).toBe(true);
    });

    expect(result.current.pathImageUrl).toBe(localSnapshot.image_url);

    await act(async () => {
      generationDeferred.resolve(buildJourneyPathSnapshot({
        generated_at: "2026-03-28T02:00:00.000Z",
        image_url: "https://example.com/path-2.png",
        milestone_index: 2,
      }));
      await generationDeferred.promise;
    });
  });

  it("auto-generates a missing initial path once and surfaces the generated image", async () => {
    const generatedSnapshot = buildJourneyPathSnapshot({
      generated_at: "2026-03-28T03:00:00.000Z",
      image_url: "https://example.com/generated.png",
    });

    mocks.requestJourneyPathGenerationMock.mockImplementation(({ epicId, milestoneIndex, queryClient, userId }) => {
      queryClient.setQueryData(["journey-path-generation", epicId, userId], {
        pending: true,
        milestoneIndex,
      });

      return Promise.resolve(generatedSnapshot).finally(() => {
        queryClient.setQueryData(["journey-path-generation", epicId, userId], {
          pending: false,
          milestoneIndex: null,
        });
      });
    });

    const { result } = renderHook(() => useJourneyPathImage("epic-1"), {
      wrapper: createWrapper().wrapper,
    });

    await waitFor(() => {
      expect(mocks.requestJourneyPathGenerationMock).toHaveBeenCalledWith({
        epicId: "epic-1",
        milestoneIndex: 0,
        queryClient: expect.any(QueryClient),
        userId: "user-1",
      });
    });

    await waitFor(() => {
      expect(result.current.pathImageUrl).toBe(generatedSnapshot.image_url);
    });
  });
});
