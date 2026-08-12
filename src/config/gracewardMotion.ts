import type { CompanionElementId } from "@/config/companionCatalog";
import {
  isPilotChristianCompanionForm,
  isPilotChristianCompanionElement,
} from "@/config/companionPilotAvailability";
import {
  getChristianCompanionForm,
  type ChristianCompanionForm,
} from "@/config/christianCompanionForms";
import type { DailyFormationCategory } from "@/data/dailyFormationPractices";

export type DailyFormationAnimationVariant = 1 | 2 | 3;
export type CompanionReactionAnimation = "encourage" | "celebrate" | "rest";

const MOTION_ASSET_ROOT = "/graceward-motion/v1";

const stableVariant = (seed: string): DailyFormationAnimationVariant => {
  let hash = 2_166_136_261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return ((Math.abs(hash) % 3) + 1) as DailyFormationAnimationVariant;
};

const resolvePilotIdentity = ({
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
  if (!form || !isPilotChristianCompanionForm(form.id)) return null;
  if (!isPilotChristianCompanionElement(element)) return null;
  return { speciesId: form.id, elementId: element };
};

export const getDailyFormationAnimationUrl = ({
  species,
  element,
  category,
  dateKey,
}: {
  species: string | null | undefined;
  element: string | null | undefined;
  category: DailyFormationCategory;
  dateKey: string;
}): string | null => {
  const identity = resolvePilotIdentity({ species, element });
  if (!identity) return null;

  const variant = stableVariant(`${identity.speciesId}:${identity.elementId}:${category}:${dateKey}`);
  return `${MOTION_ASSET_ROOT}/${identity.speciesId}/${identity.elementId}/${category.toLowerCase()}-${variant}.mp4`;
};

export const getDailyFormationStillUrl = ({
  species,
  element,
  category,
  dateKey,
}: {
  species: string | null | undefined;
  element: string | null | undefined;
  category: DailyFormationCategory;
  dateKey: string;
}): string | null => {
  const identity = resolvePilotIdentity({ species, element });
  if (!identity) return null;

  const variant = stableVariant(`${identity.speciesId}:${identity.elementId}:${category}:${dateKey}`);
  return `${MOTION_ASSET_ROOT}/${identity.speciesId}/${identity.elementId}/${category.toLowerCase()}-${variant}.jpg`;
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
  const identity = resolvePilotIdentity({ species, element });
  if (!identity) return null;
  return `${MOTION_ASSET_ROOT}/${identity.speciesId}/${identity.elementId}/reaction-${reaction}.mp4`;
};
