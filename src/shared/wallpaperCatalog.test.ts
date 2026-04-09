import { describe, expect, it } from "vitest";
import {
  WALLPAPER_PAGE_KEYS,
  calculateWallpaperPromotionScore,
  getDeterministicWallpaperRecipes,
  getEffectiveWallpaperDate,
  getWallpaperHorizonDates,
  isWallpaperAssetEligibleForLiveRotation,
  pickBestEligibleWallpaperCandidateForDate,
  pickBestWallpaperPromotionCandidate,
  pickLatestEligibleWallpaperCandidate,
} from "@/shared/wallpaperCatalog";

describe("wallpaper date resolution", () => {
  it("uses the 2 AM effective-day reset in the requested timezone", () => {
    expect(
      getEffectiveWallpaperDate("America/Los_Angeles", new Date("2026-04-08T08:30:00.000Z")),
    ).toBe("2026-04-07");

    expect(
      getEffectiveWallpaperDate("America/Los_Angeles", new Date("2026-04-08T10:30:00.000Z")),
    ).toBe("2026-04-08");

    expect(
      getEffectiveWallpaperDate("Asia/Tokyo", new Date("2026-04-08T17:30:00.000Z")),
    ).toBe("2026-04-09");
  });
});

describe("deterministic wallpaper recipes", () => {
  it("does not reuse a recipe key for the same page inside the 4-day rolling window", () => {
    const horizonDates = getWallpaperHorizonDates("2026-04-08");

    for (const pageKey of WALLPAPER_PAGE_KEYS) {
      const recipeKeys = horizonDates.flatMap((dateKey) =>
        getDeterministicWallpaperRecipes(pageKey, dateKey, 3).map((recipe) => recipe.key),
      );

      expect(new Set(recipeKeys).size).toBe(recipeKeys.length);
    }
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

  it("treats only ready assets as live-rotation eligible", () => {
    expect(
      isWallpaperAssetEligibleForLiveRotation("guide", {
        publishState: "ready",
      }),
    ).toBe(true);

    expect(
      isWallpaperAssetEligibleForLiveRotation("guide", {
        publishState: "suppressed",
      }),
    ).toBe(false);
  });

  it("prefers the best approved same-date candidate before other ready assets", () => {
    const candidates = [
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
