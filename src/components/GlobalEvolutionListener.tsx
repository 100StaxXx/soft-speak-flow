import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { CompanionEvolution } from "@/components/CompanionEvolution";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
const LOCAL_HATCH_DEDUPE_WINDOW_MS = 15000;
const HYDRATABLE_TERMINAL_ANIMATION_WINDOW_MS = 24 * 60 * 60 * 1000;
const NON_RETRYABLE_ANIMATION_REASONS = new Set([
  "image_unchanged",
  "stage_not_animatable",
]);

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

type AnimationRetryResult = {
  status: CompanionAnimationStatus | "unavailable" | null;
  jobId?: string;
  videoUrl?: string;
  code?: string;
  reason?: string;
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
const locallyPresentedEvolutionKeys = new Set<string>();

export const clearLocalEvolutionPresentationGuardsForTest = () => {
  locallyPresentedEvolutionKeys.clear();
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

const normalizeAnimationReason = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const getNonRetryableAnimationReason = (value: unknown): string | null => {
  const reason = normalizeAnimationReason(value);
  return reason && NON_RETRYABLE_ANIMATION_REASONS.has(reason) ? reason : null;
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
}): Promise<PersistedEvolutionMetadata | null> => {
  const { data, error } = await supabase
    .from("companion_evolutions")
    .select(
      "id, image_url, evolved_at, animation_video_url, animation_status, animation_error_code, animation_requested_at, animation_completed_at, animation_presented_at",
    )
    .eq("companion_id", companionId)
    .eq("stage", stage)
    .maybeSingle();

  if (error) {
    logger.warn("Evolution listener: Failed to verify persisted evolution", {
      companionId,
      stage,
      error: error.message,
    });
    return null;
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
    logger.warn("Evolution listener: Failed to verify animation job", {
      companionId,
      stage,
      evolutionId: data.id,
      error: jobError.message,
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

const waitForEvolutionPersistence = async ({
  companionId,
  stage,
}: {
  companionId: string;
  stage: number;
}): Promise<PersistedEvolutionMetadata | null> => {
  for (const delayMs of EVOLUTION_RECORD_RETRY_DELAYS_MS) {
    if (delayMs > 0) await sleep(delayMs);

    const metadata = await fetchPersistedEvolutionMetadata({
      companionId,
      stage,
    });
    if (metadata) return metadata;
  }

  return null;
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
    logger.warn(
      "Evolution listener: Companion animation retry request failed",
      {
        companionId,
        stage,
        reason,
        error: error.message ?? String(error),
      },
    );
    return { status: "unavailable", reason: error.message ?? String(error) };
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

        if (
          retryResult.status === "queued" ||
          retryResult.status === "processing"
        ) {
          jobId = retryResult.jobId ?? jobId;
          await sleep(EVOLUTION_ANIMATION_POLL_INTERVAL_MS);
          metadata =
            (await fetchPersistedEvolutionMetadata({ companionId, stage })) ??
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

        if (
          retryResult.status === "queued" ||
          retryResult.status === "processing"
        ) {
          jobId = retryResult.jobId ?? jobId;
          await sleep(EVOLUTION_ANIMATION_POLL_INTERVAL_MS);
          metadata =
            (await fetchPersistedEvolutionMetadata({ companionId, stage })) ??
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
      Date.now() > discoveryDeadline
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
            (await fetchPersistedEvolutionMetadata({ companionId, stage })) ??
            metadata;
          continue;
        }
      }

      return null;
    }

    await sleep(EVOLUTION_ANIMATION_POLL_INTERVAL_MS);
    metadata =
      (await fetchPersistedEvolutionMetadata({ companionId, stage })) ??
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
          setPendingRevealState((current) =>
            current?.companionId === companionId && current.newStage === level
              ? null
              : current,
          );
          return false;
        }

        if (
          user?.id &&
          wasEvolutionPresentedLocally(user.id, persistedEvolution.id)
        ) {
          setPendingRevealState((current) =>
            current?.companionId === companionId && current.newStage === level
              ? null
              : current,
          );
          return false;
        }

        recordEvolutionMemory({
          evolutionId: persistedEvolution.id,
          companionId,
          previousLevel,
          level,
          evolvedAt: persistedEvolution.evolvedAt,
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
            setPendingRevealState((current) =>
              current?.companionId === companionId && current.newStage === level
                ? null
                : current,
            );
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
        pendingPreloadKeyRef.current = key;
        setPendingEvolutionData(readyPendingEvolution);
        markPendingRevealReady(readyPendingEvolution);
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

  const retryPendingAnimationPreload = useCallback(
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
        "Evolution listener: Animation video could not be preloaded",
        {
          companionId: pending.companionId,
          level: pending.level,
          animationVideoUrl: pending.animationVideoUrl,
          reason,
        },
      );
      toast.info(
        "Your companion animation needs another pass. We'll try again.",
      );

      pendingPreloadKeyRef.current = null;
      setPendingEvolutionData(null);
      pendingEvolutionKeysRef.current.delete(key);
      setIsEvolvingLoading(true);
      setPendingRevealState({
        status: "preparing",
        companionId: pending.companionId,
        evolutionId: pending.evolutionId,
        previousStage: pending.previousLevel,
        newStage: pending.level,
        previousImageUrl: pending.previousImageUrl,
        newImageUrl: pending.imageUrl,
        animationVideoUrl: null,
        presetId: pending.presetId ?? null,
        element: pending.element ?? null,
      });

      void requestAnimationJobRetry({
        companionId: pending.companionId,
        stage: pending.level,
        reason: `preload_${reason}`,
        force: true,
      }).then(() => {
        void beginEvolutionPresentationWhenReady({
          companionId: pending.companionId,
          previousLevel: pending.previousLevel,
          level: pending.level,
          previousImageUrl: pending.previousImageUrl,
          imageUrl: pending.imageUrl,
          presetId: pending.presetId,
          element: pending.element,
          dispatchLoadingStart: false,
        });
      });
    },
    [
      beginEvolutionPresentationWhenReady,
      buildEvolutionKey,
      pendingEvolutionData,
      setIsEvolvingLoading,
      setPendingRevealState,
    ],
  );

  useEffect(() => {
    if (!pendingEvolutionData) return;

    const timeoutId = window.setTimeout(() => {
      retryPendingAnimationPreload("timeout");
    }, EVOLUTION_ANIMATION_PRELOAD_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [pendingEvolutionData, retryPendingAnimationPreload]);

  useEffect(() => {
    if (!user) return;

    const invalidateCompanionQueries = () => {
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
    };

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
    queryClient,
    user,
    user?.id,
  ]);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    const hydratePendingEvolutionReveal = async () => {
      const { data: companion, error } = await supabase
        .from("user_companion")
        .select(
          "id, current_stage, current_image_url, initial_image_url, preset_id, core_element, dormant_image_url, neglected_image_url",
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        logger.warn(
          "Evolution listener: Failed to hydrate pending reveal companion",
          {
            userId: user.id,
            error: error.message,
          },
        );
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

      if (
        cancelled ||
        !currentEvolution ||
        !shouldHydratePendingEvolutionReveal(currentEvolution)
      ) {
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

      if (cancelled || !resolvedCurrentImageUrl || !resolvedPreviousImageUrl) {
        return;
      }

      if (currentPendingMatches && currentEvolution.animationVideoUrl) {
        markPendingRevealReady({
          evolutionId: currentEvolution.id,
          companionId,
          previousLevel: currentPending.previousStage,
          level: currentStage,
          previousImageUrl: currentPending.previousImageUrl,
          imageUrl: currentPending.newImageUrl,
          animationVideoUrl: currentEvolution.animationVideoUrl,
          presetId: currentPending.presetId ?? undefined,
          element: currentPending.element ?? undefined,
        });
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
    };

    void hydratePendingEvolutionReveal();

    return () => {
      cancelled = true;
    };
  }, [beginEvolutionPresentationWhenReady, markPendingRevealReady, user?.id]);

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
          onError={() => retryPendingAnimationPreload("error")}
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
