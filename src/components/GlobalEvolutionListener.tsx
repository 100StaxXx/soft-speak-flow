import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { CompanionEvolution } from "@/components/CompanionEvolution";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAchievements } from "@/hooks/useAchievements";
import {
  useEvolution,
  type PendingEvolutionReveal,
} from "@/contexts/EvolutionContext";
import { useCelebration } from "@/contexts/CelebrationContext";
import { useMentorConnection } from "@/contexts/MentorConnectionContext";
import { toast } from "@/components/ui/sonner";
import { resolveCompanionVisualAssetUrl } from "@/lib/companionAssetResolver";
import {
  COMPANION_EVOLUTION_REVEAL_REQUESTED_EVENT,
  COMPANION_HATCH_STARTED_EVENT,
  isCompanionEvolutionRevealRequestedDetail,
  isCompanionHatchStartedDetail,
} from "@/lib/companionEvolutionEvents";
import { logger } from "@/utils/logger";
import {
  extractErrorMessage,
  isNetworkLikeError,
} from "@/utils/networkErrors";
import { isSupabaseMissingRelationError } from "@/utils/supabaseSchemaErrors";
import {
  getProgressionLevelDisplay,
  getProgressionTierLabelForLevel,
  isTierBoundaryLevel,
} from "@/config/progression";
import { useCompanionMotionSafe } from "@/contexts/CompanionMotionContext";

const EVOLUTION_RECORD_RETRY_DELAYS_MS = [0, 75, 150] as const;
const EVOLUTION_ANIMATION_DISCOVERY_TIMEOUT_MS = 20_000;
const STALE_TERMINAL_ANIMATION_DISCOVERY_TIMEOUT_MS = 5_000;
const EVOLUTION_ANIMATION_READY_TIMEOUT_MS = 180_000;
const EVOLUTION_ANIMATION_POLL_INTERVAL_MS = 2_000;
const EVOLUTION_ANIMATION_PROCESS_INTERVAL_MS = 5_000;
const EVOLUTION_ANIMATION_PRELOAD_TIMEOUT_MS = 30_000;
const EVOLUTION_PRESENTATION_RETRY_DELAY_MS = 5_000;
const PENDING_EVOLUTION_REVEAL_HYDRATION_INTERVAL_MS = 15_000;
const LOCAL_HATCH_DEDUPE_WINDOW_MS = 15000;
const HYDRATABLE_TERMINAL_ANIMATION_WINDOW_MS = 24 * 60 * 60 * 1000;
const HYDRATABLE_MISSING_ANIMATION_WINDOW_MS = 24 * 60 * 60 * 1000;
const NON_RETRYABLE_ANIMATION_REASONS = new Set([
  "animation_worker_auth_failed",
  "animation_worker_config_error",
  "cost_guardrail_blocked",
  "disabled",
  "fal_key_missing",
  "image_unchanged",
  "source_image_unavailable",
  "source_image_url_unavailable",
  "stage_not_animatable",
]);
const TRANSIENT_SUPABASE_READ_LOG_INTERVAL_MS = 60_000;
const transientSupabaseReadLogTimes = new Map<string, number>();
const PERSISTED_EVOLUTION_METADATA_UNAVAILABLE = Symbol(
  "persisted-evolution-metadata-unavailable",
);

type CompanionAnimationStatus =
  | "queued"
  | "processing"
  | "succeeded"
  | "failed"
  | "skipped";

type PersistedEvolutionMetadata = {
  id: string;
  imageUrl: string | null;
  evolvedAt: string | null;
  animationVideoUrl: string | null;
  animationStatus: CompanionAnimationStatus | null;
  animationErrorCode: string | null;
  animationRequestedAt: string | null;
  animationCompletedAt: string | null;
  animationPresentedAt: string | null;
};

type PersistedEvolutionMetadataLookup =
  | PersistedEvolutionMetadata
  | null
  | typeof PERSISTED_EVOLUTION_METADATA_UNAVAILABLE;

type CompanionEvolutionJobStatus =
  | "queued"
  | "processing"
  | "succeeded"
  | "failed";

type PersistedEvolutionJobMetadata = {
  id: string;
  companionId: string;
  requestedStage: number;
  status: CompanionEvolutionJobStatus;
  errorCode: string | null;
  errorMessage: string | null;
  requestedAt: string | null;
  completedAt: string | null;
  updatedAt: string | null;
};

type AnimationRetryResult = {
  status: CompanionAnimationStatus | "unavailable" | null;
  jobId?: string;
  videoUrl?: string;
  code?: string;
  reason?: string;
  transientUnavailable?: boolean;
};

type EvolutionPresentationData = {
  evolutionId: string;
  companionId: string;
  previousLevel: number;
  level: number;
  previousImageUrl: string;
  imageUrl: string;
  animationVideoUrl: string | null;
  presetId?: string;
  mentorSlug?: string;
  element?: string;
};

type PendingEvolutionPreloadData = EvolutionPresentationData & {
  animationVideoUrl: string;
};

type EvolutionPresentationRequest = Omit<
  EvolutionPresentationData,
  "evolutionId" | "animationVideoUrl" | "mentorSlug"
> & {
  dispatchLoadingStart?: boolean;
  markAsLocalHatch?: boolean;
  missingEvolutionLog?: Record<string, unknown>;
};

const sleep = (delayMs: number) =>
  new Promise((resolve) => setTimeout(resolve, delayMs));
const PRESENTED_EVOLUTION_STORAGE_PREFIX = "companion-evolution-presented";
const FAILED_EVOLUTION_JOB_STORAGE_PREFIX = "companion-evolution-job-failed";
const locallyPresentedEvolutionKeys = new Set<string>();
const locallyNotifiedFailedEvolutionJobKeys = new Set<string>();
const FAILED_EVOLUTION_JOB_NOTIFICATION_WINDOW_MS = 24 * 60 * 60 * 1000;

export const clearLocalEvolutionPresentationGuardsForTest = () => {
  locallyPresentedEvolutionKeys.clear();
  locallyNotifiedFailedEvolutionJobKeys.clear();
  transientSupabaseReadLogTimes.clear();
};

const normalizeAnimationStatus = (
  value: unknown,
): CompanionAnimationStatus | null => {
  if (
    value === "queued" ||
    value === "processing" ||
    value === "succeeded" ||
    value === "failed" ||
    value === "skipped"
  ) {
    return value;
  }

  return null;
};

const normalizeEvolutionJobStatus = (
  value: unknown,
): CompanionEvolutionJobStatus | null => {
  if (
    value === "queued" ||
    value === "processing" ||
    value === "succeeded" ||
    value === "failed"
  ) {
    return value;
  }

  return null;
};

const normalizeAnimationReason = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const getNonRetryableAnimationReason = (value: unknown): string | null => {
  const reason = normalizeAnimationReason(value);
  return reason && NON_RETRYABLE_ANIMATION_REASONS.has(reason) ? reason : null;
};

const isOffline = (): boolean =>
  typeof navigator !== "undefined" && navigator.onLine === false;

const isTransientSupabaseReadError = (error: unknown): boolean =>
  isOffline() || isNetworkLikeError(error);

const logEvolutionSupabaseReadError = ({
  logKey,
  message,
  context,
  error,
}: {
  logKey: string;
  message: string;
  context: Record<string, unknown>;
  error: unknown;
}) => {
  const errorMessage = extractErrorMessage(error);
  const isTransientNetworkError = isTransientSupabaseReadError(error);

  if (isTransientNetworkError) {
    const now = Date.now();
    const lastLoggedAt = transientSupabaseReadLogTimes.get(logKey) ?? 0;
    if (now - lastLoggedAt >= TRANSIENT_SUPABASE_READ_LOG_INTERVAL_MS) {
      transientSupabaseReadLogTimes.set(logKey, now);
      logger.debug("Evolution listener: Supabase read temporarily unavailable", {
        ...context,
        operation: logKey,
        error: errorMessage,
      });
    }
    return;
  }

  logger.warn(message, {
    ...context,
    error: errorMessage,
  });
};

const hasNonRetryableTerminalAnimation = (
  metadata: PersistedEvolutionMetadata,
): boolean =>
  (metadata.animationStatus === "failed" ||
    metadata.animationStatus === "skipped") &&
  Boolean(getNonRetryableAnimationReason(metadata.animationErrorCode));

const fetchPersistedEvolutionMetadata = async ({
  companionId,
  stage,
}: {
  companionId: string;
  stage: number;
}): Promise<PersistedEvolutionMetadataLookup> => {
  const { data, error } = await supabase
    .from("companion_evolutions")
    .select(
      "id, image_url, evolved_at, animation_video_url, animation_status, animation_error_code, animation_requested_at, animation_completed_at, animation_presented_at",
    )
    .eq("companion_id", companionId)
    .eq("stage", stage)
    .maybeSingle();

  if (error) {
    logEvolutionSupabaseReadError({
      logKey: "verify-persisted-evolution",
      message: "Evolution listener: Failed to verify persisted evolution",
      context: {
        companionId,
        stage,
      },
      error,
    });
    return isTransientSupabaseReadError(error)
      ? PERSISTED_EVOLUTION_METADATA_UNAVAILABLE
      : null;
  }

  if (!data?.id) return null;

  const { data: jobData, error: jobError } = await supabase
    .from("companion_animation_jobs")
    .select("status, video_url, completed_at, updated_at, error_code")
    .eq("evolution_id", data.id)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (
    jobError &&
    !isSupabaseMissingRelationError(jobError, "companion_animation_jobs")
  ) {
    logEvolutionSupabaseReadError({
      logKey: "verify-animation-job",
      message: "Evolution listener: Failed to verify animation job",
      context: {
        companionId,
        stage,
        evolutionId: data.id,
      },
      error: jobError,
    });
  }

  const animationStatus = normalizeAnimationStatus(data.animation_status);
  const jobAnimationStatus = normalizeAnimationStatus(jobData?.status);
  const animationVideoUrl =
    animationStatus === "succeeded" &&
    typeof data.animation_video_url === "string"
      ? data.animation_video_url
      : jobAnimationStatus === "succeeded" &&
          typeof jobData?.video_url === "string"
        ? jobData.video_url
        : null;

  return {
    id: data.id,
    imageUrl: typeof data.image_url === "string" ? data.image_url : null,
    evolvedAt: typeof data.evolved_at === "string" ? data.evolved_at : null,
    animationStatus: animationVideoUrl
      ? "succeeded"
      : (animationStatus ?? jobAnimationStatus),
    animationVideoUrl,
    animationErrorCode: animationVideoUrl
      ? null
      : (normalizeAnimationReason(data.animation_error_code) ??
        normalizeAnimationReason(jobData?.error_code)),
    animationRequestedAt:
      typeof data.animation_requested_at === "string"
        ? data.animation_requested_at
        : null,
    animationCompletedAt:
      typeof data.animation_completed_at === "string"
        ? data.animation_completed_at
        : typeof jobData?.completed_at === "string"
          ? jobData.completed_at
          : null,
    animationPresentedAt:
      typeof data.animation_presented_at === "string"
        ? data.animation_presented_at
        : null,
  };
};

const toPersistedEvolutionJobMetadata = (
  row: Record<string, unknown> | null | undefined,
): PersistedEvolutionJobMetadata | null => {
  const status = normalizeEvolutionJobStatus(row?.status);
  const id = typeof row?.id === "string" ? row.id : null;
  const companionId =
    typeof row?.companion_id === "string" ? row.companion_id : null;
  const requestedStage =
    typeof row?.requested_stage === "number" ? row.requested_stage : null;

  if (!id || !companionId || requestedStage === null || !status) {
    return null;
  }

  return {
    id,
    companionId,
    requestedStage,
    status,
    errorCode:
      typeof row?.error_code === "string" ? row.error_code : null,
    errorMessage:
      typeof row?.error_message === "string" ? row.error_message : null,
    requestedAt:
      typeof row?.requested_at === "string" ? row.requested_at : null,
    completedAt:
      typeof row?.completed_at === "string" ? row.completed_at : null,
    updatedAt:
      typeof row?.updated_at === "string" ? row.updated_at : null,
  };
};

const fetchLatestEvolutionJobMetadata = async ({
  userId,
}: {
  userId: string;
}): Promise<PersistedEvolutionJobMetadata | null> => {
  const { data, error } = await supabase
    .from("companion_evolution_jobs")
    .select(
      "id, companion_id, requested_stage, status, error_code, error_message, requested_at, completed_at, updated_at",
    )
    .eq("user_id", userId)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logEvolutionSupabaseReadError({
      logKey: "hydrate-evolution-job",
      message: "Evolution listener: Failed to hydrate evolution job",
      context: {
        userId,
      },
      error,
    });
    return null;
  }

  return toPersistedEvolutionJobMetadata(data as Record<string, unknown> | null);
};

const isTimestampAtOrAfter = (
  value: string | null,
  referenceMs: number,
): boolean => {
  if (!value) return false;
  const valueMs = new Date(value).getTime();
  return Number.isFinite(valueMs) && valueMs >= referenceMs;
};

const getTimestampMs = (value: string | null): number | null => {
  if (!value) return null;
  const valueMs = new Date(value).getTime();
  return Number.isFinite(valueMs) ? valueMs : null;
};

const getLatestAnimationActivityMs = (
  metadata: PersistedEvolutionMetadata,
): number | null => {
  const timestamps = [
    getTimestampMs(metadata.animationRequestedAt),
    getTimestampMs(metadata.animationCompletedAt),
  ].filter((value): value is number => value !== null);

  return timestamps.length > 0 ? Math.max(...timestamps) : null;
};

const shouldHydratePendingEvolutionReveal = (
  metadata: PersistedEvolutionMetadata,
): boolean => {
  if (metadata.animationPresentedAt) return false;
  if (metadata.animationVideoUrl) return true;
  if (hasNonRetryableTerminalAnimation(metadata)) return false;
  if (
    metadata.animationStatus === "queued" ||
    metadata.animationStatus === "processing"
  )
    return true;
  if (metadata.animationStatus === null) {
    const evolvedAtMs = getTimestampMs(metadata.evolvedAt);
    return (
      evolvedAtMs !== null &&
      Date.now() - evolvedAtMs <= HYDRATABLE_MISSING_ANIMATION_WINDOW_MS
    );
  }
  if (
    metadata.animationStatus !== "failed" &&
    metadata.animationStatus !== "skipped"
  )
    return false;

  const latestAnimationActivityMs = getLatestAnimationActivityMs(metadata);
  return (
    latestAnimationActivityMs !== null &&
    Date.now() - latestAnimationActivityMs <=
      HYDRATABLE_TERMINAL_ANIMATION_WINDOW_MS
  );
};

const toDateOnly = (value: string | null | undefined): string => {
  if (value) {
    const parsedMs = new Date(value).getTime();
    if (Number.isFinite(parsedMs)) {
      return new Date(parsedMs).toISOString().split("T")[0];
    }
  }

  return new Date().toISOString().split("T")[0];
};

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: unknown }).code === "23505";

const getPresentedEvolutionStorageKey = (
  userId: string,
  evolutionId: string,
): string => `${PRESENTED_EVOLUTION_STORAGE_PREFIX}:${userId}:${evolutionId}`;

const getFailedEvolutionJobStorageKey = (
  userId: string,
  jobId: string,
): string => `${FAILED_EVOLUTION_JOB_STORAGE_PREFIX}:${userId}:${jobId}`;

const markEvolutionPresentedLocally = (userId: string, evolutionId: string) => {
  const storageKey = getPresentedEvolutionStorageKey(userId, evolutionId);
  locallyPresentedEvolutionKeys.add(storageKey);

  try {
    window.localStorage.setItem(storageKey, new Date().toISOString());
  } catch {
    // localStorage can be unavailable in privacy modes; the RPC remains authoritative.
  }
};

const wasEvolutionPresentedLocally = (
  userId: string,
  evolutionId: string,
): boolean => {
  const storageKey = getPresentedEvolutionStorageKey(userId, evolutionId);
  if (locallyPresentedEvolutionKeys.has(storageKey)) return true;

  try {
    return Boolean(window.localStorage.getItem(storageKey));
  } catch {
    return false;
  }
};

const markFailedEvolutionJobNotifiedLocally = (userId: string, jobId: string) => {
  const storageKey = getFailedEvolutionJobStorageKey(userId, jobId);
  locallyNotifiedFailedEvolutionJobKeys.add(storageKey);

  try {
    window.localStorage.setItem(storageKey, new Date().toISOString());
  } catch {
    // localStorage can be unavailable in privacy modes; the toast is best-effort.
  }
};

const wasFailedEvolutionJobNotifiedLocally = (
  userId: string,
  jobId: string,
): boolean => {
  const storageKey = getFailedEvolutionJobStorageKey(userId, jobId);
  if (locallyNotifiedFailedEvolutionJobKeys.has(storageKey)) return true;

  try {
    return Boolean(window.localStorage.getItem(storageKey));
  } catch {
    return false;
  }
};

const waitForEvolutionPersistence = async ({
  companionId,
  stage,
}: {
  companionId: string;
  stage: number;
}): Promise<PersistedEvolutionMetadataLookup> => {
  let sawTransientUnavailable = false;

  for (const delayMs of EVOLUTION_RECORD_RETRY_DELAYS_MS) {
    if (delayMs > 0) await sleep(delayMs);

    const metadata = await fetchPersistedEvolutionMetadata({
      companionId,
      stage,
    });
    if (metadata === PERSISTED_EVOLUTION_METADATA_UNAVAILABLE) {
      sawTransientUnavailable = true;
      continue;
    }
    if (metadata) return metadata;
  }

  return sawTransientUnavailable
    ? PERSISTED_EVOLUTION_METADATA_UNAVAILABLE
    : null;
};

const refreshPersistedEvolutionMetadata = async ({
  companionId,
  stage,
}: {
  companionId: string;
  stage: number;
}): Promise<PersistedEvolutionMetadata | null> => {
  const metadata = await fetchPersistedEvolutionMetadata({
    companionId,
    stage,
  });
  return metadata === PERSISTED_EVOLUTION_METADATA_UNAVAILABLE
    ? null
    : metadata;
};

const requestAnimationJobRetry = async ({
  companionId,
  stage,
  reason,
  force = true,
}: {
  companionId: string;
  stage: number;
  reason: string;
  force?: boolean;
}): Promise<AnimationRetryResult> => {
  const { data, error } = await supabase.functions.invoke(
    "prewarm-companion-animation",
    {
      body: { companionId, stage, force, reason },
    },
  );

  if (error) {
    const transientUnavailable = isTransientSupabaseReadError(error);
    logEvolutionSupabaseReadError({
      logKey: "animation-retry-request",
      message: "Evolution listener: Companion animation retry request failed",
      context: {
        companionId,
        stage,
        reason,
      },
      error,
    });
    return {
      status: "unavailable",
      reason: extractErrorMessage(error),
      transientUnavailable,
    };
  }

  const result = (data ?? {}) as {
    status?: unknown;
    jobId?: unknown;
    videoUrl?: unknown;
    reason?: unknown;
    code?: unknown;
  };
  const status = normalizeAnimationStatus(result.status);
  const jobId = typeof result.jobId === "string" ? result.jobId : undefined;
  const videoUrl =
    typeof result.videoUrl === "string" ? result.videoUrl : undefined;
  const code = normalizeAnimationReason(result.code);

  return {
    status: status ?? "unavailable",
    jobId,
    videoUrl,
    code: code ?? undefined,
    reason: typeof result.reason === "string" ? result.reason : undefined,
  };
};

const resolveTerminalMetadataFromRetry = (
  metadata: PersistedEvolutionMetadata,
  retryResult: AnimationRetryResult,
): PersistedEvolutionMetadata | null => {
  if (retryResult.videoUrl) {
    return {
      ...metadata,
      animationStatus: "succeeded",
      animationVideoUrl: retryResult.videoUrl,
      animationErrorCode: null,
    };
  }

  const nonRetryableReason = getNonRetryableAnimationReason(
    retryResult.code ?? retryResult.reason,
  );
  if (
    (retryResult.status === "failed" || retryResult.status === "skipped") &&
    nonRetryableReason
  ) {
    return {
      ...metadata,
      animationStatus: "skipped",
      animationErrorCode: nonRetryableReason,
    };
  }

  return null;
};

const waitForEvolutionAnimation = async ({
  companionId,
  stage,
  initialMetadata,
}: {
  companionId: string;
  stage: number;
  initialMetadata: PersistedEvolutionMetadata;
}): Promise<PersistedEvolutionMetadata | null> => {
  let metadata = initialMetadata;
  const startedAt = Date.now();
  const currentAttemptCutoffMs = startedAt - 5_000;
  const discoveryDeadline =
    startedAt + EVOLUTION_ANIMATION_DISCOVERY_TIMEOUT_MS;
  const staleTerminalDiscoveryDeadline =
    startedAt + STALE_TERMINAL_ANIMATION_DISCOVERY_TIMEOUT_MS;
  const readyDeadline = startedAt + EVOLUTION_ANIMATION_READY_TIMEOUT_MS;
  let jobId: string | null = null;
  let lastWorkerKickAt = 0;
  const retryAttemptKeys = new Set<string>();

  while (Date.now() < readyDeadline) {
    if (metadata.animationVideoUrl) {
      return metadata;
    }

    if (hasNonRetryableTerminalAnimation(metadata)) {
      return metadata;
    }

    const hasTerminalAnimationStatus =
      metadata.animationStatus === "failed" ||
      metadata.animationStatus === "skipped";
    const terminalStatusHasTimestamp = Boolean(
      metadata.animationRequestedAt || metadata.animationCompletedAt,
    );
    const terminalStatusIsCurrentAttempt =
      !terminalStatusHasTimestamp ||
      isTimestampAtOrAfter(
        metadata.animationRequestedAt,
        currentAttemptCutoffMs,
      ) ||
      isTimestampAtOrAfter(
        metadata.animationCompletedAt,
        currentAttemptCutoffMs,
      );
    const activeDiscoveryDeadline = hasTerminalAnimationStatus
      ? staleTerminalDiscoveryDeadline
      : discoveryDeadline;

    if (hasTerminalAnimationStatus && terminalStatusIsCurrentAttempt) {
      const retryKey = [
        metadata.animationStatus,
        metadata.animationRequestedAt ?? "requested-unknown",
        metadata.animationCompletedAt ?? "completed-unknown",
      ].join("|");

      if (!retryAttemptKeys.has(retryKey)) {
        retryAttemptKeys.add(retryKey);
        const retryResult = await requestAnimationJobRetry({
          companionId,
          stage,
          reason: `terminal_${metadata.animationStatus}`,
        });

        const terminalMetadata = resolveTerminalMetadataFromRetry(
          metadata,
          retryResult,
        );
        if (terminalMetadata) return terminalMetadata;

        if (retryResult.transientUnavailable) {
          await sleep(EVOLUTION_ANIMATION_POLL_INTERVAL_MS);
          metadata =
            (await refreshPersistedEvolutionMetadata({ companionId, stage })) ??
            metadata;
          continue;
        }

        if (
          retryResult.status === "queued" ||
          retryResult.status === "processing"
        ) {
          jobId = retryResult.jobId ?? jobId;
          await sleep(EVOLUTION_ANIMATION_POLL_INTERVAL_MS);
          metadata =
            (await refreshPersistedEvolutionMetadata({ companionId, stage })) ??
            metadata;
          continue;
        }
      }

      logger.warn(
        "Evolution listener: Companion animation ended without a playable video",
        {
          companionId,
          stage,
          evolutionId: metadata.id,
          animationStatus: metadata.animationStatus,
        },
      );
      return null;
    }

    const shouldDiscoverAnimationJob =
      metadata.animationStatus === "queued" ||
      metadata.animationStatus === "processing" ||
      (hasTerminalAnimationStatus && Date.now() <= activeDiscoveryDeadline);

    if (
      shouldDiscoverAnimationJob &&
      (metadata.animationStatus === "queued" ||
        metadata.animationStatus === "processing") &&
      Date.now() - lastWorkerKickAt >= EVOLUTION_ANIMATION_PROCESS_INTERVAL_MS
    ) {
      lastWorkerKickAt = Date.now();
      const processingResult = await requestAnimationJobRetry({
        companionId,
        stage,
        reason: `status_${metadata.animationStatus}`,
        force: false,
      });

      const terminalMetadata = resolveTerminalMetadataFromRetry(
        metadata,
        processingResult,
      );
      if (terminalMetadata) return terminalMetadata;

      if (
        processingResult.status === "queued" ||
        processingResult.status === "processing"
      ) {
        jobId = processingResult.jobId ?? jobId;
      }
    }

    if (hasTerminalAnimationStatus && Date.now() > activeDiscoveryDeadline) {
      const retryKey = [
        "stale",
        metadata.animationStatus,
        metadata.animationRequestedAt ?? "requested-unknown",
        metadata.animationCompletedAt ?? "completed-unknown",
      ].join("|");

      if (!retryAttemptKeys.has(retryKey)) {
        retryAttemptKeys.add(retryKey);
        const retryResult = await requestAnimationJobRetry({
          companionId,
          stage,
          reason: `stale_${metadata.animationStatus}`,
        });

        const terminalMetadata = resolveTerminalMetadataFromRetry(
          metadata,
          retryResult,
        );
        if (terminalMetadata) return terminalMetadata;

        if (retryResult.transientUnavailable) {
          await sleep(EVOLUTION_ANIMATION_POLL_INTERVAL_MS);
          metadata =
            (await refreshPersistedEvolutionMetadata({ companionId, stage })) ??
            metadata;
          continue;
        }

        if (
          retryResult.status === "queued" ||
          retryResult.status === "processing"
        ) {
          jobId = retryResult.jobId ?? jobId;
          await sleep(EVOLUTION_ANIMATION_POLL_INTERVAL_MS);
          metadata =
            (await refreshPersistedEvolutionMetadata({ companionId, stage })) ??
            metadata;
          continue;
        }
      }

      return null;
    }

    if (
      !jobId &&
      metadata.animationStatus !== "queued" &&
      metadata.animationStatus !== "processing" &&
      (metadata.animationStatus === null || Date.now() > discoveryDeadline)
    ) {
      const retryKey = `missing_job:${metadata.animationStatus ?? "none"}`;
      if (!retryAttemptKeys.has(retryKey)) {
        retryAttemptKeys.add(retryKey);
        const retryResult = await requestAnimationJobRetry({
          companionId,
          stage,
          reason: "missing_animation_job",
        });

        const terminalMetadata = resolveTerminalMetadataFromRetry(
          metadata,
          retryResult,
        );
        if (terminalMetadata) return terminalMetadata;

        if (
          retryResult.status === "queued" ||
          retryResult.status === "processing"
        ) {
          jobId = retryResult.jobId ?? jobId;
          await sleep(EVOLUTION_ANIMATION_POLL_INTERVAL_MS);
          metadata =
            (await refreshPersistedEvolutionMetadata({ companionId, stage })) ??
            metadata;
          continue;
        }
      }

      return null;
    }

    await sleep(EVOLUTION_ANIMATION_POLL_INTERVAL_MS);
    metadata =
      (await refreshPersistedEvolutionMetadata({ companionId, stage })) ??
      metadata;
  }

  logger.warn(
    "Evolution listener: Timed out waiting for companion animation video",
    {
      companionId,
      stage,
      evolutionId: metadata.id,
      animationStatus: metadata.animationStatus,
    },
  );
  return null;
};

const markEvolutionAnimationPresented = async (evolutionId: string) => {
  const { error } = await supabase.rpc(
    "mark_companion_evolution_animation_presented",
    {
      p_evolution_id: evolutionId,
    },
  );

  if (error) {
    logger.warn(
      "Evolution listener: Failed to mark evolution animation as presented",
      {
        evolutionId,
        error: error.message,
      },
    );
    return false;
  }

  return true;
};

export const GlobalEvolutionListener = () => {
  const { user } = useAuth();
  const { mentorId: resolvedMentorId } = useMentorConnection();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    setIsEvolvingLoading,
    pendingEvolutionReveal,
    setPendingEvolutionReveal,
    onEvolutionComplete,
  } = useEvolution();
  const { setEvolutionInProgress } = useCelebration();
  const { triggerEvent } = useCompanionMotionSafe();
  const { checkCompanionAchievements } = useAchievements();
  const [isEvolving, setIsEvolving] = useState(false);
  const [evolutionData, setEvolutionData] =
    useState<EvolutionPresentationData | null>(null);
  const [pendingEvolutionData, setPendingEvolutionData] =
    useState<PendingEvolutionPreloadData | null>(null);
  const activeEvolutionKeyRef = useRef<string | null>(null);
  const pendingEvolutionKeysRef = useRef(new Set<string>());
  const pendingEvolutionRevealRef = useRef<PendingEvolutionReveal | null>(
    pendingEvolutionReveal,
  );
  const pendingPreloadKeyRef = useRef<string | null>(null);
  const presentationRetryTimersRef = useRef(new Map<string, number>());
  const presentationRetryNotifiedKeysRef = useRef(new Set<string>());
  const recentLocalHatchKeysRef = useRef(new Map<string, number>());
  const recordedEvolutionMemoryIdsRef = useRef(new Set<string>());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const buildEvolutionKey = useCallback(
    (companionId: string, stage: number) => `${companionId}:${stage}`,
    [],
  );

  const clearPresentationRetryTimer = useCallback((key: string) => {
    const timerId = presentationRetryTimersRef.current.get(key);
    if (timerId) {
      window.clearTimeout(timerId);
      presentationRetryTimersRef.current.delete(key);
    }
  }, []);

  const setPendingRevealState = useCallback(
    (
      next:
        | PendingEvolutionReveal
        | null
        | ((
            current: PendingEvolutionReveal | null,
          ) => PendingEvolutionReveal | null),
    ) => {
      const resolved =
        typeof next === "function"
          ? next(pendingEvolutionRevealRef.current)
          : next;
      pendingEvolutionRevealRef.current = resolved;
      setPendingEvolutionReveal(resolved);
    },
    [setPendingEvolutionReveal],
  );

  const clearPendingRevealForEvolution = useCallback(
    ({
      companionId,
      stage,
    }: {
      companionId: string;
      stage: number;
    }) => {
      const key = buildEvolutionKey(companionId, stage);
      clearPresentationRetryTimer(key);
      pendingEvolutionKeysRef.current.delete(key);
      if (pendingPreloadKeyRef.current === key) {
        pendingPreloadKeyRef.current = null;
      }
      setPendingEvolutionData(null);
      setIsEvolvingLoading(false);
      setPendingRevealState((current) =>
        current?.companionId === companionId && current.newStage === stage
          ? null
          : current,
      );
    },
    [
      buildEvolutionKey,
      clearPresentationRetryTimer,
      setIsEvolvingLoading,
      setPendingRevealState,
    ],
  );

  useEffect(() => {
    pendingEvolutionRevealRef.current = pendingEvolutionReveal;
  }, [pendingEvolutionReveal]);

  const pruneRecentLocalHatchKeys = useCallback(() => {
    const now = Date.now();
    recentLocalHatchKeysRef.current.forEach((timestamp, key) => {
      if (now - timestamp > LOCAL_HATCH_DEDUPE_WINDOW_MS) {
        recentLocalHatchKeysRef.current.delete(key);
      }
    });
  }, []);

  useEffect(
    () => () => {
      presentationRetryTimersRef.current.forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      presentationRetryTimersRef.current.clear();
    },
    [],
  );

  const resolveMentorSlug = useCallback(async () => {
    if (!resolvedMentorId) return undefined;

    const { data: mentor } = await supabase
      .from("mentors")
      .select("slug")
      .eq("id", resolvedMentorId)
      .maybeSingle();

    return mentor?.slug;
  }, [resolvedMentorId]);

  const recordEvolutionMemory = useCallback(
    ({
      evolutionId,
      companionId,
      previousLevel,
      level,
      evolvedAt,
    }: {
      evolutionId: string;
      companionId: string;
      previousLevel: number;
      level: number;
      evolvedAt: string | null;
    }) => {
      if (!user?.id) return;
      if (recordedEvolutionMemoryIdsRef.current.has(evolutionId)) return;

      recordedEvolutionMemoryIdsRef.current.add(evolutionId);
      const memoryDate = toDateOnly(evolvedAt);
      const isFirstEvolution = level === 1;
      const tierLabel = getProgressionTierLabelForLevel(level);
      supabase
        .from("companion_memories")
        .insert({
          user_id: user.id,
          companion_id: companionId,
          memory_type: isFirstEvolution ? "first_evolution" : "evolution",
          memory_date: memoryDate,
          memory_context: {
            title: isFirstEvolution
              ? "First Hatch"
              : `Reached ${getProgressionLevelDisplay(level)}`,
            description: isFirstEvolution
              ? "The shell cracked open, and your companion finally emerged."
              : `Your companion crossed into the ${tierLabel} tier.`,
            emotion: isFirstEvolution ? "pride" : "joy",
            details: {
              evolutionId,
              level,
              previousLevel,
              tier: tierLabel,
              evolvedAt,
            },
          },
          referenced_count: 0,
        })
        .then(({ error }) => {
          if (!error || isUniqueViolation(error)) return;

          recordedEvolutionMemoryIdsRef.current.delete(evolutionId);
          logger.error("Failed to create evolution memory:", error);
        });
    },
    [user?.id],
  );

  const startEvolutionPresentation = useCallback(
    ({
      evolutionId,
      companionId,
      previousLevel,
      level,
      previousImageUrl,
      imageUrl,
      animationVideoUrl,
      presetId,
      element,
      dispatchLoadingStart = false,
      markAsLocalHatch = false,
    }: {
      evolutionId: string;
      companionId: string;
      previousLevel: number;
      level: number;
      previousImageUrl: string;
      imageUrl: string;
      animationVideoUrl?: string | null;
      presetId?: string;
      element?: string;
      dispatchLoadingStart?: boolean;
      markAsLocalHatch?: boolean;
    }) => {
      const key = buildEvolutionKey(companionId, level);

      if (!isTierBoundaryLevel(level)) {
        logger.warn(
          "Evolution listener: Refusing to open reveal for non-boundary stage",
          {
            companionId,
            level,
          },
        );
        return false;
      }

      if (activeEvolutionKeyRef.current === key) {
        return false;
      }

      if (!animationVideoUrl) {
        logger.warn(
          "Evolution listener: Refusing to open reveal without animation video",
          {
            companionId,
            level,
          },
        );
        return false;
      }

      activeEvolutionKeyRef.current = key;

      if (markAsLocalHatch) {
        recentLocalHatchKeysRef.current.set(key, Date.now());
      }

      try {
        pendingPreloadKeyRef.current = null;
        setPendingEvolutionData(null);
        setEvolutionData({
          evolutionId,
          companionId,
          previousLevel,
          level,
          previousImageUrl,
          imageUrl,
          animationVideoUrl: animationVideoUrl ?? null,
          presetId,
          element,
        });
        triggerEvent({
          type: "evolution_start",
          intensity: level >= 56 ? "heroic" : "medium",
          element,
          stage: level,
        });
        setIsEvolving(true);
        setEvolutionInProgress(true);

        if (dispatchLoadingStart) {
          window.dispatchEvent(new CustomEvent("evolution-loading-start"));
        }

        void resolveMentorSlug()
          .then((mentorSlug) => {
            if (!mentorSlug) {
              return;
            }

            setEvolutionData((current) => {
              if (
                !current ||
                current.companionId !== companionId ||
                current.previousLevel !== previousLevel ||
                current.level !== level
              ) {
                return current;
              }

              if (current.mentorSlug === mentorSlug) {
                return current;
              }

              return {
                ...current,
                mentorSlug,
              };
            });
          })
          .catch((error) => {
            logger.warn("Evolution listener: Failed to resolve mentor slug", {
              companionId,
              level,
              error: error instanceof Error ? error.message : String(error),
            });
          });

        return true;
      } catch (error) {
        activeEvolutionKeyRef.current = null;
        logger.error(
          "Evolution listener: Failed to start evolution presentation",
          {
            companionId,
            level,
            error: error instanceof Error ? error.message : String(error),
          },
        );
        return false;
      }
    },
    [
      buildEvolutionKey,
      resolveMentorSlug,
      setEvolutionInProgress,
      triggerEvent,
    ],
  );

  const markPendingRevealReady = useCallback(
    (pending: EvolutionPresentationData) => {
      const key = buildEvolutionKey(pending.companionId, pending.level);
      pendingEvolutionKeysRef.current.delete(key);
      presentationRetryNotifiedKeysRef.current.delete(key);
      setIsEvolvingLoading(false);
      setPendingRevealState({
        status: "ready",
        companionId: pending.companionId,
        evolutionId: pending.evolutionId,
        previousStage: pending.previousLevel,
        newStage: pending.level,
        previousImageUrl: pending.previousImageUrl,
        newImageUrl: pending.imageUrl,
        animationVideoUrl: pending.animationVideoUrl,
        presetId: pending.presetId ?? null,
        element: pending.element ?? null,
      });
      toast.info("Your companion's evolution is ready.", {
        action: {
          label: "Reveal",
          onClick: () => navigate("/companion"),
        },
      });
    },
    [buildEvolutionKey, navigate, setIsEvolvingLoading, setPendingRevealState],
  );

  const beginEvolutionPresentationWhenReady = useCallback(
    async ({
      companionId,
      previousLevel,
      level,
      previousImageUrl,
      imageUrl,
      presetId,
      element,
      dispatchLoadingStart = false,
      markAsLocalHatch = false,
      missingEvolutionLog,
    }: EvolutionPresentationRequest) => {
      const key = buildEvolutionKey(companionId, level);
      if (!isTierBoundaryLevel(level)) {
        logger.warn(
          "Evolution listener: Skipping animation reveal for non-boundary stage",
          {
            companionId,
            previousLevel,
            level,
            ...missingEvolutionLog,
          },
        );
        return false;
      }

      if (
        activeEvolutionKeyRef.current === key ||
        pendingEvolutionKeysRef.current.has(key)
      ) {
        return false;
      }

      clearPresentationRetryTimer(key);
      pendingEvolutionKeysRef.current.add(key);
      if (markAsLocalHatch) {
        recentLocalHatchKeysRef.current.set(key, Date.now());
      }

      if (dispatchLoadingStart) {
        window.dispatchEvent(new CustomEvent("evolution-loading-start"));
      }
      setIsEvolvingLoading(true);
      setPendingRevealState({
        status: "preparing",
        companionId,
        previousStage: previousLevel,
        newStage: level,
        previousImageUrl,
        newImageUrl: imageUrl,
        animationVideoUrl: null,
        presetId: presetId ?? null,
        element: element ?? null,
      });

      let queuedForPreload = false;
      let scheduledRetry = false;
      const schedulePresentationRetry = (reason: string) => {
        if (presentationRetryTimersRef.current.has(key)) {
          scheduledRetry = true;
          return;
        }

        scheduledRetry = true;
        if (!presentationRetryNotifiedKeysRef.current.has(key)) {
          presentationRetryNotifiedKeysRef.current.add(key);
          toast.info(
            "Your companion animation is still preparing. We'll keep trying in the background.",
          );
        }

        const retryRequest: EvolutionPresentationRequest = {
          companionId,
          previousLevel,
          level,
          previousImageUrl,
          imageUrl,
          presetId,
          element,
          dispatchLoadingStart: false,
          markAsLocalHatch: false,
          missingEvolutionLog: {
            ...(missingEvolutionLog ?? {}),
            retryReason: reason,
          },
        };

        const timerId = window.setTimeout(() => {
          presentationRetryTimersRef.current.delete(key);
          pendingEvolutionKeysRef.current.delete(key);
          void beginEvolutionPresentationWhenReady(retryRequest);
        }, EVOLUTION_PRESENTATION_RETRY_DELAY_MS);

        presentationRetryTimersRef.current.set(key, timerId);
      };

      try {
        const persistedEvolution = await waitForEvolutionPersistence({
          companionId,
          stage: level,
        });

        if (persistedEvolution === PERSISTED_EVOLUTION_METADATA_UNAVAILABLE) {
          schedulePresentationRetry("persisted_evolution_unavailable");
          return false;
        }

        if (!persistedEvolution) {
          logger.warn(
            "Evolution listener: Ignoring stage update without persisted evolution row",
            {
              companionId,
              previousLevel,
              level,
              ...missingEvolutionLog,
            },
          );
          schedulePresentationRetry("missing_persisted_evolution");
          return false;
        }

        if (persistedEvolution.animationPresentedAt) {
          clearPendingRevealForEvolution({ companionId, stage: level });
          return false;
        }

        if (
          user?.id &&
          wasEvolutionPresentedLocally(user.id, persistedEvolution.id)
        ) {
          clearPendingRevealForEvolution({ companionId, stage: level });
          return false;
        }

        recordEvolutionMemory({
          evolutionId: persistedEvolution.id,
          companionId,
          previousLevel,
          level,
          evolvedAt: persistedEvolution.evolvedAt,
        });
        void checkCompanionAchievements(level).catch((error) => {
          logger.warn("Evolution listener: Failed to check companion achievements", {
            companionId,
            level,
            error: error instanceof Error ? error.message : String(error),
          });
        });

        const readyEvolution = await waitForEvolutionAnimation({
          companionId,
          stage: level,
          initialMetadata: persistedEvolution,
        });

        if (!readyEvolution?.animationVideoUrl) {
          if (
            readyEvolution &&
            hasNonRetryableTerminalAnimation(readyEvolution)
          ) {
            logger.warn(
              "Evolution listener: Skipping reveal for non-animatable evolution",
              {
                companionId,
                level,
                evolutionId: readyEvolution.id,
                animationErrorCode: readyEvolution.animationErrorCode,
              },
            );
            presentationRetryNotifiedKeysRef.current.delete(key);
            if (user?.id) {
              markEvolutionPresentedLocally(user.id, readyEvolution.id);
            }
            clearPendingRevealForEvolution({ companionId, stage: level });
            void markEvolutionAnimationPresented(readyEvolution.id).then(
              (marked) => {
                if (marked) {
                  queryClient.invalidateQueries({
                    queryKey: ["companion-evolution-moments"],
                  });
                }
              },
            );
            return false;
          }

          schedulePresentationRetry("animation_not_ready");
          return false;
        }

        presentationRetryNotifiedKeysRef.current.delete(key);
        const readyPendingEvolution = {
          evolutionId: persistedEvolution.id,
          companionId,
          previousLevel,
          level,
          previousImageUrl,
          imageUrl,
          animationVideoUrl: readyEvolution.animationVideoUrl,
          presetId,
          element,
        };
        markPendingRevealReady(readyPendingEvolution);
        pendingPreloadKeyRef.current = key;
        setPendingEvolutionData(readyPendingEvolution);
        queuedForPreload = true;
        return true;
      } finally {
        if (!queuedForPreload) {
          pendingEvolutionKeysRef.current.delete(key);
        }
        if (
          !queuedForPreload &&
          !scheduledRetry &&
          activeEvolutionKeyRef.current !== key
        ) {
          setIsEvolvingLoading(false);
        }
      }
    },
    [
      buildEvolutionKey,
      clearPresentationRetryTimer,
      clearPendingRevealForEvolution,
      checkCompanionAchievements,
      markPendingRevealReady,
      recordEvolutionMemory,
      setPendingRevealState,
      setIsEvolvingLoading,
      queryClient,
      user?.id,
    ],
  );

  const handlePendingAnimationReady = useCallback(() => {
    const pending = pendingEvolutionData;
    if (!pending) return;

    const key = buildEvolutionKey(pending.companionId, pending.level);
    if (pendingPreloadKeyRef.current !== key) return;
    pendingPreloadKeyRef.current = null;
    setPendingEvolutionData(null);
    const currentReveal = pendingEvolutionRevealRef.current;
    if (
      currentReveal?.status === "ready" &&
      currentReveal.companionId === pending.companionId &&
      currentReveal.newStage === pending.level &&
      currentReveal.animationVideoUrl === pending.animationVideoUrl
    ) {
      return;
    }
    markPendingRevealReady(pending);
  }, [buildEvolutionKey, markPendingRevealReady, pendingEvolutionData]);

  const handlePendingAnimationPreloadMiss = useCallback(
    (reason: string) => {
      const pending = pendingEvolutionData;
      if (!pending) return;

      const key = buildEvolutionKey(pending.companionId, pending.level);
      if (pendingPreloadKeyRef.current !== key) return;
      const currentReveal = pendingEvolutionRevealRef.current;
      if (
        currentReveal?.status === "ready" &&
        currentReveal.companionId === pending.companionId &&
        currentReveal.newStage === pending.level &&
        currentReveal.animationVideoUrl === pending.animationVideoUrl
      ) {
        logger.warn(
          "Evolution listener: Animation video preload did not complete before reveal became ready",
          {
            companionId: pending.companionId,
            level: pending.level,
            animationVideoUrl: pending.animationVideoUrl,
            reason,
          },
        );
        pendingPreloadKeyRef.current = null;
        setPendingEvolutionData(null);
        return;
      }

      logger.warn(
        "Evolution listener: Animation video preload was skipped",
        {
          companionId: pending.companionId,
          level: pending.level,
          animationVideoUrl: pending.animationVideoUrl,
          reason,
        },
      );

      pendingPreloadKeyRef.current = null;
      setPendingEvolutionData(null);
    },
    [buildEvolutionKey, pendingEvolutionData],
  );

  useEffect(() => {
    if (!pendingEvolutionData) return;

    const timeoutId = window.setTimeout(() => {
      handlePendingAnimationPreloadMiss("timeout");
    }, EVOLUTION_ANIMATION_PRELOAD_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [handlePendingAnimationPreloadMiss, pendingEvolutionData]);

  const invalidateCompanionQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["companion"] });
    queryClient.invalidateQueries({ queryKey: ["companion-health"] });
    queryClient.invalidateQueries({ queryKey: ["companion-care-signals"] });
    queryClient.invalidateQueries({ queryKey: ["companion-attributes"] });
    queryClient.invalidateQueries({ queryKey: ["companion-story"] });
    queryClient.invalidateQueries({ queryKey: ["companion-stories-all"] });
    queryClient.invalidateQueries({ queryKey: ["companion-memories"] });
    queryClient.invalidateQueries({ queryKey: ["companion-bond"] });
    queryClient.invalidateQueries({
      queryKey: ["companion-evolution-image"],
    });
    queryClient.invalidateQueries({ queryKey: ["current-evolution-card"] });
    queryClient.invalidateQueries({ queryKey: ["evolution-cards"] });
  }, [queryClient]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`companion-evolution-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_companion",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          invalidateCompanionQueries();

          if (payload.eventType !== "UPDATE") {
            return;
          }

          const newData = payload.new as Record<string, unknown> | null;
          const oldData = payload.old as Record<string, unknown> | null;

          if (!newData || !oldData) {
            logger.warn("Evolution listener: Missing payload data");
            return;
          }

          const newLevel =
            typeof newData.current_stage === "number"
              ? newData.current_stage
              : null;
          const oldLevel =
            typeof oldData.current_stage === "number"
              ? oldData.current_stage
              : null;

          if (newLevel === null || oldLevel === null) {
            logger.warn("Evolution listener: Invalid stage values");
            return;
          }

          if (newLevel <= oldLevel) {
            return;
          }

          if (!isTierBoundaryLevel(newLevel)) {
            return;
          }

          const companionId =
            typeof newData.id === "string" ? newData.id : null;
          if (!companionId) {
            logger.warn("Evolution listener: Missing companion id");
            return;
          }

          const evolutionKey = buildEvolutionKey(companionId, newLevel);
          pruneRecentLocalHatchKeys();

          const localHatchStartedAt =
            recentLocalHatchKeysRef.current.get(evolutionKey);
          if (
            localHatchStartedAt &&
            Date.now() - localHatchStartedAt <= LOCAL_HATCH_DEDUPE_WINDOW_MS
          ) {
            recentLocalHatchKeysRef.current.delete(evolutionKey);
            return;
          }

          const currentImageUrl =
            typeof newData.current_image_url === "string"
              ? newData.current_image_url
              : "";
          const element =
            typeof newData.core_element === "string"
              ? newData.core_element
              : undefined;
          const imageUrl =
            resolveCompanionVisualAssetUrl({
              preset_id:
                typeof newData.preset_id === "string"
                  ? newData.preset_id
                  : null,
              current_stage: newLevel,
              core_element: element ?? null,
              current_image_url: currentImageUrl,
              dormant_image_url:
                typeof newData.dormant_image_url === "string"
                  ? newData.dormant_image_url
                  : null,
              neglected_image_url:
                typeof newData.neglected_image_url === "string"
                  ? newData.neglected_image_url
                  : null,
            }) ?? currentImageUrl;
          const previousImageUrl =
            resolveCompanionVisualAssetUrl({
              preset_id:
                typeof oldData.preset_id === "string"
                  ? oldData.preset_id
                  : typeof newData.preset_id === "string"
                    ? newData.preset_id
                    : null,
              current_stage: oldLevel,
              core_element:
                typeof oldData.core_element === "string"
                  ? oldData.core_element
                  : (element ?? null),
              current_image_url:
                typeof oldData.current_image_url === "string"
                  ? oldData.current_image_url
                  : currentImageUrl,
              dormant_image_url:
                typeof oldData.dormant_image_url === "string"
                  ? oldData.dormant_image_url
                  : typeof newData.dormant_image_url === "string"
                    ? newData.dormant_image_url
                    : null,
              neglected_image_url:
                typeof oldData.neglected_image_url === "string"
                  ? oldData.neglected_image_url
                  : typeof newData.neglected_image_url === "string"
                    ? newData.neglected_image_url
                    : null,
            }) ?? currentImageUrl;

          await beginEvolutionPresentationWhenReady({
            companionId,
            previousLevel: oldLevel,
            level: newLevel,
            previousImageUrl,
            imageUrl,
            presetId:
              typeof newData.preset_id === "string"
                ? newData.preset_id
                : typeof oldData.preset_id === "string"
                  ? oldData.preset_id
                  : undefined,
            element,
            dispatchLoadingStart: true,
            missingEvolutionLog: {
              oldLevel,
              newLevel,
            },
          });
        },
      )
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          logger.warn("Evolution listener subscription error", {
            status,
            error: err?.message,
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    buildEvolutionKey,
    pruneRecentLocalHatchKeys,
    beginEvolutionPresentationWhenReady,
    invalidateCompanionQueries,
    user,
    user?.id,
  ]);

  const hydratePendingEvolutionReveal = useCallback(async () => {
    if (!user?.id) return;

      const { data: companion, error } = await supabase
        .from("user_companion")
        .select(
          "id, current_stage, current_image_url, initial_image_url, preset_id, core_element, dormant_image_url, neglected_image_url",
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (!mountedRef.current) return;

      if (error) {
        logEvolutionSupabaseReadError({
          logKey: "hydrate-pending-reveal-companion",
          message:
            "Evolution listener: Failed to hydrate pending reveal companion",
          context: {
            userId: user.id,
          },
          error,
        });
        return;
      }

      const companionRecord = companion as Record<string, unknown> | null;
      const companionId =
        typeof companionRecord?.id === "string" ? companionRecord.id : null;
      const currentStage =
        typeof companionRecord?.current_stage === "number"
          ? companionRecord.current_stage
          : null;

      if (
        !companionId ||
        currentStage === null ||
        currentStage <= 0 ||
        !isTierBoundaryLevel(currentStage)
      ) {
        return;
      }

      const currentPending = pendingEvolutionRevealRef.current;
      const currentPendingMatches =
        currentPending?.companionId === companionId &&
        currentPending.newStage === currentStage;
      if (currentPendingMatches && currentPending.status === "ready") {
        return;
      }

      const currentEvolution = await fetchPersistedEvolutionMetadata({
        companionId,
        stage: currentStage,
      });

      if (currentEvolution === PERSISTED_EVOLUTION_METADATA_UNAVAILABLE) {
        return;
      }

      if (!mountedRef.current || !currentEvolution) {
        return;
      }

      if (!shouldHydratePendingEvolutionReveal(currentEvolution)) {
        if (currentPendingMatches && currentPending.status === "preparing") {
          clearPendingRevealForEvolution({
            companionId,
            stage: currentStage,
          });
        }
        return;
      }

      if (
        user?.id &&
        wasEvolutionPresentedLocally(user.id, currentEvolution.id)
      ) {
        clearPendingRevealForEvolution({
          companionId,
          stage: currentStage,
        });
        return;
      }

      const previousStage = Math.max(0, currentStage - 1);
      let previousImageUrl: string | null =
        typeof companionRecord?.initial_image_url === "string"
          ? companionRecord.initial_image_url
          : null;

      if (previousStage > 0) {
        const { data: previousEvolution } = await supabase
          .from("companion_evolutions")
          .select("image_url")
          .eq("companion_id", companionId)
          .eq("stage", previousStage)
          .maybeSingle();

        if (typeof previousEvolution?.image_url === "string") {
          previousImageUrl = previousEvolution.image_url;
        }
      }

      const element =
        typeof companionRecord?.core_element === "string"
          ? companionRecord.core_element
          : undefined;
      const currentImageUrl =
        typeof companionRecord?.current_image_url === "string"
          ? companionRecord.current_image_url
          : "";
      const resolvedCurrentImageUrl =
        currentEvolution.imageUrl ??
        resolveCompanionVisualAssetUrl({
          preset_id:
            typeof companionRecord?.preset_id === "string"
              ? companionRecord.preset_id
              : null,
          current_stage: currentStage,
          core_element: element ?? null,
          current_image_url: currentImageUrl,
          dormant_image_url:
            typeof companionRecord?.dormant_image_url === "string"
              ? companionRecord.dormant_image_url
              : null,
          neglected_image_url:
            typeof companionRecord?.neglected_image_url === "string"
              ? companionRecord.neglected_image_url
              : null,
        }) ??
        currentImageUrl;
      const resolvedPreviousImageUrl =
        previousImageUrl ??
        resolveCompanionVisualAssetUrl({
          preset_id:
            typeof companionRecord?.preset_id === "string"
              ? companionRecord.preset_id
              : null,
          current_stage: previousStage,
          core_element: element ?? null,
          current_image_url: previousImageUrl ?? currentImageUrl,
          dormant_image_url: null,
          neglected_image_url: null,
        }) ??
        currentImageUrl;

      if (
        !mountedRef.current ||
        !resolvedCurrentImageUrl ||
        !resolvedPreviousImageUrl
      ) {
        return;
      }

      if (currentEvolution.animationVideoUrl) {
        const key = buildEvolutionKey(companionId, currentStage);
        const previousImageForPreload = currentPendingMatches && currentPending
          ? currentPending.previousImageUrl
          : resolvedPreviousImageUrl;
        const currentImageForPreload = currentPendingMatches && currentPending
          ? currentPending.newImageUrl
          : resolvedCurrentImageUrl;
        const presetIdForPreload = currentPendingMatches && currentPending
          ? currentPending.presetId ?? undefined
          : typeof companionRecord?.preset_id === "string"
            ? companionRecord.preset_id
            : undefined;
        const elementForPreload = currentPendingMatches && currentPending
          ? currentPending.element ?? undefined
          : element;

        const readyPendingEvolution = {
          evolutionId: currentEvolution.id,
          companionId,
          previousLevel: currentPendingMatches && currentPending
            ? currentPending.previousStage
            : previousStage,
          level: currentStage,
          previousImageUrl: previousImageForPreload,
          imageUrl: currentImageForPreload,
          animationVideoUrl: currentEvolution.animationVideoUrl,
          presetId: presetIdForPreload,
          element: elementForPreload,
        };

        pendingEvolutionKeysRef.current.add(key);
        pendingPreloadKeyRef.current = key;
        markPendingRevealReady(readyPendingEvolution);
        setPendingEvolutionData(readyPendingEvolution);
        return;
      }

      void beginEvolutionPresentationWhenReady({
        companionId,
        previousLevel: previousStage,
        level: currentStage,
        previousImageUrl: resolvedPreviousImageUrl,
        imageUrl: resolvedCurrentImageUrl,
        presetId:
          typeof companionRecord?.preset_id === "string"
            ? companionRecord.preset_id
            : undefined,
        element,
        dispatchLoadingStart: false,
      });
  }, [
    beginEvolutionPresentationWhenReady,
    buildEvolutionKey,
    clearPendingRevealForEvolution,
    markPendingRevealReady,
    user?.id,
  ]);

  useEffect(() => {
    void hydratePendingEvolutionReveal();
  }, [hydratePendingEvolutionReveal]);

  const setPreparingStateForEvolutionJob = useCallback(
    async (job: PersistedEvolutionJobMetadata) => {
      setIsEvolvingLoading(true);

      if (!isTierBoundaryLevel(job.requestedStage)) {
        return;
      }

      const currentPending = pendingEvolutionRevealRef.current;
      if (
        currentPending?.status === "ready" &&
        currentPending.companionId === job.companionId &&
        currentPending.newStage === job.requestedStage
      ) {
        return;
      }

      const { data: companion, error } = await supabase
        .from("user_companion")
        .select(
          "id, current_stage, current_image_url, initial_image_url, preset_id, core_element, dormant_image_url, neglected_image_url",
        )
        .eq("id", job.companionId)
        .maybeSingle();

      if (error) {
        logEvolutionSupabaseReadError({
          logKey: "hydrate-active-evolution-job-companion",
          message:
            "Evolution listener: Failed to hydrate active evolution job companion",
          context: {
            companionId: job.companionId,
            jobId: job.id,
          },
          error,
        });
        return;
      }

      const companionRecord = companion as Record<string, unknown> | null;
      const currentStage =
        typeof companionRecord?.current_stage === "number"
          ? companionRecord.current_stage
          : Math.max(0, job.requestedStage - 1);
      const previousStage = Math.max(
        0,
        Math.min(job.requestedStage - 1, currentStage),
      );
      const element =
        typeof companionRecord?.core_element === "string"
          ? companionRecord.core_element
          : undefined;
      const currentImageUrl =
        typeof companionRecord?.current_image_url === "string"
          ? companionRecord.current_image_url
          : typeof companionRecord?.initial_image_url === "string"
            ? companionRecord.initial_image_url
            : "";
      const presetId =
        typeof companionRecord?.preset_id === "string"
          ? companionRecord.preset_id
          : null;
      const dormantImageUrl =
        typeof companionRecord?.dormant_image_url === "string"
          ? companionRecord.dormant_image_url
          : null;
      const neglectedImageUrl =
        typeof companionRecord?.neglected_image_url === "string"
          ? companionRecord.neglected_image_url
          : null;
      const previousImageUrl =
        resolveCompanionVisualAssetUrl({
          preset_id: presetId,
          current_stage: previousStage,
          core_element: element ?? null,
          current_image_url: currentImageUrl,
          dormant_image_url: dormantImageUrl,
          neglected_image_url: neglectedImageUrl,
        }) ?? currentImageUrl;
      const pendingImageUrl =
        resolveCompanionVisualAssetUrl({
          preset_id: presetId,
          current_stage: job.requestedStage,
          core_element: element ?? null,
          current_image_url: currentImageUrl,
          dormant_image_url: dormantImageUrl,
          neglected_image_url: neglectedImageUrl,
        }) ?? currentImageUrl;

      if (!previousImageUrl || !pendingImageUrl) {
        return;
      }

      setPendingRevealState((current) => {
        if (
          current?.status === "ready" &&
          current.companionId === job.companionId &&
          current.newStage === job.requestedStage
        ) {
          return current;
        }

        return {
          status: "preparing",
          evolutionId: null,
          companionId: job.companionId,
          previousStage,
          newStage: job.requestedStage,
          previousImageUrl,
          newImageUrl: pendingImageUrl,
          animationVideoUrl: null,
          presetId,
          element: element ?? null,
        };
      });
    },
    [setIsEvolvingLoading, setPendingRevealState],
  );

  const notifyFailedEvolutionJob = useCallback(
    (job: PersistedEvolutionJobMetadata) => {
      if (!user?.id) return;
      if (wasFailedEvolutionJobNotifiedLocally(user.id, job.id)) return;

      const latestActivityMs =
        getTimestampMs(job.completedAt) ??
        getTimestampMs(job.updatedAt) ??
        getTimestampMs(job.requestedAt);
      if (
        latestActivityMs !== null &&
        Date.now() - latestActivityMs >
          FAILED_EVOLUTION_JOB_NOTIFICATION_WINDOW_MS
      ) {
        return;
      }

      markFailedEvolutionJobNotifiedLocally(user.id, job.id);
      const normalizedCode = normalizeAnimationReason(job.errorCode);
      const message =
        normalizedCode === "not_enough_xp"
          ? "Your companion is not ready to evolve yet."
          : normalizedCode === "rate_limited"
            ? "Evolution is on cooldown. Please try again in a little while."
            : "Unable to evolve your companion. Please try again.";

      toast.error(message);
    },
    [user?.id],
  );

  const handleEvolutionJobMetadata = useCallback(
    async (job: PersistedEvolutionJobMetadata) => {
      invalidateCompanionQueries();
      const key = buildEvolutionKey(job.companionId, job.requestedStage);

      if (job.status === "queued" || job.status === "processing") {
        await setPreparingStateForEvolutionJob(job);
        if (job.status === "queued") {
          void supabase.functions.invoke("process-companion-evolution-job", {
            body: { jobId: job.id },
          });
        }
        return;
      }

      if (job.status === "failed") {
        clearPresentationRetryTimer(key);
        pendingEvolutionKeysRef.current.delete(key);
        pendingPreloadKeyRef.current = null;
        setPendingEvolutionData(null);
        setIsEvolvingLoading(false);
        setPendingRevealState((current) =>
          current?.companionId === job.companionId &&
          current.newStage === job.requestedStage
            ? null
            : current,
        );
        notifyFailedEvolutionJob(job);
        return;
      }

      await hydratePendingEvolutionReveal();
      if (
        !pendingEvolutionRevealRef.current &&
        pendingEvolutionKeysRef.current.size === 0 &&
        !pendingPreloadKeyRef.current
      ) {
        setIsEvolvingLoading(false);
      }
    },
    [
      buildEvolutionKey,
      clearPresentationRetryTimer,
      hydratePendingEvolutionReveal,
      invalidateCompanionQueries,
      notifyFailedEvolutionJob,
      setIsEvolvingLoading,
      setPendingRevealState,
      setPreparingStateForEvolutionJob,
    ],
  );

  const hydrateLatestEvolutionJob = useCallback(async () => {
    if (!user?.id) return;

    const latestJob = await fetchLatestEvolutionJobMetadata({ userId: user.id });
    if (!latestJob || !mountedRef.current) {
      return;
    }

    await handleEvolutionJobMetadata(latestJob);
  }, [handleEvolutionJobMetadata, user?.id]);

  useEffect(() => {
    void hydrateLatestEvolutionJob();
  }, [hydrateLatestEvolutionJob]);

  useEffect(() => {
    if (!user?.id) return;

    const hydrateWhenVisible = () => {
      if (document.visibilityState !== "visible") return;
      void hydrateLatestEvolutionJob();
      void hydratePendingEvolutionReveal();
    };

    document.addEventListener("visibilitychange", hydrateWhenVisible);
    window.addEventListener("focus", hydrateWhenVisible);

    return () => {
      document.removeEventListener("visibilitychange", hydrateWhenVisible);
      window.removeEventListener("focus", hydrateWhenVisible);
    };
  }, [hydrateLatestEvolutionJob, hydratePendingEvolutionReveal, user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const intervalId = window.setInterval(() => {
      if (pendingEvolutionRevealRef.current?.status !== "preparing") return;

      void hydrateLatestEvolutionJob();
      void hydratePendingEvolutionReveal();
    }, PENDING_EVOLUTION_REVEAL_HYDRATION_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [hydrateLatestEvolutionJob, hydratePendingEvolutionReveal, user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const jobChannel = supabase
      .channel(`companion-evolution-jobs-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "companion_evolution_jobs",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const metadata = toPersistedEvolutionJobMetadata(
            payload.new as Record<string, unknown> | null,
          );
          if (!metadata) return;

          await handleEvolutionJobMetadata(metadata);
        },
      )
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          logger.warn("Evolution job listener subscription error", {
            status,
            error: err?.message,
          });
        }
      });

    return () => {
      supabase.removeChannel(jobChannel);
    };
  }, [handleEvolutionJobMetadata, user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const animationJobChannel = supabase
      .channel(`companion-animation-jobs-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "companion_animation_jobs",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          invalidateCompanionQueries();
          void hydratePendingEvolutionReveal();
        },
      )
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          logger.warn("Evolution animation job listener subscription error", {
            status,
            error: err?.message,
          });
        }
      });

    return () => {
      supabase.removeChannel(animationJobChannel);
    };
  }, [hydratePendingEvolutionReveal, invalidateCompanionQueries, user?.id]);

  useEffect(() => {
    if (!user) return;

    const handleHatchStarted = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (!isCompanionHatchStartedDetail(detail)) {
        return;
      }

      void beginEvolutionPresentationWhenReady({
        companionId: detail.companionId,
        previousLevel: detail.previousStage,
        level: detail.newStage,
        previousImageUrl: detail.previousImageUrl,
        imageUrl: detail.newImageUrl,
        presetId:
          typeof detail.presetId === "string" ? detail.presetId : undefined,
        element: detail.element ?? undefined,
        dispatchLoadingStart: true,
        markAsLocalHatch: true,
      });
    };

    window.addEventListener(
      COMPANION_HATCH_STARTED_EVENT,
      handleHatchStarted as EventListener,
    );
    return () => {
      window.removeEventListener(
        COMPANION_HATCH_STARTED_EVENT,
        handleHatchStarted as EventListener,
      );
    };
  }, [beginEvolutionPresentationWhenReady, user]);

  useEffect(() => {
    if (!user) return;

    const handleRevealRequested = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (!isCompanionEvolutionRevealRequestedDetail(detail)) {
        return;
      }

      const pending = pendingEvolutionRevealRef.current;
      if (
        !pending ||
        pending.status !== "ready" ||
        pending.companionId !== detail.companionId ||
        pending.newStage !== detail.stage
      ) {
        return;
      }

      if (!pending.evolutionId || !pending.animationVideoUrl) {
        logger.warn(
          "Evolution listener: Reveal requested before animation was playable",
          {
            companionId: pending.companionId,
            stage: pending.newStage,
          },
        );
        return;
      }

      const started = startEvolutionPresentation({
        evolutionId: pending.evolutionId,
        companionId: pending.companionId,
        previousLevel: pending.previousStage,
        level: pending.newStage,
        previousImageUrl: pending.previousImageUrl,
        imageUrl: pending.newImageUrl,
        animationVideoUrl: pending.animationVideoUrl ?? null,
        presetId: pending.presetId ?? undefined,
        element: pending.element ?? undefined,
      });

      if (started) {
        setIsEvolvingLoading(false);
      }
    };

    window.addEventListener(
      COMPANION_EVOLUTION_REVEAL_REQUESTED_EVENT,
      handleRevealRequested as EventListener,
    );
    return () => {
      window.removeEventListener(
        COMPANION_EVOLUTION_REVEAL_REQUESTED_EVENT,
        handleRevealRequested as EventListener,
      );
    };
  }, [setIsEvolvingLoading, startEvolutionPresentation, user]);

  return (
    <>
      {pendingEvolutionData && !isEvolving && (
        <video
          aria-hidden="true"
          data-testid="evolution-animation-preloader"
          muted
          playsInline
          preload="auto"
          src={pendingEvolutionData.animationVideoUrl}
          onCanPlay={handlePendingAnimationReady}
          onCanPlayThrough={handlePendingAnimationReady}
          onError={() => handlePendingAnimationPreloadMiss("error")}
          style={{
            position: "fixed",
            width: 1,
            height: 1,
            opacity: 0,
            pointerEvents: "none",
            left: -1,
            top: -1,
          }}
        />
      )}

      {isEvolving && evolutionData && (
        <CompanionEvolution
          isEvolving={isEvolving}
          previousStage={evolutionData.previousLevel}
          newStage={evolutionData.level}
          previousImageUrl={evolutionData.previousImageUrl}
          newImageUrl={evolutionData.imageUrl}
          animationVideoUrl={evolutionData.animationVideoUrl}
          presetId={evolutionData.presetId}
          element={evolutionData.element}
          onAnimationError={() => {
            const key = buildEvolutionKey(
              evolutionData.companionId,
              evolutionData.level,
            );
            setIsEvolving(false);
            setEvolutionData(null);
            activeEvolutionKeyRef.current = null;
            pendingEvolutionKeysRef.current.delete(key);
            setIsEvolvingLoading(true);
            setEvolutionInProgress(false);
            setPendingRevealState({
              status: "preparing",
              evolutionId: evolutionData.evolutionId,
              companionId: evolutionData.companionId,
              previousStage: evolutionData.previousLevel,
              newStage: evolutionData.level,
              previousImageUrl: evolutionData.previousImageUrl,
              newImageUrl: evolutionData.imageUrl,
              animationVideoUrl: null,
              presetId: evolutionData.presetId ?? null,
              element: evolutionData.element ?? null,
            });
            toast.info(
              "Your companion animation needs another pass. We'll try again.",
            );
            void requestAnimationJobRetry({
              companionId: evolutionData.companionId,
              stage: evolutionData.level,
              reason: "playback_error",
              force: true,
            }).then(() => {
              void beginEvolutionPresentationWhenReady({
                companionId: evolutionData.companionId,
                previousLevel: evolutionData.previousLevel,
                level: evolutionData.level,
                previousImageUrl: evolutionData.previousImageUrl,
                imageUrl: evolutionData.imageUrl,
                presetId: evolutionData.presetId,
                element: evolutionData.element,
                dispatchLoadingStart: false,
              });
            });
          }}
          onComplete={() => {
            const completedEvolutionId = evolutionData.evolutionId;
            const completedKey = buildEvolutionKey(
              evolutionData.companionId,
              evolutionData.level,
            );
            if (user?.id) {
              markEvolutionPresentedLocally(user.id, completedEvolutionId);
            }
            setIsEvolving(false);
            setEvolutionData(null);
            activeEvolutionKeyRef.current = null;
            setIsEvolvingLoading(false);
            setEvolutionInProgress(false);
            pendingEvolutionKeysRef.current.delete(completedKey);
            setPendingRevealState((current) =>
              current?.companionId === evolutionData.companionId &&
              current.newStage === evolutionData.level
                ? null
                : current,
            );
            void markEvolutionAnimationPresented(completedEvolutionId).then(
              (marked) => {
                if (marked) {
                  queryClient.invalidateQueries({
                    queryKey: ["companion-evolution-moments"],
                  });
                }
              },
            );

            if (onEvolutionComplete) {
              onEvolutionComplete();
            }
          }}
        />
      )}
    </>
  );
};
