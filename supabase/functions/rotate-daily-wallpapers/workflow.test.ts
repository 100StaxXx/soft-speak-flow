import {
  rotatePageWallpaper,
  rotateWallpaperAssignments,
  type RotationDeps,
} from "./workflow.ts";
import {
  WALLPAPER_PAGE_KEYS,
  getDeterministicWallpaperRecipes,
  resolvePepTalkWallpaperThemeForDate,
} from "../../../src/shared/wallpaperCatalog.ts";

const withGenerationSlotBudget = async (
  slotCount: number,
  callback: () => Promise<void>,
) => {
  const previousValue = Deno.env.get("WALLPAPER_MAX_GENERATION_SLOTS_PER_RUN");
  Deno.env.set("WALLPAPER_MAX_GENERATION_SLOTS_PER_RUN", String(slotCount));

  try {
    await callback();
  } finally {
    if (typeof previousValue === "string") {
      Deno.env.set("WALLPAPER_MAX_GENERATION_SLOTS_PER_RUN", previousValue);
    } else {
      Deno.env.delete("WALLPAPER_MAX_GENERATION_SLOTS_PER_RUN");
    }
  }
};

const createDeps = (overrides: Partial<RotationDeps> = {}): RotationDeps => ({
  getExistingAssignment: async () => null,
  getWallpaperAssetEligibilitySnapshot: async () => null,
  listWallpaperAssetCandidates: async () => [],
  generateAndStoreWallpaperAsset: async (_supabase, args) => ({
    assetId: `${args.pageKey}-${args.dateKey}-${args.variantKey}`,
    createdAt: `${args.dateKey}T10:00:00.000Z`,
    imageUrl: `https://example.com/${args.pageKey}/${args.dateKey}/${args.variantKey}.png`,
    publishState: "ready",
    validationResult: {
      approved: true,
      hasReadableText: false,
      hasUiOverlay: false,
      hasPurpleDominance: false,
      safeZonesClear: true,
      safeZoneConfidenceScore: 90,
      scenicQualityScore: 92,
      detailScore: 88,
      contrastScore: 80,
      moodMatchScore: 90,
      mobileFocusX: 50,
      mobileFocusY: 30,
      desktopFocusX: 50,
      desktopFocusY: 34,
      notes: [],
      rejectionReasons: [],
    },
    variantKey: args.variantKey ?? null,
  }),
  assignWallpaperAsset: async () => undefined,
  getLatestReadyAsset: async () => null,
  ...overrides,
});

Deno.test("rotateWallpaperAssignments fills the 4-day horizon for all six surfaces", async () => {
  await withGenerationSlotBudget(WALLPAPER_PAGE_KEYS.length * 4, async () => {
    const assigned: Array<{ pageKey: string; dateKey: string; assetId: string; assignmentSource: string }> = [];
    const generated: Array<{ pageKey: string; dateKey: string; variantKey: string | null }> = [];
    const deps = createDeps({
      generateAndStoreWallpaperAsset: async (_supabase, args) => {
        generated.push({
          pageKey: args.pageKey,
          dateKey: args.dateKey,
          variantKey: args.variantKey ?? null,
        });
        return createDeps().generateAndStoreWallpaperAsset(_supabase, args);
      },
      assignWallpaperAsset: async (_supabase, pageKey, dateKey, assetId, assignmentSource) => {
        assigned.push({ pageKey, dateKey, assetId, assignmentSource });
      },
    });

    const { outcomes } = await rotateWallpaperAssignments({}, {
      startDate: "2026-04-08",
      daysAhead: 4,
      pageKeys: [...WALLPAPER_PAGE_KEYS],
      candidateCount: 3,
      force: false,
    }, deps);

    if (outcomes.length !== WALLPAPER_PAGE_KEYS.length * 4) {
      throw new Error(`Expected ${WALLPAPER_PAGE_KEYS.length * 4} outcomes, got ${outcomes.length}`);
    }

    if (outcomes.some((outcome) => outcome.status !== "generated")) {
      throw new Error(`Expected every slot to generate when empty, got ${JSON.stringify(outcomes)}`);
    }

    const generatedDates = new Set(generated.map((entry) => entry.dateKey));
    if (generatedDates.size !== 4) {
      throw new Error(`Expected generation across the full horizon, got ${JSON.stringify(generated)}`);
    }

    if (assigned.length !== WALLPAPER_PAGE_KEYS.length * 4) {
      throw new Error(`Expected every page/date to be assigned, got ${assigned.length}`);
    }
  });
});

Deno.test("pep_talk recipes stay inside the scheduled weekday theme bucket", () => {
  const mondayTheme = resolvePepTalkWallpaperThemeForDate("2026-04-06");
  const saturdayTheme = resolvePepTalkWallpaperThemeForDate("2026-04-11");
  const mondayRecipes = getDeterministicWallpaperRecipes("pep_talk", "2026-04-06", 3);
  const saturdayRecipes = getDeterministicWallpaperRecipes("pep_talk", "2026-04-11", 3);

  if (mondayTheme.key !== "forge" || saturdayTheme.key !== "recovery") {
    throw new Error(`Unexpected pep talk theme schedule: ${JSON.stringify({ mondayTheme, saturdayTheme })}`);
  }

  if (mondayRecipes.some((recipe) => recipe.themeKey !== mondayTheme.key)) {
    throw new Error(`Expected Monday pep talk recipes to stay in the forge bucket, got ${JSON.stringify(mondayRecipes)}`);
  }

  if (saturdayRecipes.some((recipe) => recipe.themeKey !== saturdayTheme.key)) {
    throw new Error(`Expected Saturday pep talk recipes to stay in the recovery bucket, got ${JSON.stringify(saturdayRecipes)}`);
  }
});

Deno.test("rotatePageWallpaper retries a carry-forward assignment instead of treating it as final", async () => {
  let generatedCount = 0;
  const assigned: Array<{ assetId: string; assignmentSource: string }> = [];
  const outcome = await rotatePageWallpaper(
    {},
    "companion",
    "2026-04-10",
    3,
    false,
    "rotate-2026-04-09",
    createDeps({
      getExistingAssignment: async () => ({
        id: "assign-carry-forward",
        wallpaper_asset_id: "old-asset",
        assignment_source: "carry_forward",
      }),
      getWallpaperAssetEligibilitySnapshot: async () => ({
        publish_state: "ready",
        source_kind: "generated",
        generation_date: "2026-04-09",
      }),
      generateAndStoreWallpaperAsset: async (...args) => {
        generatedCount += 1;
        return createDeps().generateAndStoreWallpaperAsset(...args);
      },
      assignWallpaperAsset: async (_supabase, _pageKey, _dateKey, assetId, assignmentSource) => {
        assigned.push({ assetId, assignmentSource });
      },
    }),
  );

  if (outcome.status !== "generated") {
    throw new Error(`Expected carry-forward slot to be regenerated, got ${JSON.stringify(outcome)}`);
  }

  if (generatedCount === 0) {
    throw new Error("Expected carry-forward slots to retry generation");
  }

  if (assigned[0]?.assignmentSource !== "auto") {
    throw new Error(`Expected regenerated asset to replace carry-forward with auto, got ${JSON.stringify(assigned)}`);
  }
});

Deno.test("rotatePageWallpaper keeps admin overrides sticky", async () => {
  let generatedCount = 0;
  const outcome = await rotatePageWallpaper(
    {},
    "profile",
    "2026-04-10",
    3,
    false,
    "rotate-2026-04-10",
    createDeps({
      getExistingAssignment: async () => ({
        id: "assign-admin",
        wallpaper_asset_id: "admin-asset",
        assignment_source: "admin_override",
      }),
      generateAndStoreWallpaperAsset: async (...args) => {
        generatedCount += 1;
        return createDeps().generateAndStoreWallpaperAsset(...args);
      },
    }),
  );

  if (outcome.status !== "skipped" || outcome.assetId !== "admin-asset") {
    throw new Error(`Expected admin override to remain in place, got ${JSON.stringify(outcome)}`);
  }

  if (generatedCount !== 0) {
    throw new Error("Expected admin override to skip generation");
  }
});

Deno.test("rotatePageWallpaper skips regeneration when a ready assignment already exists and force is false", async () => {
  let generatedCount = 0;
  const outcome = await rotatePageWallpaper(
    {},
    "guide",
    "2026-04-08",
    3,
    false,
    "rotate-2026-04-08",
    createDeps({
      getExistingAssignment: async () => ({
        id: "assign-1",
        wallpaper_asset_id: "asset-1",
        assignment_source: "auto",
      }),
      getWallpaperAssetEligibilitySnapshot: async () => ({
        publish_state: "ready",
        source_kind: "generated",
        generation_date: "2026-04-08",
      }),
      generateAndStoreWallpaperAsset: async (...args) => {
        generatedCount += 1;
        return createDeps().generateAndStoreWallpaperAsset(...args);
      },
    }),
  );

  if (outcome.status !== "skipped" || outcome.assetId !== "asset-1") {
    throw new Error(`Expected the existing assignment to be kept, got ${JSON.stringify(outcome)}`);
  }

  if (generatedCount !== 0) {
    throw new Error("Expected no regeneration when a ready assignment already exists");
  }
});

Deno.test("rotatePageWallpaper prefers approved same-date candidates before carry-forward assets", async () => {
  const assigned: Array<{ assetId: string; assignmentSource: string }> = [];
  const outcome = await rotatePageWallpaper(
    {},
    "campaigns",
    "2026-04-09",
    3,
    false,
    "rotate-2026-04-09",
    createDeps({
      listWallpaperAssetCandidates: async () => [
        {
          id: "same-day-approved",
          createdAt: "2026-04-09T10:00:00.000Z",
          publishState: "ready",
          sourceKind: "generated",
          generationDate: "2026-04-09",
          variantKey: "campaigns-ocean-cliffs-ringworld",
          batchLabel: "rotate-2026-04-09",
          validation_result: {
            scenicQualityScore: 95,
            moodMatchScore: 92,
            detailScore: 88,
            contrastScore: 84,
            safeZoneConfidenceScore: 90,
          },
          validation: {
            scenicQualityScore: 95,
            moodMatchScore: 92,
            detailScore: 88,
            contrastScore: 84,
            safeZoneConfidenceScore: 90,
          },
        },
      ],
      getLatestReadyAsset: async () => ({
        id: "older-carry-forward",
        createdAt: "2026-04-08T10:00:00.000Z",
        publishState: "ready",
        sourceKind: "generated",
        generationDate: "2026-04-08",
        variantKey: "campaigns-golden-canyon-sun-struck",
        batchLabel: "rotate-2026-04-08",
        validation_result: {
          scenicQualityScore: 88,
          moodMatchScore: 85,
          detailScore: 80,
          contrastScore: 78,
          safeZoneConfidenceScore: 82,
        },
        validation: {
          scenicQualityScore: 88,
          moodMatchScore: 85,
          detailScore: 80,
          contrastScore: 78,
          safeZoneConfidenceScore: 82,
        },
      }),
      assignWallpaperAsset: async (_supabase, _pageKey, _dateKey, assetId, assignmentSource) => {
        assigned.push({ assetId, assignmentSource });
      },
    }),
  );

  if (outcome.status !== "assigned_existing" || outcome.assetId !== "same-day-approved") {
    throw new Error(`Expected same-day approved asset to win, got ${JSON.stringify(outcome)}`);
  }

  if (assigned[0]?.assignmentSource !== "auto") {
    throw new Error(`Expected auto assignment, got ${JSON.stringify(assigned)}`);
  }
});

Deno.test("rotatePageWallpaper uses carry-forward only when there are no approved same-date candidates", async () => {
  const assigned: Array<{ assetId: string; assignmentSource: string }> = [];
  const outcome = await rotatePageWallpaper(
    {},
    "profile",
    "2026-04-09",
    3,
    false,
    "rotate-2026-04-09",
    createDeps({
      generateAndStoreWallpaperAsset: async (_supabase, args) => ({
        assetId: `${args.pageKey}-${args.dateKey}-${args.variantKey}`,
        createdAt: `${args.dateKey}T10:00:00.000Z`,
        imageUrl: `https://example.com/${args.pageKey}/${args.dateKey}/${args.variantKey}.png`,
        publishState: "validation_failed",
        validationResult: {
          approved: false,
          hasReadableText: false,
          hasUiOverlay: false,
          hasPurpleDominance: false,
          safeZonesClear: false,
          safeZoneConfidenceScore: 20,
          scenicQualityScore: 50,
          detailScore: 52,
          contrastScore: 48,
          moodMatchScore: 55,
          mobileFocusX: 50,
          mobileFocusY: 30,
          desktopFocusX: 50,
          desktopFocusY: 34,
          notes: [],
          rejectionReasons: ["unsafe composition"],
        },
        variantKey: args.variantKey ?? null,
      }),
      getLatestReadyAsset: async () => ({
        id: "profile-carry-forward",
        createdAt: "2026-04-08T10:00:00.000Z",
        publishState: "ready",
        sourceKind: "generated",
        generationDate: "2026-04-08",
        variantKey: "profile-coastal-observatory-slate-evening",
        batchLabel: "rotate-2026-04-08",
        validation_result: {
          scenicQualityScore: 90,
          moodMatchScore: 88,
          detailScore: 82,
          contrastScore: 80,
          safeZoneConfidenceScore: 84,
        },
        validation: {
          scenicQualityScore: 90,
          moodMatchScore: 88,
          detailScore: 82,
          contrastScore: 80,
          safeZoneConfidenceScore: 84,
        },
      }),
      assignWallpaperAsset: async (_supabase, _pageKey, _dateKey, assetId, assignmentSource) => {
        assigned.push({ assetId, assignmentSource });
      },
    }),
  );

  if (outcome.status !== "carry_forward" || outcome.assetId !== "profile-carry-forward") {
    throw new Error(`Expected carry-forward fallback, got ${JSON.stringify(outcome)}`);
  }

  if (assigned[0]?.assignmentSource !== "carry_forward") {
    throw new Error(`Expected carry_forward assignment, got ${JSON.stringify(assigned)}`);
  }
});

Deno.test("rotatePageWallpaper retries deterministic recipes after earlier validation failures", async () => {
  const recipe = getDeterministicWallpaperRecipes("guide", "2026-04-10", 1)[0];
  let generatedCount = 0;

  const outcome = await rotatePageWallpaper(
    {},
    "guide",
    "2026-04-10",
    1,
    false,
    "rotate-2026-04-10",
    createDeps({
      listWallpaperAssetCandidates: async () => [
        {
          id: "failed-guide-candidate",
          createdAt: "2026-04-10T10:00:00.000Z",
          publishState: "validation_failed",
          sourceKind: "generated",
          generationDate: "2026-04-10",
          variantKey: recipe.key,
          batchLabel: "rotate-2026-04-10",
          validation_result: {
            scenicQualityScore: 40,
            moodMatchScore: 42,
            detailScore: 39,
            contrastScore: 45,
            safeZoneConfidenceScore: 25,
          },
          validation: {
            scenicQualityScore: 40,
            moodMatchScore: 42,
            detailScore: 39,
            contrastScore: 45,
            safeZoneConfidenceScore: 25,
          },
        },
      ],
      generateAndStoreWallpaperAsset: async (...args) => {
        generatedCount += 1;
        return createDeps().generateAndStoreWallpaperAsset(...args);
      },
    }),
  );

  if (generatedCount !== 1) {
    throw new Error(`Expected the failed deterministic recipe to be retried, got ${generatedCount}`);
  }

  if (outcome.status !== "generated") {
    throw new Error(`Expected retry to replace carry-forward path with a generated asset, got ${JSON.stringify(outcome)}`);
  }
});
