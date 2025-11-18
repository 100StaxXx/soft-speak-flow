import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

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
  energy?: number;
  resilience?: number;
  focus?: number;
  balance?: number;
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

      // Generate initial companion image with color specifications
      const { data: imageData, error: imageError } = await supabase.functions.invoke(
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

      if (imageError) throw imageError;
      if (!imageData?.imageUrl) throw new Error("Failed to generate companion image");

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

      // Generate the first chapter of the companion's story
      try {
        await supabase.functions.invoke('generate-companion-story', {
          body: {
            companionId: companionData.id,
            userId: user.id,
            stage: 0
          }
        });
      } catch (storyError) {
        console.error("Error generating initial companion story:", storyError);
        // Don't fail companion creation if story generation fails
      }

      return companionData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companion"] });
      toast.success("Your companion has been created!");
    },
    onError: (error) => {
      console.error("Failed to create companion:", error);
      toast.error("Failed to create your companion. Please try again.");
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
      queryClient.invalidateQueries({ queryKey: ["companion"] });
      
      if (shouldEvolve && companion) {
        toast.success("🎉 Your companion is ready to evolve!");
        // Trigger evolution
        evolveCompanion.mutate({ newStage, currentXP: newXP });
      }
    },
  });

  const evolveCompanion = useMutation({
    mutationFn: async ({ newStage, currentXP }: { newStage: number; currentXP: number }) => {
      if (!user || !companion) throw new Error("No companion found");

      toast.loading("Your companion is evolving...", { id: "evolution" });

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
      if (!imageData?.imageUrl) throw new Error("Failed to generate evolution image");

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

      if (!existingEvolution) {
        await supabase.from("companion_evolutions").insert({
          companion_id: companion.id,
          stage: newStage,
          image_url: imageData.imageUrl,
          xp_at_evolution: currentXP,
        });
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
        }).catch((error) => {
          console.error("Failed to auto-generate story:", error);
          // Don't throw - story generation is not critical to evolution
        });
      }

      return imageData.imageUrl;
    },
    onSuccess: () => {
      toast.dismiss("evolution");
      toast.success("🌟 Evolution complete! Your companion has grown stronger!");
      queryClient.invalidateQueries({ queryKey: ["companion"] });
      queryClient.invalidateQueries({ queryKey: ["companion-stories-all"] });
    },
    onError: (error) => {
      toast.dismiss("evolution");
      console.error("Evolution failed:", error);
      toast.error("Evolution failed. Please try again.");
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
  };
};