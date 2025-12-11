import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getDocument, updateDocument } from "@/lib/firebase/firestore";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { generateCompanionImage } from "@/lib/firebase/functions";

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

      const latestCompanion = await getDocument<{ image_regenerations_used: number; user_id: string }>(
        "user_companion",
        companion.id
      );

      if (!latestCompanion) {
        throw new Error("Companion not found");
      }

      if (latestCompanion.user_id !== user.uid) {
        throw new Error("Unauthorized");
      }

      const regenerationsUsed = latestCompanion.image_regenerations_used ?? 0;
      if (regenerationsUsed >= MAX_REGENERATIONS) {
        throw new Error("You've used all your regenerations");
      }

      // Generate new companion image using Firebase Cloud Function
      const imageResult = await generateCompanionImage({
        companionId: companion.id,
        stage: companion.current_stage,
        species: companion.spirit_animal,
        element: companion.core_element,
        color: companion.favorite_color,
      });

      if (!imageResult?.imageData?.imageUrl) {
        throw new Error("Failed to generate companion image");
      }

      // Update companion with new image and increment regeneration count
      await updateDocument("user_companion", companion.id, {
        current_image_url: imageResult.imageData.imageUrl,
        image_regenerations_used: regenerationsUsed + 1,
      });

      return imageResult;
    },
    onSuccess: () => {
      // Will not be called since mutation always throws
      queryClient.invalidateQueries({ queryKey: ["companion"] });
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
