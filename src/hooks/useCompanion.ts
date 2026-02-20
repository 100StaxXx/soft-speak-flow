import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useAchievements } from "./useAchievements";
import { toast } from "sonner";
import { useRef, useMemo, useCallback } from "react";
import { useEvolution } from "@/contexts/EvolutionContext";
import { useEvolutionThresholds } from "./useEvolutionThresholds";
import { SYSTEM_XP_REWARDS } from "@/config/xpRewards";
import type { CreateCompanionIfNotExistsResult } from "@/types/referral-functions";
import { logger } from "@/utils/logger";
import { generateWithValidation } from "@/utils/validateCompanionImage";
import {
  parseFunctionInvokeError,
  toUserFacingFunctionError,
} from "@/utils/supabaseFunctionErrors";

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
};

type SupabaseRpcError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

const AWARD_XP_UNAVAILABLE_MESSAGE = "XP service is temporarily unavailable. Please try again shortly.";

const normalizeEvolutionErrorCode = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized.length > 0 ? normalized : null;
};

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
  const { getThreshold, shouldEvolve } = useEvolutionThresholds();

  // Prevent duplicate evolution/XP/companion creation requests during lag
  const evolutionInProgress = useRef(false);
  const evolutionPromise = useRef<Promise<unknown> | null>(null);
  const companionCreationInProgress = useRef(false);

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
            flowType: "onboarding",
          },
          {
            // Adaptive retry policy: onboarding (stage 0) prioritizes reliability/latency.
            maxRetries: 0,
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
    onSuccess: (result) => {
      evolutionInProgress.current = false;
      setIsEvolvingLoading(false);

      if (!result) return;
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

  const isEvolutionBusy = evolveCompanion.isPending;

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
    triggerManualEvolution,
  };
};
