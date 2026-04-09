import {
  rotatePageWallpaper,
  rotateWallpaperAssignments,
  type RotationDeps,
} from "./workflow.ts";
import { WALLPAPER_PAGE_KEYS } from "../../../src/shared/wallpaperCatalog.ts";

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

Deno.test("rotateWallpaperAssignments fills the 4-day horizon for all five pages", async () => {
  const assigned: Array<{ pageKey: string; dateKey: string; assetId: string; assignmentSource: string }> = [];
  const deps = createDeps({
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
    throw new Error(`Expected 20 outcomes, got ${outcomes.length}`);
  }

  if (outcomes.some((outcome) => outcome.status !== "generated")) {
    throw new Error(`Expected all outcomes to generate, got ${JSON.stringify(outcomes)}`);
  }

  if (assigned.length !== WALLPAPER_PAGE_KEYS.length * 4) {
    throw new Error(`Expected every page/date to be assigned, got ${assigned.length}`);
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
