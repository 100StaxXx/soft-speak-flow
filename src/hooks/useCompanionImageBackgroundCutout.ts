import { useEffect, useState } from "react";
import { removeLightBorderBackgroundFromCompanionImageData } from "@/lib/companionImageBackgroundRemoval";

type CompanionImageCutoutStatus = "idle" | "processing" | "ready" | "skipped" | "failed";

interface UseCompanionImageBackgroundCutoutOptions {
  enabled?: boolean;
}

interface CompanionImageBackgroundCutoutResult {
  cutoutSrc: string | null;
  status: CompanionImageCutoutStatus;
}

type CachedCompanionImageCutoutResult = {
  cutoutSrc: string | null;
  status: Exclude<CompanionImageCutoutStatus, "idle" | "processing">;
};

const MAX_CUTOUT_EDGE_PX = 512;
const MIN_REMOVED_PIXEL_RATIO = 0.02;
// Hard ceiling to keep the FAB from staying invisible (opacity-0) forever
// when an image neither loads nor fires `onerror` — most often caused by a
// cross-origin response without proper CORS headers under
// `crossOrigin="anonymous"`.
const CUTOUT_LOAD_TIMEOUT_MS = 4000;
const cutoutCache = new Map<string, CachedCompanionImageCutoutResult>();

const isCutoutCandidateSrc = (src?: string | null) => {
  if (!src || typeof src !== "string") return false;

  const normalized = src.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.startsWith("data:image/svg")) return false;
  if (normalized.includes(".svg")) return false;

  return true;
};

const createScaledCanvas = (image: HTMLImageElement) => {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const scale = Math.min(1, MAX_CUTOUT_EDGE_PX / Math.max(sourceWidth, sourceHeight, 1));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  return canvas;
};

export const useCompanionImageBackgroundCutout = (
  src?: string | null,
  { enabled = true }: UseCompanionImageBackgroundCutoutOptions = {},
): CompanionImageBackgroundCutoutResult => {
  const [result, setResult] = useState<CompanionImageBackgroundCutoutResult>({
    cutoutSrc: null,
    status: "idle",
  });

  useEffect(() => {
    if (!enabled || !isCutoutCandidateSrc(src)) {
      setResult({ cutoutSrc: null, status: "skipped" });
      return;
    }

    const normalizedSrc = src.trim();
    if (cutoutCache.has(normalizedSrc)) {
      setResult(cutoutCache.get(normalizedSrc) ?? { cutoutSrc: null, status: "failed" });
      return;
    }

    let cancelled = false;
    setResult({ cutoutSrc: null, status: "processing" });

    const image = new Image();
    image.decoding = "async";
    if (!normalizedSrc.startsWith("data:") && !normalizedSrc.startsWith("blob:")) {
      image.crossOrigin = "anonymous";
    }

    const failOnce = (reason: "load-error" | "timeout" | "context-missing" | "decode-error") => {
      if (cancelled) return;
      cutoutCache.set(normalizedSrc, { cutoutSrc: null, status: "failed" });
      setResult({ cutoutSrc: null, status: "failed" });
      if (reason === "timeout") {
        // Detach handlers so a late onload/onerror cannot resurrect the
        // hook into a stale state for a different src.
        image.onload = null;
        image.onerror = null;
      }
    };

    const loadTimeout = window.setTimeout(() => failOnce("timeout"), CUTOUT_LOAD_TIMEOUT_MS);

    image.onload = () => {
      window.clearTimeout(loadTimeout);
      if (cancelled) return;

      try {
        const canvas = createScaledCanvas(image);
        const context = canvas.getContext("2d", { willReadFrequently: true });

        if (!context) {
          failOnce("context-missing");
          return;
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        const sourceImageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const { imageData, removedPixels } = removeLightBorderBackgroundFromCompanionImageData(sourceImageData);
        const removedRatio = removedPixels / Math.max(1, canvas.width * canvas.height);

        if (removedRatio < MIN_REMOVED_PIXEL_RATIO) {
          cutoutCache.set(normalizedSrc, { cutoutSrc: null, status: "skipped" });
          setResult({ cutoutSrc: null, status: "skipped" });
          return;
        }

        context.putImageData(imageData, 0, 0);

        const cutoutSrc = canvas.toDataURL("image/png");
        cutoutCache.set(normalizedSrc, { cutoutSrc, status: "ready" });
        setResult({ cutoutSrc, status: "ready" });
      } catch {
        failOnce("decode-error");
      }
    };

    image.onerror = () => {
      window.clearTimeout(loadTimeout);
      failOnce("load-error");
    };

    image.src = normalizedSrc;

    return () => {
      cancelled = true;
      window.clearTimeout(loadTimeout);
      image.onload = null;
      image.onerror = null;
    };
  }, [enabled, src]);

  return result;
};
