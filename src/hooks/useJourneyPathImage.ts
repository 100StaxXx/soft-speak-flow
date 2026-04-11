import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useResilience } from "@/contexts/ResilienceContext";
import { getEpicsQueryKey, type EpicRecord } from "@/hooks/epicsQuery";
import { needsJourneyPathLandscapeRefresh } from "@/shared/journeyPathConfig";
import { getActiveQueuedActions } from "@/utils/offlineStorage";
import { PLANNER_SYNC_EVENT } from "@/utils/plannerSync";
import {
  fetchRemoteLatestJourneyPath,
  type JourneyPathGenerationError,
  getJourneyPathGenerationKey,
  getJourneyPathQueryKey,
  getJourneyPathSnapshotFromEpic,
  getPersistedJourneyPathSnapshot,
  patchJourneyPathQueryCache,
  persistAndPatchJourneyPathSnapshot,
  preferNewerJourneyPathSnapshot,
  requestJourneyPathGeneration,
  type JourneyPathSnapshot,
} from "@/utils/journeyPathCache";

const EPIC_CREATE_QUEUE_POLL_INTERVAL_MS = 2_000;
const EPIC_SYNC_FAILURE_MESSAGE =
  "We couldn't finish saving this campaign yet. Retry sync to finish setting up your Star Path.";

type EpicCreateSyncState =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "failed"; actionId: string | null; message: string };

export const useJourneyPathImage = (epicId: string | undefined) => {
  const { user } = useAuth();
  const { retryAction, retryNow } = useResilience();
  const queryClient = useQueryClient();
  const initialGenerationRequestedRef = useRef(false);
  const legacyLandscapeRefreshRequestedRef = useRef(false);
  const [persistedJourneyPath, setPersistedJourneyPath] = useState<JourneyPathSnapshot | null>(null);
  const [hasResolvedLocalSnapshot, setHasResolvedLocalSnapshot] = useState(false);
  const [epicCreateSyncState, setEpicCreateSyncState] = useState<EpicCreateSyncState>({ status: "idle" });

  const epics = queryClient.getQueryData<EpicRecord[]>(getEpicsQueryKey(user?.id)) ?? [];

  const journeyPathFromEpics = useMemo(() => {
    if (!epicId || !user?.id) return null;
    const matchingEpic = epics.find((epic) => epic.id === epicId) ?? null;
    return getJourneyPathSnapshotFromEpic(matchingEpic, user.id);
  }, [epicId, epics, user?.id]);

  const remoteJourneyPathQuery = useQuery<JourneyPathSnapshot | null>({
    queryKey: getJourneyPathQueryKey(epicId, user?.id),
    queryFn: async () => {
      if (!epicId || !user?.id) return null;

      const remoteJourneyPath = await fetchRemoteLatestJourneyPath(user.id, epicId);
      if (remoteJourneyPath) {
        await persistAndPatchJourneyPathSnapshot(queryClient, remoteJourneyPath);
      }

      return remoteJourneyPath;
    },
    enabled: !!epicId && !!user?.id,
    staleTime: 10 * 60 * 1000,
    placeholderData: (previousJourneyPath) =>
      previousJourneyPath
      ?? queryClient.getQueryData<JourneyPathSnapshot | null>(getJourneyPathQueryKey(epicId, user?.id))
      ?? journeyPathFromEpics
      ?? null,
  });

  const { data: generationState = { pending: false, milestoneIndex: null, error: null } } = useQuery<{
    error: JourneyPathGenerationError | null;
    pending: boolean;
    milestoneIndex: number | null;
  }>({
    queryKey: getJourneyPathGenerationKey(epicId, user?.id),
    queryFn: async () => ({ pending: false, milestoneIndex: null, error: null }),
    enabled: false,
    initialData: { pending: false, milestoneIndex: null, error: null },
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const refreshEpicCreateSyncState = useCallback(async () => {
    if (!epicId || !user?.id) {
      setEpicCreateSyncState({ status: "idle" });
      return { status: "idle" } as const;
    }

    try {
      const activeQueuedActions = await getActiveQueuedActions(user.id);
      const matchingEpicCreates = activeQueuedActions
        .filter((action) => action.action_kind === "EPIC_CREATE" && action.entity_id === epicId)
        .sort((left, right) => right.updated_at - left.updated_at);

      const hasPendingEpicCreate = matchingEpicCreates.some((action) =>
        action.status === "queued" || action.status === "syncing"
      );
      if (hasPendingEpicCreate) {
        const nextState = { status: "pending" } as const;
        setEpicCreateSyncState(nextState);
        return nextState;
      }

      const failedEpicCreate = matchingEpicCreates.find((action) => action.status === "failed");
      if (failedEpicCreate) {
        const nextState = {
          status: "failed",
          actionId: failedEpicCreate.id,
          message: failedEpicCreate.last_error || EPIC_SYNC_FAILURE_MESSAGE,
        } as const;
        setEpicCreateSyncState(nextState);
        return nextState;
      }

      const nextState = { status: "idle" } as const;
      setEpicCreateSyncState(nextState);
      return nextState;
    } catch (error) {
      console.error("Failed to inspect pending epic sync state:", error);
      const nextState = {
        status: "failed",
        actionId: null,
        message: EPIC_SYNC_FAILURE_MESSAGE,
      } as const;
      setEpicCreateSyncState(nextState);
      return nextState;
    }
  }, [epicId, user?.id]);

  useEffect(() => {
    if (!journeyPathFromEpics || !user?.id) return;

    setPersistedJourneyPath((currentJourneyPath) =>
      preferNewerJourneyPathSnapshot(currentJourneyPath, journeyPathFromEpics),
    );
    patchJourneyPathQueryCache(queryClient, user.id, journeyPathFromEpics);
  }, [journeyPathFromEpics, queryClient, user?.id]);

  useEffect(() => {
    let cancelled = false;

    if (!epicId || !user?.id) {
      setPersistedJourneyPath(null);
      setHasResolvedLocalSnapshot(true);
      return () => {
        cancelled = true;
      };
    }

    setHasResolvedLocalSnapshot(false);

    void getPersistedJourneyPathSnapshot(user.id, epicId)
      .then((journeyPathSnapshot) => {
        if (cancelled || !journeyPathSnapshot) return;

        setPersistedJourneyPath((currentJourneyPath) =>
          preferNewerJourneyPathSnapshot(currentJourneyPath, journeyPathSnapshot),
        );
        patchJourneyPathQueryCache(queryClient, user.id, journeyPathSnapshot);
      })
      .catch((error) => {
        console.error("Failed to load persisted journey path:", error);
      })
      .finally(() => {
        if (!cancelled) {
          setHasResolvedLocalSnapshot(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [epicId, queryClient, user?.id]);

  useEffect(() => {
    if (!remoteJourneyPathQuery.data) return;

    setPersistedJourneyPath((currentJourneyPath) =>
      preferNewerJourneyPathSnapshot(currentJourneyPath, remoteJourneyPathQuery.data),
    );
  }, [remoteJourneyPathQuery.data]);

  useEffect(() => {
    initialGenerationRequestedRef.current = false;
    legacyLandscapeRefreshRequestedRef.current = false;
  }, [epicId, user?.id]);

  useEffect(() => {
    let disposed = false;

    const refreshPendingState = async () => {
      const nextState = await refreshEpicCreateSyncState();
      if (disposed) return;
      if (nextState.status === "pending") {
        initialGenerationRequestedRef.current = false;
      }
    };

    void refreshPendingState();

    const handlePlannerSync = () => {
      void refreshPendingState();
    };

    const handleOnline = () => {
      void refreshPendingState();
    };

    window.addEventListener(PLANNER_SYNC_EVENT, handlePlannerSync);
    window.addEventListener("online", handleOnline);

    return () => {
      disposed = true;
      window.removeEventListener(PLANNER_SYNC_EVENT, handlePlannerSync);
      window.removeEventListener("online", handleOnline);
    };
  }, [refreshEpicCreateSyncState]);

  useEffect(() => {
    if (epicCreateSyncState.status !== "pending") {
      return;
    }

    if (epicId && user?.id) {
      queryClient.setQueryData(getJourneyPathGenerationKey(epicId, user.id), {
        error: null,
        pending: false,
        milestoneIndex: null,
      });
    }

    const intervalId = globalThis.setInterval(() => {
      void refreshEpicCreateSyncState();
    }, EPIC_CREATE_QUEUE_POLL_INTERVAL_MS);

    return () => {
      globalThis.clearInterval(intervalId);
    };
  }, [epicCreateSyncState.status, epicId, queryClient, refreshEpicCreateSyncState, user?.id]);

  const journeyPath = useMemo(
    () =>
      preferNewerJourneyPathSnapshot(
        remoteJourneyPathQuery.data,
        preferNewerJourneyPathSnapshot(persistedJourneyPath, journeyPathFromEpics),
      ),
    [journeyPathFromEpics, persistedJourneyPath, remoteJourneyPathQuery.data],
  );
  const needsLandscapeRefresh = useMemo(
    () => Boolean(journeyPath && needsJourneyPathLandscapeRefresh(journeyPath.prompt_context)),
    [journeyPath],
  );

  const triggerJourneyPathGeneration = useCallback(
    async (milestoneIndex: number) => {
      if (!epicId || !user?.id) {
        throw new Error("Missing epic or user");
      }

      if (epicCreateSyncState.status !== "idle") {
        return null;
      }

      const generatedJourneyPath = await requestJourneyPathGeneration({
        epicId,
        milestoneIndex,
        queryClient,
        userId: user.id,
      });

      if (generatedJourneyPath) {
        setPersistedJourneyPath((currentJourneyPath) =>
          preferNewerJourneyPathSnapshot(currentJourneyPath, generatedJourneyPath),
        );
      }

      return generatedJourneyPath;
    },
    [epicCreateSyncState.status, epicId, queryClient, user?.id],
  );

  const generateInitialPath = useCallback(() => {
    if (!epicId || !user?.id || journeyPath) return;

    void triggerJourneyPathGeneration(0).catch((error) => {
      console.error("Failed to generate initial journey path:", error);
    });
  }, [epicId, journeyPath, triggerJourneyPathGeneration, user?.id]);

  const retryInitialPath = useCallback(() => {
    if (!epicId || !user?.id || journeyPath) return;

    initialGenerationRequestedRef.current = false;
    void triggerJourneyPathGeneration(0).catch((error) => {
      console.error("Failed to retry initial journey path generation:", error);
    });
  }, [epicId, journeyPath, triggerJourneyPathGeneration, user?.id]);

  const regeneratePathForMilestone = useCallback((milestoneIndex: number) => {
    if (!epicId || !user?.id) return;

    void triggerJourneyPathGeneration(milestoneIndex).catch((error) => {
      console.error("Failed to regenerate journey path:", error);
    });
  }, [epicId, triggerJourneyPathGeneration, user?.id]);

  const retryEpicSync = useCallback(async () => {
    try {
      if (epicCreateSyncState.status === "failed" && epicCreateSyncState.actionId) {
        await retryAction(epicCreateSyncState.actionId);
      } else {
        await retryNow();
      }
    } finally {
      await refreshEpicCreateSyncState();
    }
  }, [epicCreateSyncState, refreshEpicCreateSyncState, retryAction, retryNow]);

  useEffect(() => {
    if (
      !epicId
      || !user?.id
      || !hasResolvedLocalSnapshot
      || journeyPath
      || epicCreateSyncState.status !== "idle"
      || generationState.error
      || generationState.pending
      || initialGenerationRequestedRef.current
    ) {
      return;
    }

    initialGenerationRequestedRef.current = true;
    void triggerJourneyPathGeneration(0).catch((error) => {
      console.error("Failed to auto-generate initial journey path:", error);
      initialGenerationRequestedRef.current = false;
    });
  }, [
    epicId,
    epicCreateSyncState.status,
    generationState.error,
    generationState.pending,
    hasResolvedLocalSnapshot,
    journeyPath,
    triggerJourneyPathGeneration,
    user?.id,
  ]);

  useEffect(() => {
    if (
      !epicId
      || !user?.id
      || !journeyPath
      || !hasResolvedLocalSnapshot
      || remoteJourneyPathQuery.isFetching
      || generationState.pending
      || !needsLandscapeRefresh
      || legacyLandscapeRefreshRequestedRef.current
    ) {
      return;
    }

    legacyLandscapeRefreshRequestedRef.current = true;
    void triggerJourneyPathGeneration(Math.max(0, journeyPath.milestone_index ?? 0)).catch((error) => {
      console.error("Failed to refresh legacy journey path image:", error);
    });
  }, [
    epicId,
    generationState.pending,
    hasResolvedLocalSnapshot,
    journeyPath,
    needsLandscapeRefresh,
    remoteJourneyPathQuery.isFetching,
    triggerJourneyPathGeneration,
    user?.id,
  ]);

  return {
    pathImageUrl: journeyPath?.image_url || null,
    currentMilestoneIndex: journeyPath?.milestone_index ?? -1,
    journeyPathPromptContext: journeyPath?.prompt_context ?? null,
    isLoading: !journeyPath && (!hasResolvedLocalSnapshot || remoteJourneyPathQuery.isLoading),
    isGenerating: generationState.pending,
    isWaitingForEpicSync: epicCreateSyncState.status === "pending",
    epicSyncStatus: epicCreateSyncState.status,
    epicSyncErrorMessage: epicCreateSyncState.status === "failed" ? epicCreateSyncState.message : null,
    needsLandscapeRefresh,
    error: remoteJourneyPathQuery.error,
    generationError: epicCreateSyncState.status === "pending" ? null : generationState.error,
    generateInitialPath,
    retryInitialPath,
    retryEpicSync,
    regeneratePathForMilestone,
  };
};
