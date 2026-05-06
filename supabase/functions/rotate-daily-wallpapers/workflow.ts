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
  costEndpointKey?: string;
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

const defaultDeps: RotationDeps = {
  getExistingAssignment,
  getWallpaperAssetEligibilitySnapshot,
  listWallpaperAssetCandidates,
  generateAndStoreWallpaperAsset,
  assignWallpaperAsset,
  getLatestReadyAsset,
};

const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_MAX_GENERATION_SLOTS_PER_RUN = 1;
const GENERATION_DEFERRED_REASON = "generation deferred due to run budget";

interface RotatePageWallpaperControls {
  allowGeneration: boolean;
}

interface RotatePageWallpaperExecutionResult {
  outcome: RotationOutcome;
  consumedGenerationSlot: boolean;
}

const getMaxGenerationSlotsPerRun = () => {
  const rawValue = Deno.env.get("WALLPAPER_MAX_GENERATION_SLOTS_PER_RUN");
  if (!rawValue) {
    return DEFAULT_MAX_GENERATION_SLOTS_PER_RUN;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_MAX_GENERATION_SLOTS_PER_RUN;
  }

  return parsed;
};

const logRotationOutcome = (
  batchLabel: string,
  outcome: RotationOutcome,
  force: boolean,
) => {
  console.info(JSON.stringify({
    event: "wallpaper_rotation_slot",
    batchLabel,
    force,
    pageKey: outcome.pageKey,
    dateKey: outcome.dateKey,
    status: outcome.status,
    assetId: outcome.assetId,
    assignmentSource: outcome.assignmentSource ?? null,
    reason: outcome.reason ?? null,
  }));
};

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

const rotatePageWallpaperInternal = async (
  supabase: SupabaseClient,
  pageKey: WallpaperPageKey,
  dateKey: string,
  candidateCount: number,
  force: boolean,
  batchLabel: string,
  controls: RotatePageWallpaperControls,
  costEndpointKey?: string,
  deps: RotationDeps = defaultDeps,
): Promise<RotatePageWallpaperExecutionResult> => {
  const existingAssignment = await deps.getExistingAssignment(supabase, pageKey, dateKey);
  if (existingAssignment && !force) {
    if (existingAssignment.assignment_source === "admin_override") {
      return {
        outcome: {
          pageKey,
          dateKey,
          status: "skipped",
          assetId: existingAssignment.wallpaper_asset_id,
          assignmentSource: existingAssignment.assignment_source,
          reason: "admin override kept",
        },
        consumedGenerationSlot: false,
      };
    }

    const eligibilitySnapshot = await deps.getWallpaperAssetEligibilitySnapshot(
      supabase,
      existingAssignment.wallpaper_asset_id,
    );

    if (
      existingAssignment.assignment_source === "auto"
      && eligibilitySnapshot?.publish_state === "ready"
      && eligibilitySnapshot.generation_date === dateKey
    ) {
      return {
        outcome: {
          pageKey,
          dateKey,
          status: "skipped",
          assetId: existingAssignment.wallpaper_asset_id,
          assignmentSource: existingAssignment.assignment_source,
          reason: "same-date auto assignment kept",
        },
        consumedGenerationSlot: false,
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
      outcome: {
        pageKey,
        dateKey,
        status: "assigned_existing",
        assetId: bestExistingSameDate.id,
        assignmentSource: "auto",
        reason: "reused approved same-date asset",
      },
      consumedGenerationSlot: false,
    };
  }

  if (!controls.allowGeneration) {
    if (existingAssignment) {
      return {
        outcome: {
          pageKey,
          dateKey,
          status: "skipped",
          assetId: existingAssignment.wallpaper_asset_id,
          assignmentSource: existingAssignment.assignment_source,
          reason: GENERATION_DEFERRED_REASON,
        },
        consumedGenerationSlot: false,
      };
    }

    const latestReadyAsset = await deps.getLatestReadyAsset(supabase, pageKey);
    if (latestReadyAsset) {
      await deps.assignWallpaperAsset(supabase, pageKey, dateKey, latestReadyAsset.id, "carry_forward");
      return {
        outcome: {
          pageKey,
          dateKey,
          status: "carry_forward",
          assetId: latestReadyAsset.id,
          assignmentSource: "carry_forward",
          reason: GENERATION_DEFERRED_REASON,
        },
        consumedGenerationSlot: false,
      };
    }

    return {
      outcome: {
        pageKey,
        dateKey,
        status: "skipped",
        assetId: null,
        reason: `${GENERATION_DEFERRED_REASON} and no carry-forward asset`,
      },
      consumedGenerationSlot: false,
    };
  }

  const existingReadyVariantKeys = new Set(
    sameDateCandidates
      .filter((candidate) => candidate.publishState === "ready")
      .map((candidate) => candidate.variantKey)
      .filter((variantKey): variantKey is string => Boolean(variantKey)),
  );
  const recipesToGenerate = getDeterministicWallpaperRecipes(pageKey, dateKey, Math.max(1, candidateCount))
    .filter((recipe) => force || !existingReadyVariantKeys.has(recipe.key));

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
        endpointKey: costEndpointKey,
      });

      generatedCandidates.push(
        toCandidateFromGeneratedAsset(generatedAsset, pageKey, dateKey, batchLabel),
      );

      const bestCandidateAfterGeneration = pickBestEligibleWallpaperCandidateForDate(
        pageKey,
        dateKey,
        [...sameDateCandidates, ...generatedCandidates],
      );

      if (bestCandidateAfterGeneration) {
        await deps.assignWallpaperAsset(supabase, pageKey, dateKey, bestCandidateAfterGeneration.id, "auto");
        return {
          outcome: {
            pageKey,
            dateKey,
            status: generatedCandidates.some((candidate) => candidate.id === bestCandidateAfterGeneration.id)
              ? "generated"
              : "assigned_existing",
            assetId: bestCandidateAfterGeneration.id,
            assignmentSource: "auto",
            reason: generatedCandidates.some((candidate) => candidate.id === bestCandidateAfterGeneration.id)
              ? "generated approved same-date candidate"
              : "reused approved same-date asset",
          },
          consumedGenerationSlot: true,
        };
      }
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
      outcome: {
        pageKey,
        dateKey,
        status: generatedCandidates.some((candidate) => candidate.id === bestSameDateCandidate.id)
          ? "generated"
          : "assigned_existing",
        assetId: bestSameDateCandidate.id,
        assignmentSource: "auto",
        reason: generatedCandidates.some((candidate) => candidate.id === bestSameDateCandidate.id)
          ? "generated approved same-date candidate"
          : "reused approved same-date asset",
      },
      consumedGenerationSlot: true,
    };
  }

  const latestReadyAsset = await deps.getLatestReadyAsset(supabase, pageKey);
  if (latestReadyAsset) {
    await deps.assignWallpaperAsset(supabase, pageKey, dateKey, latestReadyAsset.id, "carry_forward");
    return {
      outcome: {
        pageKey,
        dateKey,
        status: "carry_forward",
        assetId: latestReadyAsset.id,
        assignmentSource: "carry_forward",
        reason: generationErrors[0] ?? "no approved same-date candidates",
      },
      consumedGenerationSlot: true,
    };
  }

  return {
    outcome: {
      pageKey,
      dateKey,
      status: "skipped",
      assetId: null,
      reason: generationErrors[0] ?? "no approved candidates and no carry-forward asset",
    },
    consumedGenerationSlot: true,
  };
};

export const rotatePageWallpaper = async (
  supabase: SupabaseClient,
  pageKey: WallpaperPageKey,
  dateKey: string,
  candidateCount: number,
  force: boolean,
  batchLabel: string,
  deps: RotationDeps = defaultDeps,
): Promise<RotationOutcome> => {
  const { outcome } = await rotatePageWallpaperInternal(
    supabase,
    pageKey,
    dateKey,
    candidateCount,
    force,
    batchLabel,
    { allowGeneration: true },
    undefined,
    deps,
  );

  return outcome;
};

export const rotateWallpaperAssignments = async (
  supabase: SupabaseClient,
  options: RotateDailyWallpapersOptions,
  deps: RotationDeps = defaultDeps,
) => {
  const batchLabel = buildWallpaperBatchLabel(options.startDate);
  const dates = getWallpaperHorizonDates(options.startDate, options.daysAhead);
  const outcomes: RotationOutcome[] = [];
  let remainingGenerationSlots = getMaxGenerationSlotsPerRun();

  for (const dateKey of dates) {
    for (const pageKey of options.pageKeys) {
      const { outcome, consumedGenerationSlot } = await rotatePageWallpaperInternal(
        supabase,
        pageKey,
        dateKey,
        options.candidateCount,
        options.force,
        batchLabel,
        { allowGeneration: remainingGenerationSlots > 0 },
        options.costEndpointKey,
        deps,
      );
      outcomes.push(outcome);
      logRotationOutcome(batchLabel, outcome, options.force);
      if (consumedGenerationSlot) {
        remainingGenerationSlots -= 1;
      }
    }
  }

  return {
    batchLabel,
    outcomes,
  };
};
