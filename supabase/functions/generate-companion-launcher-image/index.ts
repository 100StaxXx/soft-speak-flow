import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
import {
  CompanionLauncherCutoutValidationError,
  validateAndNormalizeCompanionLauncherCutout,
  type CompanionLauncherAlphaStats,
} from "../_shared/companionLauncherCutout.ts";
import { registerUserStorageAsset } from "../_shared/storageAssetLedger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-key",
};

const COMPANION_IMAGE_BUCKET = "mentors-avatars";
const LAUNCHER_IMAGE_FILE_KIND = "launcher_validated_transparent";
const PHOTOROOM_SEGMENT_URL = "https://sdk.photoroom.com/v1/segment";

type PhotoRoomMode = "sandbox" | "live";
type PhotoRoomProvider = `photoroom:${PhotoRoomMode}`;

interface CompanionRow {
  id: string;
  user_id: string;
  preset_id: string | null;
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
  ) => Promise<UserOrInternalRequestAuth | Response>;
  createSupabaseClient: () => any;
  createCostGuardrailSessionFn: any;
  fetchFn: typeof fetch;
  getEnv: (name: string) => string | undefined;
  now: () => number;
}

const defaultDeps: GenerateCompanionLauncherImageDeps = {
  authenticate: requireUserOrInternalRequest,
  createSupabaseClient: () => {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    return createClient(supabaseUrl, supabaseServiceKey);
  },
  createCostGuardrailSessionFn: createCostGuardrailSession,
  fetchFn: fetch,
  getEnv: (name: string) => Deno.env.get(name) ?? undefined,
  now: () => Date.now(),
};

const isUsableReferenceUrl = (
  value: string | null | undefined,
): value is string =>
  typeof value === "string" && /^https?:\/\//i.test(value.trim());

const isTransparentLauncherImageUrl = (
  value: string | null | undefined,
): value is string =>
  typeof value === "string" &&
  value.includes(`_${LAUNCHER_IMAGE_FILE_KIND}_stage`);

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

interface PhotoRoomConfig {
  apiKey: string;
  mode: PhotoRoomMode;
  provider: PhotoRoomProvider;
}

interface DownloadedReferenceImage {
  bytes: Uint8Array;
  contentType: string;
}

interface PhotoRoomLauncherCutout {
  pngBytes: Uint8Array;
  provider: PhotoRoomProvider;
  alphaStats: CompanionLauncherAlphaStats;
}

const normalizeEnvValue = (value: string | undefined): string =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const isProductionEnvironment = (
  getEnv: GenerateCompanionLauncherImageDeps["getEnv"],
): boolean => normalizeEnvValue(getEnv("ENVIRONMENT")) === "production";

const isExplicitSandboxEnvironment = (
  getEnv: GenerateCompanionLauncherImageDeps["getEnv"],
): boolean => {
  const environment = normalizeEnvValue(getEnv("ENVIRONMENT"));
  return environment === "development" ||
    environment === "local" ||
    environment === "test";
};

const resolvePhotoRoomConfig = (
  getEnv: GenerateCompanionLauncherImageDeps["getEnv"],
): PhotoRoomConfig | Response => {
  const production = isProductionEnvironment(getEnv);
  const rawMode = normalizeEnvValue(getEnv("PHOTOROOM_MODE"));
  const mode = rawMode === "live" || rawMode === "sandbox" ? rawMode : null;

  if (!mode) {
    return launcherErrorResponse({
      status: 500,
      message: "Companion launcher cutout provider is not configured",
      code: "COMPANION_LAUNCHER_CONFIG_ERROR",
      stage: "configure_photoroom",
      failureReason: "photoroom_mode_missing",
    });
  }

  if (production && mode !== "live") {
    return launcherErrorResponse({
      status: 500,
      message: "Companion launcher cutout provider is not configured for production",
      code: "COMPANION_LAUNCHER_CONFIG_ERROR",
      stage: "configure_photoroom",
      failureReason: "photoroom_live_mode_required",
    });
  }

  if (mode === "sandbox" && !isExplicitSandboxEnvironment(getEnv)) {
    return launcherErrorResponse({
      status: 500,
      message: "Companion launcher cutout sandbox mode requires a non-production environment",
      code: "COMPANION_LAUNCHER_CONFIG_ERROR",
      stage: "configure_photoroom",
      failureReason: "photoroom_sandbox_environment_required",
    });
  }

  const apiKeyName = mode === "live"
    ? "PHOTOROOM_API_KEY_LIVE"
    : "PHOTOROOM_API_KEY_SANDBOX";
  const apiKey = getEnv(apiKeyName)?.trim() ?? "";

  if (!apiKey) {
    return launcherErrorResponse({
      status: 500,
      message: "Companion launcher cutout provider is not configured",
      code: "COMPANION_LAUNCHER_CONFIG_ERROR",
      stage: "configure_photoroom",
      failureReason: mode === "live"
        ? "photoroom_live_key_missing"
        : "photoroom_sandbox_key_missing",
    });
  }

  if (mode === "sandbox" && !apiKey.startsWith("sandbox_")) {
    return launcherErrorResponse({
      status: 500,
      message: "Companion launcher cutout sandbox key is invalid",
      code: "COMPANION_LAUNCHER_CONFIG_ERROR",
      stage: "configure_photoroom",
      failureReason: "photoroom_sandbox_key_invalid",
    });
  }

  if (mode === "live" && apiKey.startsWith("sandbox_")) {
    return launcherErrorResponse({
      status: 500,
      message: "Companion launcher cutout live key is invalid",
      code: "COMPANION_LAUNCHER_CONFIG_ERROR",
      stage: "configure_photoroom",
      failureReason: "photoroom_live_key_invalid",
    });
  }

  return {
    apiKey,
    mode,
    provider: `photoroom:${mode}`,
  };
};

const downloadReferenceImage = async ({
  fetchFn,
  referenceImageUrl,
}: {
  fetchFn: typeof fetch;
  referenceImageUrl: string;
}): Promise<DownloadedReferenceImage> => {
  let response: Response;
  try {
    response = await fetchFn(referenceImageUrl);
  } catch (error) {
    throw launcherErrorResponse({
      status: 502,
      message: "Companion reference image could not be downloaded",
      code: "COMPANION_LAUNCHER_REFERENCE_DOWNLOAD_FAILED",
      stage: "download_reference",
      failureReason: "reference_download_failed",
      retryable: true,
      upstreamError: getErrorMessage(error),
    });
  }

  if (!response.ok) {
    throw launcherErrorResponse({
      status: getLauncherStatusForUpstreamFailure(response.status),
      message: "Companion reference image could not be downloaded",
      code: "COMPANION_LAUNCHER_REFERENCE_DOWNLOAD_FAILED",
      stage: "download_reference",
      failureReason: "reference_download_failed",
      retryable: isRetryableUpstreamStatus(response.status),
      upstreamStatus: response.status,
      upstreamError: await response.text().catch(() => response.statusText),
    });
  }

  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    contentType: response.headers.get("Content-Type") ?? "image/png",
  };
};

const createPhotoRoomLauncherCutout = async ({
  fetchFn,
  config,
  referenceImage,
}: {
  fetchFn: typeof fetch;
  config: PhotoRoomConfig;
  referenceImage: DownloadedReferenceImage;
}): Promise<PhotoRoomLauncherCutout> => {
  const formData = new FormData();
  const referenceImageBuffer = referenceImage.bytes.buffer.slice(
    referenceImage.bytes.byteOffset,
    referenceImage.bytes.byteOffset + referenceImage.bytes.byteLength,
  ) as ArrayBuffer;
  formData.append(
    "image_file",
    new Blob([referenceImageBuffer], { type: referenceImage.contentType }),
    "companion.png",
  );
  formData.append("format", "png");

  let response: Response;
  try {
    response = await fetchFn(PHOTOROOM_SEGMENT_URL, {
      method: "POST",
      headers: {
        "x-api-key": config.apiKey,
      },
      body: formData,
    });
  } catch (error) {
    throw launcherErrorResponse({
      status: 502,
      message: "Companion launcher cutout provider failed",
      code: "COMPANION_LAUNCHER_PHOTOROOM_FAILED",
      stage: "remove_background",
      failureReason: "photoroom_cutout_failed",
      retryable: true,
      upstreamError: getErrorMessage(error),
    });
  }

  if (!response.ok) {
    throw launcherErrorResponse({
      status: getLauncherStatusForUpstreamFailure(response.status),
      message: "Companion launcher cutout provider failed",
      code: "COMPANION_LAUNCHER_PHOTOROOM_FAILED",
      stage: "remove_background",
      failureReason: "photoroom_cutout_failed",
      retryable: isRetryableUpstreamStatus(response.status),
      upstreamStatus: response.status,
      upstreamError: await response.text().catch(() => response.statusText),
    });
  }

  const rawPngBytes = new Uint8Array(await response.arrayBuffer());
  try {
    const normalized = await validateAndNormalizeCompanionLauncherCutout(
      rawPngBytes,
    );
    return {
      pngBytes: normalized.pngBytes,
      alphaStats: normalized.alphaStats,
      provider: config.provider,
    };
  } catch (error) {
    const validationError = error instanceof CompanionLauncherCutoutValidationError
      ? error
      : new CompanionLauncherCutoutValidationError(
        "invalid_alpha",
        getErrorMessage(error),
      );
    throw launcherErrorResponse({
      status: 424,
      message: "Companion launcher cutout failed transparent alpha validation",
      code: "COMPANION_LAUNCHER_VALIDATION_FAILED",
      stage: "validate_image",
      failureReason: validationError.reason,
      retryable: false,
      upstreamError: validationError.alphaStats
        ? JSON.stringify(validationError.alphaStats)
        : validationError.message,
    });
  }
};

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
    const requestedUserId = typeof body?.userId === "string"
      ? body.userId.trim()
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
    let companionQuery = supabase
      .from("user_companion")
      .select(
        "id, user_id, preset_id, current_stage, current_image_url, launcher_image_url, launcher_image_focal_x, launcher_image_focal_y, launcher_image_source_url",
      )
      .eq("id", companionId);

    if (requestAuth.isInternal) {
      if (requestedUserId) {
        companionQuery = companionQuery.eq("user_id", requestedUserId);
      }
    } else {
      companionQuery = companionQuery.eq("user_id", requestAuth.userId);
    }

    const { data, error: companionError } = await companionQuery.maybeSingle();

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
      companion.launcher_image_url &&
      companion.current_image_url &&
      companion.launcher_image_source_url === companion.current_image_url &&
      isTransparentLauncherImageUrl(companion.launcher_image_url)
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

    const photoRoomConfig = resolvePhotoRoomConfig(deps.getEnv);
    if (photoRoomConfig instanceof Response) {
      return photoRoomConfig;
    }

    const costGuardrails = deps.createCostGuardrailSessionFn({
      supabase,
      endpointKey: "generate-companion-launcher-image",
      featureKey: "ai_companion_images",
      userId: companion.user_id,
    });
    const guardedFetch = costGuardrails.wrapFetch(deps.fetchFn);
    await costGuardrails.enforceAccess({
      capabilities: ["image"],
      providers: ["photoroom"],
      metadata: { provider: photoRoomConfig.provider },
    });

    const stage = typeof companion.current_stage === "number"
      ? companion.current_stage
      : 0;
    const referenceImage = await downloadReferenceImage({
      fetchFn: deps.fetchFn,
      referenceImageUrl,
    });
    const cutout = await createPhotoRoomLauncherCutout({
      fetchFn: guardedFetch,
      config: photoRoomConfig,
      referenceImage,
    });
    const imageBuffer = cutout.pngBytes;
    const filePath =
      `${companion.user_id}/companion_${companion.user_id}_${LAUNCHER_IMAGE_FILE_KIND}_stage${stage}_${deps.now()}.png`;

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
      provider: cutout.provider,
      alphaStats: cutout.alphaStats,
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
