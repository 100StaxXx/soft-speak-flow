import { describe, expect, it } from "vitest";
import {
  LANDSCAPE_DIVERSE_V1_VARIANT_KEYS,
  calculateWallpaperPromotionScore,
  countWallpaperVariantsByPage,
  pickOldestUnusedWallpaperAssetId,
  pickBestWallpaperPromotionCandidate,
  wallpaperGenerationBatchPresets,
} from "@/shared/wallpaperCatalog";

describe("wallpaperGenerationBatchPresets", () => {
  it("keeps the landscape-diverse-v1 preset locked to the curated 10-image backlog", () => {
    const preset = wallpaperGenerationBatchPresets["landscape-diverse-v1"];

    expect(preset.variantKeys).toEqual([...LANDSCAPE_DIVERSE_V1_VARIANT_KEYS]);
    expect(preset.variantKeys).toHaveLength(10);
    expect(countWallpaperVariantsByPage(preset.variantKeys)).toEqual({
      quests: 3,
      campaigns: 3,
      companion: 2,
      profile: 2,
    });
  });
});

describe("wallpaper promotion scoring", () => {
  it("applies the weighted scenic score formula", () => {
    expect(calculateWallpaperPromotionScore({
      scenicQualityScore: 90,
      moodMatchScore: 80,
      detailScore: 70,
      contrastScore: 60,
    })).toBe(77.5);
  });

  it("breaks ties by safe-zone confidence and then recency", () => {
    const best = pickBestWallpaperPromotionCandidate([
      {
        id: "older-higher-safe-zone",
        createdAt: "2026-04-08T09:00:00.000Z",
        validation: {
          scenicQualityScore: 88,
          moodMatchScore: 86,
          detailScore: 82,
          contrastScore: 80,
          safeZoneConfidenceScore: 92,
        },
      },
      {
        id: "newer-lower-safe-zone",
        createdAt: "2026-04-08T10:00:00.000Z",
        validation: {
          scenicQualityScore: 88,
          moodMatchScore: 86,
          detailScore: 82,
          contrastScore: 80,
          safeZoneConfidenceScore: 84,
        },
      },
      {
        id: "newest-equal-safe-zone",
        createdAt: "2026-04-08T11:00:00.000Z",
        validation: {
          scenicQualityScore: 88,
          moodMatchScore: 86,
          detailScore: 82,
          contrastScore: 80,
          safeZoneConfidenceScore: 92,
        },
      },
    ]);

    expect(best?.id).toBe("newest-equal-safe-zone");
  });

  it("selects the oldest ready asset that has never been assigned", () => {
    expect(
      pickOldestUnusedWallpaperAssetId(
        ["asset-1", "asset-2", "asset-3"],
        ["asset-1", "asset-3"],
      ),
    ).toBe("asset-2");
  });
});
