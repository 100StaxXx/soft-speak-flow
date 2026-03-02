import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import type { GenerationPhase } from "@/components/ImageGenerationProgress";
import { generateWithValidation } from "@/utils/validateCompanionImage";

const MAX_REGENERATIONS = 2;

export const useCompanionRegenerate = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [generationPhase, setGenerationPhase] = useState<GenerationPhase>('starting');
  const [retryCount, setRetryCount] = useState(0);

  const regenerateMutation = useMutation({
    mutationFn: async (companion: {
      id: string;
      spirit_animal: string;
      core_element: string;
      favorite_color: string;
      current_stage: number;
      eye_color?: string;
      fur_color?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");

      // Reset progress state
      setGenerationPhase('starting');
      setRetryCount(0);

      const { data: latestCompanion, error: latestCompanionError } = await supabase
        .from("user_companion")
        .select("image_regenerations_used")
        .eq("id", companion.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (latestCompanionError) {
        console.error("Failed to verify regeneration count:", latestCompanionError);
        throw new Error("Unable to verify look refresh status. Please try again.");
      }

      const regenerationsUsed = latestCompanion?.image_regenerations_used ?? 0;
      if (regenerationsUsed >= MAX_REGENERATIONS) {
        throw new Error("You've used all your look refreshes");
      }

      // Start generation phase
      setGenerationPhase('generating');

      // Use shared validation helper for consistent behavior with initial hatching
      const { imageUrl, validationPassed, retryCount: finalRetryCount } = await generateWithValidation(
        {
          favoriteColor: companion.favorite_color,
          spiritAnimal: companion.spirit_animal,
          element: companion.core_element,
          stage: companion.current_stage,
          eyeColor: companion.eye_color,
          furColor: companion.fur_color,
          flowType: "regenerate",
        },
        {
          maxRetries: 1,
          onRetry: (attempt) => {
            setGenerationPhase('retrying');
            setRetryCount(attempt);
          },
          onValidating: () => {
            setGenerationPhase('validating');
          },
        }
      );

      // Update local retry count state
      setRetryCount(finalRetryCount);

      // Finalizing phase
      setGenerationPhase('finalizing');

      // Update companion with new image and increment regeneration count atomically
      const { data: updatedRow, error: updateError } = await supabase
        .from("user_companion")
        .update({
          current_image_url: imageUrl,
          dormant_image_url: null,
          neglected_image_url: null,
          scarred_image_url: null,
          image_regenerations_used: regenerationsUsed + 1,
        })
        .eq("id", companion.id)
        .eq("user_id", user.id)
        .eq("image_regenerations_used", regenerationsUsed)
        .select("image_regenerations_used")
        .single();

      if (updateError) {
        const errorCode = (updateError as { code?: string })?.code;
        if (errorCode === "PGRST116") {
          throw new Error("Look refresh already used. Please refresh to continue.");
        }
        throw updateError;
      }

      const totalUsed = updatedRow?.image_regenerations_used ?? regenerationsUsed + 1;

      // Complete
      setGenerationPhase(validationPassed ? 'complete' : 'warning');

      return { 
        imageUrl, 
        imageRegenerationsUsed: totalUsed,
        regenerationsRemaining: Math.max(0, MAX_REGENERATIONS - totalUsed),
        validationPassed,
        retryCount
      };
    },
    onSuccess: (data) => {
      queryClient.setQueriesData(
        { queryKey: ["companion"] },
        (cachedCompanion: unknown) => {
          if (!cachedCompanion || typeof cachedCompanion !== "object") return cachedCompanion;
          return {
            ...(cachedCompanion as Record<string, unknown>),
            current_image_url: data.imageUrl,
            dormant_image_url: null,
            neglected_image_url: null,
            scarred_image_url: null,
            image_regenerations_used: data.imageRegenerationsUsed,
            updated_at: new Date().toISOString(),
          };
        },
      );

      queryClient.setQueriesData(
        { queryKey: ["companion-health"] },
        (cachedHealth: unknown) => {
          if (!cachedHealth || typeof cachedHealth !== "object") return cachedHealth;
          return {
            ...(cachedHealth as Record<string, unknown>),
            current_image_url: data.imageUrl,
            neglected_image_url: null,
          };
        },
      );

      queryClient.setQueriesData(
        { queryKey: ["community-members"] },
        (cachedMembers: unknown) => {
          if (!Array.isArray(cachedMembers) || !user?.id) return cachedMembers;

          return cachedMembers.map((member) => {
            if (!member || typeof member !== "object") return member;

            const typedMember = member as {
              user_id?: string;
              companion?: Record<string, unknown> | null;
            };

            if (typedMember.user_id !== user.id || !typedMember.companion) {
              return member;
            }

            return {
              ...typedMember,
              companion: {
                ...typedMember.companion,
                current_image_url: data.imageUrl,
              },
            };
          });
        },
      );

      queryClient.invalidateQueries({ queryKey: ["companion"] });
      queryClient.invalidateQueries({ queryKey: ["companion-health"] });
      queryClient.invalidateQueries({ queryKey: ["community-members"] });
      if (data.validationPassed) {
        toast.success(`New look unlocked! ${data.regenerationsRemaining} look refresh${data.regenerationsRemaining === 1 ? '' : 'es'} remaining.`);
      } else {
        toast.success(`Companion created! ${data.regenerationsRemaining} look refresh${data.regenerationsRemaining === 1 ? '' : 'es'} remaining. You can refresh the look again if needed.`);
      }
      // Close dialog after successful regeneration
      setTimeout(() => setShowConfirmDialog(false), 1500);
    },
    onError: (error) => {
      console.error("Regeneration failed:", error);
      setGenerationPhase('starting');
      toast.error(error instanceof Error ? error.message : "Failed to refresh companion look");
    },
  });

  const resetProgress = () => {
    setGenerationPhase('starting');
    setRetryCount(0);
  };

  return {
    regenerate: regenerateMutation.mutate,
    isRegenerating: regenerateMutation.isPending,
    showConfirmDialog,
    setShowConfirmDialog,
    maxRegenerations: MAX_REGENERATIONS,
    generationPhase,
    retryCount,
    resetProgress,
  };
};
