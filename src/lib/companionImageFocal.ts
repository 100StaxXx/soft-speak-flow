import type { CSSProperties } from "react";
import {
  bundledCompanionImageFocalManifest,
  type BundledCompanionImageFocalManifestEntry,
} from "@/generated/companionImageFocalManifest";

export interface CompanionImageFocalPoint {
  x: number;
  y: number;
}

export interface CompanionImagePresentationOptions {
  src?: string | null;
  fit?: "cover" | "contain";
  focalX?: number | null;
  focalY?: number | null;
  containerAspectRatio?: number;
}

export interface CompanionImagePresentation {
  style: CSSProperties;
  focalPoint: CompanionImageFocalPoint | null;
  focalSource: "stored" | "manifest" | "default";
  assetKey: string | null;
}

const BUNDLED_COMPANION_PREFIXES = ["companion-eggs/", "companion-presets/"] as const;
const DEFAULT_PRESENTATION: CompanionImagePresentation = {
  style: {},
  focalPoint: null,
  focalSource: "default",
  assetKey: null,
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export const normalizeCompanionImageFocalValue = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return clamp01(value);
};

const getStoredFocalPoint = (
  focalX?: number | null,
  focalY?: number | null,
): CompanionImageFocalPoint | null => {
  const x = normalizeCompanionImageFocalValue(focalX);
  const y = normalizeCompanionImageFocalValue(focalY);
  if (x === null || y === null) return null;
  return { x, y };
};

export const getBundledCompanionImageAssetKey = (src?: string | null): string | null => {
  if (!src || typeof src !== "string") return null;

  let candidate = src.trim();
  if (candidate.length === 0) return null;

  if (candidate.startsWith("data:")) return null;

  try {
    const parsed = new URL(candidate, "https://companion.local");
    candidate = parsed.pathname;
  } catch {
    // Fall through to raw path normalization.
  }

  const normalized = candidate.replace(/^\/+/, "");
  const prefix = BUNDLED_COMPANION_PREFIXES.find((value) => normalized.includes(value));
  return prefix ? normalized.slice(normalized.indexOf(prefix)) : null;
};

export const getBundledCompanionImageFocalEntry = (
  src?: string | null,
): BundledCompanionImageFocalManifestEntry | null => {
  const assetKey = getBundledCompanionImageAssetKey(src);
  if (!assetKey) return null;
  return bundledCompanionImageFocalManifest[assetKey] ?? null;
};

export const getBundledCompanionImageFocalPoint = (
  src?: string | null,
): CompanionImageFocalPoint | null => {
  const entry = getBundledCompanionImageFocalEntry(src);
  if (!entry) return null;
  return {
    x: entry.focalX,
    y: entry.focalY,
  };
};

export const hasBundledCompanionImageFocal = (src?: string | null): boolean =>
  getBundledCompanionImageFocalEntry(src) !== null;

const resolveCoverObjectPosition = ({
  focalPoint,
  entry,
  containerAspectRatio,
}: {
  focalPoint: CompanionImageFocalPoint;
  entry: BundledCompanionImageFocalManifestEntry | null;
  containerAspectRatio: number;
}) => {
  if (!entry || entry.width <= 0 || entry.height <= 0) {
    return `${focalPoint.x * 100}% ${focalPoint.y * 100}%`;
  }

  const sourceAspectRatio = entry.width / entry.height;
  const safeContainerAspectRatio = containerAspectRatio > 0 ? containerAspectRatio : 1;

  if (Math.abs(sourceAspectRatio - safeContainerAspectRatio) < 0.0001) {
    return "50% 50%";
  }

  if (sourceAspectRatio > safeContainerAspectRatio) {
    const renderedWidth = safeContainerAspectRatio / sourceAspectRatio;
    const cropRange = 1 - renderedWidth;
    if (cropRange <= 0) return "50% 50%";
    const xPosition = clamp01((focalPoint.x - renderedWidth / 2) / cropRange) * 100;
    return `${xPosition}% 50%`;
  }

  const renderedHeight = sourceAspectRatio / safeContainerAspectRatio;
  const cropRange = 1 - renderedHeight;
  if (cropRange <= 0) return "50% 50%";
  const yPosition = clamp01((focalPoint.y - renderedHeight / 2) / cropRange) * 100;
  return `50% ${yPosition}%`;
};

const resolveContainTransform = (focalPoint: CompanionImageFocalPoint): string => {
  const translateX = (0.5 - focalPoint.x) * 100;
  const translateY = (0.5 - focalPoint.y) * 100;
  const maxMagnitude = Math.max(Math.abs(translateX), Math.abs(translateY));
  const scale = maxMagnitude > 0.5 ? 1.08 : 1;
  return `translate(${translateX.toFixed(3)}%, ${translateY.toFixed(3)}%) scale(${scale})`;
};

export const resolveCompanionImagePresentation = ({
  src,
  fit = "cover",
  focalX,
  focalY,
  containerAspectRatio = 1,
}: CompanionImagePresentationOptions): CompanionImagePresentation => {
  const storedFocalPoint = getStoredFocalPoint(focalX, focalY);
  const manifestEntry = getBundledCompanionImageFocalEntry(src);
  const focalPoint = storedFocalPoint ?? getBundledCompanionImageFocalPoint(src);
  const focalSource = storedFocalPoint ? "stored" : manifestEntry ? "manifest" : "default";
  const assetKey = getBundledCompanionImageAssetKey(src);

  if (!focalPoint) {
    return {
      ...DEFAULT_PRESENTATION,
      assetKey,
    };
  }

  if (fit === "contain") {
    return {
      focalPoint,
      focalSource,
      assetKey,
      style: {
        transform: resolveContainTransform(focalPoint),
        transformOrigin: "center center",
      },
    };
  }

  return {
    focalPoint,
    focalSource,
    assetKey,
    style: {
      objectPosition: resolveCoverObjectPosition({
        focalPoint,
        entry: manifestEntry,
        containerAspectRatio,
      }),
    },
  };
};

export const shouldBackfillCompanionImageFocal = (
  imageUrl: string | null | undefined,
  focalX: number | null | undefined,
  focalY: number | null | undefined,
): boolean => {
  if (!imageUrl || typeof imageUrl !== "string") return false;
  if (getStoredFocalPoint(focalX, focalY)) return false;
  if (hasBundledCompanionImageFocal(imageUrl)) return false;
  if (imageUrl.startsWith("data:")) return false;
  return /^https?:\/\//i.test(imageUrl);
};
