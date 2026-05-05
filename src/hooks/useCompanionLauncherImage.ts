import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  isRetriableFunctionInvokeError,
  parseFunctionInvokeError,
  type ParsedFunctionInvokeError,
} from "@/utils/supabaseFunctionErrors";
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

interface GenerateCompanionLauncherImageRequest {
  companionId: string;
  sourceImageUrl: string;
}

const getRequestKey = (companionId: string, sourceImageUrl: string) =>
  `${companionId}:${sourceImageUrl}`;

type LauncherFunctionError = Error & {
  parsedFunctionError?: ParsedFunctionInvokeError;
};

const decorateFunctionError = async (error: unknown): Promise<LauncherFunctionError> => {
  const parsedFunctionError = await parseFunctionInvokeError(error);
  const decoratedError: LauncherFunctionError =
    error instanceof Error
      ? error
      : new Error(parsedFunctionError.message ?? String(error));
  decoratedError.parsedFunctionError = parsedFunctionError;
  return decoratedError;
};

const getDecoratedParsedError = (error: unknown): ParsedFunctionInvokeError | undefined => {
  if (!error || typeof error !== "object") return undefined;
  return (error as { parsedFunctionError?: ParsedFunctionInvokeError }).parsedFunctionError;
};

const isPermanentUpstreamFailure = (parsedError: ParsedFunctionInvokeError | undefined): boolean => {
  const upstreamStatus = parsedError?.upstreamStatus;
  return typeof upstreamStatus === "number" &&
    upstreamStatus >= 400 &&
    upstreamStatus < 500 &&
    upstreamStatus !== 408 &&
    upstreamStatus !== 429;
};

export const useCompanionLauncherImage = ({
  companionId,
  sourceImageUrl,
  enabled = true,
}: UseCompanionLauncherImageOptions) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const requestedKeyRef = useRef<string | null>(null);

  const mutation = useMutation({
    mutationFn: async ({
      companionId: requestCompanionId,
      sourceImageUrl: requestSourceImageUrl,
    }: GenerateCompanionLauncherImageRequest): Promise<GenerateCompanionLauncherImageResponse> => {
      if (!requestCompanionId) {
        throw new Error("Missing companion id");
      }

      const { data, error } = await supabase.functions.invoke<GenerateCompanionLauncherImageResponse>(
        "generate-companion-launcher-image",
        {
          body: {
            companionId: requestCompanionId,
            sourceImageUrl: requestSourceImageUrl,
          },
        },
      );

      if (error) {
        throw await decorateFunctionError(error);
      }

      return data ?? {};
    },
    retry: (failureCount, error) => {
      if (failureCount >= 1) return false;
      const retryable = getDecoratedParsedError(error)?.responsePayload?.retryable;
      if (retryable === false) return false;
      if (retryable === true) return true;
      if (isPermanentUpstreamFailure(getDecoratedParsedError(error))) return false;
      return isRetriableFunctionInvokeError(error);
    },
    retryDelay: 0,
    onSuccess: (data, variables) => {
      if (!user?.id) return;

      const imageUrl = typeof data.imageUrl === "string" && data.imageUrl.trim().length > 0
        ? data.imageUrl.trim()
        : null;
      const sourceUrl = typeof data.sourceImageUrl === "string" && data.sourceImageUrl.trim().length > 0
        ? data.sourceImageUrl.trim()
        : variables.sourceImageUrl;

      if (imageUrl && sourceUrl) {
        queryClient.setQueryData<Companion | null>(
          getCompanionQueryKey(user.id),
          (existing) => {
            if (!existing || existing.id !== variables.companionId) return existing ?? null;
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
    onError: (error, variables) => {
      const parsedErrorPromise = getDecoratedParsedError(error)
        ? Promise.resolve(getDecoratedParsedError(error)!)
        : parseFunctionInvokeError(error);
      void parsedErrorPromise.then((parsedError) => {
        logger.warn("Companion launcher image generation failed", {
          companionId: variables.companionId,
          sourceImageUrl: variables.sourceImageUrl,
          status: parsedError.status,
          code: parsedError.code,
          reason: parsedError.failureReason ?? parsedError.backendMessage ?? parsedError.message,
          category: parsedError.category,
          requestId: parsedError.requestId,
          upstreamStatus: parsedError.upstreamStatus,
          upstreamError: parsedError.upstreamError,
          error: error instanceof Error ? error.message : String(error),
        });
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
    mutation.mutate({
      companionId: trimmedCompanionId,
      sourceImageUrl: trimmedSourceImageUrl,
    });
  }, [companionId, enabled, mutation, sourceImageUrl]);

  return {
    isGenerating: mutation.isPending,
    error: mutation.error,
  };
};
