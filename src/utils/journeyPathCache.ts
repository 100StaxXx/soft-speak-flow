import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getEpicsQueryKey, type EpicRecord } from "@/hooks/epicsQuery";
import { normalizeJourneyPathPromptContext, type JourneyPathPromptContext } from "@/shared/journeyPathConfig";
import {
  isRetriableFunctionInvokeError,
  parseFunctionInvokeError,
  toUserFacingFunctionError,
} from "@/utils/supabaseFunctionErrors";
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
  error: JourneyPathGenerationError | null;
  milestoneIndex: number | null;
  pending: boolean;
}

export interface JourneyPathGenerationError {
  code: string | null;
  message: string;
  requestId: string | null;
  retryAfterSeconds: number | null;
  retryable: boolean;
  status: number | null;
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
const INVALID_JOURNEY_PATH_INPUT_MESSAGE = "Missing or invalid journey path parameters.";

export const getJourneyPathQueryKey = (epicId: string | undefined, userId: string | undefined) =>
  ["journey-path", epicId, userId] as const;

export const getJourneyPathGenerationKey = (epicId: string | undefined, userId: string | undefined) =>
  ["journey-path-generation", epicId, userId] as const;

export const getLocalJourneyPathSnapshotId = (userId: string, epicId: string) => `${userId}:${epicId}`;

const getGenerationRequestKey = (userId: string, epicId: string, milestoneIndex: number) =>
  `${userId}:${epicId}:${milestoneIndex}`;

const getGenerationStateKey = (userId: string, epicId: string) => `${userId}:${epicId}`;

const toGenerationState = (
  pending: boolean,
  milestoneIndex: number | null,
  error: JourneyPathGenerationError | null = null,
): JourneyPathGenerationState => ({
  error,
  pending,
  milestoneIndex,
});

export class JourneyPathGenerationFailure extends Error {
  readonly code: string | null;
  readonly requestId: string | null;
  readonly retryAfterSeconds: number | null;
  readonly retryable: boolean;
  readonly status: number | null;

  constructor(details: JourneyPathGenerationError) {
    super(details.message);
    this.name = "JourneyPathGenerationFailure";
    this.code = details.code;
    this.requestId = details.requestId;
    this.retryAfterSeconds = details.retryAfterSeconds;
    this.retryable = details.retryable;
    this.status = details.status;
    Object.setPrototypeOf(this, JourneyPathGenerationFailure.prototype);
  }
}

const toJourneyPathGenerationError = (
  details: Partial<JourneyPathGenerationError> & { message?: string | null },
): JourneyPathGenerationError => ({
  code: typeof details.code === "string" ? details.code : null,
  message: typeof details.message === "string" && details.message.trim().length > 0
    ? details.message
    : "Unable to generate your Star Path image. Please try again.",
  requestId: typeof details.requestId === "string" ? details.requestId : null,
  retryAfterSeconds: typeof details.retryAfterSeconds === "number" ? details.retryAfterSeconds : null,
  retryable: details.retryable === true,
  status: typeof details.status === "number" ? details.status : null,
});

const toJourneyPathGenerationFailure = async (error: unknown) => {
  const parsed = await parseFunctionInvokeError(error);
  const userFacingMessage = toUserFacingFunctionError(parsed, {
    action: "generate your Star Path image",
  });
  const message = userFacingMessage === "Request could not be processed right now"
    ? "Our servers are temporarily unavailable. Please try again in a moment."
    : userFacingMessage;

  return new JourneyPathGenerationFailure(
    toJourneyPathGenerationError({
      code: parsed.responsePayload?.code ?? parsed.code ?? null,
      message,
      requestId: parsed.requestId ?? null,
      retryAfterSeconds: parsed.retryAfterSeconds ?? null,
      retryable: parsed.category === "rate_limit" || isRetriableFunctionInvokeError(error),
      status: parsed.status ?? null,
    }),
  );
};

const toJourneyPathPayloadFailure = (
  payload: unknown,
  fallbackMessage = "Unable to generate your Star Path image. Please try again.",
) => {
  const responsePayload = payload && typeof payload === "object"
    ? payload as Record<string, unknown>
    : {};

  return new JourneyPathGenerationFailure(
    toJourneyPathGenerationError({
      code: typeof responsePayload.code === "string" ? responsePayload.code : null,
      message: typeof responsePayload.error === "string" ? responsePayload.error : fallbackMessage,
      requestId: typeof responsePayload.requestId === "string" ? responsePayload.requestId : null,
      retryAfterSeconds: typeof responsePayload.retryAfterSeconds === "number"
        ? responsePayload.retryAfterSeconds
        : null,
      retryable:
        typeof responsePayload.retryAfterSeconds === "number"
        || responsePayload.code === "RATE_LIMITED"
        || responsePayload.code === "COOLDOWN_ACTIVE",
      status: typeof responsePayload.status === "number" ? responsePayload.status : null,
    }),
  );
};

const createJourneyPathInputFailure = (
  message = INVALID_JOURNEY_PATH_INPUT_MESSAGE,
) => new JourneyPathGenerationFailure(
  toJourneyPathGenerationError({
    code: "INVALID_INPUT",
    message,
    requestId: null,
    retryAfterSeconds: null,
    retryable: false,
    status: 400,
  }),
);

const normalizeJourneyPathGenerationInput = (epicId: string, milestoneIndex: number) => {
  const normalizedEpicId = epicId.trim();
  if (normalizedEpicId.length === 0) {
    return createJourneyPathInputFailure();
  }

  if (!Number.isInteger(milestoneIndex) || milestoneIndex < 0) {
    return createJourneyPathInputFailure();
  }

  return {
    epicId: normalizedEpicId,
    milestoneIndex,
  };
};

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
  error: JourneyPathGenerationError | null = null,
) => {
  queryClient.setQueryData<JourneyPathGenerationState>(
    getJourneyPathGenerationKey(epicId, userId),
    toGenerationState(pending, milestoneIndex, error),
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
  patchJourneyPathGenerationState(queryClient, epicId, userId, true, getHighestPendingMilestoneIndex(current), null);
};

const markJourneyPathGenerationEnd = (
  queryClient: QueryClient,
  epicId: string,
  userId: string,
  milestoneIndex: number,
  error: JourneyPathGenerationError | null = null,
) => {
  const generationStateKey = getGenerationStateKey(userId, epicId);
  const current = generationStatusCounts.get(generationStateKey);
  if (!current) {
    patchJourneyPathGenerationState(queryClient, epicId, userId, false, null, error);
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
    patchJourneyPathGenerationState(queryClient, epicId, userId, false, null, error);
    return;
  }

  generationStatusCounts.set(generationStateKey, current);
  patchJourneyPathGenerationState(queryClient, epicId, userId, true, getHighestPendingMilestoneIndex(current), null);
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
  const normalizedInput = normalizeJourneyPathGenerationInput(epicId, milestoneIndex);
  if (normalizedInput instanceof JourneyPathGenerationFailure) {
    patchJourneyPathGenerationState(
      queryClient,
      epicId,
      userId,
      false,
      null,
      toJourneyPathGenerationError({
        code: normalizedInput.code,
        message: normalizedInput.message,
        requestId: normalizedInput.requestId,
        retryAfterSeconds: normalizedInput.retryAfterSeconds,
        retryable: normalizedInput.retryable,
        status: normalizedInput.status,
      }),
    );
    throw normalizedInput;
  }

  const { epicId: normalizedEpicId, milestoneIndex: normalizedMilestoneIndex } = normalizedInput;
  const generationRequestKey = getGenerationRequestKey(userId, normalizedEpicId, normalizedMilestoneIndex);
  const existingRequest = pendingJourneyPathGenerations.get(generationRequestKey);
  if (existingRequest) {
    return existingRequest;
  }

  markJourneyPathGenerationStart(queryClient, normalizedEpicId, userId, normalizedMilestoneIndex);

  const request = (async () => {
    let failure: JourneyPathGenerationFailure | null = null;

    try {
      const { data, error } = await supabase.functions.invoke("generate-journey-path", {
        body: {
          epicId: normalizedEpicId,
          milestoneIndex: normalizedMilestoneIndex,
        },
      });

      if (error) {
        throw await toJourneyPathGenerationFailure(error);
      }
      if (data?.error) {
        throw toJourneyPathPayloadFailure(data);
      }

      const remoteSnapshot = await fetchRemoteLatestJourneyPath(userId, normalizedEpicId);
      if (remoteSnapshot) {
        return persistAndPatchJourneyPathSnapshot(queryClient, remoteSnapshot);
      }

      if (typeof data?.imageUrl !== "string" || data.imageUrl.length === 0) {
        throw toJourneyPathPayloadFailure(
          data,
          "We couldn't generate your Star Path image. Please try again.",
        );
      }

      return persistAndPatchJourneyPathSnapshot(queryClient, {
        id: getLocalJourneyPathSnapshotId(userId, normalizedEpicId),
        user_id: userId,
        epic_id: normalizedEpicId,
        milestone_index: typeof data?.milestoneIndex === "number" ? data.milestoneIndex : normalizedMilestoneIndex,
        image_url: data.imageUrl,
        generated_at: new Date().toISOString(),
        prompt_context: null,
      });
    } catch (error) {
      failure = error instanceof JourneyPathGenerationFailure
        ? error
        : await toJourneyPathGenerationFailure(error);
      throw failure;
    } finally {
      pendingJourneyPathGenerations.delete(generationRequestKey);
      markJourneyPathGenerationEnd(
        queryClient,
        normalizedEpicId,
        userId,
        normalizedMilestoneIndex,
        failure
          ? toJourneyPathGenerationError({
            code: failure.code,
            message: failure.message,
            requestId: failure.requestId,
            retryAfterSeconds: failure.retryAfterSeconds,
            retryable: failure.retryable,
            status: failure.status,
          })
          : null,
      );
    }
  })();

  pendingJourneyPathGenerations.set(generationRequestKey, request);
  return request;
}
