import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveCompanionImageSizeForUser } from "../_shared/companionImagePolicy.ts";
import { errorResponse, type InternalRequestAuth, requireInternalRequest } from "../_shared/auth.ts";
import {
  buildCostGuardrailBlockedResponse,
  createCostGuardrailSession,
  isCostGuardrailBlockedError,
} from "../_shared/costGuardrails.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateDormantCompanionImageDeps {
  authenticate: (req: Request, corsHeaders: HeadersInit) => Promise<InternalRequestAuth | Response>;
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
    const companionId = typeof body?.companionId === "string" ? body.companionId : null;

    if (!companionId) {
      return errorResponse(400, "Missing companionId", corsHeaders);
    }

    const supabase = deps.createSupabaseClient();
    const { data: companion, error: companionError } = await supabase
      .from("user_companion")
      .select("id, user_id, current_image_url, dormant_image_url, spirit_animal, companion_name")
      .eq("id", companionId)
      .maybeSingle();

    if (companionError) {
      console.error("[Dormant Image] Failed to fetch companion:", companionError);
      return errorResponse(500, "Failed to load companion", corsHeaders);
    }

    if (!companion) {
      return errorResponse(404, "Companion not found", corsHeaders);
    }

    const imageSize = resolveCompanionImageSizeForUser(companion.user_id);
    console.log(`[DormantImagePolicy] user=${companion.user_id} image_size=${imageSize}`);
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
        JSON.stringify({ success: true, imageUrl: companion.dormant_image_url, cached: true }),
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

    const editPrompt = `Transform this creature into a peaceful sleeping state:
- Eyes gently closed, serene expression
- Curled up in a comfortable resting position
- Soft, muted colors with a slight blue-grey tint suggesting deep sleep
- Gentle breathing visible through subtle chest movement suggestion
- Surrounded by soft shadow or comfortable darkness
- Dreamlike atmosphere with subtle stardust or sleep particles
- Peaceful but with a hint of waiting/longing
- The creature should look like it's in a deep, protective slumber
- Preserve the core identity and features of the creature
- Add a subtle ethereal glow suggesting the spirit is dormant but alive`;

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
      console.error("[Dormant Image] API error:", errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!generatedImage) {
      throw new Error("No image generated");
    }

    const base64Data = generatedImage.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Uint8Array.from(atob(base64Data), (char) => char.charCodeAt(0));

    const fileName = `dormant/${companionId}-${Date.now()}.png`;

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
      .update({ dormant_image_url: publicUrl.publicUrl })
      .eq("id", companionId);

    if (updateError) {
      console.error("[Dormant Image] Failed to save image:", updateError);
      throw updateError;
    }

    console.log(`[Dormant Image] Generated and saved for companion ${companionId}`);

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
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } finally {
    console.log(`[DormantImageTiming] total_ms=${Date.now() - requestStartedAt}`);
  }
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleGenerateDormantCompanionImage(req));
}
