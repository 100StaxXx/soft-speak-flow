import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/utils/logger";
import type { Companion } from "./useCompanion";

export type CompanionLauncherImageStatus = "idle" | "pending" | "ready" | "error";

interface UseCompanionLauncherImageResult {
  launcherImageUrl: string | null;
  launcherImageFocalX: number;
  launcherImageFocalY: number;
  isFresh: boolean;
  status: CompanionLauncherImageStatus;
  retry: () => void;
}

const log = logger.scope("CompanionLauncherImage");

const DEFAULT_FOCAL = 0.5;

export const useCompanionLauncherImage = (
  companion: Companion | null | undefined,
): UseCompanionLauncherImageResult => {
  const isFresh = Boolean(
    companion?.launcher_image_url
      && (
        !companion?.launcher_image_source_url
        || companion?.launcher_image_source_url === companion?.current_image_url
      ),
  );

  const [status, setStatus] = useState<CompanionLauncherImageStatus>(
    isFresh ? "ready" : "idle",
  );
  const lastInvokeKeyRef = useRef<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (isFresh) {
      setStatus("ready");
    }
  }, [isFresh]);

  useEffect(() => {
    const companionId = companion?.id;
    const currentImageUrl = companion?.current_image_url;
    if (!companionId || !currentImageUrl || isFresh) {
      return;
    }

    const key = `${companionId}:${currentImageUrl}:${retryNonce}`;
    if (lastInvokeKeyRef.current === key) {
      return;
    }
    lastInvokeKeyRef.current = key;

    setStatus("pending");
    log.info("Invoking generate-companion-launcher-image", {
      companionId,
      retryNonce,
    });

    void supabase.functions
      .invoke("generate-companion-launcher-image", {
        body: { companionId },
      })
      .then((result) => {
        if (result.error) {
          log.warn("Launcher image generation failed", {
            companionId,
            error: result.error.message ?? String(result.error),
          });
          setStatus("error");
        } else {
          log.info("Launcher image generation request acknowledged", {
            companionId,
          });
        }
      })
      .catch((error) => {
        log.warn("Launcher image generation invoke threw", {
          companionId,
          error: error instanceof Error ? error.message : String(error),
        });
        setStatus("error");
      });
  }, [companion?.id, companion?.current_image_url, isFresh, retryNonce]);

  const retry = useCallback(() => {
    setRetryNonce((nonce) => nonce + 1);
  }, []);

  return {
    launcherImageUrl: isFresh ? (companion?.launcher_image_url ?? null) : null,
    launcherImageFocalX: isFresh
      ? (companion?.launcher_image_focal_x ?? DEFAULT_FOCAL)
      : DEFAULT_FOCAL,
    launcherImageFocalY: isFresh
      ? (companion?.launcher_image_focal_y ?? DEFAULT_FOCAL)
      : DEFAULT_FOCAL,
    isFresh,
    status,
    retry,
  };
};
