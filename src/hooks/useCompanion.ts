import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { retryWithBackoff } from "@/utils/retry";
import { useRef, useState } from "react";

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
  0: 0,       // Dormant Egg
  1: 10,      // Cracking Awakening (Tutorial-optimized)
  2: 30,      // Newborn Emergence
  3: 60,      // Early Infant
  4: 100,     // Juvenile Form
  5: 150,     // Young Explorer
  6: 210,     // Adolescent Guardian
  7: 280,     // Initiate Protector
  8: 360,     // Seasoned Guardian
  9: 450,     // Mature Protector
  10: 550,    // Veteran Form (achievable in 2-3 months)
  11: 700,    // Elevated Form (endgame begins)
  12: 900,    // Ascended Form
  13: 1150,   // Ether-Born Avatar
  14: 1450,   // Primordial Aspect
  15: 1800,   // Colossus Form
  16: 2250,   // Cosmic Guardian
  17: 2800,   // Astral Overlord
  18: 3500,   // Universal Sovereign
  19: 4400,   // Mythic Apex
  20: 5500,   // Origin of Creation (ultimate form)
};

export const useCompanion = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Prevent duplicate evolution/XP requests during lag
  const evolutionInProgress = useRef(false);
  const xpInProgress = useRef(false);
  const [isEvolvingLoading, setIsEvolvingLoading] = useState(false);

  const { data: companion, isLoading } = useQuery({
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
  });

  const createCompanion = useMutation({
    mutationFn: async (data: {
      favoriteColor: string;
      spiritAnimal: string;
      coreElement: string;
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
          shouldRetry: (error: any) => {
            // Don't retry on payment/credits errors
            if (error?.message?.includes("INSUFFICIENT_CREDITS") || 
                error?.message?.includes("temporarily unavailable") ||
                error?.message?.includes("contact support")) {
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
          current_stage: 0,
          current_xp: 0,
          current_image_url: imageData.imageUrl,
          eye_color: eyeColor,
          fur_color: furColor,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Record initial evolution
      await supabase.from("companion_evolutions").insert({
        companion_id: companionData.id,
        stage: 0,
        image_url: imageData.imageUrl,
        xp_at_evolution: 0,
      });

      // Auto-generate the first chapter of the companion's story in background
      supabase.functions.invoke('generate-companion-story', {
        body: {
          companionId: companionData.id,
          stage: 0,
          tonePreference: "heroic",
          themeIntensity: "moderate",
        }
      }).then(() => {
        console.log("Stage 0 story generation started");
        queryClient.invalidateQueries({ queryKey: ["companion-story"] });
        queryClient.invalidateQueries({ queryKey: ["companion-stories-all"] });
      }).catch((storyError) => {
        console.error("Failed to auto-generate stage 0 story:", storyError);
        // Don't fail companion creation if story generation fails
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
      if (!user || !companion) throw new Error("No companion found");

      const newXP = companion.current_xp + xpAmount;
      
      // Check if evolution is needed
      const currentThreshold = EVOLUTION_THRESHOLDS[companion.current_stage as keyof typeof EVOLUTION_THRESHOLDS];
      const nextStage = companion.current_stage + 1;
      const nextThreshold = EVOLUTION_THRESHOLDS[nextStage as keyof typeof EVOLUTION_THRESHOLDS];
      
      let shouldEvolve = false;
      let newStage = companion.current_stage;
      
      if (nextThreshold && newXP >= nextThreshold) {
        shouldEvolve = true;
        newStage = nextStage;
      }

      // Record XP event
      await supabase.from("xp_events").insert({
        user_id: user.id,
        companion_id: companion.id,
        event_type: eventType,
        xp_earned: xpAmount,
        event_metadata: metadata,
      });

      // Update companion XP
      const { error: updateError } = await supabase
        .from("user_companion")
        .update({ current_xp: newXP })
        .eq("id", companion.id);

      if (updateError) throw updateError;

      return { shouldEvolve, newStage, newXP };
    },
    onSuccess: async ({ shouldEvolve, newStage, newXP }) => {
      xpInProgress.current = false;
      queryClient.invalidateQueries({ queryKey: ["companion"] });
      
      if (shouldEvolve && companion) {
        // Show overlay immediately BEFORE toast
        setIsEvolvingLoading(true);
        toast.success("🎉 Your companion is ready to evolve!");
        // Trigger evolution
        evolveCompanion.mutate({ newStage, currentXP: newXP });
      }
    },
    onError: () => {
      xpInProgress.current = false;
    },
  });

  const evolveCompanion = useMutation({
    mutationFn: async ({ newStage, currentXP }: { newStage: number; currentXP: number }) => {
      // Prevent duplicate evolution requests
      if (evolutionInProgress.current) {
        throw new Error('Evolution in progress');
      }
      evolutionInProgress.current = true;
      
      if (!user || !companion) throw new Error("No companion found");

      setIsEvolvingLoading(true);

      // Generate evolved image with consistent colors
      const { data: imageData, error: imageError } = await supabase.functions.invoke(
        "generate-companion-image",
        {
          body: {
            favoriteColor: companion.favorite_color,
            spiritAnimal: companion.spirit_animal,
            element: companion.core_element,
            stage: newStage,
            previousImageUrl: companion.current_image_url,
            eyeColor: companion.eye_color || `glowing ${companion.favorite_color}`,
            furColor: companion.fur_color || companion.favorite_color,
          },
        }
      );

      if (imageError) throw imageError;
      if (!imageData?.imageUrl) throw new Error("Unable to generate evolution image. Please try again.");

      // Update companion
      const { error: updateError } = await supabase
        .from("user_companion")
        .update({
          current_stage: newStage,
          current_image_url: imageData.imageUrl,
        })
        .eq("id", companion.id);

      if (updateError) throw updateError;

      // Record evolution (check if it doesn't already exist for this stage)
      const { data: existingEvolution } = await supabase
        .from("companion_evolutions")
        .select("id")
        .eq("companion_id", companion.id)
        .eq("stage", newStage)
        .maybeSingle();

      let evolutionId;
      if (!existingEvolution) {
        const { data: newEvolution, error: evolutionError } = await supabase
          .from("companion_evolutions")
          .insert({
            companion_id: companion.id,
            stage: newStage,
            image_url: imageData.imageUrl,
            xp_at_evolution: currentXP,
          })
          .select()
          .single();

        if (evolutionError) throw evolutionError;
        evolutionId = newEvolution.id;
      } else {
        evolutionId = existingEvolution.id;
      }

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
            await supabase.functions.invoke("generate-evolution-card", {
              body: {
                companionId: companion.id,
                evolutionId: evolutionId,
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

      return imageData.imageUrl;
    },
    onSuccess: () => {
      evolutionInProgress.current = false;
      // Don't hide overlay here - let CompanionEvolution handle it
      // The overlay will remain visible until the animation completes
      queryClient.invalidateQueries({ queryKey: ["companion"] });
      queryClient.invalidateQueries({ queryKey: ["companion-stories-all"] });
      queryClient.invalidateQueries({ queryKey: ["evolution-cards"] });
    },
    onError: (error) => {
      evolutionInProgress.current = false;
      setIsEvolvingLoading(false);
      console.error("Evolution failed:", error);
      toast.error(error instanceof Error ? error.message : "Unable to evolve your companion. Please try again.");
    },
  });

  const nextEvolutionXP = companion
    ? EVOLUTION_THRESHOLDS[(companion.current_stage + 1) as keyof typeof EVOLUTION_THRESHOLDS]
    : null;

  const progressToNext = companion && nextEvolutionXP
    ? ((companion.current_xp / nextEvolutionXP) * 100)
    : 0;

  return {
    companion,
    isLoading,
    createCompanion,
    awardXP,
    evolveCompanion,
    nextEvolutionXP,
    progressToNext,
    isEvolvingLoading,
    setIsEvolvingLoading,
  };
};