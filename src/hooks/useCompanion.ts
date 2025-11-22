import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useAchievements } from "./useAchievements";
import { toast } from "sonner";
import { retryWithBackoff } from "@/utils/retry";
import { useRef, useMemo, useCallback } from "react";
import { useEvolution } from "@/contexts/EvolutionContext";

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

export const XP_REWARDS = {
  HABIT_COMPLETE: 5,
  ALL_HABITS_COMPLETE: 10,
  CHALLENGE_COMPLETE: 20,
  WEEKLY_CHALLENGE: 50,
  PEP_TALK_LISTEN: 3,
  CHECK_IN: 5,
  STREAK_MILESTONE: 15,
};

// 21-Stage Evolution System: Early stages fast, late stages exponential
export const EVOLUTION_THRESHOLDS = {
  0: 0,      // Egg
  1: 15,     // Hatchling (first quest completes this!)
  2: 120,    // Guardian (was stage 3)
  3: 250,    // Ascended (was stage 4)
  4: 500,    // Mythic (was stage 5)
  5: 1200,   // Titan (was stage 6)
  6: 2500,   // (was stage 7)
  7: 5000,   // (was stage 8)
  8: 10000,  // (was stage 9)
  9: 20000,  // (was stage 10)
  10: 35000, // (was stage 11)
  11: 50000, // (was stage 12)
  12: 75000, // (was stage 13)
  13: 100000, // (was stage 14)
  14: 150000, // (was stage 15)
  15: 200000, // (was stage 16)
  16: 300000, // (was stage 17)
  17: 450000, // (was stage 18)
  18: 650000, // (was stage 19)
  19: 1000000, // (was stage 20)
  20: 1500000, // NEW Ultimate stage
};

export const useCompanion = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { checkCompanionAchievements } = useAchievements();
  const { isEvolvingLoading, setIsEvolvingLoading } = useEvolution();

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
    retry: 2,
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
            if (error.message?.includes("INSUFFICIENT_CREDITS") || error.message?.includes("Insufficient AI credits")) {
              throw new Error("The companion creation service is temporarily unavailable. Please contact support.");
            }
            if (error.message?.includes("RATE_LIMITED") || error.message?.includes("AI service is currently busy")) {
              throw new Error("The service is currently busy. Please wait a moment and try again.");
            }
            throw error;
          }
          
          if (!imageResult?.imageUrl) throw new Error("Unable to create your companion's image. Please try again.");
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

      if (!imageData?.imageUrl) throw new Error("Unable to create your companion's image. Please try again.");

      // Create companion record with color specifications
      const { data: companionData, error: createError } = await supabase
        .from("user_companion")
        .insert({
          user_id: user.id,
          favorite_color: data.favoriteColor,
          spirit_animal: data.spiritAnimal,
          core_element: data.coreElement,
          story_tone: data.storyTone,
          current_stage: 0,
          current_xp: 0,
          current_image_url: imageData.imageUrl,
          eye_color: eyeColor,
          fur_color: furColor,
        })
        .select()
        .maybeSingle();

      if (createError) throw createError;
      if (!companionData) throw new Error("Failed to create companion");

      // Record initial evolution
      await supabase.from("companion_evolutions").insert({
        companion_id: companionData.id,
        stage: 0,
        image_url: imageData.imageUrl,
        xp_at_evolution: 0,
      });

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
            // Don't fail companion creation if story generation fails
            // Story can be regenerated later by the user
            break;
          }
        }
      };

      // Start story generation in background (don't await)
      generateStoryWithRetry().catch(() => {
        // Final catch to prevent unhandled rejection
      });

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
      
      // CRITICAL: Ensure companion is loaded before awarding XP
      if (!companion) {
        console.warn('Companion not loaded yet, fetching...');
        // Refetch companion data and wait for it to complete
        await queryClient.refetchQueries({ queryKey: ["companion", user.id] });
        const freshCompanion = queryClient.getQueryData(["companion", user.id]) as Companion | null;
        if (!freshCompanion) {
          throw new Error("No companion found. Please create one first.");
        }
        // Use fresh companion for calculation
        const companionToUse = freshCompanion;
        
        // Prevent duplicate XP awards
        if (xpInProgress.current) {
          console.warn('XP award already in progress, skipping duplicate');
          return { shouldEvolve: false, newStage: companionToUse.current_stage, newXP: companionToUse.current_xp };
        }
        
        return await performXPAward(companionToUse, xpAmount, eventType, metadata, user);
      }
      
      // Prevent duplicate XP awards
      if (xpInProgress.current) {
        console.warn('XP award already in progress, skipping duplicate');
        return { shouldEvolve: false, newStage: companion.current_stage, newXP: companion.current_xp };
      }
      
      return await performXPAward(companion, xpAmount, eventType, metadata, user);
    },
    onSuccess: async ({ shouldEvolve, newStage, newXP }) => {
      xpInProgress.current = false;
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
      xpInProgress.current = false;
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
    xpInProgress.current = true;

    const newXP = companionData.current_xp + xpAmount;
    
    // Check if evolution is needed
    const currentThreshold = EVOLUTION_THRESHOLDS[companionData.current_stage as keyof typeof EVOLUTION_THRESHOLDS];
    const nextStage = companionData.current_stage + 1;
    const nextThreshold = EVOLUTION_THRESHOLDS[nextStage as keyof typeof EVOLUTION_THRESHOLDS];
    
    console.log('[XP Award Debug]', {
      currentStage: companionData.current_stage,
      currentXP: companionData.current_xp,
      xpAmount,
      newXP,
      currentThreshold,
      nextStage,
      nextThreshold,
      willEvolve: nextThreshold && newXP >= nextThreshold
    });
    
    let shouldEvolve = false;
    let newStage = companionData.current_stage;
    
    if (nextThreshold && newXP >= nextThreshold) {
      shouldEvolve = true;
      newStage = nextStage;
      console.log('[Evolution Triggered]', { newStage, newXP, nextThreshold });
    }

    // Record XP event
    await supabase.from("xp_events").insert({
      user_id: currentUser!.id,
      companion_id: companionData.id,
      event_type: eventType,
      xp_earned: xpAmount,
      event_metadata: metadata,
    });

    // Update companion XP
    const { error: updateError } = await supabase
      .from("user_companion")
      .update({ current_xp: newXP })
      .eq("id", companionData.id);

    if (updateError) throw updateError;

    return { shouldEvolve, newStage, newXP };
  };


  const evolveCompanion = useMutation({
    mutationFn: async ({ newStage, currentXP }: { newStage: number; currentXP: number }) => {
      // Prevent duplicate evolution requests - wait for any ongoing evolution
      if (evolutionInProgress.current && evolutionPromise.current) {
        console.log('Evolution already in progress, waiting for completion');
        await evolutionPromise.current;
        return null;
      }

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

        // Generate cards for missing stages (stages 1 through newStage)
        for (let stage = 1; stage <= newStage; stage++) {
          if (!existingStages.has(stage)) {
            console.log(`Generating card for stage ${stage}`);
            
            // Get the evolution record for this stage
            const { data: evolutionRecord } = await supabase
              .from("companion_evolutions")
              .select("id")
              .eq("companion_id", companion.id)
              .eq("stage", stage)
              .maybeSingle();
            
            await supabase.functions.invoke("generate-evolution-card", {
              body: {
                companionId: companion.id,
                evolutionId: evolutionRecord?.id || evolutionId,
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
        // Generate story chapter in the background
        supabase.functions.invoke("generate-companion-story", {
          body: {
            companionId: companion.id,
            stage: newStage,
            tonePreference: "heroic",
            themeIntensity: "moderate",
          },
        }).then(() => {
          console.log(`Stage ${newStage} story generation started`);
          queryClient.invalidateQueries({ queryKey: ["companion-story"] });
          queryClient.invalidateQueries({ queryKey: ["companion-stories-all"] });
        }).catch((error) => {
          console.error(`Failed to auto-generate story for stage ${newStage}:`, error);
          // Don't throw - story generation is not critical to evolution
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
    return EVOLUTION_THRESHOLDS[(companion.current_stage + 1) as keyof typeof EVOLUTION_THRESHOLDS];
  }, [companion?.current_stage]);

  const progressToNext = useMemo(() => {
    if (!companion || !nextEvolutionXP) return 0;
    return ((companion.current_xp / nextEvolutionXP) * 100);
  }, [companion?.current_xp, nextEvolutionXP]);

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