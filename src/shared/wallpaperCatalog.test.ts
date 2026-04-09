import { describe, expect, it } from "vitest";
import {
  CORE_TABS_V1_VARIANT_KEYS,
  LANDSCAPE_DIVERSE_V1_VARIANT_KEYS,
  calculateWallpaperPromotionScore,
  countWallpaperVariantsByPage,
  isWallpaperAssetEligibleForLiveRotation,
  pickBestEligibleWallpaperCandidateForDate,
  pickLatestEligibleWallpaperCandidate,
  pickOldestUnusedWallpaperAssetId,
  pickBestWallpaperPromotionCandidate,
  RECENT_LIVE_WALLPAPER_CUTOFF_DATE,
  wallpaperGenerationBatchPresets,
} from "@/shared/wallpaperCatalog";

describe("wallpaperGenerationBatchPresets", () => {
  it("keeps the core-tabs-v1 preset locked to one generated backdrop per core tab", () => {
    const preset = wallpaperGenerationBatchPresets["core-tabs-v1"];

    expect(preset.variantKeys).toEqual([...CORE_TABS_V1_VARIANT_KEYS]);
    expect(preset.variantKeys).toHaveLength(4);
    expect(countWallpaperVariantsByPage(preset.variantKeys)).toEqual({
      guide: 1,
      quests: 1,
      campaigns: 1,
      companion: 1,
      profile: 0,
    });
  });

  it("keeps the landscape-diverse-v1 preset locked to the curated 10-image backlog", () => {
    const preset = wallpaperGenerationBatchPresets["landscape-diverse-v1"];

    expect(preset.variantKeys).toEqual([...LANDSCAPE_DIVERSE_V1_VARIANT_KEYS]);
    expect(preset.variantKeys).toHaveLength(10);
    expect(countWallpaperVariantsByPage(preset.variantKeys)).toEqual({
      guide: 1,
      quests: 3,
      campaigns: 3,
      companion: 2,
      profile: 1,
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

  it("only keeps post-cutoff generated assets eligible for the recent live wallpaper pages", () => {
    expect(
      isWallpaperAssetEligibleForLiveRotation("guide", {
        publishState: "ready",
        sourceKind: "generated",
        generationDate: RECENT_LIVE_WALLPAPER_CUTOFF_DATE,
      }),
    ).toBe(true);

    expect(
      isWallpaperAssetEligibleForLiveRotation("campaigns", {
        publishState: "ready",
        sourceKind: "generated",
        generationDate: RECENT_LIVE_WALLPAPER_CUTOFF_DATE,
      }),
    ).toBe(true);

    expect(
      isWallpaperAssetEligibleForLiveRotation("guide", {
        publishState: "ready",
        sourceKind: "seed",
        generationDate: "2026-04-08",
      }),
    ).toBe(false);

    expect(
      isWallpaperAssetEligibleForLiveRotation("quests", {
        publishState: "ready",
        sourceKind: "generated",
        generationDate: "2026-04-07",
      }),
    ).toBe(false);

    expect(
      isWallpaperAssetEligibleForLiveRotation("profile", {
        publishState: "ready",
        sourceKind: "seed",
        generationDate: "2026-04-01",
      }),
    ).toBe(true);
  });

  it("prefers the best eligible current-day candidate before other ready assets", () => {
    const candidates = [
      {
        id: "newest-seed-but-ineligible",
        createdAt: "2026-04-09T12:00:00.000Z",
        publishState: "ready",
        sourceKind: "seed",
        generationDate: "2026-04-09",
        validation: {
          scenicQualityScore: 99,
          moodMatchScore: 99,
          detailScore: 99,
          contrastScore: 99,
          safeZoneConfidenceScore: 99,
        },
      },
      {
        id: "latest-older",
        createdAt: "2026-04-09T11:00:00.000Z",
        publishState: "ready",
        sourceKind: "generated",
        generationDate: "2026-04-08",
        validation: {
          scenicQualityScore: 82,
          moodMatchScore: 80,
          detailScore: 78,
          contrastScore: 76,
          safeZoneConfidenceScore: 80,
        },
      },
      {
        id: "today-best",
        createdAt: "2026-04-09T10:00:00.000Z",
        publishState: "ready",
        sourceKind: "generated",
        generationDate: "2026-04-09",
        validation: {
          scenicQualityScore: 95,
          moodMatchScore: 92,
          detailScore: 88,
          contrastScore: 84,
          safeZoneConfidenceScore: 90,
        },
      },
      {
        id: "today-weaker",
        createdAt: "2026-04-09T11:30:00.000Z",
        publishState: "ready",
        sourceKind: "generated",
        generationDate: "2026-04-09",
        validation: {
          scenicQualityScore: 80,
          moodMatchScore: 81,
          detailScore: 79,
          contrastScore: 78,
          safeZoneConfidenceScore: 82,
        },
      },
    ];

    expect(
      pickBestEligibleWallpaperCandidateForDate("campaigns", "2026-04-09", candidates)?.id,
    ).toBe("today-best");
    expect(
      pickLatestEligibleWallpaperCandidate("campaigns", candidates)?.id,
    ).toBe("today-weaker");
  });
});
