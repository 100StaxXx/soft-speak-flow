import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/utils/logger";
import { useAuth } from "./useAuth";
import { getCompanionQueryKey, type Companion } from "./useCompanion";

interface UseCompanionLauncherImageOptions {
  companionId?: string | null;
  sourceImageUrl?: string | null;
  enabled?: boolean;
}

interface GenerateCompanionLauncherImageResponse {
  success?: boolean;
  imageUrl?: string | null;
  imageFocalX?: number | null;
  imageFocalY?: number | null;
  sourceImageUrl?: string | null;
  cached?: boolean;
  skipped?: boolean;
  reason?: string;
}

const getRequestKey = (companionId: string, sourceImageUrl: string) =>
  `${companionId}:${sourceImageUrl}`;

export const useCompanionLauncherImage = ({
  companionId,
  sourceImageUrl,
  enabled = true,
}: UseCompanionLauncherImageOptions) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const requestedKeyRef = useRef<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (): Promise<GenerateCompanionLauncherImageResponse> => {
      if (!companionId) {
        throw new Error("Missing companion id");
      }

      const { data, error } = await supabase.functions.invoke<GenerateCompanionLauncherImageResponse>(
        "generate-companion-launcher-image",
        {
          body: { companionId },
        },
      );

      if (error) {
        throw error;
      }

      return data ?? {};
    },
    onSuccess: (data) => {
      if (!user?.id || !companionId) return;

      const imageUrl = typeof data.imageUrl === "string" && data.imageUrl.trim().length > 0
        ? data.imageUrl.trim()
        : null;
      const sourceUrl = typeof data.sourceImageUrl === "string" && data.sourceImageUrl.trim().length > 0
        ? data.sourceImageUrl.trim()
        : sourceImageUrl ?? null;

      if (imageUrl && sourceUrl) {
        queryClient.setQueryData<Companion | null>(
          getCompanionQueryKey(user.id),
          (existing) => {
            if (!existing || existing.id !== companionId) return existing ?? null;
            return {
              ...existing,
              launcher_image_url: imageUrl,
              launcher_image_focal_x: data.imageFocalX ?? 0.5,
              launcher_image_focal_y: data.imageFocalY ?? 0.5,
              launcher_image_source_url: sourceUrl,
            };
          },
        );
      }

      void queryClient.invalidateQueries({ queryKey: getCompanionQueryKey(user.id) });
    },
    onError: (error) => {
      logger.warn("Companion launcher image generation failed", {
        companionId,
        error: error instanceof Error ? error.message : String(error),
      });
    },
  });

  useEffect(() => {
    const trimmedCompanionId = companionId?.trim();
    const trimmedSourceImageUrl = sourceImageUrl?.trim();

    if (!enabled || !trimmedCompanionId || !trimmedSourceImageUrl) {
      return;
    }

    const requestKey = getRequestKey(trimmedCompanionId, trimmedSourceImageUrl);
    if (requestedKeyRef.current === requestKey || mutation.isPending) {
      return;
    }

    requestedKeyRef.current = requestKey;
    mutation.mutate();
  }, [companionId, enabled, mutation, sourceImageUrl]);

  return {
    isGenerating: mutation.isPending,
    error: mutation.error,
  };
};
