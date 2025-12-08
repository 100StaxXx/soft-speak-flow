import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

const MAX_REGENERATIONS = 2;

export const useCompanionRegenerate = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

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

      // Call the image generation function
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

      // Update companion with new image and increment regeneration count atomically
      const { data: updatedRow, error: updateError } = await supabase
        .from("user_companion")
        .update({
          current_image_url: imageResult.imageUrl,
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

      return { 
        imageUrl: imageResult.imageUrl, 
        regenerationsRemaining: Math.max(0, MAX_REGENERATIONS - totalUsed) 
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["companion"] });
      toast.success(`New look unlocked! ${data.regenerationsRemaining} regeneration${data.regenerationsRemaining === 1 ? '' : 's'} remaining.`);
    },
    onError: (error) => {
      console.error("Regeneration failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to regenerate");
    },
  });

  return {
    regenerate: regenerateMutation.mutate,
    isRegenerating: regenerateMutation.isPending,
    showConfirmDialog,
    setShowConfirmDialog,
    maxRegenerations: MAX_REGENERATIONS,
  };
};
