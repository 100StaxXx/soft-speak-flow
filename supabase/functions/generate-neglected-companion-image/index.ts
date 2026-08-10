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

interface GenerateNeglectedCompanionImageDeps {
  authenticate: (
    req: Request,
    corsHeaders: HeadersInit,
  ) => Promise<InternalRequestAuth | Response>;
  createSupabaseClient: () => any;
  createCostGuardrailSessionFn: any;
  fetchImpl: typeof fetch;
}

const defaultDeps: GenerateNeglectedCompanionImageDeps = {
  authenticate: requireInternalRequest,
  createSupabaseClient: () => {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    return createClient(supabaseUrl, supabaseServiceKey);
  },
  createCostGuardrailSessionFn: createCostGuardrailSession,
  fetchImpl: fetch,
};

export async function handleGenerateNeglectedCompanionImage(
  req: Request,
  deps: GenerateNeglectedCompanionImageDeps = defaultDeps,
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
        "id, user_id, current_image_url, current_image_focal_x, current_image_focal_y, spirit_animal, core_element, favorite_color, current_stage, neglected_image_url, neglected_image_focal_x, neglected_image_focal_y, preset_id",
      )
      .eq("id", companionId)
      .maybeSingle();

    if (companionError) {
      console.error(
        "[Neglected Image] Failed to fetch companion:",
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
            state: "neglected",
            element: coerceCompanionElementId(companion.core_element),
          }),
        ).data.publicUrl;

      if (companion.neglected_image_url !== imageUrl) {
        const { error: updateError } = await supabase
          .from("user_companion")
          .update({
            neglected_image_url: imageUrl,
            neglected_image_focal_x: companion.current_image_focal_x ?? 0.5,
            neglected_image_focal_y: companion.current_image_focal_y ?? 0.5,
          })
          .eq("id", companionId);

        if (updateError) {
          console.error(
            "[Neglected Image] Failed to save preset image:",
            updateError,
          );
          throw updateError;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          imageUrl,
          cached: companion.neglected_image_url === imageUrl,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const imageSize = resolveCompanionImageSizeForUser(companion.user_id);
    console.log(
      `[NeglectedImagePolicy] user=${companion.user_id} image_size=${imageSize}`,
    );
    console.log(`[Neglected Image] Generating for companion ${companionId}`);
    const costGuardrails = deps.createCostGuardrailSessionFn({
      supabase,
      endpointKey: "generate-neglected-companion-image",
      featureKey: "ai_companion_images",
      userId: companion.user_id,
    });
    const guardedFetch = costGuardrails.wrapFetch(deps.fetchImpl);
    await costGuardrails.enforceAccess({
      capabilities: ["image"],
      providers: ["openai"],
    });

    if (companion.neglected_image_url) {
      console.log(
        `[Neglected Image] Already exists for companion ${companionId}`,
      );
      return new Response(
        JSON.stringify({
          success: true,
          imageUrl: companion.neglected_image_url,
          cached: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!companion.current_image_url) {
      throw new Error("No current image to edit");
    }

    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAIApiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const editPrompt =
      `Edit this companion creature to look sad and neglected while PRESERVING ITS EXACT APPEARANCE:

PRESERVE COMPLETELY (DO NOT CHANGE):
- The creature's species (${companion.spirit_animal}), face shape, and body structure
- All colors, markings, and patterns (especially ${companion.favorite_color} tones)
- Eye color and facial features
- The art style and quality
- Any unique characteristics or accessories

MODIFY TO SHOW NEGLECT (SUBTLE CHANGES ONLY):
- Make the posture slightly droopy and tired (lowered head, slightly slumped)
- Reduce color vibrancy by about 20% (desaturate slightly, not grayscale)
- Make eyes look sad and longing (droopy eyelids, looking down or away)
- Add subtle visual cues of low energy: slightly matted fur, dimmer glow, tired expression
- The creature should look like it misses someone, like a pet waiting by the door
- DO NOT make it look sick, injured, or dramatically different

MOOD: Sad, lonely, longing for attention - but still recognizable as the same companion
OUTPUT: The posture change overrides only the standard stance rule. Preserve the canonical square canvas, camera distance, subject scale, lighting recipe, edge finish, and transparent cutout.

Canonical Cosmiq render contract:
${buildCompanionArtDirection().map((rule) => `- ${rule}`).join("\n")}`;

    console.log("[Neglected Image] Calling image edit API...");

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
    const editedImageUrl = rendered.imageDataUrl;

    if (!editedImageUrl) {
      console.error(
        "[Neglected Image] No image returned by canonical image client",
      );
      throw new Error("Failed to generate neglected image");
    }

    console.log(
      `[Neglected Image] Successfully generated, saving to database for ${companionId}...`,
    );

    const base64Data = editedImageUrl.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Uint8Array.from(
      atob(base64Data),
      (char) => char.charCodeAt(0),
    );
    const fileName =
      `${companion.user_id}/neglected/${companionId}-${Date.now()}.png`;
    const { error: uploadError } = await supabase.storage
      .from("companion-images")
      .upload(fileName, imageBuffer, {
        contentType: "image/png",
        upsert: false,
      });
    if (uploadError) {
      throw new Error(
        `Failed to upload neglected image: ${uploadError.message}`,
      );
    }
    const { data: publicUrl } = supabase.storage
      .from("companion-images")
      .getPublicUrl(fileName);

    const { error: updateError } = await supabase
      .from("user_companion")
      .update({
        neglected_image_url: publicUrl.publicUrl,
        neglected_image_focal_x: companion.current_image_focal_x ?? 0.5,
        neglected_image_focal_y: companion.current_image_focal_y ?? 0.5,
      })
      .eq("id", companionId);

    if (updateError) {
      console.error("[Neglected Image] Failed to save:", updateError);
      throw updateError;
    }

    await registerUserStorageAsset({
      supabase,
      userId: companion.user_id,
      bucketId: "companion-images",
      storagePath: fileName,
      sourceKind: "companion_neglected_image",
      sourceRecordTable: "user_companion",
      sourceRecordId: companion.id,
    });

    console.log(`[Neglected Image] Complete for companion ${companionId}`);

    return new Response(
      JSON.stringify({
        success: true,
        imageUrl: publicUrl.publicUrl,
        cached: false,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    if (isCostGuardrailBlockedError(error)) {
      return buildCostGuardrailBlockedResponse(error, corsHeaders);
    }
    console.error("[Neglected Image] Error:", error);
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } finally {
    console.log(
      `[NeglectedImageTiming] total_ms=${Date.now() - requestStartedAt}`,
    );
  }
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleGenerateNeglectedCompanionImage(req));
}
