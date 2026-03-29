import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getEpicsQueryKey, type EpicRecord } from "@/hooks/epicsQuery";
import { normalizeJourneyPathPromptContext, type JourneyPathPromptContext } from "@/shared/journeyPathConfig";
import {
  getLocalJourneyPathForEpic,
  upsertPlannerRecord,
} from "@/utils/plannerLocalStore";

export interface JourneyPathSnapshot {
  id: string;
  user_id: string;
  epic_id: string;
  milestone_index: number;
  image_url: string;
  generated_at: string;
  prompt_context?: JourneyPathPromptContext | null;
}

interface JourneyPathGenerationState {
  milestoneIndex: number | null;
  pending: boolean;
}

interface JourneyPathGenerationOptions {
  epicId: string;
  milestoneIndex: number;
  queryClient: QueryClient;
  userId: string;
}

type EpicWithJourneyPath = EpicRecord & {
  latest_journey_path_generated_at?: string | null;
  latest_journey_path_milestone_index?: number | null;
  latest_journey_path_url?: string | null;
  latest_journey_path_prompt_context?: JourneyPathPromptContext | null;
};

const pendingJourneyPathGenerations = new Map<string, Promise<JourneyPathSnapshot | null>>();
const generationStatusCounts = new Map<string, Map<number, number>>();

export const getJourneyPathQueryKey = (epicId: string | undefined, userId: string | undefined) =>
  ["journey-path", epicId, userId] as const;

export const getJourneyPathGenerationKey = (epicId: string | undefined, userId: string | undefined) =>
  ["journey-path-generation", epicId, userId] as const;

export const getLocalJourneyPathSnapshotId = (userId: string, epicId: string) => `${userId}:${epicId}`;

const getGenerationRequestKey = (userId: string, epicId: string, milestoneIndex: number) =>
  `${userId}:${epicId}:${milestoneIndex}`;

const getGenerationStateKey = (userId: string, epicId: string) => `${userId}:${epicId}`;

const toGenerationState = (pending: boolean, milestoneIndex: number | null): JourneyPathGenerationState => ({
  pending,
  milestoneIndex,
});

const getHighestPendingMilestoneIndex = (countsByMilestone: Map<number, number>) => {
  const pendingMilestones = [...countsByMilestone.entries()]
    .filter(([, count]) => count > 0)
    .map(([milestone]) => milestone);

  if (pendingMilestones.length === 0) {
    return null;
  }

  return Math.max(...pendingMilestones);
};

const compareJourneyPathSnapshots = (
  left: Pick<JourneyPathSnapshot, "generated_at" | "milestone_index"> | null | undefined,
  right: Pick<JourneyPathSnapshot, "generated_at" | "milestone_index"> | null | undefined,
) => {
  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;
  if (left.milestone_index !== right.milestone_index) {
    return left.milestone_index - right.milestone_index;
  }
  return (left.generated_at ?? "").localeCompare(right.generated_at ?? "");
};

export const preferNewerJourneyPathSnapshot = (
  current: JourneyPathSnapshot | null | undefined,
  candidate: JourneyPathSnapshot | null | undefined,
) => {
  if (!candidate) return current ?? null;
  if (!current) return candidate;
  return compareJourneyPathSnapshots(current, candidate) >= 0 ? current : candidate;
};

export const normalizeJourneyPathSnapshot = (
  snapshot: Omit<JourneyPathSnapshot, "id"> & { id?: string | null },
): JourneyPathSnapshot => ({
  id: getLocalJourneyPathSnapshotId(snapshot.user_id, snapshot.epic_id),
  user_id: snapshot.user_id,
  epic_id: snapshot.epic_id,
  milestone_index: snapshot.milestone_index,
  image_url: snapshot.image_url,
  generated_at: snapshot.generated_at,
  prompt_context: normalizeJourneyPathPromptContext(snapshot.prompt_context),
});

export const attachJourneyPathSnapshotToEpic = <TEpic extends EpicRecord>(
  epic: TEpic,
  snapshot: JourneyPathSnapshot | null | undefined,
): TEpic & EpicWithJourneyPath => ({
  ...epic,
  latest_journey_path_url: snapshot?.image_url ?? null,
  latest_journey_path_milestone_index: snapshot?.milestone_index ?? null,
  latest_journey_path_generated_at: snapshot?.generated_at ?? null,
  latest_journey_path_prompt_context: snapshot?.prompt_context ?? null,
});

export const getJourneyPathSnapshotFromEpic = (
  epic: EpicWithJourneyPath | null | undefined,
  userId: string,
): JourneyPathSnapshot | null => {
  if (
    !epic
    || typeof epic.latest_journey_path_url !== "string"
    || epic.latest_journey_path_url.length === 0
    || typeof epic.latest_journey_path_milestone_index !== "number"
  ) {
    return null;
  }

  return {
    id: getLocalJourneyPathSnapshotId(userId, epic.id),
    user_id: userId,
    epic_id: epic.id,
    milestone_index: epic.latest_journey_path_milestone_index,
    image_url: epic.latest_journey_path_url,
    generated_at: epic.latest_journey_path_generated_at ?? "",
    prompt_context: normalizeJourneyPathPromptContext(epic.latest_journey_path_prompt_context),
  };
};

const patchJourneyPathGenerationState = (
  queryClient: QueryClient,
  epicId: string,
  userId: string,
  pending: boolean,
  milestoneIndex: number | null,
) => {
  queryClient.setQueryData<JourneyPathGenerationState>(
    getJourneyPathGenerationKey(epicId, userId),
    toGenerationState(pending, milestoneIndex),
  );
};

const markJourneyPathGenerationStart = (
  queryClient: QueryClient,
  epicId: string,
  userId: string,
  milestoneIndex: number,
) => {
  const generationStateKey = getGenerationStateKey(userId, epicId);
  const current = generationStatusCounts.get(generationStateKey) ?? new Map<number, number>();
  current.set(milestoneIndex, (current.get(milestoneIndex) ?? 0) + 1);
  generationStatusCounts.set(generationStateKey, current);
  patchJourneyPathGenerationState(queryClient, epicId, userId, true, getHighestPendingMilestoneIndex(current));
};

const markJourneyPathGenerationEnd = (
  queryClient: QueryClient,
  epicId: string,
  userId: string,
  milestoneIndex: number,
) => {
  const generationStateKey = getGenerationStateKey(userId, epicId);
  const current = generationStatusCounts.get(generationStateKey);
  if (!current) {
    patchJourneyPathGenerationState(queryClient, epicId, userId, false, null);
    return;
  }

  const nextCount = (current.get(milestoneIndex) ?? 0) - 1;
  if (nextCount > 0) {
    current.set(milestoneIndex, nextCount);
  } else {
    current.delete(milestoneIndex);
  }

  if (current.size === 0) {
    generationStatusCounts.delete(generationStateKey);
    patchJourneyPathGenerationState(queryClient, epicId, userId, false, null);
    return;
  }

  generationStatusCounts.set(generationStateKey, current);
  patchJourneyPathGenerationState(queryClient, epicId, userId, true, getHighestPendingMilestoneIndex(current));
};

export async function getPersistedJourneyPathSnapshot(
  userId: string,
  epicId: string,
): Promise<JourneyPathSnapshot | null> {
  return getLocalJourneyPathForEpic<JourneyPathSnapshot>(userId, epicId);
}

export async function persistJourneyPathSnapshot(snapshot: JourneyPathSnapshot): Promise<JourneyPathSnapshot> {
  const normalizedSnapshot = normalizeJourneyPathSnapshot(snapshot);
  await upsertPlannerRecord("epic_journey_paths", normalizedSnapshot);
  return normalizedSnapshot;
}

export function patchJourneyPathQueryCache(
  queryClient: QueryClient,
  userId: string,
  snapshot: JourneyPathSnapshot,
): JourneyPathSnapshot {
  const normalizedSnapshot = normalizeJourneyPathSnapshot(snapshot);

  queryClient.setQueryData<JourneyPathSnapshot | null>(
    getJourneyPathQueryKey(normalizedSnapshot.epic_id, userId),
    (currentSnapshot) => preferNewerJourneyPathSnapshot(currentSnapshot, normalizedSnapshot),
  );

  queryClient.setQueryData<EpicWithJourneyPath[] | undefined>(
    getEpicsQueryKey(userId),
    (currentEpics) =>
      currentEpics?.map((epic) =>
        epic.id === normalizedSnapshot.epic_id
          ? attachJourneyPathSnapshotToEpic(
            epic,
            preferNewerJourneyPathSnapshot(getJourneyPathSnapshotFromEpic(epic, userId), normalizedSnapshot),
          )
          : epic,
      ),
  );

  return normalizedSnapshot;
}

export async function persistAndPatchJourneyPathSnapshot(
  queryClient: QueryClient,
  snapshot: JourneyPathSnapshot,
): Promise<JourneyPathSnapshot> {
  const normalizedSnapshot = await persistJourneyPathSnapshot(snapshot);
  patchJourneyPathQueryCache(queryClient, normalizedSnapshot.user_id, normalizedSnapshot);
  return normalizedSnapshot;
}

export async function fetchRemoteLatestJourneyPath(
  userId: string,
  epicId: string,
): Promise<JourneyPathSnapshot | null> {
  const { data, error } = await supabase
    .from("epic_journey_paths")
    .select("id, user_id, epic_id, milestone_index, image_url, prompt_context, generated_at")
    .eq("epic_id", epicId)
    .eq("user_id", userId)
    .order("milestone_index", { ascending: false })
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return normalizeJourneyPathSnapshot(data as JourneyPathSnapshot);
}

export async function requestJourneyPathGeneration({
  epicId,
  milestoneIndex,
  queryClient,
  userId,
}: JourneyPathGenerationOptions): Promise<JourneyPathSnapshot | null> {
  const generationRequestKey = getGenerationRequestKey(userId, epicId, milestoneIndex);
  const existingRequest = pendingJourneyPathGenerations.get(generationRequestKey);
  if (existingRequest) {
    return existingRequest;
  }

  markJourneyPathGenerationStart(queryClient, epicId, userId, milestoneIndex);

  const request = (async () => {
    const { data, error } = await supabase.functions.invoke("generate-journey-path", {
      body: {
        epicId,
        milestoneIndex,
      },
    });

    if (error) {
      throw error;
    }
    if (data?.error) {
      throw new Error(data.error);
    }

    const remoteSnapshot = await fetchRemoteLatestJourneyPath(userId, epicId);
    if (remoteSnapshot) {
      return persistAndPatchJourneyPathSnapshot(queryClient, remoteSnapshot);
    }

    if (typeof data?.imageUrl !== "string" || data.imageUrl.length === 0) {
      return null;
    }

    return persistAndPatchJourneyPathSnapshot(queryClient, {
      id: getLocalJourneyPathSnapshotId(userId, epicId),
      user_id: userId,
      epic_id: epicId,
      milestone_index: typeof data?.milestoneIndex === "number" ? data.milestoneIndex : milestoneIndex,
      image_url: data.imageUrl,
      generated_at: new Date().toISOString(),
      prompt_context: null,
    });
  })()
    .finally(() => {
      pendingJourneyPathGenerations.delete(generationRequestKey);
      markJourneyPathGenerationEnd(queryClient, epicId, userId, milestoneIndex);
    });

  pendingJourneyPathGenerations.set(generationRequestKey, request);
  return request;
}
