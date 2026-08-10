import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getCompanionFinalImageQuality,
  resolveCompanionImageSizeForUser,
} from "../_shared/companionImagePolicy.ts";
import { buildCompanionArtDirection } from "../_shared/companionLineage.ts";
import { editCompanionImage } from "../_shared/openaiCompanionImageClient.ts";
import {
  errorResponse,
  type InternalRequestAuth,
  requireInternalRequest,
} from "../_shared/auth.ts";
import {
  buildCostGuardrailBlockedResponse,
  createCostGuardrailSession,
  isCostGuardrailBlockedError,
} from "../_shared/costGuardrails.ts";
import {
  coerceCompanionElementId,
  coerceCompanionPresetId,
  COMPANION_PRESET_BUCKET,
  resolveCompanionAssetPath,
} from "../../../src/config/companionCatalog.ts";
import { registerUserStorageAsset } from "../_shared/storageAssetLedger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface GenerateDormantCompanionImageDeps {
  authenticate: (
    req: Request,
    corsHeaders: HeadersInit,
  ) => Promise<InternalRequestAuth | Response>;
  createSupabaseClient: () => any;
  createCostGuardrailSessionFn: any;
  fetchImpl: typeof fetch;
}

const defaultDeps: GenerateDormantCompanionImageDeps = {
  authenticate: requireInternalRequest,
  createSupabaseClient: () => {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    return createClient(supabaseUrl, supabaseServiceKey);
  },
  createCostGuardrailSessionFn: createCostGuardrailSession,
  fetchImpl: fetch,
};

export async function handleGenerateDormantCompanionImage(
  req: Request,
  deps: GenerateDormantCompanionImageDeps = defaultDeps,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestStartedAt = Date.now();

  try {
    const requestAuth = await deps.authenticate(req, corsHeaders);
    if (requestAuth instanceof Response) {
      return requestAuth;
    }

    const body = await req.json().catch(() => ({}));
    const companionId = typeof body?.companionId === "string"
      ? body.companionId
      : null;

    if (!companionId) {
      return errorResponse(400, "Missing companionId", corsHeaders);
    }

    const supabase = deps.createSupabaseClient();
    const { data: companion, error: companionError } = await supabase
      .from("user_companion")
      .select(
        "id, user_id, current_image_url, current_image_focal_x, current_image_focal_y, dormant_image_url, dormant_image_focal_x, dormant_image_focal_y, spirit_animal, companion_name, core_element, current_stage, preset_id",
      )
      .eq("id", companionId)
      .maybeSingle();

    if (companionError) {
      console.error(
        "[Dormant Image] Failed to fetch companion:",
        companionError,
      );
      return errorResponse(500, "Failed to load companion", corsHeaders);
    }

    if (!companion) {
      return errorResponse(404, "Companion not found", corsHeaders);
    }

    const normalizedPresetId = coerceCompanionPresetId(companion.preset_id);
    if (normalizedPresetId) {
      const imageUrl = supabase.storage
        .from(COMPANION_PRESET_BUCKET)
        .getPublicUrl(
          resolveCompanionAssetPath({
            presetId: normalizedPresetId,
            stage: companion.current_stage ?? 0,
            state: "dormant",
            element: coerceCompanionElementId(companion.core_element),
          }),
        ).data.publicUrl;

      if (companion.dormant_image_url !== imageUrl) {
        const { error: updateError } = await supabase
          .from("user_companion")
          .update({
            dormant_image_url: imageUrl,
            dormant_image_focal_x: companion.current_image_focal_x ?? 0.5,
            dormant_image_focal_y: companion.current_image_focal_y ?? 0.5,
          })
          .eq("id", companionId);

        if (updateError) {
          console.error(
            "[Dormant Image] Failed to save preset image:",
            updateError,
          );
          throw updateError;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          imageUrl,
          cached: companion.dormant_image_url === imageUrl,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const imageSize = resolveCompanionImageSizeForUser(companion.user_id);
    console.log(
      `[DormantImagePolicy] user=${companion.user_id} image_size=${imageSize}`,
    );
    const costGuardrails = deps.createCostGuardrailSessionFn({
      supabase,
      endpointKey: "generate-dormant-companion-image",
      featureKey: "ai_companion_images",
      userId: companion.user_id,
    });
    const guardedFetch = costGuardrails.wrapFetch(deps.fetchImpl);
    await costGuardrails.enforceAccess({
      capabilities: ["image"],
      providers: ["openai"],
    });

    if (companion.dormant_image_url) {
      return new Response(
        JSON.stringify({
          success: true,
          imageUrl: companion.dormant_image_url,
          cached: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!companion.current_image_url) {
      throw new Error("No current image to base dormant image on");
    }

    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAIApiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    console.log(`[Dormant Image] Generating for companion ${companionId}`);

    const editPrompt =
      `Transform this exact companion into a peaceful sleeping state while preserving its identity and canonical Cosmiq artwork:
- Eyes gently closed, serene expression
- Curled up in a comfortable resting position
- Preserve the exact palette; reduce saturation no more than 10% and use a faint body-attached blue-grey sleep aura
- Gentle breathing visible through subtle chest movement suggestion
- Dreamlike mood with subtle stardust or sleep particles over transparency
- Peaceful but with a hint of waiting/longing
- The creature should look like it's in a deep, protective slumber
- Preserve the exact species, anatomy, face, markings, materials, signature features, and maturity
- The sleeping pose overrides only the standard stance rule; preserve the standard square canvas, camera distance, subject scale, lighting recipe, edge finish, and transparent cutout

Canonical Cosmiq render contract:
${buildCompanionArtDirection().map((rule) => `- ${rule}`).join("\n")}`;

    const rendered = await editCompanionImage({
      guardedFetch,
      openAIApiKey,
      prompt: editPrompt,
      size: imageSize,
      quality: getCompanionFinalImageQuality(),
      background: "transparent",
      outputFormat: "png",
      userId: companion.user_id,
      referenceImages: [{ imageUrl: companion.current_image_url }],
    });
    const generatedImage = rendered.imageDataUrl;

    if (!generatedImage) {
      throw new Error("No image generated");
    }

    const base64Data = generatedImage.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Uint8Array.from(
      atob(base64Data),
      (char) => char.charCodeAt(0),
    );

    const fileName =
      `${companion.user_id}/dormant/${companionId}-${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("companion-images")
      .upload(fileName, imageBuffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("[Dormant Image] Upload error:", uploadError);
      throw uploadError;
    }

    const { data: publicUrl } = supabase.storage
      .from("companion-images")
      .getPublicUrl(fileName);

    const { error: updateError } = await supabase
      .from("user_companion")
      .update({
        dormant_image_url: publicUrl.publicUrl,
        dormant_image_focal_x: companion.current_image_focal_x ?? 0.5,
        dormant_image_focal_y: companion.current_image_focal_y ?? 0.5,
      })
      .eq("id", companionId);

    if (updateError) {
      console.error("[Dormant Image] Failed to save image:", updateError);
      throw updateError;
    }

    await registerUserStorageAsset({
      supabase,
      userId: companion.user_id,
      bucketId: "companion-images",
      storagePath: fileName,
      sourceKind: "companion_dormant_image",
      sourceRecordTable: "user_companion",
      sourceRecordId: companion.id,
    });

    console.log(
      `[Dormant Image] Generated and saved for companion ${companionId}`,
    );

    return new Response(
      JSON.stringify({ success: true, imageUrl: publicUrl.publicUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    if (isCostGuardrailBlockedError(error)) {
      return buildCostGuardrailBlockedResponse(error, corsHeaders);
    }
    console.error("[Dormant Image] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } finally {
    console.log(
      `[DormantImageTiming] total_ms=${Date.now() - requestStartedAt}`,
    );
  }
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleGenerateDormantCompanionImage(req));
}
