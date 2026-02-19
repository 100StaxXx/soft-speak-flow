import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useAchievements } from "./useAchievements";
import { toast } from "sonner";
import { retryWithBackoff } from "@/utils/retry";
import { useRef, useMemo, useCallback, useEffect, useState } from "react";
import { useEvolution } from "@/contexts/EvolutionContext";
import { useEvolutionThresholds } from "./useEvolutionThresholds";
import { SYSTEM_XP_REWARDS } from "@/config/xpRewards";
import type { CreateCompanionIfNotExistsResult } from "@/types/referral-functions";
import { logger } from "@/utils/logger";
import { generateWithValidation } from "@/utils/validateCompanionImage";
import {
  isRetriableFunctionInvokeError,
  parseFunctionInvokeError,
  toUserFacingFunctionError,
} from "@/utils/supabaseFunctionErrors";
import { safeLocalStorage } from "@/utils/storage";

export interface Companion {
  id: string;
  user_id: string;
  favorite_color: string;
  spirit_animal: string;
  core_element: string;
  story_tone?: string;
  current_stage: number;
  current_xp: number;
  current_image_url: string | null;
  initial_image_url?: string | null;
  dormant_image_url?: string | null;
  eye_color?: string;
  fur_color?: string;
  cached_creature_name?: string | null;
  // New 6-stat system
  vitality?: number;
  wisdom?: number;
  discipline?: number;
  resolve?: number;
  creativity?: number;
  alignment?: number;
  current_mood?: string | null;
  last_mood_update?: string | null;
  last_activity_date?: string | null;
  last_energy_update?: string;
  inactive_days?: number;
  neglected_image_url?: string | null;
  image_regenerations_used?: number;
  created_at: string;
  updated_at: string;
}

export const XP_REWARDS = SYSTEM_XP_REWARDS;

export const getCompanionQueryKey = (userId: string | undefined) =>
  ["companion", userId] as const;

export const fetchCompanion = async (userId: string): Promise<Companion | null> => {
  const { data, error } = await supabase
    .from("user_companion")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data as Companion | null;
};

type EvolutionJobStatus = "queued" | "processing" | "succeeded" | "failed";

interface CompanionEvolutionJob {
  id: string;
  status: EvolutionJobStatus;
  requested_stage: number;
  requested_at: string;
  started_at: string | null;
  next_retry_at: string | null;
  error_code: string | null;
  error_message: string | null;
}

interface RequestCompanionEvolutionJobResult {
  job_id: string;
  status: EvolutionJobStatus;
  requested_stage: number;
}

interface EvolutionRequestRpcError {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

interface DirectEvolutionResponse {
  evolved?: boolean;
  message?: string;
  error?: string;
  code?: string;
  previous_stage?: number;
  new_stage?: number;
  image_url?: string;
  evolution_id?: string;
}

export type EvolutionServiceState = "ready" | "processing" | "degraded";

type EvolutionFailureClass = "terminal" | "retryable_infrastructure" | "non_retryable";

interface EvolutionResolvedFailure {
  message: string;
  allowDirectFallback: boolean;
  failureClass: EvolutionFailureClass;
  reason: string;
  code: string | null;
}

interface EvolutionAttemptContext {
  attempt_id: string;
  user_id: string;
  target_stage: number;
  evolution_phase: "rpc_request" | "direct_fallback" | "job_polling" | "complete";
  fallback_path: "none" | "job" | "direct" | "degraded";
  error_class: EvolutionFailureClass | null;
  error_category: string | null;
  error_status: number | null;
  error_code: string | null;
  rpc_error_code: string | null;
  invoke_status: number | null;
  invoke_category: string | null;
  job_id: string | null;
}

type EvolutionMutationResult =
  | { path: "job"; jobId: string }
  | { path: "direct"; newStage: number | null }
  | { path: "degraded"; retryAfterMs: number; reason: string }
  | null;

const isEvolutionJobStatus = (value: unknown): value is EvolutionJobStatus =>
  value === "queued" || value === "processing" || value === "succeeded" || value === "failed";

const parseCompositeJobTuple = (value: unknown) => {
  if (typeof value !== "string") return null;
  const match = value.match(/^\(([^,]+),([^,]+),([^,]+)\)$/);
  if (!match) return null;

  const parsedStatus = match[2]?.trim();
  const parsedStage = Number.parseInt(match[3]?.trim() ?? "", 10);
  if (!isEvolutionJobStatus(parsedStatus) || Number.isNaN(parsedStage)) {
    return null;
  }

  return {
    jobId: match[1]?.trim(),
    status: parsedStatus,
    requestedStage: parsedStage,
  };
};

const extractRequestedEvolutionJob = (
  data: RequestCompanionEvolutionJobResult[] | RequestCompanionEvolutionJobResult | null,
) => {
  const requestResult = Array.isArray(data) ? data[0] : data;
  if (!requestResult) return null;

  if (typeof requestResult !== "object") return null;

  const resultRecord = requestResult as Record<string, unknown>;
  const parsedComposite = parseCompositeJobTuple(resultRecord.request_companion_evolution_job);
  const rawJobId = typeof resultRecord.job_id === "string"
    ? resultRecord.job_id
    : typeof resultRecord.id === "string"
      ? resultRecord.id
      : parsedComposite?.jobId;
  const rawStatus = resultRecord.status ?? parsedComposite?.status;
  const rawRequestedStage = resultRecord.requested_stage ?? resultRecord.requestedStage ?? parsedComposite?.requestedStage;
  const parsedStage =
    typeof rawRequestedStage === "number"
      ? rawRequestedStage
      : typeof rawRequestedStage === "string"
        ? Number.parseInt(rawRequestedStage, 10)
        : NaN;

  if (!rawJobId || !isEvolutionJobStatus(rawStatus) || Number.isNaN(parsedStage)) {
    return null;
  }

  return {
    job_id: rawJobId,
    status: rawStatus,
    requested_stage: parsedStage,
  } satisfies RequestCompanionEvolutionJobResult;
};

const normalizeEvolutionErrorCode = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized.length > 0 ? normalized : null;
};

const resolveKnownTerminalEvolutionFailure = (
  normalizedSource: string,
): { code: string; message: string; category: "auth" | "xp" | "max_stage" | "duplicate" | "not_found" | "rate_limit" } | null => {
  if (normalizedSource.includes("not_enough_xp") || normalizedSource.includes("not enough xp")) {
    return {
      code: "not_enough_xp",
      message: "Your companion is not ready to evolve yet.",
      category: "xp",
    };
  }
  if (normalizedSource.includes("max_stage_reached") || normalizedSource.includes("max stage")) {
    return {
      code: "max_stage_reached",
      message: "Your companion has already reached the maximum stage.",
      category: "max_stage",
    };
  }
  if (normalizedSource.includes("already_evolved") || normalizedSource.includes("already evolved")) {
    return {
      code: "already_evolved",
      message: "Your companion already evolved to this stage.",
      category: "duplicate",
    };
  }
  if (normalizedSource.includes("companion_not_found") || normalizedSource.includes("companion not found")) {
    return {
      code: "companion_not_found",
      message: "No companion found to evolve.",
      category: "not_found",
    };
  }
  if (
    normalizedSource.includes("not_authenticated")
    || normalizedSource.includes("permission denied")
    || normalizedSource.includes("jwt")
    || normalizedSource.includes("unauthorized")
  ) {
    return {
      code: "unauthorized",
      message: "Your session has expired. Please sign in again and try evolving.",
      category: "auth",
    };
  }
  if (
    normalizedSource.includes("rate_limited")
    || normalizedSource.includes("rate limit")
    || normalizedSource.includes("too many requests")
    || normalizedSource.includes("429")
  ) {
    return {
      code: "rate_limited",
      message: "Evolution is on cooldown. Please try again in a little while.",
      category: "rate_limit",
    };
  }

  return null;
};

const isRetryableEvolutionInfrastructureSource = (normalizedSource: string) => (
  (normalizedSource.includes("request_companion_evolution_job")
    && (normalizedSource.includes("could not find") || normalizedSource.includes("schema cache")))
  || (normalizedSource.includes("companion_evolution_jobs") && normalizedSource.includes("does not exist"))
  || normalizedSource.includes("failed to fetch")
  || normalizedSource.includes("network")
  || normalizedSource.includes("timeout")
  || normalizedSource.includes("timed out")
  || normalizedSource.includes("temporarily unavailable")
  || normalizedSource.includes("relay")
  || normalizedSource.includes("service_unavailable")
);

const resolveEvolutionRequestError = (error: EvolutionRequestRpcError | null): EvolutionResolvedFailure => {
  const message = [
    error?.message,
    error?.code,
    error?.details,
    error?.hint,
  ]
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    .join(" ");
  const normalized = message.toLowerCase();
  const terminalFailure = resolveKnownTerminalEvolutionFailure(normalized);

  if (terminalFailure) {
    return {
      message: terminalFailure.message,
      allowDirectFallback: false,
      failureClass: "terminal",
      reason: terminalFailure.category,
      code: terminalFailure.code,
    };
  }

  if (isRetryableEvolutionInfrastructureSource(normalized)) {
    return {
      message: "Evolution service is temporarily unavailable. Please try again in a minute.",
      allowDirectFallback: true,
      failureClass: "retryable_infrastructure",
      reason: "rpc_infrastructure",
      code: normalizeEvolutionErrorCode(error?.code) ?? "evolution_service_unavailable",
    };
  }

  const fallbackMessage = message.length > 0
    ? evolutionRequestErrorMessage(message)
    : "Unable to start evolution right now. Please try again.";
  return {
    message: fallbackMessage,
    allowDirectFallback: true,
    failureClass: "non_retryable",
    reason: "rpc_unknown",
    code: normalizeEvolutionErrorCode(error?.code),
  };
};

const directEvolutionFailureMessage = (data: DirectEvolutionResponse | null) => {
  const source = [data?.code, data?.message, data?.error].filter(Boolean).join(" ").toLowerCase();
  if (source.includes("not enough xp")) return "Your companion is not ready to evolve yet.";
  if (source.includes("max stage")) return "Your companion has already reached the maximum stage.";
  if (source.includes("companion not found")) return "No companion found to evolve.";
  if (source.includes("rate limit")) return "Evolution is on cooldown. Please try again in a little while.";
  return "Unable to start evolution right now. Please try again.";
};

const resolveDirectEvolutionPayloadFailure = (data: DirectEvolutionResponse | null): EvolutionResolvedFailure => {
  const source = [data?.code, data?.message, data?.error].filter(Boolean).join(" ").toLowerCase();
  const terminalFailure = resolveKnownTerminalEvolutionFailure(source);
  if (terminalFailure) {
    return {
      message: terminalFailure.message,
      allowDirectFallback: false,
      failureClass: "terminal",
      reason: terminalFailure.category,
      code: terminalFailure.code,
    };
  }

  if (isRetryableEvolutionInfrastructureSource(source)) {
    return {
      message: "Evolution service is temporarily unavailable. Please try again in a minute.",
      allowDirectFallback: false,
      failureClass: "retryable_infrastructure",
      reason: "direct_payload_infrastructure",
      code: normalizeEvolutionErrorCode(data?.code) ?? "evolution_service_unavailable",
    };
  }

  return {
    message: directEvolutionFailureMessage(data),
    allowDirectFallback: false,
    failureClass: "non_retryable",
    reason: "direct_payload_terminal",
    code: normalizeEvolutionErrorCode(data?.code),
  };
};

interface ResolvedDirectInvokeFailure extends EvolutionResolvedFailure {
  invokeCategory: string;
  invokeStatus: number | null;
}

const resolveDirectEvolutionInvokeFailure = async (invokeError: unknown): Promise<ResolvedDirectInvokeFailure> => {
  const parsed = await parseFunctionInvokeError(invokeError);
  const backend = `${parsed.responsePayload?.code ?? ""} ${parsed.backendMessage ?? ""} ${parsed.message ?? ""}`.toLowerCase();
  const terminalFailure = resolveKnownTerminalEvolutionFailure(backend);

  if (terminalFailure) {
    return {
      message: terminalFailure.message,
      allowDirectFallback: false,
      failureClass: "terminal",
      reason: terminalFailure.category,
      code: terminalFailure.code,
      invokeCategory: parsed.category,
      invokeStatus: parsed.status ?? null,
    };
  }

  if (parsed.category === "auth") {
    return {
      message: "Your session has expired. Please sign in again and try evolving.",
      allowDirectFallback: false,
      failureClass: "terminal",
      reason: "auth",
      code: "unauthorized",
      invokeCategory: parsed.category,
      invokeStatus: parsed.status ?? null,
    };
  }

  if (parsed.category === "rate_limit") {
    return {
      message: "Evolution is on cooldown. Please try again in a little while.",
      allowDirectFallback: false,
      failureClass: "terminal",
      reason: "rate_limit",
      code: "rate_limited",
      invokeCategory: parsed.category,
      invokeStatus: parsed.status ?? null,
    };
  }

  if (
    parsed.category === "network"
    || parsed.category === "relay"
    || parsed.status === 408
    || (typeof parsed.status === "number" && parsed.status >= 500)
  ) {
    return {
      message: "Evolution service is temporarily unavailable. Please try again in a minute.",
      allowDirectFallback: false,
      failureClass: "retryable_infrastructure",
      reason: "invoke_infrastructure",
      code: normalizeEvolutionErrorCode(parsed.responsePayload?.code ?? parsed.code) ?? "evolution_service_unavailable",
      invokeCategory: parsed.category,
      invokeStatus: parsed.status ?? null,
    };
  }

  return {
    message: toUserFacingFunctionError(parsed, { action: "start evolution" }),
    allowDirectFallback: false,
    failureClass: "non_retryable",
    reason: "invoke_unknown",
    code: normalizeEvolutionErrorCode(parsed.responsePayload?.code ?? parsed.code),
    invokeCategory: parsed.category,
    invokeStatus: parsed.status ?? null,
  };
};

const normalizeEvolutionError = async (error: unknown): Promise<Error> => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error;
  }

  const parsed = await parseFunctionInvokeError(error);
  const message = toUserFacingFunctionError(parsed, { action: "start evolution" });
  return new Error(message);
};

const ACTIVE_EVOLUTION_JOB_STORAGE_PREFIX = "companion:evolution:active-job";
const EVOLUTION_READY_STORAGE_PREFIX = "companion:evolution:ready";
const EVOLUTION_ETA_DELAY_MS = 75_000;
const EVOLUTION_DEGRADED_COOLDOWN_MS = 60_000;
const EVOLUTION_DEGRADED_RETRY_AFTER_MS = 60_000;
const EVOLUTION_DEGRADED_NOTICE = "Evolution is busy right now. Try again in about a minute.";
const EVOLUTION_RPC_MAX_ATTEMPTS = 3;
const EVOLUTION_DIRECT_MAX_ATTEMPTS = 2;
const EVOLUTION_RETRY_DELAYS_MS = [400, 900];

const waitForEvolutionRetry = async (delayMs: number) => {
  const effectiveDelayMs = import.meta.env.MODE === "test" ? 0 : delayMs;
  await new Promise((resolve) => setTimeout(resolve, effectiveDelayMs));
};

const getEvolutionRetryDelayMs = (attempt: number) => {
  const index = Math.max(0, Math.min(attempt - 1, EVOLUTION_RETRY_DELAYS_MS.length - 1));
  return EVOLUTION_RETRY_DELAYS_MS[index] ?? EVOLUTION_RETRY_DELAYS_MS[EVOLUTION_RETRY_DELAYS_MS.length - 1];
};

const createEvolutionAttemptId = () => (
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `evolution-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
);

const seenFailedJobToasts = new Set<string>();
const seenSucceededJobToasts = new Set<string>();
const lastEvolutionWorkerKickoffAt = new Map<string, number>();

const getEvolutionJobQueryKey = (userId: string | undefined) =>
  ["companion-evolution-job", userId] as const;

const getEvolutionReadyQueryKey = (userId: string | undefined) =>
  ["companion-evolution-ready", userId] as const;

const getActiveEvolutionJobStorageKey = (userId: string) =>
  `${ACTIVE_EVOLUTION_JOB_STORAGE_PREFIX}:${userId}`;

const getEvolutionReadyStorageKey = (userId: string) =>
  `${EVOLUTION_READY_STORAGE_PREFIX}:${userId}`;

const readStoredActiveEvolutionJobId = (userId: string) =>
  safeLocalStorage.getItem(getActiveEvolutionJobStorageKey(userId));

const writeStoredActiveEvolutionJobId = (userId: string, jobId: string) => {
  safeLocalStorage.setItem(getActiveEvolutionJobStorageKey(userId), jobId);
};

const clearStoredActiveEvolutionJobId = (userId: string) => {
  safeLocalStorage.removeItem(getActiveEvolutionJobStorageKey(userId));
};

const readEvolutionReadyFlag = (userId: string) =>
  safeLocalStorage.getItem(getEvolutionReadyStorageKey(userId)) === "true";

const writeEvolutionReadyFlag = (userId: string, value: boolean) => {
  if (value) {
    safeLocalStorage.setItem(getEvolutionReadyStorageKey(userId), "true");
    return;
  }
  safeLocalStorage.removeItem(getEvolutionReadyStorageKey(userId));
};

const fetchTrackedEvolutionJob = async (userId: string): Promise<CompanionEvolutionJob | null> => {
  const trackedJobId = readStoredActiveEvolutionJobId(userId);

  if (trackedJobId) {
    const { data, error } = await supabase
      .from("companion_evolution_jobs")
      .select("id, status, requested_stage, requested_at, started_at, next_retry_at, error_code, error_message")
      .eq("id", trackedJobId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      clearStoredActiveEvolutionJobId(userId);
      return null;
    }
    return data as CompanionEvolutionJob;
  }

  const { data, error } = await supabase
    .from("companion_evolution_jobs")
    .select("id, status, requested_stage, requested_at, started_at, next_retry_at, error_code, error_message")
    .eq("user_id", userId)
    .in("status", ["queued", "processing"])
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  writeStoredActiveEvolutionJobId(userId, data.id);
  return data as CompanionEvolutionJob;
};

const evolutionRequestErrorMessage = (errorMessage: string) => {
  const normalized = errorMessage.toLowerCase();
  if (normalized.includes("not_enough_xp")) return "Your companion is not ready to evolve yet.";
  if (normalized.includes("max_stage_reached")) return "Your companion has already reached the maximum stage.";
  if (normalized.includes("already_evolved")) return "Your companion already evolved to this stage.";
  if (normalized.includes("companion_not_found")) return "No companion found to evolve.";
  if (
    normalized.includes("request_companion_evolution_job")
    && (normalized.includes("could not find") || normalized.includes("schema cache"))
  ) {
    return "Evolution service is temporarily unavailable. Please try again in a minute.";
  }
  if (normalized.includes("companion_evolution_jobs") && normalized.includes("does not exist")) {
    return "Evolution service is temporarily unavailable. Please try again in a minute.";
  }
  if (normalized.includes("failed to fetch") || normalized.includes("network")) {
    return "Unable to reach evolution service. Check your connection and try again.";
  }
  return "Unable to start evolution right now. Please try again.";
};

const evolutionJobErrorMessage = (job: CompanionEvolutionJob) => {
  const code = (job.error_code ?? "").toLowerCase();
  if (code.includes("rate_limited")) return "Evolution is on cooldown. Please try again in a little while.";
  if (code.includes("not_enough_xp")) return "Your companion is not ready to evolve yet.";
  if (code.includes("max_stage_reached")) return "Your companion has already reached the maximum stage.";
  if (code.includes("companion_not_found")) return "We couldn't find your companion. Refresh and try again.";
  if (job.error_message) return "Evolution failed. Please try again.";
  return "Unable to evolve your companion right now. Please try again.";
};

export const useCompanion = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { checkCompanionAchievements } = useAchievements();
  const { isEvolvingLoading, setIsEvolvingLoading } = useEvolution();
  const { getThreshold, shouldEvolve } = useEvolutionThresholds();

  // Prevent duplicate evolution/XP/companion creation requests during lag
  const evolutionInProgress = useRef(false);
  const evolutionPromise = useRef<Promise<unknown> | null>(null);
  const companionCreationInProgress = useRef(false);
  const lastEvolutionDegradedNoticeAt = useRef(0);
  const [evolutionServiceNotice, setEvolutionServiceNotice] = useState<string | null>(null);

  const { data: companion, isLoading, error, refetch } = useQuery({
    queryKey: getCompanionQueryKey(user?.id),
    queryFn: async () => {
      if (!user) return null;

      return fetchCompanion(user.id);
    },
    enabled: !!user,
    staleTime: 60000, // 1 minute - prevents unnecessary refetches and tab flash
    gcTime: 30 * 60 * 1000, // Keep companion cache warm across tab switches
    placeholderData: (previousData) => previousData,
    retry: 3, // Increased from 2 to 3 for better reliability after onboarding
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Exponential backoff
  });

  const [etaNow, setEtaNow] = useState(() => Date.now());

  const setEvolutionReady = useCallback(
    (value: boolean) => {
      if (!user?.id) return;
      writeEvolutionReadyFlag(user.id, value);
      queryClient.setQueryData(getEvolutionReadyQueryKey(user.id), value);
    },
    [queryClient, user?.id],
  );

  const { data: hasEvolutionReady = false } = useQuery({
    queryKey: getEvolutionReadyQueryKey(user?.id),
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return false;
      return readEvolutionReadyFlag(user.id);
    },
    initialData: user?.id ? readEvolutionReadyFlag(user.id) : false,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const { data: trackedEvolutionJob = null } = useQuery({
    queryKey: getEvolutionJobQueryKey(user?.id),
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return null;
      return fetchTrackedEvolutionJob(user.id);
    },
    staleTime: 1000,
    refetchInterval: (query) => {
      const job = query.state.data as CompanionEvolutionJob | null;
      if (!job) return false;
      return job.status === "queued" || job.status === "processing" ? 3000 : false;
    },
  });

  const hasActiveEvolutionJob = Boolean(
    trackedEvolutionJob &&
      (trackedEvolutionJob.status === "queued" || trackedEvolutionJob.status === "processing"),
  );

  useEffect(() => {
    if (!hasActiveEvolutionJob) return undefined;

    const intervalId = window.setInterval(() => {
      setEtaNow(Date.now());
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [hasActiveEvolutionJob]);

  useEffect(() => {
    if (!user?.id || !trackedEvolutionJob) return;

    if (trackedEvolutionJob.status === "queued" || trackedEvolutionJob.status === "processing") {
      writeStoredActiveEvolutionJobId(user.id, trackedEvolutionJob.id);
      setIsEvolvingLoading(true);
      return;
    }

    clearStoredActiveEvolutionJobId(user.id);
    lastEvolutionWorkerKickoffAt.delete(trackedEvolutionJob.id);

    if (trackedEvolutionJob.status === "succeeded") {
      setEvolutionReady(true);
      setIsEvolvingLoading(false);

      if (!seenSucceededJobToasts.has(trackedEvolutionJob.id)) {
        toast.success("Your companion evolved. Tap Companion to see the new form.");
        seenSucceededJobToasts.add(trackedEvolutionJob.id);
      }

      queryClient.invalidateQueries({ queryKey: ["companion"] });
      queryClient.invalidateQueries({ queryKey: ["companion-stories-all"] });
      queryClient.invalidateQueries({ queryKey: ["evolution-cards"] });
      queryClient.invalidateQueries({ queryKey: ["current-evolution-card"] });
      queryClient.setQueryData(getEvolutionJobQueryKey(user.id), null);
      return;
    }

    setIsEvolvingLoading(false);

    if (!seenFailedJobToasts.has(trackedEvolutionJob.id)) {
      toast.error(evolutionJobErrorMessage(trackedEvolutionJob));
      seenFailedJobToasts.add(trackedEvolutionJob.id);
    }
    queryClient.setQueryData(getEvolutionJobQueryKey(user.id), null);
  }, [queryClient, setEvolutionReady, setIsEvolvingLoading, trackedEvolutionJob, user?.id]);

  useEffect(() => {
    if (!user?.id || !trackedEvolutionJob) return undefined;
    if (!(trackedEvolutionJob.status === "queued" || trackedEvolutionJob.status === "processing")) {
      return undefined;
    }

    let disposed = false;

    const maybeInvokeWorker = async () => {
      if (disposed) return;

      if (trackedEvolutionJob.status === "queued" && trackedEvolutionJob.next_retry_at) {
        const nextRetryMs = Date.parse(trackedEvolutionJob.next_retry_at);
        if (Number.isFinite(nextRetryMs) && Date.now() < nextRetryMs) {
          return;
        }
      }

      const nowMs = Date.now();
      const lastKickoffMs = lastEvolutionWorkerKickoffAt.get(trackedEvolutionJob.id) ?? 0;
      if (nowMs - lastKickoffMs < 8000) {
        return;
      }

      lastEvolutionWorkerKickoffAt.set(trackedEvolutionJob.id, nowMs);

      try {
        await supabase.functions.invoke("process-companion-evolution-job", {
          body: {
            jobId: trackedEvolutionJob.id,
          },
        });
      } catch (workerError) {
        logger.warn("Background evolution worker kick failed; will retry", {
          jobId: trackedEvolutionJob.id,
          evolution_phase: "job_polling",
          rpc_error_code: null,
          invoke_status: null,
          invoke_category: "worker_kickoff",
          fallback_path: "job",
          job_id: trackedEvolutionJob.id,
          error: workerError instanceof Error ? workerError.message : String(workerError),
        });
      }
    };

    void maybeInvokeWorker();

    const intervalId = window.setInterval(() => {
      void maybeInvokeWorker();
    }, 15000);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, [trackedEvolutionJob, user?.id]);

  const evolutionEtaMessage = useMemo(() => {
    if (!hasActiveEvolutionJob || !trackedEvolutionJob) return null;

    const baselineTimestamp = trackedEvolutionJob.started_at ?? trackedEvolutionJob.requested_at;
    const baselineMs = Date.parse(baselineTimestamp);
    const elapsedMs = Number.isFinite(baselineMs) ? Math.max(0, etaNow - baselineMs) : 0;

    if (elapsedMs >= EVOLUTION_ETA_DELAY_MS) {
      return "Taking longer than usual, can take up to ~2 minutes";
    }

    return "About 1 minute";
  }, [etaNow, hasActiveEvolutionJob, trackedEvolutionJob]);

  const publishEvolutionDegradedNotice = useCallback((notice: string | null) => {
    const safeNotice = typeof notice === "string" && notice.trim().length > 0
      ? notice.trim()
      : EVOLUTION_DEGRADED_NOTICE;
    const nowMs = Date.now();

    setEvolutionServiceNotice((currentNotice) => {
      const withinCooldown = nowMs - lastEvolutionDegradedNoticeAt.current < EVOLUTION_DEGRADED_COOLDOWN_MS;
      if (withinCooldown && currentNotice) {
        return currentNotice;
      }

      lastEvolutionDegradedNoticeAt.current = nowMs;
      return safeNotice;
    });
  }, []);

  useEffect(() => {
    if (!evolutionServiceNotice) return undefined;

    const elapsedMs = Date.now() - lastEvolutionDegradedNoticeAt.current;
    const remainingMs = Math.max(0, EVOLUTION_DEGRADED_COOLDOWN_MS - elapsedMs);
    const timeoutId = window.setTimeout(() => {
      setEvolutionServiceNotice(null);
    }, remainingMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [evolutionServiceNotice]);

  const clearEvolutionReadyIndicator = useCallback(() => {
    setEvolutionReady(false);
  }, [setEvolutionReady]);

  const createCompanion = useMutation({
    mutationFn: async (data: {
      favoriteColor: string;
      spiritAnimal: string;
      coreElement: string;
      storyTone: string;
    }) => {
      const creationStartedAt = Date.now();
      if (!user) throw new Error("Not authenticated");

      // Prevent duplicate companion creation during rapid clicks
      if (companionCreationInProgress.current) {
        throw new Error("Companion creation already in progress");
      }
      companionCreationInProgress.current = true;

      try {
        logger.log("Starting companion creation process...");
        logger.info("Companion creation started", {
          userId: user.id,
          spiritAnimal: data.spiritAnimal,
          coreElement: data.coreElement,
          stage: 0,
        });

        // Determine consistent colors for the companion's lifetime
        const eyeColor = `glowing ${data.favoriteColor}`;
        const furColor = data.favoriteColor;

        // Generate initial companion image with validation (retries on anatomical issues)
        logger.log("Generating companion image with validation...");
        const { imageUrl, validationPassed, retryCount } = await generateWithValidation(
          {
            favoriteColor: data.favoriteColor,
            spiritAnimal: data.spiritAnimal,
            element: data.coreElement,
            stage: 0,
            eyeColor,
            furColor,
            storyTone: data.storyTone,
          },
          {
            // Adaptive retry policy: onboarding (stage 0) prioritizes reliability/latency.
            maxRetries: 1,
            onRetry: (attempt) => {
              logger.log(`Validation failed, retrying image generation (attempt ${attempt})...`);
            },
            onValidating: () => {
              logger.log("Validating generated image for anatomical issues...");
            },
          }
        );

        if (retryCount > 0) {
          logger.log(`Image generated after ${retryCount} validation retry(ies), passed: ${validationPassed}`);
        } else {
          logger.log(`Image generated on first attempt, validation passed: ${validationPassed}`);
        }

        const imageData = { imageUrl };

        logger.log("Image generated successfully, creating companion record...");

        // Use atomic database function to create companion (prevents duplicates)
        const result = await supabase.rpc('create_companion_if_not_exists', {
          p_user_id: user.id,
          p_favorite_color: data.favoriteColor,
          p_spirit_animal: data.spiritAnimal,
          p_core_element: data.coreElement,
          p_story_tone: data.storyTone,
          p_current_image_url: imageData.imageUrl,
          p_initial_image_url: imageData.imageUrl,
          p_eye_color: eyeColor,
          p_fur_color: furColor,
        }) as { data: CreateCompanionIfNotExistsResult[] | null; error: Error | null };

        if (result.error) {
          console.error("Database error creating companion:", result.error);
          throw new Error(`Failed to save companion to database: ${result.error.message}`);
        }
        
        const companionResult = result.data;

        logger.log("RPC call successful, result:", companionResult);
      
      if (!companionResult || companionResult.length === 0) {
        logger.error("No companion data returned from function");
        throw new Error("Failed to create companion record. Please try again.");
      }

      const companionData = companionResult[0] as unknown as CreateCompanionIfNotExistsResult;
      const isNewCompanion = companionData.is_new;

      logger.log(`Companion ${isNewCompanion ? 'created' : 'already exists'}:`, companionData.id);

      // Check if stage 0 evolution exists (regardless of whether companion is new)
      const { data: existingEvolution } = await supabase
        .from("companion_evolutions")
        .select("id")
        .eq("companion_id", companionData.id)
        .eq("stage", 0)
        .maybeSingle();

      // Create stage 0 evolution if missing
      if (!existingEvolution) {
        logger.log("Creating stage 0 evolution...");
        const { data: stageZeroEvolution, error: stageZeroInsertError } = await supabase
          .from("companion_evolutions")
          .insert({
            companion_id: companionData.id,
            stage: 0,
            image_url: imageData.imageUrl,
            xp_at_evolution: 0,
          })
          .select()
          .maybeSingle();

        if (stageZeroInsertError) {
          console.error("Failed to create stage 0 evolution:", stageZeroInsertError);
          throw new Error(`Unable to record stage 0 evolution: ${stageZeroInsertError.message}`);
        }

        if (!stageZeroEvolution) {
          console.error("Stage 0 evolution insert returned no data");
          throw new Error("Unable to record stage 0 evolution");
        }

        // Generate stage 0 card in background (don't await - don't block onboarding)
        const generateStageZeroCard = async () => {
          try {
            const { data: fullCompanionData } = await supabase
              .from("user_companion")
              .select("*")
              .eq("id", companionData.id)
              .single();

            await supabase.functions.invoke("generate-evolution-card", {
              body: {
                companionId: companionData.id,
                evolutionId: stageZeroEvolution.id,
                stage: 0,
                species: companionData.spirit_animal,
                element: companionData.core_element,
                color: companionData.favorite_color,
                userAttributes: {
                  vitality: fullCompanionData?.vitality || 300,
                  wisdom: fullCompanionData?.wisdom || 300,
                  discipline: fullCompanionData?.discipline || 300,
                  resolve: fullCompanionData?.resolve || 300,
                  creativity: fullCompanionData?.creativity || 300,
                  alignment: fullCompanionData?.alignment || 300,
                },
              },
            });
            queryClient.invalidateQueries({ queryKey: ["evolution-cards"] });
          } catch (cardError) {
            console.error("Stage 0 card generation failed (non-critical):", cardError);
          }
        };

        generateStageZeroCard(); // Fire and forget - don't block onboarding
      }

      // Generate story only for new companions
      if (isNewCompanion) {
        // Auto-generate the first chapter of the companion's story in background with retry
        const generateStoryWithRetry = async (attempts = 3) => {
          for (let attempt = 1; attempt <= attempts; attempt++) {
            try {
              const { error } = await supabase.functions.invoke('generate-companion-story', {
                body: {
                  companionId: companionData.id,
                  stage: 0,
                }
              });

              if (error) throw error;

              logger.log("Stage 0 story generation started");
              queryClient.invalidateQueries({ queryKey: ["companion-story"] });
              queryClient.invalidateQueries({ queryKey: ["companion-stories-all"] });
              return;
            } catch (storyError) {
              const errorMessage = storyError instanceof Error ? storyError.message : String(storyError);
              const isTransient = errorMessage.includes('network') ||
                                 errorMessage.includes('timeout') ||
                                 errorMessage.includes('temporarily unavailable');

              if (attempt < attempts && isTransient) {
                logger.log(`Story generation attempt ${attempt} failed, retrying...`);
                await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
                continue;
              }

              console.error(`Failed to auto-generate stage 0 story after ${attempt} attempts:`, storyError);
              break;
            }
          }
        };

        // Start story generation in background (don't await)
        generateStoryWithRetry().catch((error) => {
          console.warn('Story generation failed (non-critical):', error?.message || error);
        });
      }

      logger.info("Companion creation completed", {
        userId: user.id,
        durationMs: Date.now() - creationStartedAt,
      });
      return companionData;
      } catch (error) {
        // Reset flag on error
        companionCreationInProgress.current = false;
        logger.error("Companion creation mutation failed", {
          userId: user.id,
          durationMs: Date.now() - creationStartedAt,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    onSuccess: () => {
      companionCreationInProgress.current = false;
      queryClient.invalidateQueries({ queryKey: ["companion"] });
      logger.log("Companion creation successful!");
      // Don't show toast here - let the parent component handle success message
    },
    onError: (error) => {
      companionCreationInProgress.current = false;
      console.error("Failed to create companion:", error);
      // Don't show toast here - let the parent component handle error display
    },
  });

  const awardXP = useMutation({
    mutationFn: async ({
      eventType,
      xpAmount,
      metadata = {},
      idempotencyKey,
    }: {
      eventType: string;
      xpAmount: number;
      metadata?: Record<string, string | number | boolean | undefined>;
      idempotencyKey?: string;
    }) => {
      if (!user) throw new Error("No user found");

      // Ensure companion is loaded before awarding XP
      let companionToUse = companion;

      if (!companionToUse) {
        logger.warn('Companion not loaded yet, fetching...');
        await queryClient.refetchQueries({ queryKey: ["companion", user.id] });
        companionToUse = queryClient.getQueryData(["companion", user.id]) as Companion | null;

        if (!companionToUse) {
          throw new Error("No companion found. Please create one first.");
        }
      }

      return await performXPAward(companionToUse, xpAmount, eventType, metadata, user, idempotencyKey);
    },
    onSuccess: async ({ shouldEvolve, newStage }) => {
      queryClient.invalidateQueries({ queryKey: ["companion"] });
      
      if (shouldEvolve) {
        // Check for companion stage achievements
        await checkCompanionAchievements(newStage);
        
        // Show notification that evolution is available - but DON'T auto-trigger
        toast.success("✨ Your companion is ready to evolve! Visit your companion page.", {
          duration: 5000,
        });
      }
    },
    onError: (error) => {
      console.error('XP award failed:', error);
      toast.error("Failed to award XP. Please try again.");
    },
  });

  // Helper function to perform XP award logic
  const performXPAward = async (
    companionData: Companion,
    xpAmount: number,
    eventType: string,
    metadata: Record<string, string | number | boolean | undefined>,
    currentUser: typeof user,
    idempotencyKey?: string
  ) => {
    if (!currentUser?.id) {
      throw new Error("Not authenticated");
    }

    const sanitizedMetadata = Object.fromEntries(
      Object.entries(metadata).filter(([, value]) => value !== undefined),
    ) as Record<string, string | number | boolean>;
    const requestIdempotencyKey = idempotencyKey ?? (
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    );

    const { data, error } = await supabase.rpc("award_xp_v2", {
      p_event_type: eventType,
      p_xp_amount: xpAmount,
      p_event_metadata: sanitizedMetadata,
      p_idempotency_key: requestIdempotencyKey,
    });

    if (error) throw error;

    const awardResult = Array.isArray(data) ? data[0] : data;
    if (!awardResult) {
      throw new Error("XP award returned no data");
    }

    const shouldEvolveNow = Boolean(awardResult.should_evolve);
    const newXP = awardResult.xp_after ?? companionData.current_xp;
    const newStage = shouldEvolveNow ? companionData.current_stage + 1 : companionData.current_stage;

    logger.log("[XP Award Debug]", {
      eventType,
      requestedXP: xpAmount,
      awardedXP: awardResult.xp_awarded,
      capApplied: awardResult.cap_applied,
      currentStage: companionData.current_stage,
      currentXP: awardResult.xp_before,
      newXP,
      nextThreshold: awardResult.next_threshold,
      shouldEvolve: shouldEvolveNow,
      idempotencyKey: requestIdempotencyKey,
    });

    return {
      shouldEvolve: shouldEvolveNow,
      newStage,
      newXP,
      xpAwarded: awardResult.xp_awarded ?? 0,
      capApplied: Boolean(awardResult.cap_applied),
      nextThreshold: awardResult.next_threshold ?? null,
    };
  };

  const evolveCompanion = useMutation<EvolutionMutationResult, Error, { newStage: number; currentXP: number }>({
    mutationFn: async ({ newStage, currentXP: _currentXP }: { newStage: number; currentXP: number }) => {
      // Prevent duplicate evolution requests - wait for any ongoing evolution
      if (evolutionInProgress.current) {
        logger.log("Evolution already in progress, rejecting duplicate request");
        if (evolutionPromise.current) {
          // Wait for existing evolution to complete
          await evolutionPromise.current;
        }
        // Return null to indicate this call was skipped
        return null;
      }

      // Set flag immediately before any async operations
      evolutionInProgress.current = true;

      // Create a promise to track this evolution
      const evolutionExecution = (async () => {
        if (!user || !companion) {
          evolutionInProgress.current = false;
          throw new Error("No companion found");
        }

        const attemptContext: EvolutionAttemptContext = {
          attempt_id: createEvolutionAttemptId(),
          user_id: user.id,
          target_stage: newStage,
          evolution_phase: "rpc_request",
          fallback_path: "none",
          error_class: null,
          error_category: null,
          error_status: null,
          error_code: null,
          rpc_error_code: null,
          invoke_status: null,
          invoke_category: null,
          job_id: null,
        };

        const updateAttemptContext = (updates: Partial<EvolutionAttemptContext>) => {
          Object.assign(attemptContext, updates);
        };

        const currentAttemptContext = () => ({ ...attemptContext });

        if (trackedEvolutionJob && (trackedEvolutionJob.status === "queued" || trackedEvolutionJob.status === "processing")) {
          updateAttemptContext({
            evolution_phase: "job_polling",
            fallback_path: "job",
            job_id: trackedEvolutionJob.id,
          });
          writeStoredActiveEvolutionJobId(user.id, trackedEvolutionJob.id);
          setEvolutionReady(false);
          setIsEvolvingLoading(true);
          return { path: "job", jobId: trackedEvolutionJob.id } satisfies EvolutionMutationResult;
        }

        setIsEvolvingLoading(true);

        try {
          let requestFailure: EvolutionResolvedFailure | null = null;
          let resolvedJob: RequestCompanionEvolutionJobResult | null = null;

          for (let attempt = 1; attempt <= EVOLUTION_RPC_MAX_ATTEMPTS; attempt += 1) {
            const { data, error: requestError } = await (supabase.rpc as unknown as (
              name: string,
            ) => Promise<{ data: RequestCompanionEvolutionJobResult[] | RequestCompanionEvolutionJobResult | null; error: EvolutionRequestRpcError | null }>)(
              "request_companion_evolution_job",
            );

            if (!requestError) {
              const requestResult = extractRequestedEvolutionJob(data);
              resolvedJob = requestResult;

              if (!resolvedJob) {
                logger.warn("Evolution request returned unexpected payload; attempting active-job recovery", {
                  ...currentAttemptContext(),
                  payloadType: Array.isArray(data) ? "array" : typeof data,
                  hasPayload: Boolean(data),
                });

                const fallbackActiveJob = await fetchTrackedEvolutionJob(user.id);
                if (fallbackActiveJob && (fallbackActiveJob.status === "queued" || fallbackActiveJob.status === "processing")) {
                  resolvedJob = {
                    job_id: fallbackActiveJob.id,
                    status: fallbackActiveJob.status,
                    requested_stage: fallbackActiveJob.requested_stage,
                  };
                }
              }

              break;
            }

            const resolvedFailure = resolveEvolutionRequestError(requestError);
            requestFailure = resolvedFailure;

            updateAttemptContext({
              error_class: resolvedFailure.failureClass,
              error_category: "rpc",
              error_code: resolvedFailure.code ?? normalizeEvolutionErrorCode(requestError.code),
              rpc_error_code: normalizeEvolutionErrorCode(requestError.code),
            });

            const shouldRetryRpc =
              resolvedFailure.failureClass === "retryable_infrastructure"
              && attempt < EVOLUTION_RPC_MAX_ATTEMPTS;

            logger.warn("Evolution job request RPC returned error; attempting fallback", {
              ...currentAttemptContext(),
              attempt,
              max_attempts: EVOLUTION_RPC_MAX_ATTEMPTS,
              retrying: shouldRetryRpc,
              code: requestError.code ?? null,
              message: requestError.message ?? null,
              details: requestError.details ?? null,
              hint: requestError.hint ?? null,
              fallbackAllowed: resolvedFailure.allowDirectFallback,
              fallbackReason: resolvedFailure.message,
            });

            if (resolvedFailure.failureClass === "terminal" || !resolvedFailure.allowDirectFallback) {
              throw new Error(resolvedFailure.message);
            }

            if (shouldRetryRpc) {
              await waitForEvolutionRetry(getEvolutionRetryDelayMs(attempt));
              continue;
            }

            break;
          }

          if (resolvedJob?.job_id) {
            const createdJob: CompanionEvolutionJob = {
              id: resolvedJob.job_id,
              status: resolvedJob.status,
              requested_stage: resolvedJob.requested_stage,
              requested_at: new Date().toISOString(),
              started_at: null,
              next_retry_at: null,
              error_code: null,
              error_message: null,
            };

            updateAttemptContext({
              evolution_phase: "job_polling",
              fallback_path: "job",
              job_id: createdJob.id,
              error_class: null,
              error_category: null,
              error_status: null,
              error_code: null,
            });

            writeStoredActiveEvolutionJobId(user.id, createdJob.id);
            setEvolutionReady(false);
            queryClient.setQueryData(getEvolutionJobQueryKey(user.id), createdJob);

            try {
              await retryWithBackoff(
                async () => {
                  const { error: processError } = await supabase.functions.invoke("process-companion-evolution-job", {
                    body: {
                      jobId: createdJob.id,
                    },
                  });

                  if (processError) throw processError;
                },
                {
                  maxAttempts: 2,
                  initialDelay: 500,
                  maxDelay: 1500,
                  shouldRetry: isRetriableFunctionInvokeError,
                },
              );
            } catch (workerInvokeError) {
              logger.warn("Async evolution worker invoke failed; polling will continue", {
                ...currentAttemptContext(),
                evolution_phase: "job_polling",
                fallback_path: "job",
                job_id: createdJob.id,
                error: workerInvokeError instanceof Error ? workerInvokeError.message : String(workerInvokeError),
              });
            }

            return { path: "job", jobId: createdJob.id };
          }

          updateAttemptContext({
            evolution_phase: "direct_fallback",
            fallback_path: "direct",
          });

          logger.warn("Evolution job request unavailable; attempting direct evolution fallback", {
            ...currentAttemptContext(),
            reason: requestFailure?.reason ?? "no_job_id",
          });

          for (let attempt = 1; attempt <= EVOLUTION_DIRECT_MAX_ATTEMPTS; attempt += 1) {
            const { data: directEvolutionData, error: directEvolutionError } = await supabase.functions.invoke(
              "generate-companion-evolution",
              { body: {} },
            );

            if (directEvolutionError) {
              const invokeFailure = await resolveDirectEvolutionInvokeFailure(directEvolutionError);
              const shouldRetryInvoke =
                invokeFailure.failureClass === "retryable_infrastructure"
                && attempt < EVOLUTION_DIRECT_MAX_ATTEMPTS;

              updateAttemptContext({
                error_class: invokeFailure.failureClass,
                error_category: "invoke",
                error_status: invokeFailure.invokeStatus,
                error_code: invokeFailure.code,
                invoke_status: invokeFailure.invokeStatus,
                invoke_category: invokeFailure.invokeCategory,
              });

              logger.warn("Direct evolution fallback invoke failed", {
                ...currentAttemptContext(),
                attempt,
                max_attempts: EVOLUTION_DIRECT_MAX_ATTEMPTS,
                retrying: shouldRetryInvoke,
                reason: invokeFailure.reason,
              });

              if (invokeFailure.failureClass === "terminal") {
                throw new Error(invokeFailure.message);
              }

              if (shouldRetryInvoke) {
                await waitForEvolutionRetry(getEvolutionRetryDelayMs(attempt));
                continue;
              }

              if (invokeFailure.failureClass === "retryable_infrastructure") {
                updateAttemptContext({
                  evolution_phase: "complete",
                  fallback_path: "degraded",
                });
                logger.warn("Evolution request moved to degraded mode", {
                  ...currentAttemptContext(),
                  retry_after_ms: EVOLUTION_DEGRADED_RETRY_AFTER_MS,
                  reason: invokeFailure.reason,
                });
                return {
                  path: "degraded",
                  retryAfterMs: EVOLUTION_DEGRADED_RETRY_AFTER_MS,
                  reason: EVOLUTION_DEGRADED_NOTICE,
                };
              }

              throw new Error(invokeFailure.message);
            }

            const directResult = (directEvolutionData ?? null) as DirectEvolutionResponse | null;
            if (!directResult || directResult.evolved !== true) {
              const directFailure = resolveDirectEvolutionPayloadFailure(directResult);
              const shouldRetryPayload =
                directFailure.failureClass === "retryable_infrastructure"
                && attempt < EVOLUTION_DIRECT_MAX_ATTEMPTS;

              updateAttemptContext({
                error_class: directFailure.failureClass,
                error_category: "direct_payload",
                error_status: 200,
                error_code: directFailure.code,
                invoke_status: 200,
                invoke_category: "http",
              });

              logger.warn("Direct evolution fallback returned unsuccessful response", {
                ...currentAttemptContext(),
                attempt,
                max_attempts: EVOLUTION_DIRECT_MAX_ATTEMPTS,
                retrying: shouldRetryPayload,
                reason: directFailure.reason,
              });

              if (directFailure.failureClass === "terminal") {
                throw new Error(directFailure.message);
              }

              if (shouldRetryPayload) {
                await waitForEvolutionRetry(getEvolutionRetryDelayMs(attempt));
                continue;
              }

              if (directFailure.failureClass === "retryable_infrastructure") {
                updateAttemptContext({
                  evolution_phase: "complete",
                  fallback_path: "degraded",
                });
                logger.warn("Evolution request moved to degraded mode", {
                  ...currentAttemptContext(),
                  retry_after_ms: EVOLUTION_DEGRADED_RETRY_AFTER_MS,
                  reason: directFailure.reason,
                });
                return {
                  path: "degraded",
                  retryAfterMs: EVOLUTION_DEGRADED_RETRY_AFTER_MS,
                  reason: EVOLUTION_DEGRADED_NOTICE,
                };
              }

              throw new Error(directFailure.message);
            }

            updateAttemptContext({
              evolution_phase: "complete",
              fallback_path: "direct",
              error_class: null,
              error_category: null,
              error_status: null,
              error_code: null,
              invoke_status: null,
              invoke_category: null,
            });

            return {
              path: "direct",
              newStage: typeof directResult.new_stage === "number" ? directResult.new_stage : null,
            };
          }

          updateAttemptContext({
            evolution_phase: "complete",
            fallback_path: "degraded",
          });
          logger.warn("Evolution request moved to degraded mode", {
            ...currentAttemptContext(),
            retry_after_ms: EVOLUTION_DEGRADED_RETRY_AFTER_MS,
            reason: "direct_retry_exhausted",
          });
          return {
            path: "degraded",
            retryAfterMs: EVOLUTION_DEGRADED_RETRY_AFTER_MS,
            reason: EVOLUTION_DEGRADED_NOTICE,
          };
        } catch (error) {
          logger.error("Evolution mutation failed", {
            ...currentAttemptContext(),
            error: error instanceof Error ? error.message : String(error),
          });
          evolutionInProgress.current = false;
          setIsEvolvingLoading(false);
          throw await normalizeEvolutionError(error);
        }
      })();

      // Track the promise for race condition prevention
      evolutionPromise.current = evolutionExecution;

      try {
        return await evolutionExecution;
      } finally {
        evolutionPromise.current = null;
      }
    },
    onSuccess: (result) => {
      evolutionInProgress.current = false;

      if (!result) return;

      if (result.path === "degraded") {
        setIsEvolvingLoading(false);
        publishEvolutionDegradedNotice(result.reason);
        return;
      }

      setEvolutionServiceNotice(null);

      if (result.path === "direct") {
        if (user?.id) {
          clearStoredActiveEvolutionJobId(user.id);
          queryClient.setQueryData(getEvolutionJobQueryKey(user.id), null);
        }

        setIsEvolvingLoading(false);
        queryClient.invalidateQueries({ queryKey: ["companion"] });
        queryClient.invalidateQueries({ queryKey: ["companion-stories-all"] });
        queryClient.invalidateQueries({ queryKey: ["evolution-cards"] });
        queryClient.invalidateQueries({ queryKey: ["current-evolution-card"] });
        return;
      }

      queryClient.invalidateQueries({ queryKey: getEvolutionJobQueryKey(user?.id) });
    },
    onError: (error) => {
      evolutionInProgress.current = false;
      setEvolutionServiceNotice(null);
      setIsEvolvingLoading(false);
      console.error("Evolution failed:", {
        name: error.name,
        message: error.message,
      });
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Unable to evolve your companion right now. Please try again.";
      toast.error(message);
    },
  });

  // Memoize calculated values to prevent unnecessary recalculations
  const nextEvolutionXP = useMemo(() => {
    if (!companion) return null;
    return getThreshold(companion.current_stage + 1);
  }, [companion, getThreshold]);

  const progressToNext = useMemo(() => {
    if (!companion || !nextEvolutionXP) return 0;
    const currentStageThreshold = getThreshold(companion.current_stage) ?? 0;
    const stageRange = nextEvolutionXP - currentStageThreshold;
    if (stageRange <= 0) return 100;
    const progress = ((companion.current_xp - currentStageThreshold) / stageRange) * 100;
    return Math.min(100, Math.max(0, progress));
  }, [companion, getThreshold, nextEvolutionXP]);

  // Check if companion can evolve (XP meets threshold for next stage)
  const canEvolve = useMemo(() => {
    if (!companion) return false;
    return shouldEvolve(companion.current_stage, companion.current_xp);
  }, [companion, shouldEvolve]);

  const isEvolutionBusy = evolveCompanion.isPending || hasActiveEvolutionJob;
  const evolutionServiceState: EvolutionServiceState = useMemo(() => {
    if (isEvolutionBusy) return "processing";
    if (evolutionServiceNotice) return "degraded";
    return "ready";
  }, [evolutionServiceNotice, isEvolutionBusy]);

  // Manual evolution trigger function
  const triggerManualEvolution = useCallback(() => {
    if (!companion || isEvolutionBusy || !canEvolve) return;
    
    const nextStage = companion.current_stage + 1;
    
    // Show loading overlay
    setIsEvolvingLoading(true);
    window.dispatchEvent(new CustomEvent('evolution-loading-start'));
    
    evolveCompanion.mutate({ 
      newStage: nextStage, 
      currentXP: companion.current_xp 
    });
  }, [companion, canEvolve, evolveCompanion, isEvolutionBusy, setIsEvolvingLoading]);

  return {
    companion,
    isLoading,
    error,
    refetch,
    createCompanion,
    awardXP,
    evolveCompanion,
    nextEvolutionXP,
    progressToNext,
    isEvolvingLoading,
    canEvolve,
    isEvolutionBusy,
    evolutionServiceState,
    evolutionServiceNotice,
    evolutionEtaMessage,
    hasActiveEvolutionJob,
    trackedEvolutionJob,
    hasEvolutionReady,
    clearEvolutionReadyIndicator,
    triggerManualEvolution,
  };
};
