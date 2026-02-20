import {
  resolveImageSize,
  type SupportedImageSize,
} from "./aiClient.ts";

export const DEFAULT_COMPANION_IMAGE_SIZE: SupportedImageSize = "1536x1024";
const DEFAULT_FAST_IMAGE_SIZE: SupportedImageSize = "1024x1024";

const DEFAULT_FAST_PATH_PERCENT = 0;
const DEFAULT_STAGE0_FAST_RETRIES = 0;
const DEFAULT_NON_STAGE0_FAST_RETRIES = 1;

const MAX_PERCENT = 100;

function getEnv(name: string): string | undefined {
  try {
    return Deno.env.get(name);
  } catch {
    return undefined;
  }
}

function toFiniteInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function hashStringToPercent(input: string): number {
  // FNV-1a 32-bit hash for deterministic rollout bucketing.
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % MAX_PERCENT;
}

export function getCompanionFastPathPercent(): number {
  const raw = getEnv("COMPANION_IMAGE_FAST_PATH_PERCENT");
  return clamp(toFiniteInt(raw, DEFAULT_FAST_PATH_PERCENT), 0, MAX_PERCENT);
}

export function getCompanionFastImageSize(): SupportedImageSize {
  const raw = getEnv("COMPANION_IMAGE_FAST_SIZE");
  return resolveImageSize(raw, DEFAULT_FAST_IMAGE_SIZE);
}

export function isCompanionFastPathEligible(userId: string): boolean {
  const rolloutPercent = getCompanionFastPathPercent();
  if (rolloutPercent <= 0) return false;
  return hashStringToPercent(userId) < rolloutPercent;
}

export function resolveCompanionImageSizeForUser(
  userId: string,
  requestedSize?: unknown,
): SupportedImageSize {
  const normalizedRequested = resolveImageSize(requestedSize, null);
  if (normalizedRequested) {
    return normalizedRequested;
  }
  if (isCompanionFastPathEligible(userId)) {
    return getCompanionFastImageSize();
  }
  return DEFAULT_COMPANION_IMAGE_SIZE;
}

export function getCompanionFastRetryLimits(): {
  stage0: number;
  nonStage0: number;
} {
  const stage0Raw = getEnv("COMPANION_IMAGE_STAGE0_MAX_RETRIES_FAST");
  const nonStage0Raw = getEnv("COMPANION_IMAGE_NON_STAGE0_MAX_RETRIES_FAST");

  return {
    stage0: clamp(toFiniteInt(stage0Raw, DEFAULT_STAGE0_FAST_RETRIES), 0, 3),
    nonStage0: clamp(toFiniteInt(nonStage0Raw, DEFAULT_NON_STAGE0_FAST_RETRIES), 0, 3),
  };
}
