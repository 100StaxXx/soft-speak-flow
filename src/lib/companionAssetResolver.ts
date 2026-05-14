import { supabase } from "@/integrations/supabase/client";
import {
  COMPANION_PRESET_BUCKET,
  COMPANION_EXPRESSION_MOODS,
  COMPANION_PREVIEW_TIER,
  COMPANION_EXPRESSION_VARIANT_COUNT,
  coerceCompanionElementId,
  coerceCompanionPresetId,
  hasBundledCompanionPresetExpressiveAssetCoverage,
  hasBundledYouthCompanionPresetAssets,
  hasRemoteCompanionPresetExpressiveAssetCoverage,
  hasRemoteCompanionPresetStageAssetCoverage,
  resolveCompanionAssetPath,
  resolveBundledYouthCompanionAssetPath,
  resolveCompanionArtTier,
  resolveCompanionExpressiveAssetPath,
  type CompanionExpressionMood,
  type CompanionVisualState,
} from "@/config/companionCatalog";
import { getCompanionPresetImageAssetKey } from "@/lib/companionImageFocal";
import { isPresetEggCompanion } from "@/lib/companionPredicates";

const UNIVERSAL_EGG_ASSET_DIR = "companion-eggs/v2";
const UNIVERSAL_EGG_CUTOUT_ASSET_DIR = "companion-eggs";
const COMPANION_PRESET_PUBLIC_PATH_SEGMENT = `/storage/v1/object/public/${COMPANION_PRESET_BUCKET}/`;

interface CompanionAssetSource {
  preset_id?: string | null;
  current_stage?: number | null;
  core_element?: string | null;
  current_image_url?: string | null;
  initial_image_url?: string | null;
  dormant_image_url?: string | null;
  neglected_image_url?: string | null;
}

export const resolveUniversalEggAssetPath = ({
  element,
}: {
  element: string;
}): string => {
  const normalizedElement = coerceCompanionElementId(element);
  return `${UNIVERSAL_EGG_ASSET_DIR}/egg__t0_egg__normal__${normalizedElement}.webp`;
};

export const getUniversalEggAssetUrl = (element: string): string =>
  `/${resolveUniversalEggAssetPath({ element })}`;

export const resolveUniversalEggCutoutAssetPath = ({
  element,
}: {
  element: string;
}): string => {
  const normalizedElement = coerceCompanionElementId(element);
  return `${UNIVERSAL_EGG_CUTOUT_ASSET_DIR}/egg__t0_egg__normal__${normalizedElement}.png`;
};

export const getUniversalEggCutoutAssetUrl = (element: string): string =>
  `/${resolveUniversalEggCutoutAssetPath({ element })}`;

const isBundledYouthPresetAssetPath = (storagePath: string): boolean => {
  const [presetSegment, storageTier, variantSegment] = storagePath.split("/");
  const normalizedPresetId = coerceCompanionPresetId(presetSegment);

  if (!normalizedPresetId || storageTier !== "t1_youth") {
    return false;
  }

  return hasBundledYouthCompanionPresetAssets(normalizedPresetId)
    && (
      variantSegment === "normal"
      || COMPANION_EXPRESSION_MOODS.includes(variantSegment as CompanionExpressionMood)
    );
};

export const normalizeCompanionStoredImageUrl = (
  imageUrl: string | null | undefined,
): string | null => {
  if (typeof imageUrl !== "string") return null;

  const trimmed = imageUrl.trim();
  if (trimmed.length === 0) return null;

  if (
    trimmed.startsWith("data:")
    || trimmed.startsWith("blob:")
    || trimmed.includes(COMPANION_PRESET_PUBLIC_PATH_SEGMENT)
  ) {
    return trimmed;
  }

  const assetKey = getCompanionPresetImageAssetKey(trimmed);
  if (!assetKey) {
    return trimmed;
  }

  const storagePath = assetKey.replace(new RegExp(`^${COMPANION_PRESET_BUCKET}/`), "");
  if (storagePath.length === 0) {
    return trimmed;
  }

  if (isBundledYouthPresetAssetPath(storagePath)) {
    return `/${assetKey}`;
  }

  return supabase.storage.from(COMPANION_PRESET_BUCKET).getPublicUrl(storagePath).data.publicUrl;
};

export const normalizeCompanionAssetSourceUrls = <T extends CompanionAssetSource>(companion: T): T => ({
  ...companion,
  current_image_url: normalizeCompanionStoredImageUrl(companion.current_image_url),
  initial_image_url: normalizeCompanionStoredImageUrl(companion.initial_image_url),
  dormant_image_url: normalizeCompanionStoredImageUrl(companion.dormant_image_url),
  neglected_image_url: normalizeCompanionStoredImageUrl(companion.neglected_image_url),
});

export const getPresetCompanionAssetUrl = ({
  presetId,
  stage,
  element,
  state = "normal",
}: {
  presetId: string;
  stage: number;
  element: string;
  state?: CompanionVisualState;
}): string | null => {
  const normalizedPresetId = coerceCompanionPresetId(presetId);
  if (!normalizedPresetId) return null;
  const normalizedElement = coerceCompanionElementId(element);
  const tier = resolveCompanionArtTier(stage);
  const isStageZeroEgg = stage <= 0;
  const hasRemoteStageCoverage = hasRemoteCompanionPresetStageAssetCoverage({
    presetId: normalizedPresetId,
    stage,
    state,
  });
  const bundledYouthUrl = hasBundledYouthCompanionPresetAssets(normalizedPresetId)
    ? `/${COMPANION_PRESET_BUCKET}/${resolveBundledYouthCompanionAssetPath({
      presetId: normalizedPresetId,
      element: normalizedElement,
    })}`
    : null;

  // Stage 0 should stay on the shared elemental egg art until hatch.
  // Even presets with remote coverage can point at stale or missing t0 assets.
  if (isStageZeroEgg && state === "normal") {
    return null;
  }

  if (state === "normal" && tier === COMPANION_PREVIEW_TIER && bundledYouthUrl) {
    return bundledYouthUrl;
  }

  if (hasRemoteStageCoverage) {
    return supabase.storage
      .from(COMPANION_PRESET_BUCKET)
      .getPublicUrl(
        resolveCompanionAssetPath({
          presetId: normalizedPresetId,
          stage,
          state,
          element: normalizedElement,
        }),
      )
      .data.publicUrl;
  }

  return state === "normal" ? bundledYouthUrl : null;
};

export const getPresetCompanionExpressiveAssetUrl = ({
  presetId,
  stage,
  element,
  mood,
  variant,
}: {
  presetId: string;
  stage: number;
  element: string;
  mood: CompanionExpressionMood;
  variant: number;
}): string | null => {
  const normalizedPresetId = coerceCompanionPresetId(presetId);
  if (!normalizedPresetId || stage <= 0) return null;

  const normalizedElement = coerceCompanionElementId(element);
  const normalizedVariant = Math.max(1, Math.min(COMPANION_EXPRESSION_VARIANT_COUNT, Math.floor(variant)));
  const tier = resolveCompanionArtTier(stage);

  if (
    hasBundledCompanionPresetExpressiveAssetCoverage({
      presetId: normalizedPresetId,
      tier,
    })
  ) {
    return `/${COMPANION_PRESET_BUCKET}/${resolveCompanionExpressiveAssetPath({
      presetId: normalizedPresetId,
      stage,
      mood,
      variant: normalizedVariant,
      element: normalizedElement,
    })}`;
  }

  if (
    hasRemoteCompanionPresetExpressiveAssetCoverage({
      presetId: normalizedPresetId,
      tier,
    })
  ) {
    return supabase.storage
      .from(COMPANION_PRESET_BUCKET)
      .getPublicUrl(
        resolveCompanionExpressiveAssetPath({
          presetId: normalizedPresetId,
          stage,
          mood,
          variant: normalizedVariant,
          element: normalizedElement,
        }),
      )
      .data.publicUrl;
  }

  return null;
};

export const resolveCompanionExpressiveAssetUrl = (
  companion: CompanionAssetSource | null | undefined,
  {
    mood,
    variant,
  }: {
    mood: CompanionExpressionMood;
    variant: number;
  },
): string | null => {
  if (!companion?.preset_id || (companion.current_stage ?? 0) <= 0) {
    return null;
  }

  return getPresetCompanionExpressiveAssetUrl({
    presetId: companion.preset_id,
    stage: companion.current_stage ?? 0,
    element: companion.core_element ?? "fire",
    mood,
    variant,
  });
};

export const resolveCompanionVisualAssetUrl = (
  companion: CompanionAssetSource | null | undefined,
  state: CompanionVisualState = "normal",
): string | null => {
  if (!companion) return null;

  const normalizedCurrentImageUrl = normalizeCompanionStoredImageUrl(companion.current_image_url);
  const normalizedInitialImageUrl = normalizeCompanionStoredImageUrl(companion.initial_image_url);
  const normalizedDormantImageUrl = normalizeCompanionStoredImageUrl(companion.dormant_image_url);
  const normalizedNeglectedImageUrl = normalizeCompanionStoredImageUrl(companion.neglected_image_url);

  const normalizedElement = companion.core_element ?? "fire";
  if (state === "normal" && (companion.current_stage ?? 0) <= 0) {
    return getUniversalEggAssetUrl(normalizedElement);
  }

  if (state === "normal" && isPresetEggCompanion(companion)) {
    return getUniversalEggAssetUrl(normalizedElement);
  }

  const presetUrl = companion.preset_id
    ? getPresetCompanionAssetUrl({
      presetId: companion.preset_id,
      stage: companion.current_stage ?? 0,
      element: normalizedElement,
      state,
    })
    : null;

  if (presetUrl) return presetUrl;

  if (state === "dormant") {
    return normalizedDormantImageUrl ?? normalizedCurrentImageUrl ?? null;
  }
  if (state === "neglected") {
    return normalizedNeglectedImageUrl ?? normalizedCurrentImageUrl ?? null;
  }
  return normalizedCurrentImageUrl ?? normalizedInitialImageUrl ?? null;
};
