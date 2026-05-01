import { installOpenAICompatibilityShim } from "./aiClient.ts";
import {
  type CompanionStatAnalysis,
} from "../../../src/shared/companionStatAnalysis.ts";
import {
  COMPANION_COSMIQ_TITLE_CARD_PROMPT_VERSION,
  buildCompanionCosmiqTitleCardProfileKey,
  type CompanionCosmiqTitleCard,
} from "../../../src/shared/companionStatCosmiqTitles.ts";
import {
  createCostGuardrailSession,
  isCostGuardrailBlockedError,
} from "./costGuardrails.ts";
import type { OnboardingVisualPersona } from "../../../src/shared/onboardingVisualPersona.ts";

installOpenAICompatibilityShim();

export const COSMIQ_TITLE_CARD_PROMPT_VERSION = COMPANION_COSMIQ_TITLE_CARD_PROMPT_VERSION;

const COSMIQ_TITLE_CARD_BUCKET = "cosmiq-title-cards";
const IMAGE_GENERATION_TIMEOUT_MS = 90_000;

interface ResolveCosmiqTitleCardParams {
  supabase: any;
  userId: string;
  analysis: CompanionStatAnalysis;
  visualPersona?: OnboardingVisualPersona;
  forceRefresh?: boolean;
  fetchImpl?: typeof fetch;
}

interface GetCosmiqTitleCardCacheStateParams {
  supabase: any;
  analysis: CompanionStatAnalysis;
  visualPersona?: OnboardingVisualPersona;
}

interface BeginGenerationRow {
  action?: string;
  status?: string;
  image_url?: string | null;
  prompt_version?: number | null;
}

interface CachedCardRow {
  image_url?: string | null;
  status?: string | null;
  prompt_version?: number | null;
}

const toGenerationRow = (value: unknown): BeginGenerationRow => {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === "object" && !Array.isArray(row)
    ? row as BeginGenerationRow
    : {};
};

const toCachedCardRow = (value: unknown): CachedCardRow | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as CachedCardRow
    : null;

const buildProfileKey = (
  analysis: CompanionStatAnalysis,
  visualPersona: OnboardingVisualPersona = "neutral",
) =>
  buildCompanionCosmiqTitleCardProfileKey({
    cosmiqTitle: analysis.cosmiqTitle,
    statBreakdowns: analysis.statBreakdowns,
    promptVersion: COSMIQ_TITLE_CARD_PROMPT_VERSION,
    visualPersona,
  });

export const buildPendingCosmiqTitleCard = (
  analysis: CompanionStatAnalysis,
  visualPersona: OnboardingVisualPersona = "neutral",
): CompanionCosmiqTitleCard => ({
  profileKey: buildProfileKey(analysis, visualPersona),
  imageUrl: null,
  status: "generating",
  cached: false,
  promptVersion: COSMIQ_TITLE_CARD_PROMPT_VERSION,
});

const buildUnavailableCard = (profileKey: string): CompanionCosmiqTitleCard => ({
  profileKey,
  imageUrl: null,
  status: "unavailable",
  cached: false,
  promptVersion: COSMIQ_TITLE_CARD_PROMPT_VERSION,
});

export async function getCosmiqTitleCardCacheState({
  supabase,
  analysis,
  visualPersona = "neutral",
}: GetCosmiqTitleCardCacheStateParams): Promise<CompanionCosmiqTitleCard> {
  const pending = buildPendingCosmiqTitleCard(analysis, visualPersona);

  const { data, error } = await supabase
    .from("companion_cosmiq_title_cards")
    .select("image_url, status, prompt_version")
    .eq("profile_key", pending.profileKey)
    .maybeSingle();

  if (error) {
    console.warn("[CosmiqTitleCard] Cache lookup failed", {
      profileKey: pending.profileKey,
      error: error.message ?? "unknown_cache_lookup_error",
    });
    return pending;
  }

  const row = toCachedCardRow(data);
  const promptVersion = row?.prompt_version ?? pending.promptVersion;
  if (row?.status === "ready" && row.image_url) {
    return {
      profileKey: pending.profileKey,
      imageUrl: row.image_url,
      status: "ready",
      cached: true,
      promptVersion,
    };
  }

  if (row?.status === "unavailable") {
    return {
      profileKey: pending.profileKey,
      imageUrl: null,
      status: "unavailable",
      cached: false,
      promptVersion,
    };
  }

  return {
    ...pending,
    promptVersion,
  };
}

const parseDataImage = (imageData: string): { bytes: Uint8Array; contentType: string; extension: string } | null => {
  const match = imageData.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (!match) return null;

  const [, imageFormat, base64Data] = match;
  const extension = imageFormat === "jpeg" ? "jpg" : imageFormat;
  return {
    bytes: Uint8Array.from(atob(base64Data), (char) => char.charCodeAt(0)),
    contentType: `image/${imageFormat}`,
    extension,
  };
};

const fetchWithTimeout = async (
  input: string,
  init: RequestInit,
  timeoutMs: number,
  fetchImpl: typeof fetch,
) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchImpl(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

const getVisualPersonaPromptLine = (visualPersona: OnboardingVisualPersona) => {
  if (visualPersona === "male") {
    return "Visual persona: portray the archetype as a masculine-presenting male fantasy character/avatar.";
  }
  if (visualPersona === "female") {
    return "Visual persona: portray the archetype as a feminine-presenting female fantasy character/avatar.";
  }
  return "Visual persona: portray the archetype as a non-gendered or androgynous fantasy character/avatar.";
};

const buildPrompt = (
  analysis: CompanionStatAnalysis,
  visualPersona: OnboardingVisualPersona,
) => {
  const title = analysis.cosmiqTitle;
  const dominant = title.dominantStat;
  const secondary = title.secondaryStat;
  const rebalance = title.rebalanceStat;

  return `Create a text-free fantasy character portrait for a collectible mobile RPG card.

Cosmiq Title: ${title.title}
Rarity: ${title.rarity}
Dominant stat archetype: ${dominant}
Secondary stat archetype: ${secondary}
Rebalance path stat: ${rebalance}
Fusion title: ${title.fusion ? "yes" : "no"}

Art direction:
- Single heroic fantasy character/avatar representing the title archetype, not a specific real person
- ${getVisualPersonaPromptLine(visualPersona)}
- Cosmic fantasy style, premium collectible card art, luminous but readable silhouette
- Full-body or three-quarter character portrait, centered, portrait orientation
- Include visual motifs for ${dominant} and ${secondary}; subtly hint at ${rebalance} as a path of growth
- ${title.rarity} rarity should feel reflected through lighting, materials, aura, and composition
- No text, no numbers, no letters, no logos, no UI, no border frame
- Polished mobile game illustration, high detail, beautiful lighting, safe-for-work`;
};

async function completeGenerationBestEffort({
  supabase,
  profileKey,
  status,
  imageUrl,
  errorMessage,
}: {
  supabase: any;
  profileKey: string;
  status: "ready" | "unavailable";
  imageUrl?: string | null;
  errorMessage?: string | null;
}) {
  try {
    const { error } = await supabase.rpc("complete_cosmiq_title_card_generation", {
      p_profile_key: profileKey,
      p_status: status,
      p_image_url: imageUrl ?? null,
      p_error_message: errorMessage ?? null,
    });

    if (error) {
      console.warn("[CosmiqTitleCard] Failed completing generation state", {
        profileKey,
        status,
        error: error.message ?? String(error),
      });
    }
  } catch (error) {
    console.warn("[CosmiqTitleCard] Failed completing generation state", {
      profileKey,
      status,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function resolveCosmiqTitleCard({
  supabase,
  userId,
  analysis,
  visualPersona = "neutral",
  forceRefresh = false,
  fetchImpl = fetch,
}: ResolveCosmiqTitleCardParams): Promise<CompanionCosmiqTitleCard> {
  const pending = buildPendingCosmiqTitleCard(analysis, visualPersona);
  const { profileKey } = pending;
  const unavailable = () => buildUnavailableCard(profileKey);

  const { data: beginData, error: beginError } = await supabase.rpc("begin_cosmiq_title_card_generation", {
    p_profile_key: profileKey,
    p_prompt_version: COSMIQ_TITLE_CARD_PROMPT_VERSION,
    p_visual_persona: visualPersona,
    p_title: analysis.cosmiqTitle.title,
    p_rarity: analysis.cosmiqTitle.rarity,
    p_momentum: analysis.cosmiqTitle.momentum,
    p_dominant_stat: analysis.cosmiqTitle.dominantStat,
    p_secondary_stat: analysis.cosmiqTitle.secondaryStat,
    p_rebalance_stat: analysis.cosmiqTitle.rebalanceStat,
    p_fusion: analysis.cosmiqTitle.fusion,
    p_band_signature: analysis.statBreakdowns
      .map((breakdown) => `${breakdown.attribute}:${breakdown.band}`)
      .sort()
      .join("|"),
    p_force_refresh: forceRefresh,
  });

  if (beginError) {
    console.warn("[CosmiqTitleCard] Begin generation failed", {
      profileKey,
      error: beginError.message ?? "unknown_rpc_error",
    });
    return unavailable();
  }

  const row = toGenerationRow(beginData);
  const promptVersion = row.prompt_version ?? COSMIQ_TITLE_CARD_PROMPT_VERSION;

  if (row.action === "ready" && row.image_url) {
    return {
      profileKey,
      imageUrl: row.image_url,
      status: "ready",
      cached: true,
      promptVersion,
    };
  }

  if (row.action === "generating") {
    return {
      profileKey,
      imageUrl: row.image_url ?? null,
      status: "generating",
      cached: Boolean(row.image_url),
      promptVersion,
    };
  }

  const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAiApiKey) {
    await completeGenerationBestEffort({
      supabase,
      profileKey,
      status: "unavailable",
      errorMessage: "OPENAI_API_KEY is not configured",
    });
    return unavailable();
  }

  const costGuardrails = createCostGuardrailSession({
    supabase,
    endpointKey: "generate-cosmiq-title-card",
    featureKey: "ai_companion_images",
    userId,
  });
  const guardedFetch = costGuardrails.wrapFetch(fetchImpl);

  try {
    await costGuardrails.enforceAccess({
      capabilities: ["image"],
      providers: ["openai"],
    });

    const response = await fetchWithTimeout(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image-preview",
          messages: [{ role: "user", content: buildPrompt(analysis, visualPersona) }],
          modalities: ["image", "text"],
        }),
      },
      IMAGE_GENERATION_TIMEOUT_MS,
      guardedFetch,
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI image generation failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (typeof imageData !== "string" || imageData.trim().length === 0) {
      throw new Error("No image generated");
    }

    const parsedImage = parseDataImage(imageData);
    if (!parsedImage) {
      throw new Error("Generated image was not returned as a data URL");
    }

    const storageKey = forceRefresh ? `${profileKey}__${crypto.randomUUID()}` : profileKey;
    const storagePath = `${COSMIQ_TITLE_CARD_PROMPT_VERSION}/${storageKey}.${parsedImage.extension}`;
    const { error: uploadError } = await supabase.storage
      .from(COSMIQ_TITLE_CARD_BUCKET)
      .upload(storagePath, parsedImage.bytes, {
        contentType: parsedImage.contentType,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Cosmiq title card upload failed: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from(COSMIQ_TITLE_CARD_BUCKET)
      .getPublicUrl(storagePath);
    const imageUrl = publicUrlData.publicUrl;

    await completeGenerationBestEffort({
      supabase,
      profileKey,
      status: "ready",
      imageUrl,
    });

    return {
      profileKey,
      imageUrl,
      status: "ready",
      cached: false,
      promptVersion,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await completeGenerationBestEffort({
      supabase,
      profileKey,
      status: "unavailable",
      errorMessage: message,
    });

    if (isCostGuardrailBlockedError(error)) {
      console.warn("[CosmiqTitleCard] Cost guardrail blocked image generation", {
        profileKey,
        scopeType: error.scopeType,
        scopeKey: error.scopeKey,
      });
    } else {
      console.warn("[CosmiqTitleCard] Image generation failed", {
        profileKey,
        error: message,
      });
    }

    return unavailable();
  }
}
