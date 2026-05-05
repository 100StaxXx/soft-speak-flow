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
import {
  editCompanionImage,
  OpenAIImageRequestError,
} from "../_shared/openaiCompanionImageClient.ts";
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

const truncateDiagnostic = (value: string, maxLength = 800): string =>
  value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const getReferenceDownloadStatus = (message: string): number | null => {
  const match = message.match(/Failed to download reference image:\s*(\d{3})/i);
  if (!match) return null;
  const status = Number.parseInt(match[1], 10);
  return Number.isFinite(status) ? status : null;
};

const getOpenAIImageRequestStatus = (
  error: unknown,
  message: string,
): number | null => {
  if (error instanceof OpenAIImageRequestError) {
    return error.status;
  }

  const match = message.match(/OpenAI image request failed\s*\((\d{3})\):/i);
  if (!match) return null;
  const status = Number.parseInt(match[1], 10);
  return Number.isFinite(status) ? status : null;
};

const isRetryableUpstreamStatus = (status: number | null): boolean =>
  status === null || status === 408 || status === 429 || status >= 500;

const getLauncherStatusForUpstreamFailure = (status: number | null): number =>
  isRetryableUpstreamStatus(status) ? 502 : 424;

const launcherErrorResponse = ({
  status,
  message,
  code,
  stage,
  failureReason,
  retryable,
  upstreamStatus,
  upstreamError,
  requestId,
}: {
  status: number;
  message: string;
  code: string;
  stage: string;
  failureReason: string;
  retryable?: boolean;
  upstreamStatus?: number | null;
  upstreamError?: string | null;
  requestId?: string;
}): Response =>
  jsonResponse({
    error: message,
    message,
    code,
    stage,
    failureReason,
    requestId: requestId ?? crypto.randomUUID(),
    retryable: retryable ?? false,
    ...(typeof upstreamStatus === "number" ? { upstreamStatus } : {}),
    ...(upstreamError
      ? { upstreamError: truncateDiagnostic(upstreamError) }
      : {}),
  }, { status });

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
    const requestedSourceImageUrl = typeof body?.sourceImageUrl === "string"
      ? body.sourceImageUrl.trim()
      : "";

    if (!companionId) {
      return launcherErrorResponse({
        status: 400,
        message: "Missing companionId",
        code: "COMPANION_LAUNCHER_MISSING_COMPANION_ID",
        stage: "validate_request",
        failureReason: "missing_companion_id",
      });
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
      return launcherErrorResponse({
        status: 404,
        message: "Companion not found",
        code: "COMPANION_LAUNCHER_COMPANION_NOT_FOUND",
        stage: "load_companion",
        failureReason: "companion_not_found",
      });
    }

    if (
      requestedSourceImageUrl.length > 0 &&
      requestedSourceImageUrl !== (companion.current_image_url ?? "")
    ) {
      return jsonResponse({
        success: true,
        cached: false,
        skipped: true,
        stale: true,
        reason: "source_image_changed",
        imageUrl: null,
        sourceImageUrl: companion.current_image_url,
        requestedSourceImageUrl,
      });
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

    const referenceImageUrl = companion.current_image_url;
    if (!isUsableReferenceUrl(referenceImageUrl)) {
      return launcherErrorResponse({
        status: 400,
        message:
          "Companion current image is not available for launcher generation",
        code: "COMPANION_LAUNCHER_REFERENCE_UNAVAILABLE",
        stage: "validate_reference",
        failureReason: "missing_reference_image",
      });
    }

    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAIApiKey) {
      return launcherErrorResponse({
        status: 500,
        message: "Companion launcher image generation is not configured",
        code: "COMPANION_LAUNCHER_CONFIG_ERROR",
        stage: "configure_openai",
        failureReason: "openai_config_missing",
      });
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

    const generatedImage = await (async () => {
      try {
        return await deps.editCompanionImageFn({
          guardedFetch,
          openAIApiKey,
          prompt: buildLauncherPrompt(companion),
          size: LAUNCHER_IMAGE_SIZE,
          quality: "high",
          userId: companion.user_id,
          referenceImages: [{ imageUrl: referenceImageUrl }],
        });
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        const referenceStatus = getReferenceDownloadStatus(errorMessage);
        const openAIStatus = getOpenAIImageRequestStatus(error, errorMessage);

        if (
          errorMessage.includes("Companion image model is not configured") ||
          errorMessage.includes("OPENAI_API_KEY")
        ) {
          throw launcherErrorResponse({
            status: 500,
            message: "Companion launcher image generation is not configured",
            code: "COMPANION_LAUNCHER_CONFIG_ERROR",
            stage: "configure_openai",
            failureReason: "openai_config_invalid",
            upstreamError: errorMessage,
          });
        }

        if (errorMessage.startsWith("Failed to download reference image:")) {
          throw launcherErrorResponse({
            status: referenceStatus && referenceStatus < 500 ? 424 : 502,
            message: "Companion reference image could not be downloaded",
            code: "COMPANION_LAUNCHER_REFERENCE_DOWNLOAD_FAILED",
            stage: "download_reference",
            failureReason: "reference_download_failed",
            retryable: !referenceStatus || referenceStatus >= 500 ||
              referenceStatus === 408,
            upstreamStatus: referenceStatus,
            upstreamError: errorMessage,
          });
        }

        throw launcherErrorResponse({
          status: getLauncherStatusForUpstreamFailure(openAIStatus),
          message: "Companion launcher image edit failed",
          code: "COMPANION_LAUNCHER_OPENAI_EDIT_FAILED",
          stage: "edit_image",
          failureReason: "openai_edit_failed",
          retryable: isRetryableUpstreamStatus(openAIStatus),
          upstreamStatus: openAIStatus,
          upstreamError: errorMessage,
        });
      }
    })();

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
      throw launcherErrorResponse({
        status: 502,
        message: "Companion launcher image upload failed",
        code: "COMPANION_LAUNCHER_UPLOAD_FAILED",
        stage: "upload_image",
        failureReason: "storage_upload_failed",
        retryable: true,
        upstreamError: uploadError.message ?? String(uploadError),
      });
    }

    const { data: publicUrlData } = supabase.storage
      .from(COMPANION_IMAGE_BUCKET)
      .getPublicUrl(filePath);

    const imageUrl = publicUrlData.publicUrl;
    const updatePayload = {
      launcher_image_url: imageUrl,
      launcher_image_focal_x: 0.5,
      launcher_image_focal_y: 0.5,
      launcher_image_source_url: referenceImageUrl,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedCompanion, error: updateError } = await supabase
      .from("user_companion")
      .update(updatePayload)
      .eq("id", companion.id)
      .eq("user_id", companion.user_id)
      .eq("current_image_url", referenceImageUrl)
      .select("id")
      .maybeSingle();

    if (updateError) {
      console.error(
        "[CompanionLauncherImage] Failed to save launcher image:",
        updateError,
      );
      throw launcherErrorResponse({
        status: 500,
        message: "Companion launcher image could not be saved",
        code: "COMPANION_LAUNCHER_UPDATE_FAILED",
        stage: "save_companion",
        failureReason: "companion_update_failed",
        retryable: true,
        upstreamError: updateError.message ?? String(updateError),
      });
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
        sourceImageUrl: referenceImageUrl,
      });
    }

    try {
      await registerUserStorageAsset({
        supabase,
        userId: companion.user_id,
        bucketId: COMPANION_IMAGE_BUCKET,
        storagePath: filePath,
        sourceKind: "companion_launcher_image",
        sourceRecordTable: "user_companion",
        sourceRecordId: companion.id,
      });
    } catch (ledgerError) {
      console.error(
        "[CompanionLauncherImage] Failed to register launcher asset:",
        ledgerError,
      );
      throw launcherErrorResponse({
        status: 500,
        message: "Companion launcher image asset could not be registered",
        code: "COMPANION_LAUNCHER_LEDGER_FAILED",
        stage: "register_asset",
        failureReason: "storage_ledger_failed",
        retryable: true,
        upstreamError: getErrorMessage(ledgerError),
      });
    }

    return jsonResponse({
      success: true,
      cached: false,
      imageUrl,
      imageFocalX: 0.5,
      imageFocalY: 0.5,
      sourceImageUrl: referenceImageUrl,
      imageSize: generatedImage.size,
      revisedPrompt: generatedImage.revisedPrompt,
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    if (isCostGuardrailBlockedError(error)) {
      return buildCostGuardrailBlockedResponse(error, corsHeaders);
    }

    console.error("[CompanionLauncherImage] Error:", error);
    return launcherErrorResponse({
      status: 500,
      message: "Companion launcher image generation failed",
      code: "COMPANION_LAUNCHER_GENERATION_FAILED",
      stage: "unknown",
      failureReason: "unexpected_error",
      upstreamError: getErrorMessage(error),
    });
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
