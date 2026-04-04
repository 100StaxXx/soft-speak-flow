import { supabase } from "@/integrations/supabase/client";
import {
  COMPANION_PRESET_BUCKET,
  COMPANION_PREVIEW_TIER,
  coerceCompanionElementId,
  coerceCompanionPresetId,
  hasBundledYouthCompanionPresetAssets,
  hasRemoteCompanionPresetStageAssetCoverage,
  resolveCompanionAssetPath,
  resolveBundledYouthCompanionAssetPath,
  resolveCompanionArtTier,
  type CompanionVisualState,
} from "@/config/companionCatalog";

const UNIVERSAL_EGG_ASSET_DIR = "companion-eggs";

interface CompanionAssetSource {
  preset_id?: string | null;
  current_stage?: number | null;
  core_element?: string | null;
  current_image_url?: string | null;
  dormant_image_url?: string | null;
  neglected_image_url?: string | null;
}

export const resolveUniversalEggAssetPath = ({
  element,
}: {
  element: string;
}): string => {
  const normalizedElement = coerceCompanionElementId(element);
  return `${UNIVERSAL_EGG_ASSET_DIR}/egg__t0_egg__normal__${normalizedElement}.png`;
};

export const getUniversalEggAssetUrl = (element: string): string =>
  `/${resolveUniversalEggAssetPath({ element })}`;

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

export const resolveCompanionVisualAssetUrl = (
  companion: CompanionAssetSource | null | undefined,
  state: CompanionVisualState = "normal",
): string | null => {
  if (!companion) return null;

  const normalizedElement = companion.core_element ?? "fire";
  const isStageZeroEgg = (companion.current_stage ?? 0) <= 0;

  // Level 0 always renders the shared elemental egg art. Persisted stage-0 URLs
  // can be stale or point at preset art that does not exist yet.
  if (isStageZeroEgg && state === "normal") {
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
    return companion.dormant_image_url ?? companion.current_image_url ?? null;
  }
  if (state === "neglected") {
    return companion.neglected_image_url ?? companion.current_image_url ?? null;
  }
  return companion.current_image_url ?? null;
};
