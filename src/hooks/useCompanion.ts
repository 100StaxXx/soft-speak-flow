import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useAchievements } from "./useAchievements";
import { toast } from "sonner";
import { retryWithBackoff } from "@/utils/retry";
import { useRef, useMemo, useCallback } from "react";
import { useEvolution } from "@/contexts/EvolutionContext";
import { useEvolutionThresholds } from "./useEvolutionThresholds";
import { SYSTEM_XP_REWARDS } from "@/config/xpRewards";
import type { CompleteReferralStage3Result, CreateCompanionIfNotExistsResult } from "@/types/referral-functions";
import { logger } from "@/utils/logger";

export interface Companion {
  id: string;
  user_id: string;
  favorite_color: string;
  spirit_animal: string;
  core_element: string;
  current_stage: number;
  current_xp: number;
  current_image_url: string | null;
  eye_color?: string;
  fur_color?: string;
  body?: number;
  mind?: number;
  soul?: number;
  last_energy_update?: string;
  created_at: string;
  updated_at: string;
}

export const XP_REWARDS = SYSTEM_XP_REWARDS;

export const useCompanion = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { checkCompanionAchievements } = useAchievements();
  const { isEvolvingLoading, setIsEvolvingLoading } = useEvolution();
  const { getThreshold, shouldEvolve } = useEvolutionThresholds();

  // Prevent duplicate evolution/XP/companion creation requests during lag
  const evolutionInProgress = useRef(false);
  const evolutionPromise = useRef<Promise<unknown> | null>(null);
  const xpInProgress = useRef(false);
  const companionCreationInProgress = useRef(false);

  const cachedCompanion = useMemo(() => {
    if (!user?.id) return null;
    return queryClient.getQueryData<Companion>(["companion", user.id]) ?? null;
  }, [queryClient, user?.id]);

  const { data: companion, isLoading, error } = useQuery({
    queryKey: ["companion", user?.id],
    enabled: !!user,
    initialData: cachedCompanion,
    placeholderData: cachedCompanion,
    staleTime: 5 * 60 * 1000, // 5 minutes to avoid thrashing when switching tabs
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 3, // Increased from 2 to 3 for better reliability after onboarding
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Exponential backoff
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("user_companion")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      // Ensure timestamps are consistently represented as ISO strings to
      // keep cache entries aligned across environments.
      const normalizeDate = (value?: string | null) =>
        value ? new Date(value).toISOString() : value ?? undefined;

      return {
        ...data,
        created_at: normalizeDate(data.created_at) ?? new Date().toISOString(),
        updated_at: normalizeDate(data.updated_at) ?? new Date().toISOString(),
        last_energy_update: normalizeDate(data.last_energy_update),
      } as Companion;
    },
  });

  const createCompanion = useMutation({
    mutationFn: async (data: {
      favoriteColor: string;
      spiritAnimal: string;
      coreElement: string;
      storyTone: string;
    }) => {
      if (!user) throw new Error("Not authenticated");

      // Prevent duplicate companion creation during rapid clicks
      if (companionCreationInProgress.current) {
        throw new Error("Companion creation already in progress");
      }
      companionCreationInProgress.current = true;

      try {
        logger.log("Starting companion creation process...");

        // Determine consistent colors for the companion's lifetime
        const eyeColor = `glowing ${data.favoriteColor}`;
        const furColor = data.favoriteColor;

        // Generate initial companion image with color specifications (with retry)
        logger.log("Generating companion image...");
        const imageData = await retryWithBackoff(
          async () => {
            const { data: imageResult, error } = await supabase.functions.invoke(
              "generate-companion-image",
              {
                body: {
                  favoriteColor: data.favoriteColor,
                  spiritAnimal: data.spiritAnimal,
                  element: data.coreElement,
                  stage: 0,
                  eyeColor,
                  furColor,
                },
              }
            );
            
            // Handle specific error codes from edge function
            if (error) {
              console.error("Companion image generation error:", error);
              const errorMsg = error.message || String(error);
              
              // Check for specific error codes
              if (errorMsg.includes("INSUFFICIENT_CREDITS") || errorMsg.includes("Insufficient AI credits")) {
                throw new Error("The companion creation service is temporarily unavailable. Please contact support.");
              }
              if (errorMsg.includes("RATE_LIMITED") || errorMsg.includes("AI service is currently busy")) {
                throw new Error("The service is currently busy. Please wait a moment and try again.");
              }
              if (errorMsg.includes("NO_AUTH_HEADER") || errorMsg.includes("INVALID_AUTH") || 
                  errorMsg.includes("Authentication required") || errorMsg.includes("Invalid authentication")) {
                throw new Error("Your session has expired. Please refresh the page and try again.");
              }
              if (errorMsg.includes("NETWORK_ERROR") || errorMsg.includes("Network error")) {
                throw new Error("Network error. Please check your connection and try again.");
              }
              if (errorMsg.includes("SERVER_CONFIG_ERROR") || errorMsg.includes("AI_SERVICE_NOT_CONFIGURED")) {
                throw new Error("Service configuration error. Please contact support.");
              }
              
              throw new Error(errorMsg || "Failed to generate companion image. Please try again.");
            }
            
            if (!imageResult?.imageUrl) {
              console.error("No image URL in result:", imageResult);
              throw new Error("Unable to create your companion's image. Please try again.");
            }
            return imageResult;
          },
          {
            maxAttempts: 3,
            initialDelay: 2000,
            shouldRetry: (error: unknown) => {
              // Don't retry on payment/credits errors or auth errors
              const errorMessage = error instanceof Error ? error.message : String(error);
              if (errorMessage.includes("INSUFFICIENT_CREDITS") ||
                  errorMessage.includes("temporarily unavailable") ||
                  errorMessage.includes("Authentication failed") ||
                  errorMessage.includes("contact support")) {
                return false;
              }
              return true;
            }
          }
        );

        if (!imageData?.imageUrl) {
        logger.error("Missing imageUrl after generation:", imageData);
        throw new Error("Unable to create your companion's image. Please try again.");
      }

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
                  body: fullCompanionData?.body || 0,
                  mind: fullCompanionData?.mind || 0,
                  soul: fullCompanionData?.soul || 0,
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
              const { data, error } = await supabase.functions.invoke('generate-companion-story', {
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

      return companionData;
      } catch (error) {
        // Reset flag on error
        companionCreationInProgress.current = false;
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
    }: {
      eventType: string;
      xpAmount: number;
      metadata?: Record<string, string | number | boolean | undefined>;
    }) => {
      if (!user) throw new Error("No user found");
      
      // Prevent duplicate XP awards - check and set flag IMMEDIATELY before any async operations
      if (xpInProgress.current) {
        throw new Error("XP award already in progress");
      }
      xpInProgress.current = true;
      
      try {
        // CRITICAL: Ensure companion is loaded before awarding XP
        let companionToUse = companion;
        
        if (!companionToUse) {
          logger.warn('Companion not loaded yet, fetching...');
          // Refetch companion data and wait for it to complete
          await queryClient.refetchQueries({ queryKey: ["companion", user.id] });
          companionToUse = queryClient.getQueryData(["companion", user.id]) as Companion | null;
          
          if (!companionToUse) {
            throw new Error("No companion found. Please create one first.");
          }
        }
        
        return await performXPAward(companionToUse, xpAmount, eventType, metadata, user);
      } finally {
        // Always reset flag in finally block to ensure cleanup
        xpInProgress.current = false;
      }
    },
    onSuccess: async ({ shouldEvolve, newStage, newXP }) => {
      queryClient.invalidateQueries({ queryKey: ["companion"] });
      
      if (shouldEvolve && companion) {
        // Check for companion stage achievements
        await checkCompanionAchievements(newStage);
        
        // Show overlay immediately BEFORE toast
        setIsEvolvingLoading(true);
        
        // Notify walkthrough that evolution loading has started (for hiding tooltips)
        window.dispatchEvent(new CustomEvent('evolution-loading-start'));
        
        toast.success("🎉 Your companion is ready to evolve!");
        // Trigger evolution
        evolveCompanion.mutate({ newStage, currentXP: newXP });
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
    currentUser: typeof user
  ) => {
    if (!currentUser?.id) {
      throw new Error("Not authenticated");
    }
    // Note: xpInProgress flag is managed by the caller (awardXP mutation)
    // Setting it here would cause issues with error handling

    const newXP = companionData.current_xp + xpAmount;
    const nextStage = companionData.current_stage + 1;
    const nextThreshold = getThreshold(nextStage);
    
    logger.log('[XP Award Debug]', {
      currentStage: companionData.current_stage,
      currentXP: companionData.current_xp,
      xpAmount,
      newXP,
      nextStage,
      nextThreshold,
      willEvolve: nextThreshold && newXP >= nextThreshold
    });
    
    // Check if evolution is needed using centralized logic
    const shouldEvolveNow = shouldEvolve(companionData.current_stage, newXP);
    let newStage = companionData.current_stage;
    
    if (shouldEvolveNow) {
      newStage = nextStage;
      logger.log('[Evolution Triggered]', { newStage, newXP, nextThreshold });
    }

    // XP events are logged server-side via triggers/functions
    // Client-side insert removed due to RLS policy restrictions


    // Update companion XP
    const { error: updateError } = await supabase
      .from("user_companion")
      .update({ current_xp: newXP })
      .eq("id", companionData.id)
      .eq("user_id", currentUser.id);

    if (updateError) throw updateError;

    return { shouldEvolve: shouldEvolveNow, newStage, newXP };
  };


  // Helper function to validate referral when user reaches Stage 3
  const validateReferralAtStage3 = async () => {
    if (!user) return;

    try {
      // Check if user was referred by someone
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("referred_by")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Error fetching profile for referral validation:", profileError);
        return;
      }
      if (!profile?.referred_by) return;

      // FIX Bugs #14, #16, #17, #21, #24: Use atomic function with retry logic and type safety
      const result = await retryWithBackoff<CompleteReferralStage3Result>(
        async () => {
          const response = await (supabase.rpc as unknown as (name: string, params: any) => Promise<{ data: any; error: any }>)(
            'complete_referral_stage3',
            { 
              p_referee_id: user.id,
              p_referrer_id: profile.referred_by
            }
          );
          
          const { data, error } = response as { data: CompleteReferralStage3Result | null; error: Error | null };

          if (error) throw error;
          if (!data) throw new Error("No data returned from referral completion");
          
          // Data from this RPC should match CompleteReferralStage3Result
          return data as unknown as CompleteReferralStage3Result;
        },
        {
          maxAttempts: 3,
          initialDelay: 1000,
          shouldRetry: (error: unknown) => {
            const msg = error instanceof Error ? error.message : String(error);
            
            // Don't retry business logic errors
            if (msg.includes('already_completed') ||
                msg.includes('concurrent_completion') ||
                msg.includes('not found')) {
              return false;
            }
            
            // Retry network/transient errors
            return msg.includes('network') ||
                   msg.includes('timeout') ||
                   msg.includes('temporarily unavailable') ||
                   msg.includes('connection') ||
                   msg.includes('ECONNRESET') ||
                   msg.includes('fetch');
          }
        }
      );

      if (!result || !result.success) {
        // Referral already completed or concurrent request (not an error)
        logger.log('Referral not completed:', result?.reason ?? 'unknown', result?.message ?? '');
        return;
      }

      // Success! Log the result with safe access
      logger.log('Referral completed successfully:', {
        newCount: result.new_count ?? 0,
        milestoneReached: result.milestone_reached ?? false,
        skinUnlocked: result.skin_unlocked ?? false
      });

    } catch (error) {
      console.error("Failed to validate referral after retries:", error);
      // Don't throw - this shouldn't block evolution
    }
  };

  const evolveCompanion = useMutation({
    mutationFn: async ({ newStage, currentXP }: { newStage: number; currentXP: number }) => {
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

        setIsEvolvingLoading(true);

        try {
        // Call the new evolution edge function with strict continuity
        const { data: evolutionData, error: evolutionError } = await supabase.functions.invoke(
          "generate-companion-evolution",
          {
            body: {
              userId: user.id,
            },
          }
        );

        if (evolutionError) {
          evolutionInProgress.current = false;
          throw evolutionError;
        }
        
        if (!evolutionData?.evolved) {
          evolutionInProgress.current = false;
          setIsEvolvingLoading(false);
          logger.log('Evolution not triggered:', evolutionData?.message);
          return null; // Return null instead of throwing when evolution isn't needed
        }

      const evolutionId = evolutionData.evolution_id;
        const newStage = evolutionData.new_stage;
        const oldStage = companion.current_stage;

      // FIX Bug #9: Check if we CROSSED Stage 3 (not just landed on it)
      // This handles cases where user skips from Stage 2 to Stage 4+
      if (oldStage < 3 && newStage >= 3) {
        await validateReferralAtStage3();
      }

      // Generate evolution cards for all stages up to current stage
      try {
        // Check which cards already exist
        const { data: existingCards } = await supabase
          .from("companion_evolution_cards")
          .select("evolution_stage")
          .eq("companion_id", companion.id);

        const existingStages = new Set(existingCards?.map(c => c.evolution_stage) || []);

        // Generate cards for missing stages (stage 0 through current stage)
        for (let stage = 0; stage <= newStage; stage++) {
          if (!existingStages.has(stage)) {
            logger.log(`Generating card for stage ${stage}`);
            
            // Get the evolution record for this stage
            const { data: evolutionRecord } = await supabase
              .from("companion_evolutions")
              .select("id")
              .eq("companion_id", companion.id)
              .eq("stage", stage)
              .maybeSingle();
            
            // Special handling for stage 0 - ensure evolution record exists
            let stageEvolutionId = evolutionRecord?.id;
            
            if (stage === 0 && !evolutionRecord) {
              logger.log("Stage 0 evolution record not found, creating one...");
              
              // Get the companion's initial image
              const { data: companionData } = await supabase
                .from("user_companion")
                .select("initial_image_url, created_at")
                .eq("id", companion.id)
                .maybeSingle();
              
              // Create stage 0 evolution record
              const { data: newStage0Evolution, error: stage0Error } = await supabase
                .from("companion_evolutions")
                .insert({
                  companion_id: companion.id,
                  stage: 0,
                  image_url: companionData?.initial_image_url || null,
                  xp_at_evolution: 0,
                  evolved_at: companionData?.created_at || new Date().toISOString(),
                })
                .select()
                .maybeSingle();
              
              if (!stage0Error && newStage0Evolution) {
                stageEvolutionId = newStage0Evolution.id;
                logger.log("Created stage 0 evolution record:", stageEvolutionId);
              } else {
                console.error("Failed to create stage 0 evolution record:", stage0Error);
              }
            }
            
            // Only generate card if we have a valid evolution ID for this stage
            if (stageEvolutionId) {
              await supabase.functions.invoke("generate-evolution-card", {
                body: {
                  companionId: companion.id,
                  evolutionId: stageEvolutionId,
                  stage: stage,
                  species: companion.spirit_animal,
                  element: companion.core_element,
                  color: companion.favorite_color,
                  userAttributes: {
                    body: companion.body || 0,
                    mind: companion.mind || 0,
                    soul: companion.soul || 0,
                  },
                },
              });
            } else {
              logger.warn(`Skipping card generation for stage ${stage} - no evolution record found`);
            }
          }
        }
      } catch (cardError) {
        console.error("Failed to generate evolution card:", cardError);
        // Don't fail the evolution if card generation fails
      }

      // Auto-generate story chapter for this evolution stage
      const { data: existingStory } = await supabase
        .from("companion_stories")
        .select("id")
        .eq("companion_id", companion.id)
        .eq("stage", newStage)
        .maybeSingle();

      if (!existingStory) {
        // Generate story chapter in the background - properly handled promise
        (async () => {
          try {
            await supabase.functions.invoke("generate-companion-story", {
              body: {
                companionId: companion.id,
                stage: newStage,
                tonePreference: "heroic",
                themeIntensity: "moderate",
              },
            });
            logger.log(`Stage ${newStage} story generation started`);
            queryClient.invalidateQueries({ queryKey: ["companion-story"] });
            queryClient.invalidateQueries({ queryKey: ["companion-stories-all"] });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(`Failed to auto-generate story for stage ${newStage} (non-critical):`, errorMessage);
            // Don't throw - story generation is not critical to evolution
          }
        })().catch((error) => {
          console.warn('Story generation promise rejected:', error?.message || error);
        });
      }

          return evolutionData.image_url;
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
    onSuccess: (imageUrl) => {
      evolutionInProgress.current = false;
      // Only invalidate queries if evolution actually happened
      if (imageUrl) {
        // Don't hide overlay here - let CompanionEvolution handle it
        // The overlay will remain visible until the animation completes
        queryClient.invalidateQueries({ queryKey: ["companion"] });
        queryClient.invalidateQueries({ queryKey: ["companion-stories-all"] });
        queryClient.invalidateQueries({ queryKey: ["evolution-cards"] });
      }
    },
    onError: (error) => {
      evolutionInProgress.current = false;
      setIsEvolvingLoading(false);
      console.error("Evolution failed:", error);
      toast.error(error instanceof Error ? error.message : "Unable to evolve your companion. Please try again.");
    },
  });

  // Memoize calculated values to prevent unnecessary recalculations
  const nextEvolutionXP = useMemo(() => {
    if (!companion) return null;
    return getThreshold(companion.current_stage + 1);
  }, [companion, getThreshold]);

  const progressToNext = useMemo(() => {
    if (!companion || !nextEvolutionXP) return 0;
    return ((companion.current_xp / nextEvolutionXP) * 100);
  }, [companion, nextEvolutionXP]);

  return {
    companion,
    isLoading,
    error,
    createCompanion,
    awardXP,
    evolveCompanion,
    nextEvolutionXP,
    progressToNext,
    isEvolvingLoading,
  };
};