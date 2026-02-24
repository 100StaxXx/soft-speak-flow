import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireRequestAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const THEME_DESCRIPTIONS: Record<string, string> = {
  distraction: "a swirling vortex entity with multiple floating eyes and hypnotic patterns, draws attention away from focus",
  stagnation: "a moss-covered stone golem, ancient and immovable, roots growing from cracks in its form",
  anxiety: "a creature of crackling lightning and jagged edges, nervous energy radiating outward, flickering unstably",
  doubt: "a shadowy figure with no clear form, constantly shifting between shapes, mirrors reflecting distorted images",
  chaos: "a wild elemental of fire and wind intertwined, unpredictable flames dancing in spiral patterns",
  laziness: "a large slumbering beast made of clouds and soft mist, comfortable and heavy, weighing down everything",
  overthinking: "a many-headed serpent with gears and clockwork visible through transparent scales, endless calculation",
  fear: "a shadow guardian with glowing eyes and flowing mist-like limbs, cautious and mysterious presence emerging from twilight",
  confusion: "a maze-like creature whose body is corridors and dead ends, geometric and impossible angles",
  vulnerability: "a cracked crystal being with exposed inner light, beautiful but fragile, defensive spikes emerging",
  imbalance: "a creature split down the middle - one half fire, one half ice, struggling against itself",
};

const TIER_MODIFIERS: Record<string, string> = {
  common: "simple and small, faint glow, apprentice-level threat",
  uncommon: "moderate size with emerging power, subtle magical aura",
  rare: "impressive and dangerous, strong magical presence, glowing runes",
  epic: "massive and terrifying, reality-bending presence, cosmic energy crackling",
  legendary: "god-like entity of immense power, celestial and apocalyptic, universe-shaking presence",
};

const MAX_VARIANTS = 5;
const DEFAULT_TARGET_VARIANTS = 1;
const MISSING_COLUMN_CODE = "42703";
const IMAGE_GENERATION_TIMEOUT_MS = 90_000;

interface CachedVariant {
  image_url: string;
  variant_index: number;
}

interface LegacyCachedVariant {
  image_url: string;
}

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

const toResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

const clampInteger = (value: unknown, min: number, max: number, fallback: number): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.floor(value)));
};

const resolveRequestedVariant = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const parsed = Math.floor(value);
  if (parsed < 0 || parsed >= MAX_VARIANTS) {
    return null;
  }

  return parsed;
};

const hashString = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash * 31) + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const buildPrompt = (
  theme: string,
  tier: string,
  name: string | undefined,
  variantIndex: number,
  variantCount: number,
) => {
  const themeDesc = THEME_DESCRIPTIONS[theme] || "a mysterious dark energy creature";
  const tierMod = TIER_MODIFIERS[tier] || "moderate power level";
  const resolvedName = (typeof name === "string" && name.trim().length > 0) ? name.trim() : "Astral Adversary";

  return `Create a dark fantasy creature portrait for a mobile game battle screen. The creature is called "${resolvedName}" and represents ${theme} energy.

Description: ${themeDesc}

Power level: ${tierMod}

Variant guidance:
- Produce variant ${variantIndex + 1} of ${variantCount} for the same creature identity.
- Keep species/theme consistent while varying pose, camera angle, expression, or energy effect.

Style requirements:
- Digital painting style, high-quality fantasy game concept art
- Dark and menacing but stylized and appealing (not grotesque)
- Cosmic/astral aesthetic with subtle star and nebula elements
- Glowing eyes or energy effects
- Portrait composition focused on the creature's upper body/face
- Dark background with magical ambient lighting
- Single creature only, no multiple entities
- Professional game asset quality`;
};

const generateImage = async (prompt: string, openAiApiKey: string): Promise<string> => {
  const abortController = new AbortController();
  const timeoutHandle = setTimeout(() => abortController.abort(), IMAGE_GENERATION_TIMEOUT_MS);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json",
    },
    signal: abortController.signal,
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image-preview",
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  }).catch((error) => {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new HttpError(504, "Image generation timed out");
    }
    throw error;
  }).finally(() => {
    clearTimeout(timeoutHandle);
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("AI gateway error:", response.status, errorText);
    if (response.status === 429) {
      throw new HttpError(429, "Rate limited, please try again later");
    }
    throw new HttpError(response.status, `AI generation failed: ${response.status}`);
  }

  const data = await response.json();
  const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!imageUrl) {
    console.error("No image in response:", JSON.stringify(data));
    throw new HttpError(502, "No image generated");
  }

  return imageUrl;
};

const pickDeterministicVariant = (
  variants: CachedVariant[],
  requestedVariant: number | null,
  seed: string,
): CachedVariant => {
  if (requestedVariant !== null) {
    const explicitMatch = variants.find((variant) => variant.variant_index === requestedVariant);
    if (explicitMatch) {
      return explicitMatch;
    }
  }

  const sorted = [...variants].sort((a, b) => a.variant_index - b.variant_index);
  const index = hashString(seed) % sorted.length;
  return sorted[index];
};

const isMissingVariantColumnError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: string; message?: string };
  if (maybeError.code === MISSING_COLUMN_CODE) {
    return true;
  }

  const message = (maybeError.message ?? "").toLowerCase();
  return message.includes("variant_index") && message.includes("does not exist");
};

const extractBearerToken = (req: Request): string | null => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  return token.length > 0 ? token : null;
};

const parseServiceRoleClaim = (token: string): boolean => {
  const parts = token.split(".");
  if (parts.length < 2) return false;

  try {
    const payloadJson = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadJson) as { role?: string; app_metadata?: { role?: string } };
    return payload.role === "service_role" || payload.app_metadata?.role === "service_role";
  } catch {
    return false;
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const bearerToken = extractBearerToken(req);
    const auth = await requireRequestAuth(req, corsHeaders);
    if (auth instanceof Response) {
      const serviceRoleFromJwt = bearerToken ? parseServiceRoleClaim(bearerToken) : false;
      if (!serviceRoleFromJwt) {
        return auth;
      }
    }

    const body = await req.json();
    const theme = typeof body?.theme === "string" ? body.theme.trim() : "";
    const tier = typeof body?.tier === "string" ? body.tier.trim() : "";
    const name = typeof body?.name === "string" ? body.name : undefined;
    const targetVariantsInput = body?.targetVariants;
    const requestedVariant = resolveRequestedVariant(body?.variantIndex);

    if (!theme || !tier) {
      throw new Error("Missing required parameters: theme, tier");
    }

    const targetVariants = clampInteger(targetVariantsInput, 1, MAX_VARIANTS, DEFAULT_TARGET_VARIANTS);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: cachedImages, error: cachedImagesError } = await supabase
      .from("adversary_images")
      .select("image_url, variant_index")
      .eq("theme", theme)
      .eq("tier", tier)
      .order("variant_index", { ascending: true });
    const legacySchemaMode = isMissingVariantColumnError(cachedImagesError);

    if (cachedImagesError && !legacySchemaMode) {
      throw new Error(`Failed to load cached adversary images: ${cachedImagesError.message}`);
    }

    const effectiveTargetVariants = legacySchemaMode
      ? 1
      : (requestedVariant === null
        ? targetVariants
        : Math.max(targetVariants, requestedVariant + 1));

    let normalizedCachedImages: CachedVariant[] = [];

    if (legacySchemaMode) {
      console.warn(`adversary_images.variant_index missing; using legacy single-image mode for ${theme}/${tier}`);
      const { data: legacyCachedImages, error: legacyCacheError } = await supabase
        .from("adversary_images")
        .select("image_url")
        .eq("theme", theme)
        .eq("tier", tier);

      if (legacyCacheError) {
        throw new Error(`Failed to load cached adversary images: ${legacyCacheError.message}`);
      }

      normalizedCachedImages = (legacyCachedImages ?? [])
        .filter((row): row is LegacyCachedVariant => typeof row?.image_url === "string")
        .map((row) => ({ image_url: row.image_url, variant_index: 0 }));
    } else {
      normalizedCachedImages = (cachedImages ?? [])
        .filter(
          (row): row is CachedVariant =>
            typeof row?.image_url === "string" && typeof row?.variant_index === "number",
        )
        .map((row) => ({
          image_url: row.image_url,
          variant_index: Math.floor(row.variant_index),
        }));
    }

    const variantsByIndex = new Map<number, CachedVariant>();
    for (const row of normalizedCachedImages) {
      if (!variantsByIndex.has(row.variant_index)) {
        variantsByIndex.set(row.variant_index, row);
      }
    }

    const initiallyCachedVariantIndexes = new Set<number>(variantsByIndex.keys());
    const missingVariantIndexes: number[] = [];
    for (let variantIndex = 0; variantIndex < effectiveTargetVariants; variantIndex += 1) {
      if (!variantsByIndex.has(variantIndex)) {
        missingVariantIndexes.push(variantIndex);
      }
    }

    let generatedVariants = 0;
    let sawRateLimit = false;
    const generationFailures: string[] = [];

    if (missingVariantIndexes.length > 0) {
      console.log(
        `Generating ${missingVariantIndexes.length} adversary variant(s) for ${theme}/${tier} (target ${effectiveTargetVariants})`,
      );
    }

    let openAiApiKey: string | undefined;
    if (missingVariantIndexes.length > 0) {
      openAiApiKey = Deno.env.get("OPENAI_API_KEY");
      if (!openAiApiKey) {
        throw new Error("OPENAI_API_KEY is not configured");
      }
    }

    for (const missingVariantIndex of missingVariantIndexes) {
      try {
        const prompt = buildPrompt(theme, tier, name, missingVariantIndex, effectiveTargetVariants);
        const imageUrl = await generateImage(prompt, openAiApiKey as string);
        generatedVariants += 1;

        variantsByIndex.set(missingVariantIndex, {
          image_url: imageUrl,
          variant_index: missingVariantIndex,
        });

        const { error: upsertError } = legacySchemaMode
          ? await supabase
            .from("adversary_images")
            .upsert(
              { theme, tier, image_url: imageUrl },
              { onConflict: "theme,tier", ignoreDuplicates: true },
            )
          : await supabase
            .from("adversary_images")
            .upsert(
              { theme, tier, variant_index: missingVariantIndex, image_url: imageUrl },
              { onConflict: "theme,tier,variant_index", ignoreDuplicates: true },
            );

        if (upsertError) {
          console.error(
            `Failed to cache adversary variant ${missingVariantIndex} for ${theme}/${tier}:`,
            upsertError,
          );
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown generation failure";
        generationFailures.push(errorMessage);
        if (error instanceof HttpError && error.status === 429) {
          sawRateLimit = true;
          break;
        }
      }
    }

    const availableVariants = Array.from(variantsByIndex.values())
      .sort((a, b) => a.variant_index - b.variant_index);

    if (availableVariants.length === 0) {
      if (sawRateLimit) {
        return toResponse({ error: "Rate limited, please try again later" }, 429);
      }
      const failureMessage = generationFailures[0] ?? "No image generated";
      throw new Error(failureMessage);
    }

    const selectedVariant = pickDeterministicVariant(
      availableVariants,
      requestedVariant,
      (name?.trim() || `${theme}:${tier}`),
    );
    const wasCached = initiallyCachedVariantIndexes.has(selectedVariant.variant_index);

    return toResponse({
      imageUrl: selectedVariant.image_url,
      cached: wasCached,
      variantIndex: selectedVariant.variant_index,
      availableVariants: availableVariants.length,
      generatedVariants,
    });
  } catch (error) {
    console.error("Error generating adversary image:", error);
    return toResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
