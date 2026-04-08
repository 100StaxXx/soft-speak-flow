import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getWallpaperDateKey,
  wallpaperGenerationSpecs,
  type WallpaperPageKey,
} from "../../../src/shared/wallpaperCatalog.ts";
import { requireInternalRequest } from "../_shared/auth.ts";
import {
  assignWallpaperAsset,
  createWallpaperServiceClient,
  generateAndStoreWallpaperAsset,
  getExistingAssignment,
  getLatestReadyAssetId,
  getOldestUnusedReadyAssetId,
} from "../_shared/wallpaperPipeline.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-key",
};

interface RotationOutcome {
  pageKey: WallpaperPageKey;
  status: "generated" | "backlog" | "carry_forward" | "skipped";
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

const rotatePageWallpaper = async (
  pageKey: WallpaperPageKey,
  dateKey: string,
  force: boolean,
): Promise<RotationOutcome> => {
  const existingAssignment = await getExistingAssignment(supabase, pageKey, dateKey);
  if (existingAssignment && !force) {
    return {
      pageKey,
      status: "skipped",
      assetId: existingAssignment.wallpaper_asset_id,
      reason: "already assigned for date",
    };
  }

  const backlogAssetId = await getOldestUnusedReadyAssetId(supabase, pageKey);
  if (backlogAssetId) {
    await assignWallpaperAsset(supabase, pageKey, dateKey, backlogAssetId, "auto");
    return {
      pageKey,
      status: "backlog",
      assetId: backlogAssetId,
      reason: "assigned oldest unused ready backlog asset",
    };
  }

  try {
    const generatedAsset = await generateAndStoreWallpaperAsset(supabase, {
      pageKey,
      dateKey,
      promptText: wallpaperGenerationSpecs[pageKey].prompt,
    });

    if (generatedAsset.publishState === "ready") {
      await assignWallpaperAsset(supabase, pageKey, dateKey, generatedAsset.assetId, "auto");
      return {
        pageKey,
        status: "generated",
        assetId: generatedAsset.assetId,
      };
    }

    const latestReadyAssetId = await getLatestReadyAssetId(supabase, pageKey);
    if (latestReadyAssetId) {
      await assignWallpaperAsset(supabase, pageKey, dateKey, latestReadyAssetId, "carry_forward");
      return {
        pageKey,
        status: "carry_forward",
        assetId: latestReadyAssetId,
        reason: generatedAsset.validationResult.rejectionReasons.join(" · ") || "validation rejected candidate",
      };
    }

    return {
      pageKey,
      status: "skipped",
      assetId: null,
      reason: generatedAsset.validationResult.rejectionReasons.join(" · ") || "validation rejected candidate",
    };
  } catch (error) {
    const latestReadyAssetId = await getLatestReadyAssetId(supabase, pageKey);
    if (latestReadyAssetId) {
      await assignWallpaperAsset(supabase, pageKey, dateKey, latestReadyAssetId, "carry_forward");
      return {
        pageKey,
        status: "carry_forward",
        assetId: latestReadyAssetId,
        reason: error instanceof Error ? error.message : String(error),
      };
    }

    return {
      pageKey,
      status: "skipped",
      assetId: null,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const internalRequest = await requireInternalRequest(req, corsHeaders);
  if (internalRequest instanceof Response) {
    return internalRequest;
  }
  void internalRequest;

  const body = await req.json().catch(() => ({})) as { force?: boolean };
  const force = body.force === true;
  const dateKey = getWallpaperDateKey();
  const outcomes: RotationOutcome[] = [];

  for (const pageKey of Object.keys(wallpaperGenerationSpecs) as WallpaperPageKey[]) {
    const outcome = await rotatePageWallpaper(pageKey, dateKey, force);
    outcomes.push(outcome);
  }

  return jsonResponse(200, {
    success: true,
    dateKey,
    outcomes,
  });
});
