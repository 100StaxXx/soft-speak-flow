import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildCostGuardrailBlockedResponse,
  createCostGuardrailSession,
  isCostGuardrailBlockedError,
} from "../_shared/costGuardrails.ts";
import {
  errorResponse,
  requireAuthenticatedUser,
} from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const IMAGE_FIELD_CONFIG = [
  { urlKey: "current_image_url", focalXKey: "current_image_focal_x", focalYKey: "current_image_focal_y" },
  { urlKey: "initial_image_url", focalXKey: "initial_image_focal_x", focalYKey: "initial_image_focal_y" },
  { urlKey: "dormant_image_url", focalXKey: "dormant_image_focal_x", focalYKey: "dormant_image_focal_y" },
  { urlKey: "neglected_image_url", focalXKey: "neglected_image_focal_x", focalYKey: "neglected_image_focal_y" },
] as const;

type ImageFieldConfig = typeof IMAGE_FIELD_CONFIG[number];

interface FocalAnalysisResult {
  focalX: number;
  focalY: number;
  centeringScore: number;
  compositionIssues: string[];
}

const isRemoteImageUrl = (value: unknown): value is string =>
  typeof value === "string" && /^https?:\/\//i.test(value);

const hasStoredFocal = (focalX: unknown, focalY: unknown) =>
  typeof focalX === "number" && Number.isFinite(focalX)
  && typeof focalY === "number" && Number.isFinite(focalY);

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const analyzeCompanionImageFocal = async (
  openAIApiKey: string,
  guardedFetch: typeof fetch,
  imageUrl: string,
): Promise<FocalAnalysisResult> => {
  const focalTool = {
    type: "function",
    function: {
      name: "analyze_companion_focal_point",
      description: "Determine the visible subject center for a companion image",
      parameters: {
        type: "object",
        properties: {
          subjectCenterX: {
            type: "number",
            description: "Normalized horizontal center of the visible subject mass from 0 to 1.",
          },
          subjectCenterY: {
            type: "number",
            description: "Normalized vertical center of the visible subject mass from 0 to 1.",
          },
          centeringScore: {
            type: "number",
            description: "Score 0-100 for how naturally centered the subject appears.",
          },
          compositionIssues: {
            type: "array",
            items: { type: "string" },
            description: "Any composition issues such as too high, too low, too far left, too far right, or cropped.",
          },
        },
        required: ["subjectCenterX", "subjectCenterY", "centeringScore", "compositionIssues"],
        additionalProperties: false,
      },
    },
  };

  const prompt = `Analyze this companion image and locate the visible subject, not the transparent canvas.

Return:
- subjectCenterX and subjectCenterY as normalized 0..1 coordinates for the visible creature or egg mass
- centeringScore from 0..100 for how naturally centered it appears
- compositionIssues describing any off-center framing

If the subject is fairly centered but slightly high or low, still report the true visible center.`;

  const response = await guardedFetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAIApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      tools: [focalTool],
      tool_choice: { type: "function", function: { name: "analyze_companion_focal_point" } },
    }),
  });

  if (!response.ok) {
    throw new Error(`Focal analysis failed with status ${response.status}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    throw new Error("Focal analysis returned no tool arguments");
  }

  const args = JSON.parse(toolCall.function.arguments);
  return {
    focalX: clamp01(typeof args.subjectCenterX === "number" ? args.subjectCenterX : 0.5),
    focalY: clamp01(typeof args.subjectCenterY === "number" ? args.subjectCenterY : 0.5),
    centeringScore: typeof args.centeringScore === "number" ? args.centeringScore : 50,
    compositionIssues: Array.isArray(args.compositionIssues)
      ? args.compositionIssues.filter((value: unknown): value is string => typeof value === "string")
      : [],
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await requireAuthenticatedUser(req, corsHeaders);
    if (auth instanceof Response) {
      return auth;
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return errorResponse(500, "Supabase configuration missing", corsHeaders);
    }

    if (!openAIApiKey) {
      return errorResponse(500, "AI service not configured", corsHeaders);
    }

    const body = await req.json().catch(() => ({}));
    const requestedCompanionId = typeof body?.companionId === "string" ? body.companionId : null;

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    let companionQuery = supabase
      .from("user_companion")
      .select("id, user_id, current_image_url, current_image_focal_x, current_image_focal_y, initial_image_url, initial_image_focal_x, initial_image_focal_y, dormant_image_url, dormant_image_focal_x, dormant_image_focal_y, neglected_image_url, neglected_image_focal_x, neglected_image_focal_y, created_at")
      .eq("user_id", auth.userId);

    if (requestedCompanionId) {
      companionQuery = companionQuery.eq("id", requestedCompanionId);
    } else {
      companionQuery = companionQuery.order("created_at", { ascending: false }).limit(1);
    }

    const { data: companion, error: companionError } = await companionQuery.maybeSingle();
    if (companionError) {
      console.error("[CompanionFocalBackfill] Failed to load companion:", companionError);
      return errorResponse(500, "Failed to load companion", corsHeaders);
    }

    if (!companion) {
      return errorResponse(404, "Companion not found", corsHeaders);
    }

    const costGuardrails = createCostGuardrailSession({
      supabase,
      endpointKey: "backfill-companion-image-focal",
      featureKey: "ai_companion_images",
      userId: auth.userId,
    });
    const guardedFetch = costGuardrails.wrapFetch(fetch);
    await costGuardrails.enforceAccess({
      capabilities: ["image"],
      providers: ["openai"],
    });

    const updates: Record<string, number> = {};
    const analyzedUrlCache = new Map<string, FocalAnalysisResult>();
    const updatedFields: string[] = [];

    for (const field of IMAGE_FIELD_CONFIG) {
      const imageUrl = companion[field.urlKey];
      const focalX = companion[field.focalXKey];
      const focalY = companion[field.focalYKey];

      if (!isRemoteImageUrl(imageUrl) || hasStoredFocal(focalX, focalY)) {
        continue;
      }

      let analysis = analyzedUrlCache.get(imageUrl) ?? null;
      if (!analysis) {
        analysis = await analyzeCompanionImageFocal(openAIApiKey, guardedFetch, imageUrl);
        analyzedUrlCache.set(imageUrl, analysis);
      }

      updates[field.focalXKey] = analysis.focalX;
      updates[field.focalYKey] = analysis.focalY;
      updatedFields.push(field.urlKey);
    }

    if (updatedFields.length === 0) {
      return new Response(
        JSON.stringify({ success: true, updated: false, updatedFields: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: updateError } = await supabase
      .from("user_companion")
      .update(updates)
      .eq("id", companion.id)
      .eq("user_id", auth.userId);

    if (updateError) {
      console.error("[CompanionFocalBackfill] Failed to save focal metadata:", updateError);
      return errorResponse(500, "Failed to save focal metadata", corsHeaders);
    }

    return new Response(
      JSON.stringify({
        success: true,
        updated: true,
        updatedFields,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    if (isCostGuardrailBlockedError(error)) {
      return buildCostGuardrailBlockedResponse(error, corsHeaders);
    }

    console.error("[CompanionFocalBackfill] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
