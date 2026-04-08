import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireInternalRequest } from "../_shared/auth.ts";
import {
  WALLPAPER_IMAGE_HEIGHT,
  WALLPAPER_IMAGE_SIZE,
  WALLPAPER_IMAGE_WIDTH,
  WALLPAPER_PAGE_KEYS,
  WALLPAPER_PROMPT_VERSION,
  getWallpaperDateKey,
  wallpaperGenerationSpecs,
  type WallpaperPageKey,
  type WallpaperValidationResult,
} from "../../../src/shared/wallpaperCatalog.ts";
import {
  buildWallpaperValidationPrompt,
  isWallpaperValidationAcceptable,
  parseWallpaperValidationResult,
} from "./validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-key",
};

interface RotationOutcome {
  pageKey: WallpaperPageKey;
  status: "generated" | "carry_forward" | "skipped";
  assetId: string | null;
  reason?: string;
}

const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const renderModel = Deno.env.get("OPENAI_IMAGE_MODEL") ?? "gpt-image-1";
const validationModel = Deno.env.get("OPENAI_TEXT_MODEL") ?? "gpt-4o-mini";

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured");
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const jsonResponse = (status: number, body: Record<string, unknown>) => new Response(
  JSON.stringify(body),
  {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  },
);

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

const generateWallpaperImage = async (pageKey: WallpaperPageKey) => {
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
      model: renderModel,
      image_size: WALLPAPER_IMAGE_SIZE,
      messages: [{ role: "user", content: spec.prompt }],
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

const validateWallpaperImage = async (
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

const uploadWallpaperImage = async (
  pageKey: WallpaperPageKey,
  dateKey: string,
  imageUrl: string,
) => {
  const { contentType, bytes } = await getContentTypeAndBytes(imageUrl);
  const extension = getFileExtension(contentType);
  const filePath = `${pageKey}/${dateKey}/${crypto.randomUUID()}.${extension}`;

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

const getExistingAssignment = async (pageKey: WallpaperPageKey, dateKey: string) => {
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

const getLatestReadyAssetId = async (pageKey: WallpaperPageKey) => {
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

const insertWallpaperAsset = async (
  pageKey: WallpaperPageKey,
  imageUrl: string,
  storagePath: string,
  validationResult: WallpaperValidationResult,
  publishState: "ready" | "validation_failed",
  dateKey: string,
) => {
  const spec = wallpaperGenerationSpecs[pageKey];
  const payload = {
    page_key: pageKey,
    source_kind: "generated",
    prompt_text: spec.prompt,
    prompt_version: WALLPAPER_PROMPT_VERSION,
    render_model: renderModel,
    storage_path: storagePath,
    image_url: imageUrl,
    image_width: WALLPAPER_IMAGE_WIDTH,
    image_height: WALLPAPER_IMAGE_HEIGHT,
    mobile_focus_x: validationResult.mobileFocusX ?? spec.mobileFocus.x,
    mobile_focus_y: validationResult.mobileFocusY ?? spec.mobileFocus.y,
    desktop_focus_x: validationResult.desktopFocusX ?? spec.desktopFocus.x,
    desktop_focus_y: validationResult.desktopFocusY ?? spec.desktopFocus.y,
    publish_state: publishState,
    validation_result: validationResult,
    generation_date: dateKey,
  };

  const { data, error } = await supabase
    .from("wallpaper_assets")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to save wallpaper asset record: ${error.message}`);
  }

  return data.id;
};

const assignWallpaperAsset = async (
  pageKey: WallpaperPageKey,
  dateKey: string,
  wallpaperAssetId: string,
  assignmentSource: "auto" | "carry_forward" | "admin_override",
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

const rotatePageWallpaper = async (
  pageKey: WallpaperPageKey,
  dateKey: string,
  force: boolean,
): Promise<RotationOutcome> => {
  const existingAssignment = await getExistingAssignment(pageKey, dateKey);
  if (existingAssignment && !force) {
    return {
      pageKey,
      status: "skipped",
      assetId: existingAssignment.wallpaper_asset_id,
      reason: "already assigned for date",
    };
  }

  try {
    const generatedImageUrl = await generateWallpaperImage(pageKey);
    const validation = await validateWallpaperImage(pageKey, generatedImageUrl);
    const uploaded = await uploadWallpaperImage(pageKey, dateKey, generatedImageUrl);
    const publishState = validation.approved ? "ready" : "validation_failed";
    const assetId = await insertWallpaperAsset(
      pageKey,
      uploaded.imageUrl,
      uploaded.filePath,
      validation,
      publishState,
      dateKey,
    );

    if (publishState === "ready") {
      await assignWallpaperAsset(pageKey, dateKey, assetId, "auto");
      return {
        pageKey,
        status: "generated",
        assetId,
      };
    }

    const latestReadyAssetId = await getLatestReadyAssetId(pageKey);
    if (latestReadyAssetId) {
      await assignWallpaperAsset(pageKey, dateKey, latestReadyAssetId, "carry_forward");
      return {
        pageKey,
        status: "carry_forward",
        assetId: latestReadyAssetId,
        reason: validation.rejectionReasons.join(" · ") || "validation rejected candidate",
      };
    }

    return {
      pageKey,
      status: "skipped",
      assetId: null,
      reason: validation.rejectionReasons.join(" · ") || "validation rejected candidate",
    };
  } catch (error) {
    const latestReadyAssetId = await getLatestReadyAssetId(pageKey);
    if (latestReadyAssetId) {
      await assignWallpaperAsset(pageKey, dateKey, latestReadyAssetId, "carry_forward");
      return {
        pageKey,
        status: "carry_forward",
        assetId: latestReadyAssetId,
        reason: error instanceof Error ? error.message : String(error),
      };
    }

    return {
      pageKey,
      status: "skipped",
      assetId: null,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const internalRequest = await requireInternalRequest(req, corsHeaders);
  if (internalRequest instanceof Response) {
    return internalRequest;
  }
  void internalRequest;

  const body = await req.json().catch(() => ({})) as { force?: boolean };
  const force = body.force === true;
  const dateKey = getWallpaperDateKey();

  const outcomes: RotationOutcome[] = [];
  for (const pageKey of WALLPAPER_PAGE_KEYS) {
    const outcome = await rotatePageWallpaper(pageKey, dateKey, force);
    outcomes.push(outcome);
  }

  return jsonResponse(200, {
    success: true,
    dateKey,
    outcomes,
  });
});
