import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  errorResponse,
  requireAuthenticatedUser,
  type UserRequestAuth,
} from "../_shared/auth.ts";
import {
  buildCostGuardrailBlockedResponse,
  createCostGuardrailSession,
  isCostGuardrailBlockedError,
} from "../_shared/costGuardrails.ts";
import { editCompanionImage } from "../_shared/openaiCompanionImageClient.ts";
import { registerUserStorageAsset } from "../_shared/storageAssetLedger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const COMPANION_IMAGE_BUCKET = "mentors-avatars";
const LAUNCHER_IMAGE_SIZE = "1024x1024";

interface CompanionRow {
  id: string;
  user_id: string;
  preset_id: string | null;
  companion_name: string | null;
  cached_creature_name: string | null;
  spirit_animal: string | null;
  core_element: string | null;
  favorite_color: string | null;
  current_stage: number | null;
  current_image_url: string | null;
  launcher_image_url: string | null;
  launcher_image_focal_x: number | null;
  launcher_image_focal_y: number | null;
  launcher_image_source_url: string | null;
}

interface GenerateCompanionLauncherImageDeps {
  authenticate: (
    req: Request,
    corsHeaders: HeadersInit,
  ) => Promise<UserRequestAuth | Response>;
  createSupabaseClient: () => any;
  createCostGuardrailSessionFn: any;
  editCompanionImageFn: typeof editCompanionImage;
  now: () => number;
}

const defaultDeps: GenerateCompanionLauncherImageDeps = {
  authenticate: requireAuthenticatedUser,
  createSupabaseClient: () => {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    return createClient(supabaseUrl, supabaseServiceKey);
  },
  createCostGuardrailSessionFn: createCostGuardrailSession,
  editCompanionImageFn: editCompanionImage,
  now: () => Date.now(),
};

const isUsableReferenceUrl = (
  value: string | null | undefined,
): value is string =>
  typeof value === "string" && /^https?:\/\//i.test(value.trim());

const parseDataUrl = (dataUrl: string): Uint8Array => {
  const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
  return Uint8Array.from(atob(base64Data), (char) => char.charCodeAt(0));
};

const deleteUploadedLauncherAssetBestEffort = async ({
  supabase,
  filePath,
  reason,
}: {
  supabase: any;
  filePath: string;
  reason: string;
}) => {
  try {
    const { error } = await supabase.storage
      .from(COMPANION_IMAGE_BUCKET)
      .remove([filePath]);

    if (error) {
      console.warn("[CompanionLauncherImage] Failed to remove stale upload", {
        filePath,
        reason,
        error: error.message ?? String(error),
      });
    }
  } catch (error) {
    console.warn("[CompanionLauncherImage] Stale upload removal threw", {
      filePath,
      reason,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const buildLauncherPrompt = (companion: CompanionRow): string => {
  const species = companion.spirit_animal?.trim() || "companion creature";
  const element = companion.core_element?.trim() || "natural";
  const color = companion.favorite_color?.trim() || "its existing";
  const name = companion.cached_creature_name?.trim() ||
    companion.companion_name?.trim() || "the companion";

  return `Create a dedicated floating launcher render of ${name}, based on the reference image.

Preserve the exact companion identity:
- Same species/body type: ${species}
- Same markings, colors, glow, eyes, silhouette, and personality
- Same elemental cues, especially ${element}, and preserve ${color} color accents
- Do not redesign, mature, simplify, anthropomorphize, or change the companion

Change only the presentation:
- Show only the companion, full body, centered, with ears/wings/tail fully inside the frame
- Use a clean readable silhouette with 12-18% padding on all sides
- Put the companion on a flat removable light background: solid off-white or very pale warm gray
- No scenic environment, no forest, room, starscape, frame, card, UI, props, text, watermark, border, or decorative backdrop
- No cast shadow that touches the frame edge; keep the background easy to remove

Output a polished square PNG-style render for a mobile floating action button.`;
};

const jsonResponse = (
  body: Record<string, unknown>,
  init: ResponseInit = {},
): Response =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export async function handleGenerateCompanionLauncherImage(
  req: Request,
  deps: GenerateCompanionLauncherImageDeps = defaultDeps,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse(405, "Method not allowed", corsHeaders);
  }

  const requestStartedAt = Date.now();

  try {
    const requestAuth = await deps.authenticate(req, corsHeaders);
    if (requestAuth instanceof Response) {
      return requestAuth;
    }

    const body = await req.json().catch(() => ({}));
    const companionId = typeof body?.companionId === "string"
      ? body.companionId.trim()
      : "";

    if (!companionId) {
      return errorResponse(400, "Missing companionId", corsHeaders);
    }

    const supabase = deps.createSupabaseClient();
    const { data, error: companionError } = await supabase
      .from("user_companion")
      .select(
        "id, user_id, preset_id, companion_name, cached_creature_name, spirit_animal, core_element, favorite_color, current_stage, current_image_url, launcher_image_url, launcher_image_focal_x, launcher_image_focal_y, launcher_image_source_url",
      )
      .eq("id", companionId)
      .eq("user_id", requestAuth.userId)
      .maybeSingle();

    if (companionError) {
      console.error(
        "[CompanionLauncherImage] Failed to fetch companion:",
        companionError,
      );
      return errorResponse(500, "Failed to load companion", corsHeaders);
    }

    const companion = data as CompanionRow | null;
    if (!companion) {
      return errorResponse(404, "Companion not found", corsHeaders);
    }

    if (
      typeof companion.preset_id === "string" &&
      companion.preset_id.trim().length > 0
    ) {
      return jsonResponse({
        success: true,
        skipped: true,
        reason: "preset_companion",
        imageUrl: null,
      });
    }

    if (
      companion.launcher_image_url &&
      companion.current_image_url &&
      companion.launcher_image_source_url === companion.current_image_url
    ) {
      return jsonResponse({
        success: true,
        cached: true,
        imageUrl: companion.launcher_image_url,
        imageFocalX: companion.launcher_image_focal_x ?? 0.5,
        imageFocalY: companion.launcher_image_focal_y ?? 0.5,
        sourceImageUrl: companion.launcher_image_source_url,
      });
    }

    if (!isUsableReferenceUrl(companion.current_image_url)) {
      return errorResponse(
        400,
        "Companion current image is not available for launcher generation",
        corsHeaders,
      );
    }

    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAIApiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const costGuardrails = deps.createCostGuardrailSessionFn({
      supabase,
      endpointKey: "generate-companion-launcher-image",
      featureKey: "ai_companion_images",
      userId: companion.user_id,
    });
    const guardedFetch = costGuardrails.wrapFetch(fetch);
    await costGuardrails.enforceAccess({
      capabilities: ["image"],
      providers: ["openai"],
    });

    const generatedImage = await deps.editCompanionImageFn({
      guardedFetch,
      openAIApiKey,
      prompt: buildLauncherPrompt(companion),
      size: LAUNCHER_IMAGE_SIZE,
      quality: "high",
      userId: companion.user_id,
      referenceImages: [{ imageUrl: companion.current_image_url }],
    });

    const imageBuffer = parseDataUrl(generatedImage.imageDataUrl);
    const stage = typeof companion.current_stage === "number"
      ? companion.current_stage
      : 0;
    const filePath =
      `${companion.user_id}/companion_${companion.user_id}_launcher_stage${stage}_${deps.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from(COMPANION_IMAGE_BUCKET)
      .upload(filePath, imageBuffer, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadError) {
      console.error("[CompanionLauncherImage] Upload failed:", uploadError);
      throw uploadError;
    }

    const { data: publicUrlData } = supabase.storage
      .from(COMPANION_IMAGE_BUCKET)
      .getPublicUrl(filePath);

    const imageUrl = publicUrlData.publicUrl;
    const updatePayload = {
      launcher_image_url: imageUrl,
      launcher_image_focal_x: 0.5,
      launcher_image_focal_y: 0.5,
      launcher_image_source_url: companion.current_image_url,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedCompanion, error: updateError } = await supabase
      .from("user_companion")
      .update(updatePayload)
      .eq("id", companion.id)
      .eq("user_id", companion.user_id)
      .eq("current_image_url", companion.current_image_url)
      .select("id")
      .maybeSingle();

    if (updateError) {
      console.error(
        "[CompanionLauncherImage] Failed to save launcher image:",
        updateError,
      );
      throw updateError;
    }

    if (!updatedCompanion) {
      await deleteUploadedLauncherAssetBestEffort({
        supabase,
        filePath,
        reason: "source_image_changed",
      });

      return jsonResponse({
        success: true,
        cached: false,
        skipped: true,
        stale: true,
        reason: "source_image_changed",
        imageUrl: null,
        sourceImageUrl: companion.current_image_url,
      });
    }

    await registerUserStorageAsset({
      supabase,
      userId: companion.user_id,
      bucketId: COMPANION_IMAGE_BUCKET,
      storagePath: filePath,
      sourceKind: "companion_launcher_image",
      sourceRecordTable: "user_companion",
      sourceRecordId: companion.id,
    });

    return jsonResponse({
      success: true,
      cached: false,
      imageUrl,
      imageFocalX: 0.5,
      imageFocalY: 0.5,
      sourceImageUrl: companion.current_image_url,
      imageSize: generatedImage.size,
      revisedPrompt: generatedImage.revisedPrompt,
    });
  } catch (error) {
    if (isCostGuardrailBlockedError(error)) {
      return buildCostGuardrailBlockedResponse(error, corsHeaders);
    }

    console.error("[CompanionLauncherImage] Error:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  } finally {
    console.log(
      `[CompanionLauncherImageTiming] total_ms=${
        Date.now() - requestStartedAt
      }`,
    );
  }
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleGenerateCompanionLauncherImage(req));
}
