import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAdminRequest } from "../_shared/admin.ts";
import {
  assignWallpaperAsset,
  createWallpaperServiceClient,
  generateAndStoreWallpaperAsset,
} from "../_shared/wallpaperPipeline.ts";
import {
  getWallpaperDateKey,
  WALLPAPER_PAGE_KEYS,
  pickBestWallpaperPromotionCandidate,
  wallpaperGenerationBatchPresets,
  wallpaperPromptVariants,
  type WallpaperGenerationBatchPresetKey,
  type WallpaperPageKey,
  type WallpaperPromptVariantKey,
} from "../../../src/shared/wallpaperCatalog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BatchOutcome {
  variantKey: WallpaperPromptVariantKey;
  pageKey: WallpaperPageKey;
  status: "ready" | "validation_failed" | "error";
  assetId: string | null;
  reason?: string;
}

const supabase = createWallpaperServiceClient();

const jsonResponse = (status: number, body: Record<string, unknown>) => new Response(
  JSON.stringify(body),
  {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  },
);

const buildBatchLabel = (
  presetKey: WallpaperGenerationBatchPresetKey,
  date = new Date(),
) => `${presetKey}-${date.toISOString().replace(/[:.]/g, "-")}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const adminRequest = await requireAdminRequest(req, supabase, corsHeaders);
  if (adminRequest instanceof Response) {
    return adminRequest;
  }
  void adminRequest;

  const body = await req.json().catch(() => ({})) as {
    batchPreset?: WallpaperGenerationBatchPresetKey;
    promoteNow?: boolean;
  };
  const batchPresetKey = body.batchPreset ?? "core-tabs-v1";
  const promoteNow = body.promoteNow !== false;
  const preset = wallpaperGenerationBatchPresets[batchPresetKey];

  if (!preset) {
    return jsonResponse(400, {
      success: false,
      error: `Unknown batch preset: ${batchPresetKey}`,
    });
  }

  const dateKey = getWallpaperDateKey();
  const batchLabel = buildBatchLabel(batchPresetKey);
  const outcomes: BatchOutcome[] = [];
  const acceptedByPage = Object.fromEntries(
    WALLPAPER_PAGE_KEYS.map((pageKey) => [pageKey, [] as Array<{
      id: string;
      createdAt: string;
      variantKey: WallpaperPromptVariantKey;
      validation: {
        scenicQualityScore: number;
        moodMatchScore: number;
        detailScore: number;
        contrastScore: number;
        safeZoneConfidenceScore: number;
      };
    }>]),
  ) as Record<
    WallpaperPageKey,
    Array<{
      id: string;
      createdAt: string;
      variantKey: WallpaperPromptVariantKey;
      validation: {
        scenicQualityScore: number;
        moodMatchScore: number;
        detailScore: number;
        contrastScore: number;
        safeZoneConfidenceScore: number;
      };
    }>
  >;

  for (const variantKey of preset.variantKeys) {
    const variant = wallpaperPromptVariants[variantKey];

    try {
      const generatedAsset = await generateAndStoreWallpaperAsset(supabase, {
        pageKey: variant.pageKey,
        dateKey,
        promptText: variant.prompt,
        variantKey,
        batchLabel,
      });

      outcomes.push({
        variantKey,
        pageKey: variant.pageKey,
        status: generatedAsset.publishState,
        assetId: generatedAsset.assetId,
        reason: generatedAsset.publishState === "validation_failed"
          ? generatedAsset.validationResult.rejectionReasons.join(" · ") || "validation rejected candidate"
          : undefined,
      });

      if (generatedAsset.publishState === "ready") {
        acceptedByPage[variant.pageKey].push({
          id: generatedAsset.assetId,
          createdAt: generatedAsset.createdAt,
          variantKey,
          validation: {
            scenicQualityScore: generatedAsset.validationResult.scenicQualityScore,
            moodMatchScore: generatedAsset.validationResult.moodMatchScore,
            detailScore: generatedAsset.validationResult.detailScore,
            contrastScore: generatedAsset.validationResult.contrastScore,
            safeZoneConfidenceScore: generatedAsset.validationResult.safeZoneConfidenceScore,
          },
        });
      }
    } catch (error) {
      outcomes.push({
        variantKey,
        pageKey: variant.pageKey,
        status: "error",
        assetId: null,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const promoted = [];
  if (promoteNow) {
    for (const pageKey of Object.keys(acceptedByPage) as WallpaperPageKey[]) {
      const bestCandidate = pickBestWallpaperPromotionCandidate(acceptedByPage[pageKey]);
      if (!bestCandidate) continue;

      await assignWallpaperAsset(supabase, pageKey, dateKey, bestCandidate.id, "auto");
      promoted.push({
        pageKey,
        assetId: bestCandidate.id,
        variantKey: bestCandidate.variantKey,
      });
    }
  }

  return jsonResponse(200, {
    success: true,
    batchPreset: batchPresetKey,
    batchLabel,
    dateKey,
    acceptedCount: outcomes.filter((outcome) => outcome.status === "ready").length,
    rejectedCount: outcomes.filter((outcome) => outcome.status === "validation_failed").length,
    errorCount: outcomes.filter((outcome) => outcome.status === "error").length,
    promoted,
    outcomes,
  });
});
