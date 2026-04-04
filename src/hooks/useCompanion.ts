import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useAchievements } from "./useAchievements";
import { toast } from "@/components/ui/sonner";
import { useRef, useMemo, useCallback, useEffect } from "react";
import { useEvolution } from "@/contexts/EvolutionContext";
import { useEvolutionThresholds } from "./useEvolutionThresholds";
import { SYSTEM_XP_REWARDS } from "@/config/xpRewards";
import type { CreateCompanionIfNotExistsResult } from "@/types/referral-functions";
import { logger } from "@/utils/logger";
import {
  coerceCompanionElementId,
  getCompanionElementAnchorColor,
  getCompanionPreset,
} from "@/config/companionCatalog";
import {
  getPresetCompanionAssetUrl,
  getUniversalEggAssetUrl,
  resolveCompanionVisualAssetUrl,
} from "@/lib/companionAssetResolver";
import {
  getBundledCompanionImageFocalPoint,
  shouldBackfillCompanionImageFocal,
} from "@/lib/companionImageFocal";
import {
  COMPANION_HATCH_STARTED_EVENT,
  type CompanionHatchStartedDetail,
} from "@/lib/companionEvolutionEvents";
import {
  parseFunctionInvokeError,
  toUserFacingFunctionError,
} from "@/utils/supabaseFunctionErrors";
import {
  resolveProgressionLevelFromXp,
} from "@/config/progression";

export interface Companion {
  id: string;
  user_id: string;
  preset_id?: string | null;
  favorite_color: string;
  spirit_animal: string;
  core_element: string;
  story_tone?: string;
  current_stage: number;
  current_xp: number;
  current_image_url: string | null;
  current_image_focal_x?: number | null;
  current_image_focal_y?: number | null;
  initial_image_url?: string | null;
  initial_image_focal_x?: number | null;
  initial_image_focal_y?: number | null;
  dormant_image_url?: string | null;
  dormant_image_focal_x?: number | null;
  dormant_image_focal_y?: number | null;
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
  neglected_image_focal_x?: number | null;
  neglected_image_focal_y?: number | null;
  image_regenerations_used?: number;
  created_at: string;
  updated_at: string;
}

export const XP_REWARDS = SYSTEM_XP_REWARDS;

export const getCompanionQueryKey = (userId: string | undefined) =>
  ["companion", userId] as const;

const fetchCompanionById = async (companionId: string): Promise<Companion | null> => {
  const { data, error } = await supabase
    .from("user_companion")
    .select("*")
    .eq("id", companionId)
    .maybeSingle();

  if (error) throw error;
  return data as Companion | null;
};

export const fetchCompanion = async (userId: string): Promise<Companion | null> => {
  const { data, error } = await supabase
    .from("user_companion")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const companion = data as Companion | null;
  if (!companion || companion.current_stage <= 0) {
    return companion;
  }

  const { data: repairData, error: repairError } = await supabase.rpc(
    "repair_auto_advanced_companion_state",
    {
      p_companion_id: companion.id,
    },
  );

  if (repairError) {
    logger.warn("Companion repair check failed", {
      companionId: companion.id,
      userId,
      error: repairError.message,
    });
    return companion;
  }

  const repairResult = (Array.isArray(repairData) ? repairData[0] : repairData) as
    | RepairAutoAdvancedCompanionStateResult
    | null;

  if (!repairResult) {
    logger.warn("Companion repair check returned no result", {
      companionId: companion.id,
      userId,
      currentStage: companion.current_stage,
    });
    return companion;
  }

  if (!repairResult.repaired) {
    if (repairResult.last_real_stage < companion.current_stage) {
      logger.warn("Companion repair check left an impossible claimed stage unresolved", {
        companionId: companion.id,
        userId,
        currentStage: companion.current_stage,
        lastRealStage: repairResult.last_real_stage,
      });
    }
    return companion;
  }

  logger.warn("Repaired auto-advanced companion state", {
    companionId: companion.id,
    userId,
    previousStage: companion.current_stage,
    restoredStage: repairResult.current_stage,
    lastRealStage: repairResult.last_real_stage,
  });

  const repairedCompanion = await fetchCompanionById(companion.id);
  return repairedCompanion ?? {
    ...companion,
    current_stage: repairResult.current_stage,
    current_image_url: repairResult.current_image_url,
    current_image_focal_x: repairResult.current_image_focal_x,
    current_image_focal_y: repairResult.current_image_focal_y,
  };
};

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

interface HatchCompanionResponse {
  id: string;
  preset_id: string;
  spirit_animal: string;
  favorite_color: string;
  core_element: string;
  story_tone: string;
  current_stage: number;
  current_image_url: string;
  current_image_focal_x: number | null;
  current_image_focal_y: number | null;
  initial_image_url: string;
  initial_image_focal_x: number | null;
  initial_image_focal_y: number | null;
  evolution_id: string;
}

interface HatchCompanionMutationResult extends HatchCompanionResponse {
  previous_image_url: string;
}

type EvolutionFailureClass = "terminal" | "retryable_infrastructure" | "non_retryable";

interface EvolutionResolvedFailure {
  message: string;
  failureClass: EvolutionFailureClass;
  reason: string;
  code: string | null;
}

type AwardXpResult = {
  should_evolve: boolean;
  xp_before: number;
  xp_after: number;
  xp_awarded: number;
  cap_applied: boolean;
  next_threshold: number | null;
  level_before?: number | null;
  level_after?: number | null;
  tier_before?: string | null;
  tier_after?: string | null;
  earned_level_after?: number | null;
  earned_tier_after?: string | null;
  claimed_stage_after?: number | null;
  pending_evolution_count?: number | null;
};

type RepairAutoAdvancedCompanionStateResult = {
  repaired: boolean;
  current_stage: number;
  last_real_stage: number;
  current_image_url: string | null;
  current_image_focal_x: number | null;
  current_image_focal_y: number | null;
};

interface HatchAnimationSnapshot {
  previousImageUrl: string;
  element?: string | null;
}

type SupabaseRpcError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

type CreateCompanionRpcArgs = Record<string, string | number | null>;

type CreateCompanionRpcResult = {
  data: CreateCompanionIfNotExistsResult[] | null;
  error: SupabaseRpcError | null;
};

const AWARD_XP_UNAVAILABLE_MESSAGE = "XP service is temporarily unavailable. Please try again shortly.";
const CREATE_COMPANION_SIGNATURE_FALLBACK_MESSAGE = "Companion setup is still syncing. Please try again in a moment.";

const getCreateCompanionArgsWithoutFocalPoints = ({
  p_current_image_focal_x: _ignoredCurrentImageFocalX,
  p_current_image_focal_y: _ignoredCurrentImageFocalY,
  p_initial_image_focal_x: _ignoredInitialImageFocalX,
  p_initial_image_focal_y: _ignoredInitialImageFocalY,
  ...legacyCreateCompanionRpcArgs
}: CreateCompanionRpcArgs): CreateCompanionRpcArgs => legacyCreateCompanionRpcArgs;

const getCreateCompanionArgsWithoutPresetOrFocalPoints = ({
  p_preset_id: _ignoredPresetId,
  ...createCompanionRpcArgsWithoutPreset
}: CreateCompanionRpcArgs): CreateCompanionRpcArgs =>
  getCreateCompanionArgsWithoutFocalPoints(createCompanionRpcArgsWithoutPreset);

const normalizeEvolutionErrorCode = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized.length > 0 ? normalized : null;
};

const getNormalizedRpcErrorSource = (error: SupabaseRpcError | null | undefined) =>
  [error?.message, error?.details, error?.hint]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();

const isAwardXpFunctionMissingError = (error: SupabaseRpcError | null | undefined) => {
  if (!error) return false;

  const normalizedCode = normalizeEvolutionErrorCode(error.code);
  if (normalizedCode === "42883") return true;

  const normalizedSource = [error.message, error.details, error.hint]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();

  return (
    normalizedSource.includes("award_xp_v2")
    && (
      normalizedSource.includes("could not find function")
      || normalizedSource.includes("does not exist")
      || normalizedSource.includes("schema cache")
      || normalizedSource.includes("undefined function")
      || normalizedSource.includes("function not found")
    )
  );
};

const isLegacyCreateCompanionRpcSignatureError = (error: SupabaseRpcError | null | undefined) => {
  if (!error) return false;

  const normalizedCode = normalizeEvolutionErrorCode(error.code);
  if (normalizedCode === "42883") return true;

  const normalizedSource = getNormalizedRpcErrorSource(error);
  return (
    normalizedSource.includes("create_companion_if_not_exists")
    && (
      normalizedSource.includes("could not find function")
      || normalizedSource.includes("does not exist")
      || normalizedSource.includes("schema cache")
      || normalizedSource.includes("undefined function")
      || normalizedSource.includes("function not found")
    )
  );
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
      failureClass: "terminal",
      reason: terminalFailure.category,
      code: terminalFailure.code,
    };
  }

  if (isRetryableEvolutionInfrastructureSource(source)) {
    return {
      message: "Evolution service is temporarily unavailable. Please try again in a minute.",
      failureClass: "retryable_infrastructure",
      reason: "direct_payload_infrastructure",
      code: normalizeEvolutionErrorCode(data?.code) ?? "evolution_service_unavailable",
    };
  }

  return {
    message: directEvolutionFailureMessage(data),
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
      failureClass: "retryable_infrastructure",
      reason: "invoke_infrastructure",
      code: normalizeEvolutionErrorCode(parsed.responsePayload?.code ?? parsed.code) ?? "evolution_service_unavailable",
      invokeCategory: parsed.category,
      invokeStatus: parsed.status ?? null,
    };
  }

  return {
    message: toUserFacingFunctionError(parsed, { action: "start evolution" }),
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

type EvolutionMutationResult = { newStage: number | null } | null;

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

interface UseCompanionOptions {
  enabled?: boolean;
}

export const useCompanion = (options: UseCompanionOptions = {}) => {
  const { enabled = true } = options;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { checkCompanionAchievements } = useAchievements();
  const { isEvolvingLoading, setIsEvolvingLoading } = useEvolution();
  const { getThreshold } = useEvolutionThresholds();

  // Prevent duplicate evolution/XP/companion creation requests during lag
  const evolutionInProgress = useRef(false);
  const evolutionPromise = useRef<Promise<unknown> | null>(null);
  const companionCreationInProgress = useRef(false);
  const focalBackfillRequestedRef = useRef<string | null>(null);

  const { data: companion, isLoading, error, refetch } = useQuery({
    queryKey: getCompanionQueryKey(user?.id),
    queryFn: async () => {
      if (!user) return null;

      return fetchCompanion(user.id);
    },
    enabled: enabled && !!user,
    staleTime: 60000, // 1 minute - prevents unnecessary refetches and tab flash
    gcTime: 30 * 60 * 1000, // Keep companion cache warm across tab switches
    placeholderData: (previousData) => previousData,
    retry: 3, // Increased from 2 to 3 for better reliability after onboarding
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Exponential backoff
  });

  useEffect(() => {
    if (!companion?.id) {
      focalBackfillRequestedRef.current = null;
      return;
    }

    const needsBackfill = [
      shouldBackfillCompanionImageFocal(
        companion.current_image_url,
        companion.current_image_focal_x,
        companion.current_image_focal_y,
      ),
      shouldBackfillCompanionImageFocal(
        companion.initial_image_url,
        companion.initial_image_focal_x,
        companion.initial_image_focal_y,
      ),
      shouldBackfillCompanionImageFocal(
        companion.dormant_image_url,
        companion.dormant_image_focal_x,
        companion.dormant_image_focal_y,
      ),
      shouldBackfillCompanionImageFocal(
        companion.neglected_image_url,
        companion.neglected_image_focal_x,
        companion.neglected_image_focal_y,
      ),
    ].some(Boolean);

    if (!needsBackfill) {
      focalBackfillRequestedRef.current = null;
      return;
    }

    if (focalBackfillRequestedRef.current === companion.id) {
      return;
    }

    focalBackfillRequestedRef.current = companion.id;

    void supabase.functions.invoke("backfill-companion-image-focal", {
      body: {
        companionId: companion.id,
      },
    }).then(({ error: invokeError }) => {
      if (invokeError) {
        logger.warn("Companion image focal backfill failed", {
          companionId: companion.id,
          error: invokeError.message,
        });
        focalBackfillRequestedRef.current = null;
        return;
      }

      queryClient.invalidateQueries({ queryKey: getCompanionQueryKey(user?.id) });
      queryClient.invalidateQueries({ queryKey: ["companion-health", user?.id] });
    }).catch((invokeError) => {
      logger.warn("Companion image focal backfill request threw", {
        companionId: companion.id,
        error: invokeError instanceof Error ? invokeError.message : String(invokeError),
      });
      focalBackfillRequestedRef.current = null;
    });
  }, [
    companion?.id,
    companion?.current_image_url,
    companion?.current_image_focal_x,
    companion?.current_image_focal_y,
    companion?.initial_image_url,
    companion?.initial_image_focal_x,
    companion?.initial_image_focal_y,
    companion?.dormant_image_url,
    companion?.dormant_image_focal_x,
    companion?.dormant_image_focal_y,
    companion?.neglected_image_url,
    companion?.neglected_image_focal_x,
    companion?.neglected_image_focal_y,
    queryClient,
    user?.id,
  ]);

  const createCompanion = useMutation({
    mutationFn: async (data: {
      presetId?: string | null;
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
          presetId: data.presetId ?? null,
          spiritAnimal: data.spiritAnimal,
          coreElement: data.coreElement,
          stage: 0,
        });

        const preset = data.presetId ? getCompanionPreset(data.presetId) : null;
        if (data.presetId && !preset) {
          throw new Error("Unknown companion preset");
        }

        const normalizedElement = coerceCompanionElementId(data.coreElement);
        const resolvedFavoriteColor = getCompanionElementAnchorColor(normalizedElement);
        const resolvedSpiritAnimal = data.spiritAnimal?.trim() || preset?.displayName || "Egg";

        const eyeColor = "";
        const furColor = "";
        // Stage 0 always uses the shared elemental egg art. A locked preset only
        // determines the future hatch result, not the egg's visual at creation time.
        const currentImageUrl = getUniversalEggAssetUrl(normalizedElement);
        const currentImageFocal = getBundledCompanionImageFocalPoint(currentImageUrl);

        logger.log("Stage 0 asset resolved successfully, creating companion record...");

        const invokeCreateCompanionRpc = async (
          args: CreateCompanionRpcArgs,
        ): Promise<CreateCompanionRpcResult> => {
          return await supabase.rpc(
            "create_companion_if_not_exists",
            args,
          ) as unknown as CreateCompanionRpcResult;
        };

        const createCompanionRpcArgs: CreateCompanionRpcArgs = {
          p_user_id: user.id,
          p_preset_id: preset?.id ?? null,
          p_favorite_color: resolvedFavoriteColor,
          p_spirit_animal: resolvedSpiritAnimal,
          p_core_element: normalizedElement,
          p_story_tone: data.storyTone,
          p_current_image_url: currentImageUrl,
          p_current_image_focal_x: currentImageFocal?.x ?? null,
          p_current_image_focal_y: currentImageFocal?.y ?? null,
          p_initial_image_url: currentImageUrl,
          p_initial_image_focal_x: currentImageFocal?.x ?? null,
          p_initial_image_focal_y: currentImageFocal?.y ?? null,
          p_eye_color: eyeColor,
          p_fur_color: furColor,
        };

        // Use atomic database function to create companion (prevents duplicates)
        let result = await invokeCreateCompanionRpc(createCompanionRpcArgs);

        if (result.error && isLegacyCreateCompanionRpcSignatureError(result.error)) {
          logger.warn("Create companion RPC signature mismatch; retrying legacy preset-aware call without focal points", {
            userId: user.id,
            presetId: preset?.id ?? null,
            coreElement: normalizedElement,
          });
          result = await invokeCreateCompanionRpc(
            getCreateCompanionArgsWithoutFocalPoints(createCompanionRpcArgs),
          );
        }

        if (!preset && result.error && isLegacyCreateCompanionRpcSignatureError(result.error)) {
          logger.warn("Create companion RPC signature mismatch; retrying pre-preset legacy egg-first call", {
            userId: user.id,
            coreElement: normalizedElement,
          });
          result = await invokeCreateCompanionRpc(
            getCreateCompanionArgsWithoutPresetOrFocalPoints(createCompanionRpcArgs),
          );
        }

        if (result.error) {
          console.error("Database error creating companion:", result.error);
          if (isLegacyCreateCompanionRpcSignatureError(result.error)) {
            throw new Error(CREATE_COMPANION_SIGNATURE_FALLBACK_MESSAGE);
          }

          throw new Error(result.error.message?.trim() || "Failed to save companion to database.");
        }
        
        const companionResult = result.data;

        logger.log("RPC call successful, result:", companionResult);

        if (!companionResult || companionResult.length === 0) {
          logger.error("No companion data returned from function");
          throw new Error("Failed to create companion record. Please try again.");
        }

        const companionData = {
          preset_id: companionResult[0]?.preset_id ?? null,
          ...companionResult[0],
        } as CreateCompanionIfNotExistsResult;
        const isNewCompanion = companionData.is_new;

        logger.log(`Companion ${isNewCompanion ? "created" : "already exists"}:`, companionData.id);

        // Stage 0 history is now created by the security-definer RPC so onboarding
        // does not depend on client-side INSERT access to companion_evolutions.
        const { data: stageZeroEvolution, error: stageZeroEvolutionError } = await supabase
          .from("companion_evolutions")
          .select("id")
          .eq("companion_id", companionData.id)
          .eq("stage", 0)
          .maybeSingle();

        if (stageZeroEvolutionError) {
          logger.warn("Stage 0 evolution lookup failed after companion creation", {
            companionId: companionData.id,
            error: stageZeroEvolutionError.message,
          });
        } else if (!stageZeroEvolution?.id) {
          logger.warn("Stage 0 evolution missing after companion creation", {
            companionId: companionData.id,
          });
        }

        if (resolvedSpiritAnimal !== "Egg" && isNewCompanion && stageZeroEvolution?.id) {
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
                const { error } = await supabase.functions.invoke("generate-companion-story", {
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
                const isTransient = errorMessage.includes("network") ||
                                   errorMessage.includes("timeout") ||
                                   errorMessage.includes("temporarily unavailable");

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
            console.warn("Story generation failed (non-critical):", error?.message || error);
          });
        }

        logger.info("Companion creation completed", {
          userId: user.id,
          presetId: data.presetId ?? null,
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

  const hatchCompanion = useMutation({
    mutationFn: async ({
      presetId,
      companionSnapshot,
    }: {
      presetId?: string | null;
      companionSnapshot?: Companion | null;
    }): Promise<HatchCompanionMutationResult> => {
      const companionToUse = companionSnapshot ?? companion;

      if (!user || !companionToUse) {
        throw new Error("No companion found");
      }

      if (companionToUse.current_stage !== 0) {
        throw new Error("This companion is not waiting to hatch.");
      }

      const lockedPresetId = companionToUse.preset_id?.trim() || null;
      const resolvedPresetId = presetId?.trim() || lockedPresetId;
      if (!resolvedPresetId) {
        throw new Error("Choose a companion form before hatching.");
      }
      if (lockedPresetId && lockedPresetId !== resolvedPresetId) {
        throw new Error("This egg is already bound to another companion form.");
      }

      const preset = getCompanionPreset(resolvedPresetId);
      if (!preset) {
        throw new Error("Unknown companion preset");
      }

      const normalizedElement = coerceCompanionElementId(companionToUse.core_element);
      const currentImageUrl = getPresetCompanionAssetUrl({
        presetId: preset.id,
        stage: 1,
        state: "normal",
        element: normalizedElement,
      }) ?? "/placeholder-companion.svg";
      const currentImageFocal = getBundledCompanionImageFocalPoint(currentImageUrl);
      const initialImageUrl = companionToUse.initial_image_url
        ?? companionToUse.current_image_url
        ?? getUniversalEggAssetUrl(normalizedElement);
      const initialImageFocal = getBundledCompanionImageFocalPoint(initialImageUrl);
      const favoriteColor = getCompanionElementAnchorColor(normalizedElement);

      const result = await supabase.rpc("hatch_companion_with_preset", {
        p_companion_id: companionToUse.id,
        p_preset_id: preset.id,
        p_spirit_animal: preset.displayName,
        p_favorite_color: favoriteColor,
        p_core_element: normalizedElement,
        p_story_tone: companionToUse.story_tone ?? "epic_adventure",
        p_initial_image_url: initialImageUrl,
        p_initial_image_focal_x: companionToUse.initial_image_focal_x ?? initialImageFocal?.x ?? null,
        p_initial_image_focal_y: companionToUse.initial_image_focal_y ?? initialImageFocal?.y ?? null,
        p_current_image_url: currentImageUrl,
        p_current_image_focal_x: currentImageFocal?.x ?? null,
        p_current_image_focal_y: currentImageFocal?.y ?? null,
        p_xp_at_evolution: companionToUse.current_xp,
      }) as { data: HatchCompanionResponse[] | null; error: Error | null };

      if (result.error) {
        throw result.error;
      }

      const hatchResult = result.data?.[0] ?? null;
      if (!hatchResult) {
        throw new Error("Hatch completed without returning companion data.");
      }

      const generateStageOneArtifacts = async () => {
        try {
          await supabase.functions.invoke("generate-evolution-card", {
            body: {
              companionId: companionToUse.id,
              evolutionId: hatchResult.evolution_id,
              stage: 1,
              species: preset.displayName,
              element: normalizedElement,
              color: favoriteColor,
              userAttributes: {
                vitality: companionToUse.vitality || 300,
                wisdom: companionToUse.wisdom || 300,
                discipline: companionToUse.discipline || 300,
                resolve: companionToUse.resolve || 300,
                creativity: companionToUse.creativity || 300,
                alignment: companionToUse.alignment || 300,
              },
            },
          });
          queryClient.invalidateQueries({ queryKey: ["evolution-cards"] });
        } catch (cardError) {
          console.error("Stage 1 card generation failed (non-critical):", cardError);
        }

        try {
          await supabase.functions.invoke("generate-companion-story", {
            body: {
              companionId: companionToUse.id,
              stage: 1,
            },
          });
          queryClient.invalidateQueries({ queryKey: ["companion-story"] });
          queryClient.invalidateQueries({ queryKey: ["companion-stories-all"] });
        } catch (storyError) {
          console.error("Stage 1 story generation failed (non-critical):", storyError);
        }
      };

      void generateStageOneArtifacts();

      return {
        ...hatchResult,
        previous_image_url: initialImageUrl,
      };
    },
    onSuccess: (hatchResult) => {
      const hatchStartedDetail: CompanionHatchStartedDetail = {
        companionId: hatchResult.id,
        previousStage: 0,
        newStage: 1,
        previousImageUrl: hatchResult.previous_image_url,
        newImageUrl: hatchResult.current_image_url,
        element: hatchResult.core_element ?? null,
      };

      window.dispatchEvent(
        new CustomEvent(COMPANION_HATCH_STARTED_EVENT, {
          detail: hatchStartedDetail,
        }),
      );

      setIsEvolvingLoading(false);
      queryClient.invalidateQueries({ queryKey: ["companion"] });
      queryClient.invalidateQueries({ queryKey: ["companion-story"] });
      queryClient.invalidateQueries({ queryKey: ["companion-stories-all"] });
      queryClient.invalidateQueries({ queryKey: ["companion-evolution-image"] });
      queryClient.invalidateQueries({ queryKey: ["evolution-cards"] });
      queryClient.invalidateQueries({ queryKey: ["current-evolution-card"] });
    },
    onError: (error) => {
      setIsEvolvingLoading(false);
      console.error("Hatch failed:", error);
      toast.error(error instanceof Error ? error.message : "Unable to hatch your companion right now.");
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
    onSuccess: ({ shouldEvolve, claimedStage, earnedLevel, earnedLevelBefore, pendingEvolutionCount }) => {
      queryClient.invalidateQueries({ queryKey: ["companion"] });

      if (shouldEvolve && earnedLevel > earnedLevelBefore) {
        const nextClaimedLevel = claimedStage + 1;
        const extraReadyCopy = pendingEvolutionCount > 1
          ? ` ${pendingEvolutionCount} evolutions are ready.`
          : "";

        toast.success(`Ready to evolve to Stage ${nextClaimedLevel}.${extraReadyCopy}`);
      }
    },
    onError: (error) => {
      console.error('XP award failed:', error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Failed to award XP. Please try again.";
      toast.error(message);
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

    if (error) {
      if (isAwardXpFunctionMissingError(error)) {
        logger.error("award_xp_v2 unavailable during XP award", {
          userId: currentUser.id,
          eventType,
          idempotencyKey: requestIdempotencyKey,
          error_code: error.code ?? null,
          error_message: error.message ?? null,
          error_details: error.details ?? null,
          error_hint: error.hint ?? null,
        });
        throw new Error(AWARD_XP_UNAVAILABLE_MESSAGE);
      }
      throw error;
    }

    const awardResult = (Array.isArray(data) ? data[0] : data) as AwardXpResult | null;
    if (!awardResult) {
      throw new Error("XP award returned no data");
    }

    const previousLevel = typeof awardResult.level_before === "number"
      ? awardResult.level_before
      : companionData.current_stage;
    const newXP = awardResult.xp_after ?? companionData.current_xp;
    const earnedLevelBefore = resolveProgressionLevelFromXp(
      awardResult.xp_before ?? companionData.current_xp,
    );
    const earnedLevel = typeof awardResult.earned_level_after === "number"
      ? awardResult.earned_level_after
      : typeof awardResult.level_after === "number"
        ? awardResult.level_after
        : resolveProgressionLevelFromXp(newXP);
    const claimedStage = typeof awardResult.claimed_stage_after === "number"
      ? awardResult.claimed_stage_after
      : companionData.current_stage;
    const pendingEvolutionCount = typeof awardResult.pending_evolution_count === "number"
      ? awardResult.pending_evolution_count
      : Math.max(earnedLevel - claimedStage, 0);
    const shouldEvolveNow = Boolean(awardResult.should_evolve ?? pendingEvolutionCount > 0);

    logger.log("[XP Award Debug]", {
      eventType,
      requestedXP: xpAmount,
      awardedXP: awardResult.xp_awarded,
      capApplied: awardResult.cap_applied,
      currentLevel: companionData.current_stage,
      currentXP: awardResult.xp_before,
      newXP,
      previousLevel,
      claimedStage,
      earnedLevelBefore,
      earnedLevel,
      pendingEvolutionCount,
      nextThreshold: awardResult.next_threshold,
      readyToEvolve: shouldEvolveNow,
      idempotencyKey: requestIdempotencyKey,
    });

    return {
      shouldEvolve: shouldEvolveNow,
      previousLevel,
      claimedStage,
      earnedLevel,
      earnedLevelBefore,
      newXP,
      xpAwarded: awardResult.xp_awarded ?? 0,
      capApplied: Boolean(awardResult.cap_applied),
      nextThreshold: awardResult.next_threshold ?? null,
      pendingEvolutionCount,
    };
  };

  const evolveCompanion = useMutation<EvolutionMutationResult, Error, { newStage: number; currentXP: number }>({
    mutationFn: async ({ newStage: _newStage, currentXP: _currentXP }: { newStage: number; currentXP: number }) => {
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

        setIsEvolvingLoading(true);

        try {
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

              if (shouldRetryInvoke) {
                logger.warn("Direct evolution invoke failed; retrying", {
                  attempt,
                  max_attempts: EVOLUTION_DIRECT_MAX_ATTEMPTS,
                  reason: invokeFailure.reason,
                  status: invokeFailure.invokeStatus,
                  category: invokeFailure.invokeCategory,
                });
                await waitForEvolutionRetry(getEvolutionRetryDelayMs(attempt));
                continue;
              }

              throw new Error(invokeFailure.message);
            }

            const directResult = (directEvolutionData ?? null) as DirectEvolutionResponse | null;
            if (!directResult || directResult.evolved !== true) {
              const directFailure = resolveDirectEvolutionPayloadFailure(directResult);
              const shouldRetryPayload =
                directFailure.failureClass === "retryable_infrastructure"
                && attempt < EVOLUTION_DIRECT_MAX_ATTEMPTS;

              if (shouldRetryPayload) {
                logger.warn("Direct evolution returned unsuccessful payload; retrying", {
                  attempt,
                  max_attempts: EVOLUTION_DIRECT_MAX_ATTEMPTS,
                  reason: directFailure.reason,
                  code: directFailure.code,
                });
                await waitForEvolutionRetry(getEvolutionRetryDelayMs(attempt));
                continue;
              }

              throw new Error(directFailure.message);
            }

            return { newStage: typeof directResult.new_stage === "number" ? directResult.new_stage : null };
          }

          throw new Error("Evolution service is temporarily unavailable. Please try again in a minute.");
        } catch (error) {
          logger.error("Evolution mutation failed", {
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
    onSuccess: async (result) => {
      evolutionInProgress.current = false;
      setIsEvolvingLoading(false);

      if (!result) return;
      if (typeof result.newStage === "number") {
        await checkCompanionAchievements(result.newStage);
      }
      queryClient.invalidateQueries({ queryKey: ["companion"] });
      queryClient.invalidateQueries({ queryKey: ["companion-stories-all"] });
      queryClient.invalidateQueries({ queryKey: ["evolution-cards"] });
      queryClient.invalidateQueries({ queryKey: ["current-evolution-card"] });
    },
    onError: (error) => {
      evolutionInProgress.current = false;
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

  const requiresHatchSelection = useMemo(
    () => Boolean(companion && companion.current_stage === 0 && !companion.preset_id),
    [companion],
  );

  // Memoize calculated values to prevent unnecessary recalculations
  const nextEvolutionXP = useMemo(() => {
    if (!companion) return null;
    return getThreshold(companion.current_stage + 1);
  }, [companion, getThreshold]);

  const earnedLevel = useMemo(() => {
    if (!companion) return 0;
    return resolveProgressionLevelFromXp(companion.current_xp);
  }, [companion?.current_xp]);

  const progressToNext = useMemo(() => {
    if (!companion || !nextEvolutionXP) return 0;
    const currentStageThreshold = getThreshold(companion.current_stage) ?? 0;
    const stageRange = nextEvolutionXP - currentStageThreshold;
    if (stageRange <= 0) return 100;
    const progress = ((companion.current_xp - currentStageThreshold) / stageRange) * 100;
    return Math.min(100, Math.max(0, progress));
  }, [companion, getThreshold, nextEvolutionXP]);

  const canEvolve = useMemo(() => {
    if (!companion) return false;
    return earnedLevel > companion.current_stage;
  }, [companion, earnedLevel]);

  const isEvolutionBusy = evolveCompanion.isPending || hatchCompanion.isPending;

  // Manual evolution trigger function
  const triggerManualEvolution = useCallback(async (
    options?: {
      hatchAnimationSnapshot?: HatchAnimationSnapshot;
    },
  ) => {
    if (!user || isEvolutionBusy) return;

    let latestCompanion: Companion | null = null;
    try {
      latestCompanion = await fetchCompanion(user.id);
    } catch (error) {
      logger.warn("Failed to refresh companion state before manual evolution", {
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      });
      toast.error("Unable to refresh your companion right now. Please try again.");
      return;
    }

    queryClient.setQueryData(getCompanionQueryKey(user.id), latestCompanion);

    if (!latestCompanion) return;

    const latestEarnedLevel = resolveProgressionLevelFromXp(latestCompanion.current_xp);
    const latestCanEvolve = latestEarnedLevel > latestCompanion.current_stage;
    const hatchAnimationSnapshot = options?.hatchAnimationSnapshot;

    if (!latestCanEvolve) {
      if (
        hatchAnimationSnapshot
        && latestCompanion.current_stage === 1
      ) {
        const newImageUrl = resolveCompanionVisualAssetUrl(latestCompanion)
          ?? latestCompanion.current_image_url
          ?? hatchAnimationSnapshot.previousImageUrl;

        setIsEvolvingLoading(true);
        window.dispatchEvent(new CustomEvent("evolution-loading-start"));
        window.dispatchEvent(
          new CustomEvent<CompanionHatchStartedDetail>(COMPANION_HATCH_STARTED_EVENT, {
            detail: {
              companionId: latestCompanion.id,
              previousStage: 0,
              newStage: 1,
              previousImageUrl: hatchAnimationSnapshot.previousImageUrl,
              newImageUrl,
              element: latestCompanion.core_element ?? hatchAnimationSnapshot.element ?? null,
            },
          }),
        );
        return;
      }

      if (latestCompanion.current_stage > 0) {
        window.dispatchEvent(new CustomEvent("companion-evolved"));
      }
      return;
    }

    if (latestCompanion.current_stage === 0) {
      if (!latestCompanion.preset_id) return;

      setIsEvolvingLoading(true);
      window.dispatchEvent(new CustomEvent("evolution-loading-start"));
      hatchCompanion.mutate({
        presetId: latestCompanion.preset_id,
        companionSnapshot: latestCompanion,
      });
      return;
    }

    const nextStage = latestCompanion.current_stage + 1;

    setIsEvolvingLoading(true);
    window.dispatchEvent(new CustomEvent("evolution-loading-start"));

    evolveCompanion.mutate({
      newStage: nextStage,
      currentXP: latestCompanion.current_xp,
    });
  }, [evolveCompanion, hatchCompanion, isEvolutionBusy, queryClient, setIsEvolvingLoading, user]);

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
    requiresHatchSelection,
    isEvolutionBusy,
    triggerManualEvolution,
    hatchCompanion,
  };
};
