import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveCompanionImageSizeForUser } from "../_shared/companionImagePolicy.ts";
import {
  errorResponse,
  requireUserOrInternalRequest,
  type UserOrInternalRequestAuth,
} from "../_shared/auth.ts";
import {
  buildCostGuardrailBlockedResponse,
  createCostGuardrailSession,
  isCostGuardrailBlockedError,
} from "../_shared/costGuardrails.ts";
import { registerUserStorageAsset } from "../_shared/storageAssetLedger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-key",
};

const LAUNCHER_BUCKET = "companion-images";

interface GenerateCompanionLauncherImageDeps {
  authenticate: (req: Request, corsHeaders: HeadersInit) => Promise<UserOrInternalRequestAuth | Response>;
  createSupabaseClient: () => any;
  createCostGuardrailSessionFn: typeof createCostGuardrailSession;
  fetchImpl: typeof fetch;
}

const defaultDeps: GenerateCompanionLauncherImageDeps = {
  authenticate: requireUserOrInternalRequest,
  createSupabaseClient: () => {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    return createClient(supabaseUrl, supabaseServiceKey);
  },
  createCostGuardrailSessionFn: createCostGuardrailSession,
  fetchImpl: fetch,
};

function buildLauncherPrompt(args: {
  spiritAnimal: string | null;
  element: string | null;
  favoriteColor: string | null;
  companionName: string | null;
}): string {
  const name = args.companionName ?? "the companion";
  const species = args.spiritAnimal ?? "creature";
  const element = args.element ?? "elemental";
  const color = args.favoriteColor ?? "signature";

  return `Restyle the reference creature into a dedicated launcher icon for ${name}.

Preserve identity exactly:
- Same species/body type: ${species}
- Same markings, colors, glow, eyes, silhouette, and personality
- Same elemental cues, especially ${element}, and preserve ${color} color accents
- Do not redesign, age, simplify, anthropomorphize, or change the companion

Reframe only:
- Show only the companion, full body, perfectly centered, with ears, wings, tail, and feet fully inside the frame
- 12-18% padding on all sides, no clipping against any edge
- Calm forward-facing pose suitable for an icon

Background and styling:
- Pure flat #FFFFFF white background, completely solid, no gradient, no scenic environment, no props, no UI, no text, no watermark, no border
- No cast shadows that touch any frame edge; subject must read as cleanly removable
- Soft natural rim lighting on the subject only
- Square 1024x1024 PNG output

This is a polished mobile launcher icon. The background must be pure white so it can be alpha-keyed later.`;
}

export async function handleGenerateCompanionLauncherImage(
  req: Request,
  deps: GenerateCompanionLauncherImageDeps = defaultDeps,
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
    const companionId = typeof body?.companionId === "string" ? body.companionId : null;
    const force = body?.force === true;

    if (!companionId) {
      return errorResponse(400, "Missing companionId", corsHeaders);
    }

    const supabase = deps.createSupabaseClient();
    const { data: companion, error: companionError } = await supabase
      .from("user_companion")
      .select("id, user_id, current_image_url, current_image_focal_x, current_image_focal_y, launcher_image_url, launcher_image_source_url, spirit_animal, cached_creature_name, companion_name, core_element, favorite_color, current_stage, preset_id")
      .eq("id", companionId)
      .maybeSingle();

    if (companionError) {
      console.error("[Launcher Image] Failed to fetch companion:", companionError);
      return errorResponse(500, "Failed to load companion", corsHeaders);
    }

    if (!companion) {
      return errorResponse(404, "Companion not found", corsHeaders);
    }

    if (!("isInternal" in requestAuth) || requestAuth.isInternal !== true) {
      const userAuth = requestAuth as { userId?: string };
      if (userAuth.userId && userAuth.userId !== companion.user_id) {
        return errorResponse(403, "Forbidden", corsHeaders);
      }
    }

    if (!companion.current_image_url) {
      return errorResponse(409, "Companion has no current_image_url to derive from", corsHeaders);
    }

    if (
      !force
      && companion.launcher_image_url
      && companion.launcher_image_source_url === companion.current_image_url
    ) {
      return new Response(
        JSON.stringify({
          success: true,
          cached: true,
          imageUrl: companion.launcher_image_url,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const imageSize = resolveCompanionImageSizeForUser(companion.user_id);
    const costGuardrails = deps.createCostGuardrailSessionFn({
      supabase,
      endpointKey: "generate-companion-launcher-image",
      featureKey: "ai_companion_images",
      userId: companion.user_id,
    });
    const guardedFetch = costGuardrails.wrapFetch(deps.fetchImpl);
    await costGuardrails.enforceAccess({
      capabilities: ["image"],
      providers: ["openai"],
    });

    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAIApiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const editPrompt = buildLauncherPrompt({
      spiritAnimal: companion.spirit_animal ?? null,
      element: companion.core_element ?? null,
      favoriteColor: companion.favorite_color ?? null,
      companionName: companion.companion_name ?? companion.cached_creature_name ?? null,
    });

    console.log(`[Launcher Image] Generating for companion ${companionId}`);

    const response = await guardedFetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: editPrompt },
              { type: "image_url", image_url: { url: companion.current_image_url } },
            ],
          },
        ],
        modalities: ["image", "text"],
        image_size: imageSize,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Launcher Image] API error:", errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!generatedImage) {
      throw new Error("No image generated");
    }

    const base64Data = generatedImage.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Uint8Array.from(atob(base64Data), (char) => char.charCodeAt(0));

    const fileName = `${companion.user_id}/launcher/${companionId}-${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from(LAUNCHER_BUCKET)
      .upload(fileName, imageBuffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("[Launcher Image] Upload error:", uploadError);
      throw uploadError;
    }

    const { data: publicUrlPayload } = supabase.storage
      .from(LAUNCHER_BUCKET)
      .getPublicUrl(fileName);

    const launcherImageUrl = publicUrlPayload.publicUrl;

    const { error: updateError } = await supabase
      .from("user_companion")
      .update({
        launcher_image_url: launcherImageUrl,
        launcher_image_source_url: companion.current_image_url,
        launcher_image_focal_x: 0.5,
        launcher_image_focal_y: 0.5,
        launcher_image_generated_at: new Date().toISOString(),
      })
      .eq("id", companionId);

    if (updateError) {
      console.error("[Launcher Image] Failed to save image:", updateError);
      throw updateError;
    }

    await registerUserStorageAsset({
      supabase,
      userId: companion.user_id,
      bucketId: LAUNCHER_BUCKET,
      storagePath: fileName,
      sourceKind: "companion_launcher_image",
      sourceRecordTable: "user_companion",
      sourceRecordId: companion.id,
    });

    console.log(`[Launcher Image] Saved for companion ${companionId} (${launcherImageUrl})`);

    return new Response(
      JSON.stringify({ success: true, imageUrl: launcherImageUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    if (isCostGuardrailBlockedError(error)) {
      return buildCostGuardrailBlockedResponse(error, corsHeaders);
    }
    console.error("[Launcher Image] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } finally {
    console.log(`[LauncherImageTiming] total_ms=${Date.now() - requestStartedAt}`);
  }
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleGenerateCompanionLauncherImage(req));
}
