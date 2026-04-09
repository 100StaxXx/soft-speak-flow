import {
  WALLPAPER_DEFAULT_CANDIDATE_COUNT,
  WALLPAPER_HORIZON_DAYS,
  WALLPAPER_PAGE_KEYS,
  getDeterministicWallpaperRecipes,
  getWallpaperHorizonDates,
  getWallpaperSchedulerStartDate,
  pickBestEligibleWallpaperCandidateForDate,
  type WallpaperAssignmentSource,
  type WallpaperPageKey,
} from "../../../src/shared/wallpaperCatalog.ts";
import {
  assignWallpaperAsset,
  generateAndStoreWallpaperAsset,
  getExistingAssignment,
  getLatestReadyAsset,
  getWallpaperAssetEligibilitySnapshot,
  listWallpaperAssetCandidates,
  type GeneratedWallpaperAssetRecord,
  type ReadyWallpaperAssetRow,
} from "../_shared/wallpaperPipeline.ts";

type SupabaseClient = any;

export interface RotationOutcome {
  pageKey: WallpaperPageKey;
  dateKey: string;
  status: "generated" | "assigned_existing" | "carry_forward" | "skipped";
  assetId: string | null;
  assignmentSource?: WallpaperAssignmentSource;
  reason?: string;
}

export interface RotateDailyWallpapersOptions {
  startDate: string;
  daysAhead: number;
  pageKeys: WallpaperPageKey[];
  candidateCount: number;
  force: boolean;
}

export interface RotateDailyWallpapersRequestBody {
  startDate?: string;
  daysAhead?: number;
  pageKeys?: string[];
  candidateCount?: number;
  force?: boolean;
}

export interface RotationDeps {
  getExistingAssignment: typeof getExistingAssignment;
  getWallpaperAssetEligibilitySnapshot: typeof getWallpaperAssetEligibilitySnapshot;
  listWallpaperAssetCandidates: typeof listWallpaperAssetCandidates;
  generateAndStoreWallpaperAsset: typeof generateAndStoreWallpaperAsset;
  assignWallpaperAsset: typeof assignWallpaperAsset;
  getLatestReadyAsset: typeof getLatestReadyAsset;
}

interface RotatePageWallpaperControls {
  allowGeneration?: boolean;
  generationCandidateCount?: number;
}

const defaultDeps: RotationDeps = {
  getExistingAssignment,
  getWallpaperAssetEligibilitySnapshot,
  listWallpaperAssetCandidates,
  generateAndStoreWallpaperAsset,
  assignWallpaperAsset,
  getLatestReadyAsset,
};

const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const clampInteger = (value: unknown, fallback: number, minimum: number, maximum: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Math.round(value)));
};

const isWallpaperPageKey = (value: string): value is WallpaperPageKey =>
  (WALLPAPER_PAGE_KEYS as readonly string[]).includes(value);

export const resolveRotateDailyWallpapersOptions = (
  body: RotateDailyWallpapersRequestBody | null | undefined,
): RotateDailyWallpapersOptions => {
  const requestedPageKeys = Array.isArray(body?.pageKeys)
    ? body?.pageKeys.filter(isWallpaperPageKey)
    : [];

  return {
    startDate: DATE_KEY_REGEX.test(body?.startDate ?? "")
      ? body?.startDate as string
      : getWallpaperSchedulerStartDate(),
    daysAhead: clampInteger(body?.daysAhead, WALLPAPER_HORIZON_DAYS, 1, 7),
    pageKeys: requestedPageKeys.length > 0 ? requestedPageKeys : [...WALLPAPER_PAGE_KEYS],
    candidateCount: clampInteger(body?.candidateCount, WALLPAPER_DEFAULT_CANDIDATE_COUNT, 1, 6),
    force: body?.force === true,
  };
};

const buildWallpaperBatchLabel = (
  startDate: string,
  now = new Date(),
) => `rotate-${startDate}-${now.toISOString().replace(/[:.]/g, "-")}`;

const toCandidateFromGeneratedAsset = (
  generatedAsset: GeneratedWallpaperAssetRecord,
  pageKey: WallpaperPageKey,
  dateKey: string,
  batchLabel: string,
): ReadyWallpaperAssetRow => ({
  id: generatedAsset.assetId,
  createdAt: generatedAsset.createdAt,
  publishState: generatedAsset.publishState,
  sourceKind: "generated",
  generationDate: dateKey,
  variantKey: generatedAsset.variantKey,
  batchLabel,
  validation_result: {
    scenicQualityScore: generatedAsset.validationResult.scenicQualityScore,
    moodMatchScore: generatedAsset.validationResult.moodMatchScore,
    detailScore: generatedAsset.validationResult.detailScore,
    contrastScore: generatedAsset.validationResult.contrastScore,
    safeZoneConfidenceScore: generatedAsset.validationResult.safeZoneConfidenceScore,
  },
  validation: {
    scenicQualityScore: generatedAsset.validationResult.scenicQualityScore,
    moodMatchScore: generatedAsset.validationResult.moodMatchScore,
    detailScore: generatedAsset.validationResult.detailScore,
    contrastScore: generatedAsset.validationResult.contrastScore,
    safeZoneConfidenceScore: generatedAsset.validationResult.safeZoneConfidenceScore,
  },
  pageKey,
});

export const rotatePageWallpaper = async (
  supabase: SupabaseClient,
  pageKey: WallpaperPageKey,
  dateKey: string,
  candidateCount: number,
  force: boolean,
  batchLabel: string,
  deps: RotationDeps = defaultDeps,
  controls: RotatePageWallpaperControls = {},
): Promise<RotationOutcome> => {
  const existingAssignment = await deps.getExistingAssignment(supabase, pageKey, dateKey);
  if (existingAssignment && !force) {
    const eligibilitySnapshot = await deps.getWallpaperAssetEligibilitySnapshot(
      supabase,
      existingAssignment.wallpaper_asset_id,
    );

    if (eligibilitySnapshot?.publish_state === "ready") {
      return {
        pageKey,
        dateKey,
        status: "skipped",
        assetId: existingAssignment.wallpaper_asset_id,
        assignmentSource: existingAssignment.assignment_source,
        reason: "already assigned",
      };
    }
  }

  const sameDateCandidates = await deps.listWallpaperAssetCandidates(supabase, pageKey, {
    generationDate: dateKey,
  });
  const bestExistingSameDate = pickBestEligibleWallpaperCandidateForDate(
    pageKey,
    dateKey,
    sameDateCandidates,
  );

  if (bestExistingSameDate && !force) {
    await deps.assignWallpaperAsset(supabase, pageKey, dateKey, bestExistingSameDate.id, "auto");
    return {
      pageKey,
      dateKey,
      status: "assigned_existing",
      assetId: bestExistingSameDate.id,
      assignmentSource: "auto",
      reason: "reused approved same-date asset",
    };
  }

  if (controls.allowGeneration === false) {
    const latestReadyAsset = await deps.getLatestReadyAsset(supabase, pageKey);
    if (latestReadyAsset) {
      await deps.assignWallpaperAsset(supabase, pageKey, dateKey, latestReadyAsset.id, "carry_forward");
      return {
        pageKey,
        dateKey,
        status: "carry_forward",
        assetId: latestReadyAsset.id,
        assignmentSource: "carry_forward",
        reason: "fast rotation reused latest ready asset",
      };
    }

    return {
      pageKey,
      dateKey,
      status: "skipped",
      assetId: null,
      reason: "fast rotation skipped generation with no carry-forward asset",
    };
  }

  const existingVariantKeys = new Set(
    sameDateCandidates
      .map((candidate) => candidate.variantKey)
      .filter((variantKey): variantKey is string => Boolean(variantKey)),
  );
  const effectiveCandidateCount = Math.max(1, controls.generationCandidateCount ?? candidateCount);
  const recipesToGenerate = getDeterministicWallpaperRecipes(pageKey, dateKey, effectiveCandidateCount)
    .filter((recipe) => force || !existingVariantKeys.has(recipe.key));

  const generatedCandidates: ReadyWallpaperAssetRow[] = [];
  const generationErrors: string[] = [];

  for (const recipe of recipesToGenerate) {
    try {
      const generatedAsset = await deps.generateAndStoreWallpaperAsset(supabase, {
        pageKey,
        dateKey,
        promptText: recipe.prompt,
        variantKey: recipe.key,
        batchLabel,
      });

      generatedCandidates.push(
        toCandidateFromGeneratedAsset(generatedAsset, pageKey, dateKey, batchLabel),
      );
    } catch (error) {
      generationErrors.push(error instanceof Error ? error.message : String(error));
    }
  }

  const bestSameDateCandidate = pickBestEligibleWallpaperCandidateForDate(
    pageKey,
    dateKey,
    [...sameDateCandidates, ...generatedCandidates],
  );

  if (bestSameDateCandidate) {
    await deps.assignWallpaperAsset(supabase, pageKey, dateKey, bestSameDateCandidate.id, "auto");
    return {
      pageKey,
      dateKey,
      status: recipesToGenerate.length > 0 ? "generated" : "assigned_existing",
      assetId: bestSameDateCandidate.id,
      assignmentSource: "auto",
      reason: recipesToGenerate.length > 0
        ? "generated approved same-date candidate"
        : "reused approved same-date asset",
    };
  }

  const latestReadyAsset = await deps.getLatestReadyAsset(supabase, pageKey);
  if (latestReadyAsset) {
    await deps.assignWallpaperAsset(supabase, pageKey, dateKey, latestReadyAsset.id, "carry_forward");
    return {
      pageKey,
      dateKey,
      status: "carry_forward",
      assetId: latestReadyAsset.id,
      assignmentSource: "carry_forward",
      reason: generationErrors[0] ?? "no approved same-date candidates",
    };
  }

  return {
    pageKey,
    dateKey,
    status: "skipped",
    assetId: null,
    reason: generationErrors[0] ?? "no approved candidates and no carry-forward asset",
  };
};

export const rotateWallpaperAssignments = async (
  supabase: SupabaseClient,
  options: RotateDailyWallpapersOptions,
  deps: RotationDeps = defaultDeps,
) => {
  const batchLabel = buildWallpaperBatchLabel(options.startDate);
  const dates = getWallpaperHorizonDates(options.startDate, options.daysAhead);
  const outcomes: RotationOutcome[] = [];

  if (!options.force) {
    const outcomeBySlot = new Map<string, RotationOutcome>();

    // First cover the whole horizon with same-date reuse or carry-forward so one slow
    // generation job cannot block every future assignment in the current run.
    for (const dateKey of dates) {
      for (const pageKey of options.pageKeys) {
        const outcome = await rotatePageWallpaper(
          supabase,
          pageKey,
          dateKey,
          options.candidateCount,
          false,
          batchLabel,
          deps,
          {
            allowGeneration: false,
            generationCandidateCount: 0,
          },
        );
        outcomeBySlot.set(`${dateKey}:${pageKey}`, outcome);
      }
    }

    // Then try to freshen the active wallpaper day only, promoting future carry-forward
    // assignments afterward if a new current-day asset becomes available.
    for (const pageKey of options.pageKeys) {
      const currentKey = `${options.startDate}:${pageKey}`;
      const currentOutcome = outcomeBySlot.get(currentKey);
      if (
        !currentOutcome
        || (
          currentOutcome.status !== "carry_forward"
          && currentOutcome.assignmentSource !== "carry_forward"
          && currentOutcome.assetId !== null
        )
      ) {
        continue;
      }

      const generatedOutcome = await rotatePageWallpaper(
        supabase,
        pageKey,
        options.startDate,
        options.candidateCount,
        false,
        batchLabel,
        deps,
        {
          allowGeneration: true,
          generationCandidateCount: 1,
        },
      );
      outcomeBySlot.set(currentKey, generatedOutcome);

      if (generatedOutcome.assetId === null) {
        continue;
      }

      for (const dateKey of dates.slice(1)) {
        const slotKey = `${dateKey}:${pageKey}`;
        const existingOutcome = outcomeBySlot.get(slotKey);
        if (existingOutcome?.assetId !== null) {
          continue;
        }

        const futureOutcome = await rotatePageWallpaper(
          supabase,
          pageKey,
          dateKey,
          options.candidateCount,
          false,
          batchLabel,
          deps,
          {
            allowGeneration: false,
            generationCandidateCount: 0,
          },
        );
        outcomeBySlot.set(slotKey, futureOutcome);
      }
    }

    for (const dateKey of dates) {
      for (const pageKey of options.pageKeys) {
        const outcome = outcomeBySlot.get(`${dateKey}:${pageKey}`);
        if (outcome) {
          outcomes.push(outcome);
        }
      }
    }

    return {
      batchLabel,
      outcomes,
    };
  }

  for (const dateKey of dates) {
    for (const pageKey of options.pageKeys) {
      const outcome = await rotatePageWallpaper(
        supabase,
        pageKey,
        dateKey,
        options.candidateCount,
        true,
        batchLabel,
        deps,
        {
          allowGeneration: true,
          generationCandidateCount: options.candidateCount,
        },
      );
      outcomes.push(outcome);
    }
  }

  return {
    batchLabel,
    outcomes,
  };
};
