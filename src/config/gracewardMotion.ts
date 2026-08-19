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

export type CompanionReactionAnimation = "encourage" | "celebrate" | "rest";

const MOTION_ASSET_ROOT = "/graceward-motion/v1";
const LEGACY_REACTION_SPECIES = ["lion", "dove"] as const;
const LEGACY_REACTION_ELEMENTS = ["light", "nature"] as const;

const resolveLegacyReactionIdentity = ({
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
    !(LEGACY_REACTION_SPECIES as readonly string[]).includes(form.id)
  ) return null;
  if (
    typeof element !== "string" ||
    !(LEGACY_REACTION_ELEMENTS as readonly string[]).includes(element)
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

export const getCompanionReactionAnimationUrl = ({
  species,
  element,
  reaction,
}: {
  species: string | null | undefined;
  element: string | null | undefined;
  reaction: CompanionReactionAnimation;
}): string | null => {
  const identity = resolveLegacyReactionIdentity({ species, element });
  if (!identity) return null;
  return `${MOTION_ASSET_ROOT}/${identity.speciesId}/${identity.elementId}/reaction-${reaction}.mp4`;
};
