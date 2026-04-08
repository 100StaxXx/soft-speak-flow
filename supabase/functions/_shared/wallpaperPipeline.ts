import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  WALLPAPER_IMAGE_HEIGHT,
  WALLPAPER_IMAGE_SIZE,
  WALLPAPER_IMAGE_WIDTH,
  WALLPAPER_PROMPT_VERSION,
  pickOldestUnusedWallpaperAssetId,
  wallpaperGenerationSpecs,
  type WallpaperAssignmentSource,
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
  imageUrl: string;
  publishState: "ready" | "validation_failed";
  validationResult: WallpaperValidationResult;
}

interface ReadyWallpaperAssetRow {
  id: string;
}

interface UsedWallpaperAssignmentRow {
  wallpaper_asset_id: string;
}

const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const renderModel = Deno.env.get("OPENAI_IMAGE_MODEL") ?? "gpt-image-1";
const validationModel = Deno.env.get("OPENAI_TEXT_MODEL") ?? "gpt-4o-mini";

export const createWallpaperServiceClient = () => {
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

export const generateWallpaperImage = async (promptText: string) => {
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
      model: renderModel,
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
      model: validationModel,
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
    render_model: renderModel,
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
): Promise<GeneratedWallpaperAssetRecord & { createdAt: string }> => {
  const generatedImageUrl = await generateWallpaperImage(args.promptText);
  const validation = await validateWallpaperImage(args.pageKey, generatedImageUrl);
  const uploaded = await uploadWallpaperImage(
    supabase,
    args.pageKey,
    args.dateKey,
    generatedImageUrl,
    {
      batchLabel: args.batchLabel,
      variantKey: args.variantKey,
    },
  );
  const publishState = validation.approved ? "ready" : "validation_failed";
  const asset = await insertWallpaperAsset(supabase, {
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

  return {
    assetId: asset.id,
    createdAt: asset.created_at,
    imageUrl: uploaded.imageUrl,
    publishState,
    validationResult: validation,
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

export const getExistingAssignment = async (
  supabase: SupabaseClient,
  pageKey: WallpaperPageKey,
  dateKey: string,
) => {
  const { data, error } = await supabase
    .from("daily_wallpaper_assignments")
    .select("id, wallpaper_asset_id")
    .eq("page_key", pageKey)
    .eq("for_date", dateKey)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check current wallpaper assignment: ${error.message}`);
  }

  return data;
};

export const getLatestReadyAssetId = async (
  supabase: SupabaseClient,
  pageKey: WallpaperPageKey,
) => {
  const { data, error } = await supabase
    .from("wallpaper_assets")
    .select("id")
    .eq("page_key", pageKey)
    .eq("publish_state", "ready")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load latest ready wallpaper asset: ${error.message}`);
  }

  return data?.id ?? null;
};

export const getOldestUnusedReadyAssetId = async (
  supabase: SupabaseClient,
  pageKey: WallpaperPageKey,
) => {
  const { data: readyAssets, error: readyAssetsError } = await supabase
    .from("wallpaper_assets")
    .select("id")
    .eq("page_key", pageKey)
    .eq("publish_state", "ready")
    .order("created_at", { ascending: true });

  if (readyAssetsError) {
    throw new Error(`Failed to load ready wallpaper backlog: ${readyAssetsError.message}`);
  }

  const orderedAssetIds = ((readyAssets ?? []) as ReadyWallpaperAssetRow[]).map((asset) => asset.id);
  if (orderedAssetIds.length === 0) {
    return null;
  }

  const { data: usedAssignments, error: usedAssignmentsError } = await supabase
    .from("daily_wallpaper_assignments")
    .select("wallpaper_asset_id")
    .in("wallpaper_asset_id", orderedAssetIds);

  if (usedAssignmentsError) {
    throw new Error(`Failed to load wallpaper assignment history: ${usedAssignmentsError.message}`);
  }

  return pickOldestUnusedWallpaperAssetId(
    orderedAssetIds,
    ((usedAssignments ?? []) as UsedWallpaperAssignmentRow[]).map((assignment) => assignment.wallpaper_asset_id),
  );
};
