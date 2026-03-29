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

interface GenerateNeglectedCompanionImageDeps {
  authenticate: (req: Request, corsHeaders: HeadersInit) => Promise<InternalRequestAuth | Response>;
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
    const companionId = typeof body?.companionId === "string" ? body.companionId : null;

    if (!companionId) {
      return errorResponse(400, "Missing companionId", corsHeaders);
    }

    const supabase = deps.createSupabaseClient();
    const { data: companion, error: companionError } = await supabase
      .from("user_companion")
      .select("id, user_id, current_image_url, spirit_animal, core_element, favorite_color, current_stage, neglected_image_url")
      .eq("id", companionId)
      .maybeSingle();

    if (companionError) {
      console.error("[Neglected Image] Failed to fetch companion:", companionError);
      return errorResponse(500, "Failed to load companion", corsHeaders);
    }

    if (!companion) {
      return errorResponse(404, "Companion not found", corsHeaders);
    }

    const imageSize = resolveCompanionImageSizeForUser(companion.user_id);
    console.log(`[NeglectedImagePolicy] user=${companion.user_id} image_size=${imageSize}`);
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
      console.log(`[Neglected Image] Already exists for companion ${companionId}`);
      return new Response(
        JSON.stringify({ success: true, imageUrl: companion.neglected_image_url, cached: true }),
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

    const editPrompt = `Edit this companion creature to look sad and neglected while PRESERVING ITS EXACT APPEARANCE:

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
OUTPUT: Same composition and framing as the original image`;

    console.log("[Neglected Image] Calling image edit API...");

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
      console.error("[Neglected Image] API error:", response.status, errorText);

      if (response.status === 429) {
        throw new Error("RATE_LIMITED: AI service is currently busy. Please try again later.");
      }
      if (response.status === 402) {
        throw new Error("INSUFFICIENT_CREDITS: Insufficient AI credits.");
      }

      throw new Error(`AI service error: ${response.status}`);
    }

    const data = await response.json();
    const editedImageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!editedImageUrl) {
      console.error("[Neglected Image] No image in response:", data);
      throw new Error("Failed to generate neglected image");
    }

    console.log(`[Neglected Image] Successfully generated, saving to database for ${companionId}...`);

    const { error: updateError } = await supabase
      .from("user_companion")
      .update({
        neglected_image_url: editedImageUrl,
      })
      .eq("id", companionId);

    if (updateError) {
      console.error("[Neglected Image] Failed to save:", updateError);
      throw updateError;
    }

    console.log(`[Neglected Image] Complete for companion ${companionId}`);

    return new Response(
      JSON.stringify({
        success: true,
        imageUrl: editedImageUrl,
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
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } finally {
    console.log(`[NeglectedImageTiming] total_ms=${Date.now() - requestStartedAt}`);
  }
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleGenerateNeglectedCompanionImage(req));
}
