import {
  COSMIQ_PRODUCTION_ELEMENTS,
  COSMIQ_PRODUCTION_SPECIES,
  resolveCosmiqProductionCombination,
  type CosmiqProductionElement,
  type CosmiqProductionSpecies,
} from "./cosmiqProductionCatalog";
import {
  PREMADE_COMPANION_ASSET_VERSION,
  PREMADE_COMPANION_PORTRAIT_BUCKET,
  PREMADE_COMPANION_VIDEO_BUCKET,
} from "./premadeCompanionAssets";
import {
  PROGRESSION_VISUAL_BOUNDARY_LEVELS,
  getCurrentVisualStageBoundaryLevel,
} from "./progression";

export const COSMIQ_AGENDA_CATEGORIES = ["Mind", "Body", "Soul"] as const;
export const COSMIQ_AGENDA_EVENT_TYPES = [
  "ambient",
  "task-start",
  "task-complete",
  "encourage",
  "welcome-back",
  "milestone",
] as const;

export type CosmiqAgendaCategory = (typeof COSMIQ_AGENDA_CATEGORIES)[number];
export type CosmiqAgendaEventType = (typeof COSMIQ_AGENDA_EVENT_TYPES)[number];

export interface CosmiqAgendaMotionRecipe {
  eventType: CosmiqAgendaEventType;
  category: CosmiqAgendaCategory | null;
  variant: number;
}

export interface CosmiqAgendaMotionAssetDescriptor
  extends CosmiqAgendaMotionRecipe {
  version: typeof PREMADE_COMPANION_ASSET_VERSION;
  productMode: "cosmiq";
  species: CosmiqProductionSpecies;
  element: CosmiqProductionElement;
  boundaryLevel: number;
  stillBucket: typeof PREMADE_COMPANION_PORTRAIT_BUCKET;
  stillStoragePath: string;
  videoBucket: typeof PREMADE_COMPANION_VIDEO_BUCKET;
  videoStoragePath: string;
}

const UNIVERSAL_VARIANTS = [1, 2] as const;
const AMBIENT_VARIANTS = [1, 2, 3] as const;
const TASK_VARIANTS = [1, 2, 3] as const;

export const COSMIQ_AGENDA_MOTION_RECIPES: readonly CosmiqAgendaMotionRecipe[] = [
  ...AMBIENT_VARIANTS.map((variant) => ({
    eventType: "ambient" as const,
    category: null,
    variant,
  })),
  ...(["task-start", "task-complete"] as const).flatMap((eventType) =>
    COSMIQ_AGENDA_CATEGORIES.flatMap((category) =>
      TASK_VARIANTS.map((variant) => ({ eventType, category, variant })),
    ),
  ),
  ...(["encourage", "welcome-back", "milestone"] as const).flatMap((eventType) =>
    UNIVERSAL_VARIANTS.map((variant) => ({
      eventType,
      category: null,
      variant,
    })),
  ),
];

const stableVariant = (seed: string, variantCount: number): number => {
  let hash = 2_166_136_261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (Math.abs(hash) % variantCount) + 1;
};

const getVariantCount = (eventType: CosmiqAgendaEventType): number =>
  eventType === "ambient" || eventType === "task-start" || eventType === "task-complete"
    ? 3
    : 2;

const getAssetStem = ({
  eventType,
  category,
  variant,
}: CosmiqAgendaMotionRecipe): string =>
  category
    ? `${category.toLowerCase()}-${variant}`
    : `variant-${variant}`;

export const buildCosmiqAgendaMotionStoragePath = ({
  species,
  element,
  boundaryLevel,
  eventType,
  category,
  variant,
  extension,
}: {
  species: CosmiqProductionSpecies;
  element: CosmiqProductionElement;
  boundaryLevel: number;
  eventType: CosmiqAgendaEventType;
  category: CosmiqAgendaCategory | null;
  variant: number;
  extension: "jpg" | "mp4";
}): string =>
  `premade/${PREMADE_COMPANION_ASSET_VERSION}/cosmiq/${species}/${element}/agenda/level-${boundaryLevel}/${eventType}/${getAssetStem({ eventType, category, variant })}.${extension}`;

export const getCosmiqAgendaMotionAssetDescriptor = ({
  species,
  element,
  stage,
  eventType,
  category = null,
  seed = "default",
  variant,
}: {
  species: string | null | undefined;
  element: string | null | undefined;
  stage: number | null | undefined;
  eventType: CosmiqAgendaEventType;
  category?: CosmiqAgendaCategory | null;
  seed?: string;
  variant?: number;
}): CosmiqAgendaMotionAssetDescriptor | null => {
  const combination = resolveCosmiqProductionCombination({ species, element });
  if (!combination || typeof stage !== "number" || stage < 1) return null;

  const boundaryLevel = getCurrentVisualStageBoundaryLevel(stage);
  if (!(PROGRESSION_VISUAL_BOUNDARY_LEVELS as readonly number[]).includes(boundaryLevel)) {
    return null;
  }

  const categoryRequired = eventType === "task-start" || eventType === "task-complete";
  if (categoryRequired !== Boolean(category)) return null;
  if (category && !(COSMIQ_AGENDA_CATEGORIES as readonly string[]).includes(category)) {
    return null;
  }

  const variantCount = getVariantCount(eventType);
  const resolvedVariant = variant ?? stableVariant(
    `${combination.species}:${combination.element}:${boundaryLevel}:${eventType}:${category ?? "universal"}:${seed}`,
    variantCount,
  );
  if (!Number.isInteger(resolvedVariant) || resolvedVariant < 1 || resolvedVariant > variantCount) {
    return null;
  }

  const pathInput = {
    ...combination,
    boundaryLevel,
    eventType,
    category,
    variant: resolvedVariant,
  };

  return {
    version: PREMADE_COMPANION_ASSET_VERSION,
    productMode: "cosmiq",
    ...pathInput,
    stillBucket: PREMADE_COMPANION_PORTRAIT_BUCKET,
    stillStoragePath: buildCosmiqAgendaMotionStoragePath({
      ...pathInput,
      extension: "jpg",
    }),
    videoBucket: PREMADE_COMPANION_VIDEO_BUCKET,
    videoStoragePath: buildCosmiqAgendaMotionStoragePath({
      ...pathInput,
      extension: "mp4",
    }),
  };
};

export const getExpectedCosmiqAgendaMotionAssets = (): readonly CosmiqAgendaMotionAssetDescriptor[] =>
  COSMIQ_PRODUCTION_SPECIES.flatMap((species) =>
    COSMIQ_PRODUCTION_ELEMENTS.flatMap((element) =>
      PROGRESSION_VISUAL_BOUNDARY_LEVELS.flatMap((boundaryLevel) =>
        COSMIQ_AGENDA_MOTION_RECIPES.map((recipe) =>
          getCosmiqAgendaMotionAssetDescriptor({
            species,
            element,
            stage: boundaryLevel,
            ...recipe,
          })!,
        ),
      ),
    ),
  );
