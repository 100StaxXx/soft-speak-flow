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

    image.onload = () => {
      if (cancelled) return;

      try {
        const canvas = createScaledCanvas(image);
        const context = canvas.getContext("2d", { willReadFrequently: true });

        if (!context) {
          cutoutCache.set(normalizedSrc, { cutoutSrc: null, status: "failed" });
          setResult({ cutoutSrc: null, status: "failed" });
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
        cutoutCache.set(normalizedSrc, { cutoutSrc: null, status: "failed" });
        setResult({ cutoutSrc: null, status: "failed" });
      }
    };

    image.onerror = () => {
      if (cancelled) return;
      cutoutCache.set(normalizedSrc, { cutoutSrc: null, status: "failed" });
      setResult({ cutoutSrc: null, status: "failed" });
    };

    image.src = normalizedSrc;

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [enabled, src]);

  return result;
};
