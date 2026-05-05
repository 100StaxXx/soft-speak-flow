import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CompanionEvolution } from "@/components/CompanionEvolution";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEvolution } from "@/contexts/EvolutionContext";
import { useCelebration } from "@/contexts/CelebrationContext";
import { useMentorConnection } from "@/contexts/MentorConnectionContext";
import { toast } from "@/components/ui/sonner";
import { resolveCompanionVisualAssetUrl } from "@/lib/companionAssetResolver";
import {
  COMPANION_HATCH_STARTED_EVENT,
  isCompanionHatchStartedDetail,
} from "@/lib/companionEvolutionEvents";
import { logger } from "@/utils/logger";
import {
  getProgressionLevelDisplay,
  getProgressionTierLabelForLevel,
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

type CompanionAnimationStatus =
  | "queued"
  | "processing"
  | "succeeded"
  | "failed"
  | "skipped";

type PersistedEvolutionMetadata = {
  id: string;
  animationVideoUrl: string | null;
  animationStatus: CompanionAnimationStatus | null;
  animationRequestedAt: string | null;
  animationCompletedAt: string | null;
};

type AnimationRetryResult = {
  status: CompanionAnimationStatus | "unavailable" | null;
  jobId?: string;
  videoUrl?: string;
  reason?: string;
};

type EvolutionPresentationData = {
  companionId: string;
  previousLevel: number;
  level: number;
  previousImageUrl: string;
  imageUrl: string;
  animationVideoUrl: string;
  presetId?: string;
  mentorSlug?: string;
  element?: string;
};

type EvolutionPresentationRequest = Omit<EvolutionPresentationData, "animationVideoUrl" | "mentorSlug"> & {
  dispatchLoadingStart?: boolean;
  markAsLocalHatch?: boolean;
  missingEvolutionLog?: Record<string, unknown>;
};

const sleep = (delayMs: number) => new Promise((resolve) => setTimeout(resolve, delayMs));

const normalizeAnimationStatus = (value: unknown): CompanionAnimationStatus | null => {
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

const fetchPersistedEvolutionMetadata = async ({
  companionId,
  stage,
}: {
  companionId: string;
  stage: number;
}): Promise<PersistedEvolutionMetadata | null> => {
  const { data, error } = await supabase
    .from("companion_evolutions")
    .select("id, animation_video_url, animation_status, animation_requested_at, animation_completed_at")
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

  const animationStatus = normalizeAnimationStatus(data.animation_status);
  const animationVideoUrl =
    animationStatus === "succeeded" && typeof data.animation_video_url === "string"
      ? data.animation_video_url
      : null;

  return {
    id: data.id,
    animationStatus,
    animationVideoUrl,
    animationRequestedAt: typeof data.animation_requested_at === "string"
      ? data.animation_requested_at
      : null,
    animationCompletedAt: typeof data.animation_completed_at === "string"
      ? data.animation_completed_at
      : null,
  };
};

const isTimestampAtOrAfter = (value: string | null, referenceMs: number): boolean => {
  if (!value) return false;
  const valueMs = new Date(value).getTime();
  return Number.isFinite(valueMs) && valueMs >= referenceMs;
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

    const metadata = await fetchPersistedEvolutionMetadata({ companionId, stage });
    if (metadata) return metadata;
  }

  return null;
};

const fetchAnimationJobId = async (evolutionId: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from("companion_animation_jobs")
    .select("id")
    .eq("evolution_id", evolutionId)
    .maybeSingle();

  if (error) {
    logger.warn("Evolution listener: Failed to find companion animation job", {
      evolutionId,
      error: error.message,
    });
    return null;
  }

  return typeof data?.id === "string" ? data.id : null;
};

const processAnimationJobOnce = async (jobId: string) => {
  const { error } = await supabase.functions.invoke("process-companion-animation-job", {
    body: { jobId },
  });

  if (error) {
    logger.warn("Evolution listener: Companion animation worker invoke failed", {
      jobId,
      error: error.message ?? String(error),
    });
  }
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
  const { data, error } = await supabase.functions.invoke("prewarm-companion-animation", {
    body: { companionId, stage, force, reason },
  });

  if (error) {
    logger.warn("Evolution listener: Companion animation retry request failed", {
      companionId,
      stage,
      reason,
      error: error.message ?? String(error),
    });
    return { status: "unavailable", reason: error.message ?? String(error) };
  }

  const result = (data ?? {}) as {
    status?: unknown;
    jobId?: unknown;
    videoUrl?: unknown;
    reason?: unknown;
  };
  const status = normalizeAnimationStatus(result.status);
  const jobId = typeof result.jobId === "string" ? result.jobId : undefined;
  const videoUrl = typeof result.videoUrl === "string" ? result.videoUrl : undefined;

  if (jobId) {
    await processAnimationJobOnce(jobId);
  }

  return {
    status: status ?? "unavailable",
    jobId,
    videoUrl,
    reason: typeof result.reason === "string" ? result.reason : undefined,
  };
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
  const discoveryDeadline = startedAt + EVOLUTION_ANIMATION_DISCOVERY_TIMEOUT_MS;
  const staleTerminalDiscoveryDeadline =
    startedAt + STALE_TERMINAL_ANIMATION_DISCOVERY_TIMEOUT_MS;
  const readyDeadline = startedAt + EVOLUTION_ANIMATION_READY_TIMEOUT_MS;
  let jobId: string | null = null;
  let lastProcessAt = 0;
  const retryAttemptKeys = new Set<string>();

  while (Date.now() < readyDeadline) {
    if (metadata.animationVideoUrl) {
      return metadata;
    }

    const hasTerminalAnimationStatus =
      metadata.animationStatus === "failed" || metadata.animationStatus === "skipped";
    const terminalStatusHasTimestamp =
      Boolean(metadata.animationRequestedAt || metadata.animationCompletedAt);
    const terminalStatusIsCurrentAttempt =
      !terminalStatusHasTimestamp ||
      isTimestampAtOrAfter(metadata.animationRequestedAt, currentAttemptCutoffMs) ||
      isTimestampAtOrAfter(metadata.animationCompletedAt, currentAttemptCutoffMs);
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

        if (retryResult.videoUrl) {
          return {
            ...metadata,
            animationStatus: "succeeded",
            animationVideoUrl: retryResult.videoUrl,
          };
        }

        if (retryResult.status === "queued" || retryResult.status === "processing") {
          jobId = retryResult.jobId ?? jobId;
          await sleep(EVOLUTION_ANIMATION_POLL_INTERVAL_MS);
          metadata = await fetchPersistedEvolutionMetadata({ companionId, stage }) ?? metadata;
          continue;
        }
      }

      logger.warn("Evolution listener: Companion animation ended without a playable video", {
        companionId,
        stage,
        evolutionId: metadata.id,
        animationStatus: metadata.animationStatus,
      });
      return null;
    }

    const shouldDiscoverAnimationJob =
      metadata.animationStatus === "queued" ||
      metadata.animationStatus === "processing" ||
      (
        hasTerminalAnimationStatus
        && Date.now() <= activeDiscoveryDeadline
      );

    if (shouldDiscoverAnimationJob) {
      if (!jobId) {
        jobId = await fetchAnimationJobId(metadata.id);
      }

      if (jobId && Date.now() - lastProcessAt >= EVOLUTION_ANIMATION_PROCESS_INTERVAL_MS) {
        lastProcessAt = Date.now();
        await processAnimationJobOnce(jobId);
      }
    }

    if (
      hasTerminalAnimationStatus
      && Date.now() > activeDiscoveryDeadline
    ) {
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

        if (retryResult.videoUrl) {
          return {
            ...metadata,
            animationStatus: "succeeded",
            animationVideoUrl: retryResult.videoUrl,
          };
        }

        if (retryResult.status === "queued" || retryResult.status === "processing") {
          jobId = retryResult.jobId ?? jobId;
          await sleep(EVOLUTION_ANIMATION_POLL_INTERVAL_MS);
          metadata = await fetchPersistedEvolutionMetadata({ companionId, stage }) ?? metadata;
          continue;
        }
      }

      return null;
    }

    if (
      !jobId
      && metadata.animationStatus !== "queued"
      && metadata.animationStatus !== "processing"
      && Date.now() > discoveryDeadline
    ) {
      const retryKey = `missing_job:${metadata.animationStatus ?? "none"}`;
      if (!retryAttemptKeys.has(retryKey)) {
        retryAttemptKeys.add(retryKey);
        const retryResult = await requestAnimationJobRetry({
          companionId,
          stage,
          reason: "missing_animation_job",
        });

        if (retryResult.videoUrl) {
          return {
            ...metadata,
            animationStatus: "succeeded",
            animationVideoUrl: retryResult.videoUrl,
          };
        }

        if (retryResult.status === "queued" || retryResult.status === "processing") {
          jobId = retryResult.jobId ?? jobId;
          await sleep(EVOLUTION_ANIMATION_POLL_INTERVAL_MS);
          metadata = await fetchPersistedEvolutionMetadata({ companionId, stage }) ?? metadata;
          continue;
        }
      }

      return null;
    }

    await sleep(EVOLUTION_ANIMATION_POLL_INTERVAL_MS);
    metadata = await fetchPersistedEvolutionMetadata({ companionId, stage }) ?? metadata;
  }

  logger.warn("Evolution listener: Timed out waiting for companion animation video", {
    companionId,
    stage,
    evolutionId: metadata.id,
    animationStatus: metadata.animationStatus,
  });
  return null;
};

export const GlobalEvolutionListener = () => {
  const { user } = useAuth();
  const { mentorId: resolvedMentorId } = useMentorConnection();
  const queryClient = useQueryClient();
  const { setIsEvolvingLoading, onEvolutionComplete } = useEvolution();
  const { setEvolutionInProgress } = useCelebration();
  const { triggerEvent } = useCompanionMotionSafe();
  const [isEvolving, setIsEvolving] = useState(false);
  const [evolutionData, setEvolutionData] = useState<EvolutionPresentationData | null>(null);
  const [pendingEvolutionData, setPendingEvolutionData] = useState<EvolutionPresentationData | null>(null);
  const activeEvolutionKeyRef = useRef<string | null>(null);
  const pendingEvolutionKeysRef = useRef(new Set<string>());
  const pendingPreloadKeyRef = useRef<string | null>(null);
  const presentationRetryTimersRef = useRef(new Map<string, number>());
  const presentationRetryNotifiedKeysRef = useRef(new Set<string>());
  const recentLocalHatchKeysRef = useRef(new Map<string, number>());

  const buildEvolutionKey = useCallback((companionId: string, stage: number) => (
    `${companionId}:${stage}`
  ), []);

  const clearPresentationRetryTimer = useCallback((key: string) => {
    const timerId = presentationRetryTimersRef.current.get(key);
    if (timerId) {
      window.clearTimeout(timerId);
      presentationRetryTimersRef.current.delete(key);
    }
  }, []);

  const pruneRecentLocalHatchKeys = useCallback(() => {
    const now = Date.now();
    recentLocalHatchKeysRef.current.forEach((timestamp, key) => {
      if (now - timestamp > LOCAL_HATCH_DEDUPE_WINDOW_MS) {
        recentLocalHatchKeysRef.current.delete(key);
      }
    });
  }, []);

  useEffect(() => () => {
    presentationRetryTimersRef.current.forEach((timerId) => {
      window.clearTimeout(timerId);
    });
    presentationRetryTimersRef.current.clear();
  }, []);

  const resolveMentorSlug = useCallback(async () => {
    if (!resolvedMentorId) return undefined;

    const { data: mentor } = await supabase
      .from("mentors")
      .select("slug")
      .eq("id", resolvedMentorId)
      .maybeSingle();

    return mentor?.slug;
  }, [resolvedMentorId]);

  const recordEvolutionMemory = useCallback(({
    companionId,
    previousLevel,
    level,
  }: {
    companionId: string;
    previousLevel: number;
    level: number;
  }) => {
    if (!user?.id) return;

    const today = new Date().toISOString().split("T")[0];
    const isFirstEvolution = level === 1;
    const tierLabel = getProgressionTierLabelForLevel(level);
    supabase.from("companion_memories").insert({
      user_id: user.id,
      companion_id: companionId,
      memory_type: isFirstEvolution ? "first_evolution" : "evolution",
      memory_date: today,
      memory_context: {
        title: isFirstEvolution ? "First Hatch" : `Reached ${getProgressionLevelDisplay(level)}`,
        description: isFirstEvolution
          ? "The shell cracked open, and your companion finally emerged."
          : `Your companion crossed into the ${tierLabel} tier.`,
        emotion: isFirstEvolution ? "pride" : "joy",
        details: {
          level,
          previousLevel,
          tier: tierLabel,
        },
      },
      referenced_count: 0,
    }).then(({ error }) => {
      if (error) logger.error("Failed to create evolution memory:", error);
    });
  }, [user?.id]);

  const startEvolutionPresentation = useCallback(({
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
    companionId: string;
    previousLevel: number;
    level: number;
    previousImageUrl: string;
    imageUrl: string;
    animationVideoUrl: string;
    presetId?: string;
    element?: string;
    dispatchLoadingStart?: boolean;
    markAsLocalHatch?: boolean;
  }) => {
    const key = buildEvolutionKey(companionId, level);

    if (activeEvolutionKeyRef.current === key) {
      return false;
    }

    if (!animationVideoUrl) {
      logger.warn("Evolution listener: Refusing to open reveal without animation video", {
        companionId,
        level,
      });
      return false;
    }

    activeEvolutionKeyRef.current = key;

    if (markAsLocalHatch) {
      recentLocalHatchKeysRef.current.set(key, Date.now());
    }

    try {
      setEvolutionData({
        companionId,
        previousLevel,
        level,
        previousImageUrl,
        imageUrl,
        animationVideoUrl,
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

      recordEvolutionMemory({
        companionId,
        previousLevel,
        level,
      });

      void resolveMentorSlug()
        .then((mentorSlug) => {
          if (!mentorSlug) {
            return;
          }

          setEvolutionData((current) => {
            if (
              !current
              || current.companionId !== companionId
              || current.previousLevel !== previousLevel
              || current.level !== level
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
      logger.error("Evolution listener: Failed to start evolution presentation", {
        companionId,
        level,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }, [
    buildEvolutionKey,
    recordEvolutionMemory,
    resolveMentorSlug,
    setEvolutionInProgress,
    triggerEvent,
  ]);

  const beginEvolutionPresentationWhenReady = useCallback(async ({
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
    if (activeEvolutionKeyRef.current === key || pendingEvolutionKeysRef.current.has(key)) {
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
        toast.info("Your companion animation is still preparing. We'll keep trying in the background.");
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
        logger.warn("Evolution listener: Ignoring stage update without persisted evolution row", {
          companionId,
          previousLevel,
          level,
          ...missingEvolutionLog,
        });
        schedulePresentationRetry("missing_persisted_evolution");
        return false;
      }

      const readyEvolution = await waitForEvolutionAnimation({
        companionId,
        stage: level,
        initialMetadata: persistedEvolution,
      });

      if (!readyEvolution?.animationVideoUrl) {
        schedulePresentationRetry("animation_not_ready");
        return false;
      }

      presentationRetryNotifiedKeysRef.current.delete(key);
      pendingPreloadKeyRef.current = key;
      setPendingEvolutionData({
        companionId,
        previousLevel,
        level,
        previousImageUrl,
        imageUrl,
        animationVideoUrl: readyEvolution.animationVideoUrl,
        presetId,
        element,
      });
      queuedForPreload = true;
      return true;
    } finally {
      if (!queuedForPreload) {
        pendingEvolutionKeysRef.current.delete(key);
      }
      if (!queuedForPreload && !scheduledRetry && activeEvolutionKeyRef.current !== key) {
        setIsEvolvingLoading(false);
      }
    }
  }, [
    buildEvolutionKey,
    clearPresentationRetryTimer,
    setIsEvolvingLoading,
  ]);

  const handlePendingAnimationReady = useCallback(() => {
    const pending = pendingEvolutionData;
    if (!pending) return;

    const key = buildEvolutionKey(pending.companionId, pending.level);
    if (pendingPreloadKeyRef.current !== key) return;
    pendingPreloadKeyRef.current = null;
    setPendingEvolutionData(null);
    pendingEvolutionKeysRef.current.delete(key);

    const started = startEvolutionPresentation(pending);
    if (!started) {
      setIsEvolvingLoading(false);
      activeEvolutionKeyRef.current = null;
    }
  }, [
    buildEvolutionKey,
    pendingEvolutionData,
    setIsEvolvingLoading,
    startEvolutionPresentation,
  ]);

  const retryPendingAnimationPreload = useCallback((reason: string) => {
    const pending = pendingEvolutionData;
    if (!pending) return;

    const key = buildEvolutionKey(pending.companionId, pending.level);
    if (pendingPreloadKeyRef.current !== key) return;
    logger.warn("Evolution listener: Animation video could not be preloaded", {
      companionId: pending.companionId,
      level: pending.level,
      animationVideoUrl: pending.animationVideoUrl,
      reason,
    });
    toast.info("Your companion animation needs another pass. We'll try again.");

    pendingPreloadKeyRef.current = null;
    setPendingEvolutionData(null);
    pendingEvolutionKeysRef.current.delete(key);

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
  }, [
    beginEvolutionPresentationWhenReady,
    buildEvolutionKey,
    pendingEvolutionData,
  ]);

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
      queryClient.invalidateQueries({ queryKey: ["companion-evolution-image"] });
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

          const newLevel = typeof newData.current_stage === "number" ? newData.current_stage : null;
          const oldLevel = typeof oldData.current_stage === "number" ? oldData.current_stage : null;

          if (newLevel === null || oldLevel === null) {
            logger.warn("Evolution listener: Invalid stage values");
            return;
          }

          if (newLevel <= oldLevel) {
            return;
          }

          const companionId = typeof newData.id === "string" ? newData.id : null;
          if (!companionId) {
            logger.warn("Evolution listener: Missing companion id");
            return;
          }

          const evolutionKey = buildEvolutionKey(companionId, newLevel);
          pruneRecentLocalHatchKeys();

          const localHatchStartedAt = recentLocalHatchKeysRef.current.get(evolutionKey);
          if (localHatchStartedAt && Date.now() - localHatchStartedAt <= LOCAL_HATCH_DEDUPE_WINDOW_MS) {
            recentLocalHatchKeysRef.current.delete(evolutionKey);
            return;
          }

          const currentImageUrl = typeof newData.current_image_url === "string" ? newData.current_image_url : "";
          const element = typeof newData.core_element === "string" ? newData.core_element : undefined;
          const imageUrl = resolveCompanionVisualAssetUrl({
            preset_id: typeof newData.preset_id === "string" ? newData.preset_id : null,
            current_stage: newLevel,
            core_element: element ?? null,
            current_image_url: currentImageUrl,
            dormant_image_url: typeof newData.dormant_image_url === "string" ? newData.dormant_image_url : null,
            neglected_image_url: typeof newData.neglected_image_url === "string" ? newData.neglected_image_url : null,
          }) ?? currentImageUrl;
          const previousImageUrl = resolveCompanionVisualAssetUrl({
            preset_id: typeof oldData.preset_id === "string"
              ? oldData.preset_id
              : typeof newData.preset_id === "string"
                ? newData.preset_id
                : null,
            current_stage: oldLevel,
            core_element: typeof oldData.core_element === "string"
              ? oldData.core_element
              : element ?? null,
            current_image_url: typeof oldData.current_image_url === "string"
              ? oldData.current_image_url
              : currentImageUrl,
            dormant_image_url: typeof oldData.dormant_image_url === "string"
              ? oldData.dormant_image_url
              : typeof newData.dormant_image_url === "string"
                ? newData.dormant_image_url
                : null,
            neglected_image_url: typeof oldData.neglected_image_url === "string"
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
            presetId: typeof newData.preset_id === "string"
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
          logger.warn("Evolution listener subscription error", { status, error: err?.message });
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
        presetId: typeof detail.presetId === "string" ? detail.presetId : undefined,
        element: detail.element ?? undefined,
        dispatchLoadingStart: true,
        markAsLocalHatch: true,
      });
    };

    window.addEventListener(COMPANION_HATCH_STARTED_EVENT, handleHatchStarted as EventListener);
    return () => {
      window.removeEventListener(COMPANION_HATCH_STARTED_EVENT, handleHatchStarted as EventListener);
    };
  }, [beginEvolutionPresentationWhenReady, user]);

  return (
    <>
      {pendingEvolutionData && (
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
            const key = buildEvolutionKey(evolutionData.companionId, evolutionData.level);
            setIsEvolving(false);
            setEvolutionData(null);
            activeEvolutionKeyRef.current = null;
            pendingEvolutionKeysRef.current.delete(key);
            setIsEvolvingLoading(false);
            setEvolutionInProgress(false);
            toast.info("Your companion animation needs another pass. We'll try again.");
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
            setIsEvolving(false);
            setEvolutionData(null);
            activeEvolutionKeyRef.current = null;
            setIsEvolvingLoading(false);
            setEvolutionInProgress(false);

            if (onEvolutionComplete) {
              onEvolutionComplete();
            }
          }}
        />
      )}
    </>
  );
};
