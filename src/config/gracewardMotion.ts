import type { CompanionElementId } from "@/config/companionCatalog";
import {
  getChristianCompanionForm,
  type ChristianCompanionForm,
} from "@/config/christianCompanionForms";
import type { DailyFormationCategory } from "@/data/dailyFormationPractices";
import {
  getPremadeGracewardFormationAssetDescriptor,
  type PremadeGracewardFormationAssetDescriptor,
} from "@/config/premadeCompanionAssets";
import { getCurrentVisualStageBoundaryLevel } from "@/config/progression";

export type DailyFormationAnimationVariant = 1 | 2 | 3;
export type CompanionReactionAnimation = "encourage" | "celebrate" | "rest";

const MOTION_ASSET_ROOT = "/graceward-motion/v1";
const BUNDLED_MOTION_SPECIES = ["lion", "dove"] as const;
const BUNDLED_MOTION_ELEMENTS = ["light", "nature"] as const;

const stableVariant = (seed: string): DailyFormationAnimationVariant => {
  let hash = 2_166_136_261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return ((Math.abs(hash) % 3) + 1) as DailyFormationAnimationVariant;
};

const resolveBundledMotionIdentity = ({
  species,
  element,
}: {
  species: string | null | undefined;
  element: string | null | undefined;
}): {
  speciesId: ChristianCompanionForm["id"];
  elementId: CompanionElementId;
} | null => {
  const form = getChristianCompanionForm(species);
  if (
    !form ||
    !(BUNDLED_MOTION_SPECIES as readonly string[]).includes(form.id)
  ) return null;
  if (
    typeof element !== "string" ||
    !(BUNDLED_MOTION_ELEMENTS as readonly string[]).includes(element)
  ) return null;
  return { speciesId: form.id, elementId: element as CompanionElementId };
};

export const getDailyFormationAssetDescriptor = ({
  species,
  element,
  stage,
  category,
  dateKey,
}: {
  species: string | null | undefined;
  element: string | null | undefined;
  stage: number | null | undefined;
  category: DailyFormationCategory;
  dateKey: string;
}): PremadeGracewardFormationAssetDescriptor | null =>
  getPremadeGracewardFormationAssetDescriptor({
    species,
    element,
    stage,
    category,
    dateKey,
  });

// Lion and dove formation clips shipped in the app bundle before formation
// media moved to the reviewed storage manifest. Keep them as the release-safe
// fallback for the Young visual stage while the remote pack is filled out.
export const getBundledDailyFormationAssetUrls = ({
  species,
  element,
  stage,
  category,
  dateKey,
}: {
  species: string | null | undefined;
  element: string | null | undefined;
  stage: number | null | undefined;
  category: DailyFormationCategory;
  dateKey: string;
}): { videoUrl: string; stillUrl: string } | null => {
  if (
    typeof stage !== "number" ||
    stage < 1 ||
    getCurrentVisualStageBoundaryLevel(stage) !== 1
  ) return null;

  const identity = resolveBundledMotionIdentity({ species, element });
  if (!identity) return null;

  const variant = stableVariant(
    `${identity.speciesId}:${identity.elementId}:${category}:${dateKey}`,
  );
  const assetBase = `${MOTION_ASSET_ROOT}/${identity.speciesId}/${identity.elementId}/${category.toLowerCase()}-${variant}`;
  return {
    videoUrl: `${assetBase}.mp4`,
    stillUrl: `${assetBase}.jpg`,
  };
};

export const getCompanionReactionAnimationUrl = ({
  species,
  element,
  reaction,
}: {
  species: string | null | undefined;
  element: string | null | undefined;
  reaction: CompanionReactionAnimation;
}): string | null => {
  const identity = resolveBundledMotionIdentity({ species, element });
  if (!identity) return null;
  return `${MOTION_ASSET_ROOT}/${identity.speciesId}/${identity.elementId}/reaction-${reaction}.mp4`;
};
