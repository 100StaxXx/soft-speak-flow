import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  WALLPAPER_IMAGE_HEIGHT,
  WALLPAPER_IMAGE_SIZE,
  WALLPAPER_IMAGE_WIDTH,
  WALLPAPER_PROMPT_VERSION,
  pickBestEligibleWallpaperCandidateForDate,
  pickLatestEligibleWallpaperCandidate,
  wallpaperGenerationSpecs,
  type WallpaperAssignmentSource,
  type WallpaperAssetCandidate,
  type WallpaperPageKey,
  type WallpaperPromptVariantKey,
  type WallpaperValidationResult,
} from "../../../src/shared/wallpaperCatalog.ts";
import {
  buildWallpaperValidationPrompt,
  isWallpaperValidationAcceptable,
  parseWallpaperValidationResult,
} from "../rotate-daily-wallpapers/validation.ts";

type SupabaseClient = any;

export interface GeneratedWallpaperAssetRecord {
  assetId: string;
  createdAt: string;
  imageUrl: string;
  publishState: "ready" | "validation_failed";
  validationResult: WallpaperValidationResult;
  variantKey: string | null;
}

export interface ReadyWallpaperAssetRow extends WallpaperAssetCandidate {
  id: string;
  publishState: string;
  sourceKind: string;
  generationDate: string;
  variantKey: string | null;
  batchLabel: string | null;
  validation_result?: Pick<
    WallpaperValidationResult,
    "scenicQualityScore"
    | "moodMatchScore"
    | "detailScore"
    | "contrastScore"
    | "safeZoneConfidenceScore"
  > | null;
}

interface WallpaperAssetLookupRow {
  id: string;
  publish_state: string;
  source_kind: string;
  generation_date: string;
  created_at: string;
  variant_key: string | null;
  batch_label: string | null;
  validation_result?: Pick<
    WallpaperValidationResult,
    "scenicQualityScore"
    | "moodMatchScore"
    | "detailScore"
    | "contrastScore"
    | "safeZoneConfidenceScore"
  > | null;
}

const getOpenAIApiKey = () => Deno.env.get("OPENAI_API_KEY");
const getSupabaseUrl = () => Deno.env.get("SUPABASE_URL");
const getSupabaseServiceRoleKey = () => Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const getRenderModel = () => Deno.env.get("OPENAI_IMAGE_MODEL") ?? "gpt-image-1";
const getValidationModel = () => Deno.env.get("OPENAI_TEXT_MODEL") ?? "gpt-4o-mini";

export const createWallpaperServiceClient = () => {
  const supabaseUrl = getSupabaseUrl();
  const supabaseServiceRoleKey = getSupabaseServiceRoleKey();
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }) as SupabaseClient;
};

const getContentTypeAndBytes = async (imageUrl: string) => {
  if (imageUrl.startsWith("data:image/")) {
    const match = imageUrl.match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
    if (!match) {
      throw new Error("Unsupported generated image data URL");
    }

    const [, contentType, base64Data] = match;
    const bytes = Uint8Array.from(atob(base64Data), (char) => char.charCodeAt(0));
    return { contentType, bytes };
  }

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download generated image (${response.status})`);
  }

  const contentType = response.headers.get("content-type") ?? "image/png";
  const bytes = new Uint8Array(await response.arrayBuffer());
  return { contentType, bytes };
};

const getFileExtension = (contentType: string) => {
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  return "png";
};

const sanitizeStorageSegment = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

type WallpaperFailureStage = "generate" | "validate" | "upload" | "insert";

const toErrorMessage = (error: unknown) => (
  error instanceof Error ? error.message : String(error)
).slice(0, 320);

const logWallpaperRecipeFailure = (args: {
  pageKey: WallpaperPageKey;
  dateKey: string;
  variantKey?: WallpaperPromptVariantKey | null;
  batchLabel?: string | null;
  stage: WallpaperFailureStage;
  error: string;
}) => {
  console.error(JSON.stringify({
    event: "wallpaper_recipe_failure",
    pageKey: args.pageKey,
    dateKey: args.dateKey,
    variantKey: args.variantKey ?? null,
    batchLabel: args.batchLabel ?? null,
    stage: args.stage,
    error: args.error,
  }));
};

const logWallpaperRecipeValidationFailure = (args: {
  pageKey: WallpaperPageKey;
  dateKey: string;
  variantKey?: WallpaperPromptVariantKey | null;
  batchLabel?: string | null;
  rejectionReasons: string[];
}) => {
  console.warn(JSON.stringify({
    event: "wallpaper_recipe_failure",
    pageKey: args.pageKey,
    dateKey: args.dateKey,
    variantKey: args.variantKey ?? null,
    batchLabel: args.batchLabel ?? null,
    stage: "validate",
    error: args.rejectionReasons.join(" | ").slice(0, 320),
  }));
};

export const generateWallpaperImage = async (promptText: string) => {
  const openAIApiKey = getOpenAIApiKey();
  if (!openAIApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAIApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getRenderModel(),
      image_size: WALLPAPER_IMAGE_SIZE,
      messages: [{ role: "user", content: promptText }],
      modalities: ["image", "text"],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Image generation failed (${response.status}): ${errorText.slice(0, 280)}`);
  }

  const data = await response.json();
  const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (typeof imageUrl !== "string" || imageUrl.length === 0) {
    throw new Error("Image generation returned no image payload");
  }

  return imageUrl;
};

export const validateWallpaperImage = async (
  pageKey: WallpaperPageKey,
  imageUrl: string,
) => {
  const openAIApiKey = getOpenAIApiKey();
  if (!openAIApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const spec = wallpaperGenerationSpecs[pageKey];
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAIApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getValidationModel(),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: buildWallpaperValidationPrompt(spec) },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Wallpaper validation failed (${response.status}): ${errorText.slice(0, 280)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.length === 0) {
    throw new Error("Wallpaper validation returned no structured content");
  }

  const validation = parseWallpaperValidationResult(content);
  if (!isWallpaperValidationAcceptable(validation)) {
    validation.approved = false;
  }

  return validation;
};

export const uploadWallpaperImage = async (
  supabase: SupabaseClient,
  pageKey: WallpaperPageKey,
  dateKey: string,
  imageUrl: string,
  options?: {
    batchLabel?: string | null;
    variantKey?: WallpaperPromptVariantKey | null;
  },
) => {
  const { contentType, bytes } = await getContentTypeAndBytes(imageUrl);
  const extension = getFileExtension(contentType);
  const pathSegments = [
    pageKey,
    dateKey,
    options?.batchLabel ? sanitizeStorageSegment(options.batchLabel) : null,
    options?.variantKey ? sanitizeStorageSegment(options.variantKey) : null,
    `${crypto.randomUUID()}.${extension}`,
  ].filter((segment): segment is string => Boolean(segment));
  const filePath = pathSegments.join("/");

  const { error: uploadError } = await supabase.storage
    .from("wallpaper-catalog")
    .upload(filePath, bytes, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Wallpaper upload failed: ${uploadError.message}`);
  }

  const { data } = supabase.storage
    .from("wallpaper-catalog")
    .getPublicUrl(filePath);

  return {
    filePath,
    imageUrl: data.publicUrl,
  };
};

export const insertWallpaperAsset = async (
  supabase: SupabaseClient,
  args: {
    pageKey: WallpaperPageKey;
    dateKey: string;
    promptText: string;
    imageUrl: string;
    storagePath: string;
    validationResult: WallpaperValidationResult;
    publishState: "ready" | "validation_failed";
    variantKey?: WallpaperPromptVariantKey | null;
    batchLabel?: string | null;
  },
) => {
  const spec = wallpaperGenerationSpecs[args.pageKey];
  const payload = {
    page_key: args.pageKey,
    source_kind: "generated",
    prompt_text: args.promptText,
    prompt_version: WALLPAPER_PROMPT_VERSION,
    render_model: getRenderModel(),
    storage_path: args.storagePath,
    image_url: args.imageUrl,
    image_width: WALLPAPER_IMAGE_WIDTH,
    image_height: WALLPAPER_IMAGE_HEIGHT,
    mobile_focus_x: args.validationResult.mobileFocusX ?? spec.mobileFocus.x,
    mobile_focus_y: args.validationResult.mobileFocusY ?? spec.mobileFocus.y,
    desktop_focus_x: args.validationResult.desktopFocusX ?? spec.desktopFocus.x,
    desktop_focus_y: args.validationResult.desktopFocusY ?? spec.desktopFocus.y,
    publish_state: args.publishState,
    validation_result: args.validationResult,
    generation_date: args.dateKey,
    variant_key: args.variantKey ?? null,
    batch_label: args.batchLabel ?? null,
  };

  const { data, error } = await supabase
    .from("wallpaper_assets")
    .insert(payload)
    .select("id, created_at")
    .single();

  if (error) {
    throw new Error(`Failed to save wallpaper asset record: ${error.message}`);
  }

  return data;
};

export const generateAndStoreWallpaperAsset = async (
  supabase: SupabaseClient,
  args: {
    pageKey: WallpaperPageKey;
    dateKey: string;
    promptText: string;
    variantKey?: WallpaperPromptVariantKey | null;
    batchLabel?: string | null;
  },
): Promise<GeneratedWallpaperAssetRecord> => {
  let generatedImageUrl: string;
  try {
    generatedImageUrl = await generateWallpaperImage(args.promptText);
  } catch (error) {
    logWallpaperRecipeFailure({
      pageKey: args.pageKey,
      dateKey: args.dateKey,
      variantKey: args.variantKey,
      batchLabel: args.batchLabel,
      stage: "generate",
      error: toErrorMessage(error),
    });
    throw error;
  }

  let validation: WallpaperValidationResult;
  try {
    validation = await validateWallpaperImage(args.pageKey, generatedImageUrl);
  } catch (error) {
    logWallpaperRecipeFailure({
      pageKey: args.pageKey,
      dateKey: args.dateKey,
      variantKey: args.variantKey,
      batchLabel: args.batchLabel,
      stage: "validate",
      error: toErrorMessage(error),
    });
    throw error;
  }

  let uploaded: { filePath: string; imageUrl: string };
  try {
    uploaded = await uploadWallpaperImage(
      supabase,
      args.pageKey,
      args.dateKey,
      generatedImageUrl,
      {
        batchLabel: args.batchLabel,
        variantKey: args.variantKey,
      },
    );
  } catch (error) {
    logWallpaperRecipeFailure({
      pageKey: args.pageKey,
      dateKey: args.dateKey,
      variantKey: args.variantKey,
      batchLabel: args.batchLabel,
      stage: "upload",
      error: toErrorMessage(error),
    });
    throw error;
  }

  const publishState = validation.approved ? "ready" : "validation_failed";
  let asset: { id: string; created_at: string };
  try {
    asset = await insertWallpaperAsset(supabase, {
      pageKey: args.pageKey,
      dateKey: args.dateKey,
      promptText: args.promptText,
      imageUrl: uploaded.imageUrl,
      storagePath: uploaded.filePath,
      validationResult: validation,
      publishState,
      variantKey: args.variantKey,
      batchLabel: args.batchLabel,
    });
  } catch (error) {
    logWallpaperRecipeFailure({
      pageKey: args.pageKey,
      dateKey: args.dateKey,
      variantKey: args.variantKey,
      batchLabel: args.batchLabel,
      stage: "insert",
      error: toErrorMessage(error),
    });
    throw error;
  }

  if (publishState === "validation_failed") {
    logWallpaperRecipeValidationFailure({
      pageKey: args.pageKey,
      dateKey: args.dateKey,
      variantKey: args.variantKey,
      batchLabel: args.batchLabel,
      rejectionReasons: validation.rejectionReasons.length > 0
        ? validation.rejectionReasons
        : ["validator rejected wallpaper"],
    });
  }

  return {
    assetId: asset.id,
    createdAt: asset.created_at,
    imageUrl: uploaded.imageUrl,
    publishState,
    validationResult: validation,
    variantKey: args.variantKey ?? null,
  };
};

export const assignWallpaperAsset = async (
  supabase: SupabaseClient,
  pageKey: WallpaperPageKey,
  dateKey: string,
  wallpaperAssetId: string,
  assignmentSource: WallpaperAssignmentSource,
) => {
  const { error } = await supabase
    .from("daily_wallpaper_assignments")
    .upsert({
      page_key: pageKey,
      for_date: dateKey,
      wallpaper_asset_id: wallpaperAssetId,
      assignment_source: assignmentSource,
    }, { onConflict: "page_key,for_date" });

  if (error) {
    throw new Error(`Failed to assign live wallpaper: ${error.message}`);
  }
};

const mapWallpaperAssetCandidate = (
  row: WallpaperAssetLookupRow,
): ReadyWallpaperAssetRow => ({
  id: row.id,
  createdAt: row.created_at,
  publishState: row.publish_state,
  sourceKind: row.source_kind,
  generationDate: row.generation_date,
  variantKey: row.variant_key,
  batchLabel: row.batch_label,
  validation_result: row.validation_result,
  validation: {
    scenicQualityScore: Number(row.validation_result?.scenicQualityScore ?? 0),
    moodMatchScore: Number(row.validation_result?.moodMatchScore ?? 0),
    detailScore: Number(row.validation_result?.detailScore ?? 0),
    contrastScore: Number(row.validation_result?.contrastScore ?? 0),
    safeZoneConfidenceScore: Number(row.validation_result?.safeZoneConfidenceScore ?? 0),
  },
});

export const listWallpaperAssetCandidates = async (
  supabase: SupabaseClient,
  pageKey: WallpaperPageKey,
  options?: {
    generationDate?: string;
    ascending?: boolean;
  },
) => {
  let query = supabase
    .from("wallpaper_assets")
    .select("id, publish_state, source_kind, generation_date, created_at, variant_key, batch_label, validation_result")
    .eq("page_key", pageKey);

  if (options?.generationDate) {
    query = query.eq("generation_date", options.generationDate);
  }

  const { data, error } = await query.order("created_at", {
    ascending: options?.ascending === true,
  });

  if (error) {
    throw new Error(`Failed to load wallpaper assets for ${pageKey}: ${error.message}`);
  }

  return ((data ?? []) as WallpaperAssetLookupRow[]).map(mapWallpaperAssetCandidate);
};

export const getWallpaperAssetEligibilitySnapshot = async (
  supabase: SupabaseClient,
  wallpaperAssetId: string,
) => {
  const { data, error } = await supabase
    .from("wallpaper_assets")
    .select("publish_state, source_kind, generation_date")
    .eq("id", wallpaperAssetId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load wallpaper asset eligibility: ${error.message}`);
  }

  return data as {
    publish_state: string;
    source_kind: string;
    generation_date: string;
  } | null;
};

export const getExistingAssignment = async (
  supabase: SupabaseClient,
  pageKey: WallpaperPageKey,
  dateKey: string,
) => {
  const { data, error } = await supabase
    .from("daily_wallpaper_assignments")
    .select("id, wallpaper_asset_id, assignment_source")
    .eq("page_key", pageKey)
    .eq("for_date", dateKey)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check current wallpaper assignment: ${error.message}`);
  }

  return data as {
    id: string;
    wallpaper_asset_id: string;
    assignment_source: WallpaperAssignmentSource;
  } | null;
};

export const getLatestReadyAsset = async (
  supabase: SupabaseClient,
  pageKey: WallpaperPageKey,
): Promise<ReadyWallpaperAssetRow | null> => {
  const candidates = await listWallpaperAssetCandidates(supabase, pageKey);
  return pickLatestEligibleWallpaperCandidate(pageKey, candidates);
};

export const getLatestReadyAssetId = async (
  supabase: SupabaseClient,
  pageKey: WallpaperPageKey,
) => (await getLatestReadyAsset(supabase, pageKey))?.id ?? null;

export const getBestEligibleAssetForDate = async (
  supabase: SupabaseClient,
  pageKey: WallpaperPageKey,
  dateKey: string,
) => {
  const candidates = await listWallpaperAssetCandidates(supabase, pageKey, {
    generationDate: dateKey,
  });
  return pickBestEligibleWallpaperCandidateForDate(pageKey, dateKey, candidates);
};

export const getBestEligibleAssetIdForDate = async (
  supabase: SupabaseClient,
  pageKey: WallpaperPageKey,
  dateKey: string,
) => (await getBestEligibleAssetForDate(supabase, pageKey, dateKey))?.id ?? null;
