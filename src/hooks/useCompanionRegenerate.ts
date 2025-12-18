import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import type { GenerationPhase } from "@/components/ImageGenerationProgress";

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
        throw new Error("Unable to verify regeneration status. Please try again.");
      }

      const regenerationsUsed = latestCompanion?.image_regenerations_used ?? 0;
      if (regenerationsUsed >= MAX_REGENERATIONS) {
        throw new Error("You've used all your regenerations");
      }

      // Start generation phase
      setGenerationPhase('generating');

      // Call the image generation function with validation and retry support
      const generateWithRetry = async (retryAttempt: number = 0): Promise<{ imageUrl: string; validationPassed: boolean }> => {
        if (retryAttempt > 0) {
          setGenerationPhase('retrying');
          setRetryCount(retryAttempt);
        }

        const { data: imageResult, error: imageError } = await supabase.functions.invoke(
          "generate-companion-image",
          {
            body: {
              favoriteColor: companion.favorite_color,
              spiritAnimal: companion.spirit_animal,
              element: companion.core_element,
              stage: companion.current_stage,
              eyeColor: companion.eye_color,
              furColor: companion.fur_color,
              retryAttempt,
            },
          }
        );

        if (imageError) {
          const errorMsg = imageError.message || String(imageError);
          if (errorMsg.includes("RATE_LIMITED") || errorMsg.includes("busy")) {
            throw new Error("Service is busy. Please try again in a moment.");
          }
          throw new Error("Failed to regenerate image. Please try again.");
        }

        if (!imageResult?.imageUrl) {
          throw new Error("Failed to generate new image");
        }

        // Validate the generated image
        setGenerationPhase('validating');
        
        try {
          const { data: validationResult } = await supabase.functions.invoke(
            "validate-companion-image",
            {
              body: {
                imageUrl: imageResult.imageUrl,
                spiritAnimal: companion.spirit_animal,
              },
            }
          );

          // If validation fails and we haven't exhausted retries, try again
          if (validationResult && !validationResult.valid && validationResult.confidence > 70 && retryAttempt < 2) {
            console.log(`Validation failed (confidence: ${validationResult.confidence}), retrying...`, validationResult.issues);
            return generateWithRetry(retryAttempt + 1);
          }

          return {
            imageUrl: imageResult.imageUrl,
            validationPassed: validationResult?.valid !== false
          };
        } catch (validationError) {
          console.warn("Validation service unavailable, accepting image:", validationError);
          return {
            imageUrl: imageResult.imageUrl,
            validationPassed: true
          };
        }
      };

      const { imageUrl, validationPassed } = await generateWithRetry();

      // Finalizing phase
      setGenerationPhase('finalizing');

      // Update companion with new image and increment regeneration count atomically
      const { data: updatedRow, error: updateError } = await supabase
        .from("user_companion")
        .update({
          current_image_url: imageUrl,
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
          throw new Error("Regeneration already consumed. Please refresh to continue.");
        }
        throw updateError;
      }

      const totalUsed = updatedRow?.image_regenerations_used ?? regenerationsUsed + 1;

      // Complete
      setGenerationPhase(validationPassed ? 'complete' : 'warning');

      return { 
        imageUrl, 
        regenerationsRemaining: Math.max(0, MAX_REGENERATIONS - totalUsed),
        validationPassed,
        retryCount
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["companion"] });
      if (data.validationPassed) {
        toast.success(`New look unlocked! ${data.regenerationsRemaining} regeneration${data.regenerationsRemaining === 1 ? '' : 's'} remaining.`);
      } else {
        toast.success(`Companion created! ${data.regenerationsRemaining} regeneration${data.regenerationsRemaining === 1 ? '' : 's'} remaining. You can regenerate again if needed.`);
      }
      // Close dialog after successful regeneration
      setTimeout(() => setShowConfirmDialog(false), 1500);
    },
    onError: (error) => {
      console.error("Regeneration failed:", error);
      setGenerationPhase('starting');
      toast.error(error instanceof Error ? error.message : "Failed to regenerate");
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
