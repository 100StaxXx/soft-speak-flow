import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getEpicsQueryKey, type EpicRecord } from "@/hooks/epicsQuery";
import {
  fetchRemoteLatestJourneyPath,
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

export const useJourneyPathImage = (epicId: string | undefined) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const initialGenerationRequestedRef = useRef(false);
  const [persistedJourneyPath, setPersistedJourneyPath] = useState<JourneyPathSnapshot | null>(null);
  const [hasResolvedLocalSnapshot, setHasResolvedLocalSnapshot] = useState(false);

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

  const { data: generationState = { pending: false, milestoneIndex: null } } = useQuery<{
    pending: boolean;
    milestoneIndex: number | null;
  }>({
    queryKey: getJourneyPathGenerationKey(epicId, user?.id),
    queryFn: async () => ({ pending: false, milestoneIndex: null }),
    enabled: false,
    initialData: { pending: false, milestoneIndex: null },
    staleTime: Infinity,
    gcTime: Infinity,
  });

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
  }, [epicId, user?.id]);

  const journeyPath = useMemo(
    () =>
      preferNewerJourneyPathSnapshot(
        remoteJourneyPathQuery.data,
        preferNewerJourneyPathSnapshot(persistedJourneyPath, journeyPathFromEpics),
      ),
    [journeyPathFromEpics, persistedJourneyPath, remoteJourneyPathQuery.data],
  );

  const triggerJourneyPathGeneration = useCallback(
    async (milestoneIndex: number) => {
      if (!epicId || !user?.id) {
        throw new Error("Missing epic or user");
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
    [epicId, queryClient, user?.id],
  );

  const generateInitialPath = useCallback(() => {
    if (!epicId || !user?.id || journeyPath) return;

    void triggerJourneyPathGeneration(0).catch((error) => {
      console.error("Failed to generate initial journey path:", error);
    });
  }, [epicId, journeyPath, triggerJourneyPathGeneration, user?.id]);

  const regeneratePathForMilestone = useCallback((milestoneIndex: number) => {
    if (!epicId || !user?.id) return;

    void triggerJourneyPathGeneration(milestoneIndex).catch((error) => {
      console.error("Failed to regenerate journey path:", error);
    });
  }, [epicId, triggerJourneyPathGeneration, user?.id]);

  useEffect(() => {
    if (
      !epicId
      || !user?.id
      || !hasResolvedLocalSnapshot
      || journeyPath
      || initialGenerationRequestedRef.current
    ) {
      return;
    }

    initialGenerationRequestedRef.current = true;
    void triggerJourneyPathGeneration(0).catch((error) => {
      console.error("Failed to auto-generate initial journey path:", error);
    });
  }, [
    epicId,
    hasResolvedLocalSnapshot,
    journeyPath,
    triggerJourneyPathGeneration,
    user?.id,
  ]);

  return {
    pathImageUrl: journeyPath?.image_url || null,
    currentMilestoneIndex: journeyPath?.milestone_index ?? -1,
    isLoading: !journeyPath && (!hasResolvedLocalSnapshot || remoteJourneyPathQuery.isLoading),
    isGenerating: generationState.pending,
    error: remoteJourneyPathQuery.error,
    generateInitialPath,
    regeneratePathForMilestone,
  };
};
