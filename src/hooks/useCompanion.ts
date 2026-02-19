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
import { isRetriableFunctionInvokeError } from "@/utils/supabaseFunctionErrors";
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

const ACTIVE_EVOLUTION_JOB_STORAGE_PREFIX = "companion:evolution:active-job";
const EVOLUTION_READY_STORAGE_PREFIX = "companion:evolution:ready";
const EVOLUTION_ETA_DELAY_MS = 75_000;

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

  const evolveCompanion = useMutation({
    mutationFn: async ({ newStage: _newStage, currentXP: _currentXP }: { newStage: number; currentXP: number }) => {
      // Prevent duplicate evolution requests - wait for any ongoing evolution
      if (evolutionInProgress.current) {
        logger.log('Evolution already in progress, rejecting duplicate request');
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

        if (trackedEvolutionJob && (trackedEvolutionJob.status === "queued" || trackedEvolutionJob.status === "processing")) {
          writeStoredActiveEvolutionJobId(user.id, trackedEvolutionJob.id);
          setEvolutionReady(false);
          setIsEvolvingLoading(true);
          return trackedEvolutionJob.id;
        }

        setIsEvolvingLoading(true);

        try {
          const { data, error: requestError } = await (supabase.rpc as unknown as (
            name: string,
            params?: Record<string, never>,
          ) => Promise<{ data: RequestCompanionEvolutionJobResult[] | RequestCompanionEvolutionJobResult | null; error: Error | null }>)(
            "request_companion_evolution_job",
            {},
          );

          if (requestError) {
            throw new Error(evolutionRequestErrorMessage(requestError.message));
          }

          const requestResult = Array.isArray(data) ? data[0] : data;
          if (!requestResult?.job_id) {
            throw new Error("Unable to start evolution right now. Please try again.");
          }

          const createdJob: CompanionEvolutionJob = {
            id: requestResult.job_id,
            status: requestResult.status,
            requested_stage: requestResult.requested_stage,
            requested_at: new Date().toISOString(),
            started_at: null,
            next_retry_at: null,
            error_code: null,
            error_message: null,
          };

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
              jobId: createdJob.id,
              error: workerInvokeError instanceof Error ? workerInvokeError.message : String(workerInvokeError),
            });
          }

          return createdJob.id;
        } catch (error) {
          evolutionInProgress.current = false;
          setIsEvolvingLoading(false);
          throw error;
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
    onSuccess: () => {
      evolutionInProgress.current = false;
      queryClient.invalidateQueries({ queryKey: getEvolutionJobQueryKey(user?.id) });
    },
    onError: (error) => {
      evolutionInProgress.current = false;
      setIsEvolvingLoading(false);
      console.error("Evolution failed:", error);
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
    evolutionEtaMessage,
    hasActiveEvolutionJob,
    trackedEvolutionJob,
    hasEvolutionReady,
    clearEvolutionReadyIndicator,
    triggerManualEvolution,
  };
};
