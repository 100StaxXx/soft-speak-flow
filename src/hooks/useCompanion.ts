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

  // Prevent duplicate evolution/XP requests during lag
  const evolutionInProgress = useRef(false);
  const evolutionPromise = useRef<Promise<unknown> | null>(null);
  const xpInProgress = useRef(false);

  const { data: companion, isLoading, error } = useQuery({
    queryKey: ["companion", user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from("user_companion")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data as Companion | null;
    },
    enabled: !!user,
    staleTime: 30000, // 30 seconds - prevents unnecessary refetches
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
      if (!user) throw new Error("Not authenticated");

      // Determine consistent colors for the companion's lifetime
      const eyeColor = `glowing ${data.favoriteColor}`;
      const furColor = data.favoriteColor;

      // Generate initial companion image with color specifications (with retry)
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
            if (error.message?.includes("INSUFFICIENT_CREDITS") || error.message?.includes("Insufficient AI credits")) {
              throw new Error("The companion creation service is temporarily unavailable. Please contact support.");
            }
            if (error.message?.includes("RATE_LIMITED") || error.message?.includes("AI service is currently busy")) {
              throw new Error("The service is currently busy. Please wait a moment and try again.");
            }
            throw new Error(error.message || "Failed to generate companion image. Please try again.");
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
            // Don't retry on payment/credits errors
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes("INSUFFICIENT_CREDITS") ||
                errorMessage.includes("temporarily unavailable") ||
                errorMessage.includes("contact support")) {
              return false;
            }
            return true;
          }
        }
      );

      if (!imageData?.imageUrl) {
        console.error("Missing imageUrl after generation:", imageData);
        throw new Error("Unable to create your companion's image. Please try again.");
      }

      console.log("Creating companion with data:", {
        favoriteColor: data.favoriteColor,
        spiritAnimal: data.spiritAnimal,
        coreElement: data.coreElement,
        storyTone: data.storyTone,
        imageUrl: imageData.imageUrl
      });

      // Use atomic database function to create companion (prevents duplicates)
      const { data: companionResult, error: createError } = await supabase
        .rpc('create_companion_if_not_exists', {
          p_user_id: user.id,
          p_favorite_color: data.favoriteColor,
          p_spirit_animal: data.spiritAnimal,
          p_core_element: data.coreElement,
          p_story_tone: data.storyTone,
          p_current_image_url: imageData.imageUrl,
          p_initial_image_url: imageData.imageUrl,
          p_eye_color: eyeColor,
          p_fur_color: furColor,
        });

      if (createError) {
        console.error("Database error creating companion:", createError);
        throw new Error(`Failed to save companion: ${createError.message}`);
      }
      
      if (!companionResult || companionResult.length === 0) {
        console.error("No companion data returned from function");
        throw new Error("Failed to create companion");
      }

      const companionData = companionResult[0];
      const isNewCompanion = companionData.is_new;

      console.log(`Companion ${isNewCompanion ? 'created' : 'already exists'}:`, companionData.id);

      // Check if stage 0 evolution exists (regardless of whether companion is new)
      const { data: existingEvolution } = await supabase
        .from("companion_evolutions")
        .select("id")
        .eq("companion_id", companionData.id)
        .eq("stage", 0)
        .maybeSingle();

      // Create stage 0 evolution if missing
      if (!existingEvolution) {
        console.log("Creating stage 0 evolution...");
        const { data: stageZeroEvolution, error: stageZeroInsertError } = await supabase
          .from("companion_evolutions")
          .insert({
            companion_id: companionData.id,
            stage: 0,
            image_url: imageData.imageUrl,
            xp_at_evolution: 0,
          })
          .select()
          .single();

        if (stageZeroInsertError || !stageZeroEvolution) {
          console.error("Failed to create stage 0 evolution:", stageZeroInsertError);
          throw stageZeroInsertError || new Error("Unable to record stage 0 evolution");
        }

        // Generate stage 0 card
        console.log("Generating stage 0 card...");
        const generateStageZeroCard = async () => {
          try {
            // Fetch full companion data with attributes
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
            console.log("Stage 0 card generation initiated");
          } catch (cardError) {
            console.error("Failed to generate stage 0 card:", cardError);
          }
        };

        await generateStageZeroCard();
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

              console.log("Stage 0 story generation started");
              queryClient.invalidateQueries({ queryKey: ["companion-story"] });
              queryClient.invalidateQueries({ queryKey: ["companion-stories-all"] });
              return;
            } catch (storyError) {
              const errorMessage = storyError instanceof Error ? storyError.message : String(storyError);
              const isTransient = errorMessage.includes('network') ||
                                 errorMessage.includes('timeout') ||
                                 errorMessage.includes('temporarily unavailable');

              if (attempt < attempts && isTransient) {
                console.log(`Story generation attempt ${attempt} failed, retrying...`);
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companion"] });
      toast.success("🎉 Your companion is ready!");
    },
    onError: (error) => {
      console.error("Failed to create companion:", error);
      toast.error(error instanceof Error ? error.message : "Unable to create your companion. Please try again.");
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
      metadata?: Record<string, any>;
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
          console.warn('Companion not loaded yet, fetching...');
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
    metadata: Record<string, any>,
    currentUser: typeof user
  ) => {
    if (!currentUser?.id) {
      throw new Error("Not authenticated");
    }
    xpInProgress.current = true;

    const newXP = companionData.current_xp + xpAmount;
    const nextStage = companionData.current_stage + 1;
    const nextThreshold = getThreshold(nextStage);
    
    console.log('[XP Award Debug]', {
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
      console.log('[Evolution Triggered]', { newStage, newXP, nextThreshold });
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


  const evolveCompanion = useMutation({
    mutationFn: async ({ newStage, currentXP }: { newStage: number; currentXP: number }) => {
      // Prevent duplicate evolution requests - wait for any ongoing evolution
      if (evolutionInProgress.current) {
        console.log('Evolution already in progress, rejecting duplicate request');
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
          console.log('Evolution not triggered:', evolutionData?.message);
          return null; // Return null instead of throwing when evolution isn't needed
        }

      const evolutionId = evolutionData.evolution_id;
        const newStage = evolutionData.new_stage;

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
            console.log(`Generating card for stage ${stage}`);
            
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
              console.log("Stage 0 evolution record not found, creating one...");
              
              // Get the companion's initial image
              const { data: companionData } = await supabase
                .from("user_companion")
                .select("initial_image_url, created_at")
                .eq("id", companion.id)
                .single();
              
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
                .single();
              
              if (!stage0Error && newStage0Evolution) {
                stageEvolutionId = newStage0Evolution.id;
                console.log("Created stage 0 evolution record:", stageEvolutionId);
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
              console.warn(`Skipping card generation for stage ${stage} - no evolution record found`);
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
            console.log(`Stage ${newStage} story generation started`);
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
  }, [companion?.current_stage, companion?.id, getThreshold]);

  const progressToNext = useMemo(() => {
    if (!companion || !nextEvolutionXP) return 0;
    return ((companion.current_xp / nextEvolutionXP) * 100);
  }, [companion?.current_xp, companion?.id, nextEvolutionXP]);

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