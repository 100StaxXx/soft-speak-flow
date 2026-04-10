import { isWallpaperValidationAcceptable } from "./validation.ts";
import type { WallpaperValidationResult } from "../../../src/shared/wallpaperCatalog.ts";

const createValidationResult = (
  overrides: Partial<WallpaperValidationResult> = {},
): WallpaperValidationResult => ({
  approved: true,
  hasReadableText: false,
  hasUiOverlay: false,
  hasPurpleDominance: false,
  safeZonesClear: true,
  safeZoneConfidenceScore: 80,
  scenicQualityScore: 70,
  detailScore: 70,
  contrastScore: 65,
  moodMatchScore: 75,
  mobileFocusX: 50,
  mobileFocusY: 50,
  desktopFocusX: 50,
  desktopFocusY: 50,
  notes: [],
  rejectionReasons: [],
  ...overrides,
});

Deno.test("isWallpaperValidationAcceptable accepts safe soft-threshold wallpapers", () => {
  const result = createValidationResult({
    scenicQualityScore: 68,
    detailScore: 70,
    contrastScore: 65,
    moodMatchScore: 75,
  });

  if (!isWallpaperValidationAcceptable(result)) {
    throw new Error(`Expected relaxed scenic threshold candidate to pass, got ${JSON.stringify(result)}`);
  }
});

Deno.test("isWallpaperValidationAcceptable still rejects unsafe or muddy wallpapers", () => {
  const result = createValidationResult({
    scenicQualityScore: 67,
  });

  if (isWallpaperValidationAcceptable(result)) {
    throw new Error(`Expected below-threshold scenic score to fail, got ${JSON.stringify(result)}`);
  }
});
