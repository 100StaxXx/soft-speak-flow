import {
  COMPANION_ELEMENTS,
  COMPANION_PRESETS_WITH_BUNDLED_YOUTH_ASSETS,
  coerceCompanionElementId,
  type CompanionElementId,
} from "./companionCatalog.ts";
import {
  PROGRESSION_VISUAL_BOUNDARY_LEVELS,
  getCurrentVisualStageBoundaryLevel,
} from "./progression.ts";

export const PREMADE_COMPANION_ASSET_VERSION = "v1" as const;
export const PREMADE_COMPANION_PORTRAIT_BUCKET = "companion-presets" as const;
export const PREMADE_COMPANION_VIDEO_BUCKET = "companion-animation-videos" as const;

export type PremadeCompanionProductMode = "graceward" | "cosmiq";
export const GRACEWARD_PREMADE_COMPANION_SPECIES = [
  "lamb",
  "lion",
  "stag",
  "dove",
  "eagle",
  "wolf",
] as const;

export type GracewardCompanionSpecies =
  (typeof GRACEWARD_PREMADE_COMPANION_SPECIES)[number];
export type CosmiqPremadeCompanionSpecies =
  (typeof COMPANION_PRESETS_WITH_BUNDLED_YOUTH_ASSETS)[number];
export type PremadeCompanionSpecies =
  | GracewardCompanionSpecies
  | CosmiqPremadeCompanionSpecies;

export const PREMADE_COMPANION_PRODUCT_SPECIES = {
  graceward: GRACEWARD_PREMADE_COMPANION_SPECIES,
  cosmiq: [...COMPANION_PRESETS_WITH_BUNDLED_YOUTH_ASSETS],
} as const satisfies Record<
  PremadeCompanionProductMode,
  readonly PremadeCompanionSpecies[]
>;

export const PREMADE_COMPANION_ELEMENTS = COMPANION_ELEMENTS.map(
  (element) => element.id,
);
export const GRACEWARD_PREMADE_COMPANION_ELEMENTS = [
  ...PREMADE_COMPANION_ELEMENTS,
] as const satisfies readonly CompanionElementId[];

export const PREMADE_COMPANION_PRODUCT_ELEMENTS = {
  graceward: GRACEWARD_PREMADE_COMPANION_ELEMENTS,
  cosmiq: PREMADE_COMPANION_ELEMENTS,
} as const satisfies Record<
  PremadeCompanionProductMode,
  readonly CompanionElementId[]
>;

export const PREMADE_COMPANION_BOUNDARY_LEVELS = [
  ...PROGRESSION_VISUAL_BOUNDARY_LEVELS,
] as const;

// Graceward's complete first production pack covers every selectable species
// and element while retaining the two visual forms encountered through Level 5:
// Young (Level 1) and Growing (Level 5).
export const GRACEWARD_PREMADE_COMPANION_BOUNDARY_LEVELS = [1, 5] as const;

export const PREMADE_COMPANION_PRODUCT_BOUNDARY_LEVELS = {
  graceward: GRACEWARD_PREMADE_COMPANION_BOUNDARY_LEVELS,
  cosmiq: PREMADE_COMPANION_BOUNDARY_LEVELS,
} as const satisfies Record<
  PremadeCompanionProductMode,
  readonly number[]
>;

export const GRACEWARD_PREMADE_FORMATION_CATEGORIES = [
  "Mind",
  "Body",
  "Soul",
] as const;
export const GRACEWARD_PREMADE_FORMATION_VARIANTS = [1, 2, 3] as const;

export type GracewardPremadeFormationCategory =
  (typeof GRACEWARD_PREMADE_FORMATION_CATEGORIES)[number];
export type GracewardPremadeFormationVariant =
  (typeof GRACEWARD_PREMADE_FORMATION_VARIANTS)[number];

interface GracewardPremadeFormationLaunchAvailability {
  species: GracewardCompanionSpecies;
  element: CompanionElementId;
  boundaryLevel: (typeof GRACEWARD_PREMADE_COMPANION_BOUNDARY_LEVELS)[number];
  categories: Partial<Record<
    GracewardPremadeFormationCategory,
    readonly GracewardPremadeFormationVariant[]
  >>;
}

// This manifest is the release boundary for formation media. Keep it aligned
// with the reviewed JPG/MP4 pairs in output/companion-premade. Missing entries
// intentionally resolve to the in-app pillar animation until their videos are
// generated and added here in a later release.
export const GRACEWARD_PREMADE_FORMATION_LAUNCH_AVAILABILITY = [
  { species: "dove", element: "light", boundaryLevel: 1, categories: { Mind: [1, 2] } },
  { species: "dove", element: "nature", boundaryLevel: 1, categories: { Mind: [1, 2, 3] } },
  { species: "lamb", element: "fire", boundaryLevel: 1, categories: { Mind: [1], Body: [1], Soul: [1] } },
  { species: "lamb", element: "fire", boundaryLevel: 5, categories: { Mind: [1], Body: [1], Soul: [1] } },
  { species: "lamb", element: "ice", boundaryLevel: 1, categories: { Mind: [1], Body: [1], Soul: [1] } },
  { species: "lamb", element: "ice", boundaryLevel: 5, categories: { Mind: [1], Body: [1], Soul: [1] } },
  { species: "lamb", element: "light", boundaryLevel: 1, categories: { Mind: [1], Body: [1], Soul: [1] } },
  { species: "lamb", element: "light", boundaryLevel: 5, categories: { Mind: [1] } },
  { species: "lamb", element: "nature", boundaryLevel: 1, categories: { Mind: [1], Body: [1], Soul: [1] } },
  { species: "lamb", element: "nature", boundaryLevel: 5, categories: { Mind: [1], Body: [1], Soul: [1] } },
  { species: "lamb", element: "storm", boundaryLevel: 1, categories: { Mind: [1], Body: [1], Soul: [1] } },
  { species: "lamb", element: "storm", boundaryLevel: 5, categories: { Mind: [1], Body: [1], Soul: [1] } },
  { species: "lamb", element: "void", boundaryLevel: 1, categories: { Mind: [1], Body: [1], Soul: [1] } },
  { species: "lamb", element: "void", boundaryLevel: 5, categories: { Mind: [1], Body: [1], Soul: [1] } },
  { species: "lion", element: "light", boundaryLevel: 1, categories: { Mind: [1, 2] } },
  { species: "lion", element: "nature", boundaryLevel: 1, categories: { Mind: [1, 2] } },
  { species: "wolf", element: "light", boundaryLevel: 1, categories: { Mind: [1, 2, 3] } },
  { species: "wolf", element: "nature", boundaryLevel: 1, categories: { Mind: [1, 2, 3] } },
] as const satisfies readonly GracewardPremadeFormationLaunchAvailability[];

const getGracewardFormationVariants = (
  entry: GracewardPremadeFormationLaunchAvailability,
  category: GracewardPremadeFormationCategory,
): readonly GracewardPremadeFormationVariant[] => entry.categories[category] ?? [];

export interface PremadeCompanionEvolutionAssetDescriptor {
  version: typeof PREMADE_COMPANION_ASSET_VERSION;
  productMode: PremadeCompanionProductMode;
  species: PremadeCompanionSpecies;
  element: CompanionElementId;
  previousBoundaryLevel: number;
  boundaryLevel: number;
  portraitBucket: typeof PREMADE_COMPANION_PORTRAIT_BUCKET;
  portraitStoragePath: string;
  videoBucket: typeof PREMADE_COMPANION_VIDEO_BUCKET;
  videoStoragePath: string;
}

export interface PremadeGracewardFormationAssetDescriptor {
  version: typeof PREMADE_COMPANION_ASSET_VERSION;
  productMode: "graceward";
  species: GracewardCompanionSpecies;
  element: CompanionElementId;
  boundaryLevel: number;
  category: GracewardPremadeFormationCategory;
  variant: GracewardPremadeFormationVariant;
  stillBucket: typeof PREMADE_COMPANION_PORTRAIT_BUCKET;
  stillStoragePath: string;
  videoBucket: typeof PREMADE_COMPANION_VIDEO_BUCKET;
  videoStoragePath: string;
}

const normalizeSpecies = (value: string | null | undefined): string =>
  value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "") ?? "";

const SPECIES_ALIASES: Readonly<Record<string, PremadeCompanionSpecies>> = {
  dragon: "dragon",
  wolf: "wolf",
  kitsune: "fox",
  fox: "fox",
  owl: "owl",
  lion: "lion",
  phoenix: "phoenix",
  pegasus: "pegasus",
  griffin: "griffin",
  sphinx: "sphinx",
  leviathan: "leviathan",
  mechanicaldragon: "mechanicaldragon",
  tanuki: "tanuki",
  buttercat: "buttercat",
  lamb: "lamb",
  stag: "stag",
  dove: "dove",
  eagle: "eagle",
};

export const coercePremadeCompanionSpecies = ({
  productMode,
  species,
}: {
  productMode: PremadeCompanionProductMode;
  species: string | null | undefined;
}): PremadeCompanionSpecies | null => {
  const normalizedSpecies = SPECIES_ALIASES[normalizeSpecies(species)];
  if (!normalizedSpecies) return null;

  return (PREMADE_COMPANION_PRODUCT_SPECIES[productMode] as readonly string[])
      .includes(normalizedSpecies)
    ? normalizedSpecies
    : null;
};

export const isPremadeCompanionBoundaryLevel = (
  level: number,
): boolean =>
  PREMADE_COMPANION_BOUNDARY_LEVELS.includes(
    level as (typeof PREMADE_COMPANION_BOUNDARY_LEVELS)[number],
  );

export const isPremadeCompanionBoundaryLevelForProduct = ({
  productMode,
  boundaryLevel,
}: {
  productMode: PremadeCompanionProductMode | string | null | undefined;
  boundaryLevel: number;
}): boolean => {
  if (productMode !== "graceward" && productMode !== "cosmiq") return true;
  return (PREMADE_COMPANION_PRODUCT_BOUNDARY_LEVELS[productMode] as readonly number[])
    .includes(boundaryLevel);
};

export const isPremadeCompanionCombinationAvailable = ({
  productMode,
  species,
  element,
}: {
  productMode: PremadeCompanionProductMode;
  species: string | null | undefined;
  element: string | null | undefined;
}): boolean => {
  const normalizedSpecies = coercePremadeCompanionSpecies({
    productMode,
    species,
  });
  if (!normalizedSpecies) return false;
  const normalizedElement = coerceCompanionElementId(element);
  return (PREMADE_COMPANION_PRODUCT_ELEMENTS[productMode] as readonly string[])
    .includes(normalizedElement);
};

export const buildPremadeCompanionPortraitStoragePath = ({
  productMode,
  species,
  element,
  boundaryLevel,
}: {
  productMode: PremadeCompanionProductMode;
  species: PremadeCompanionSpecies;
  element: CompanionElementId;
  boundaryLevel: number;
}): string =>
  `premade/${PREMADE_COMPANION_ASSET_VERSION}/${productMode}/${species}/${element}/portraits/level-${boundaryLevel}.webp`;

export const buildPremadeCompanionVideoStoragePath = ({
  productMode,
  species,
  element,
  previousBoundaryLevel,
  boundaryLevel,
}: {
  productMode: PremadeCompanionProductMode;
  species: PremadeCompanionSpecies;
  element: CompanionElementId;
  previousBoundaryLevel: number;
  boundaryLevel: number;
}): string =>
  `premade/${PREMADE_COMPANION_ASSET_VERSION}/${productMode}/${species}/${element}/videos/level-${previousBoundaryLevel}-to-${boundaryLevel}.mp4`;

export const buildPremadeGracewardFormationStoragePath = ({
  species,
  element,
  boundaryLevel,
  category,
  variant,
  extension,
}: {
  species: GracewardCompanionSpecies;
  element: CompanionElementId;
  boundaryLevel: number;
  category: GracewardPremadeFormationCategory;
  variant: GracewardPremadeFormationVariant;
  extension: "jpg" | "mp4";
}): string =>
  `premade/${PREMADE_COMPANION_ASSET_VERSION}/graceward/${species}/${element}/formation/level-${boundaryLevel}/${category.toLowerCase()}-${variant}.${extension}`;

export const getPremadeCompanionEvolutionAssetDescriptor = ({
  productMode,
  species,
  element,
  boundaryLevel,
}: {
  productMode: PremadeCompanionProductMode | string | null | undefined;
  species: string | null | undefined;
  element: string | null | undefined;
  boundaryLevel: number | null | undefined;
}): PremadeCompanionEvolutionAssetDescriptor | null => {
  if (productMode !== "graceward" && productMode !== "cosmiq") return null;
  if (
    typeof boundaryLevel !== "number" ||
    !isPremadeCompanionBoundaryLevel(boundaryLevel) ||
    !isPremadeCompanionBoundaryLevelForProduct({ productMode, boundaryLevel })
  ) {
    return null;
  }

  const normalizedSpecies = coercePremadeCompanionSpecies({
    productMode,
    species,
  });
  if (
    !normalizedSpecies ||
    !isPremadeCompanionCombinationAvailable({ productMode, species, element })
  ) return null;

  const normalizedElement = coerceCompanionElementId(element);
  const previousBoundaryLevel = getCurrentVisualStageBoundaryLevel(
    boundaryLevel - 1,
  );

  return {
    version: PREMADE_COMPANION_ASSET_VERSION,
    productMode,
    species: normalizedSpecies,
    element: normalizedElement,
    previousBoundaryLevel,
    boundaryLevel,
    portraitBucket: PREMADE_COMPANION_PORTRAIT_BUCKET,
    portraitStoragePath: buildPremadeCompanionPortraitStoragePath({
      productMode,
      species: normalizedSpecies,
      element: normalizedElement,
      boundaryLevel,
    }),
    videoBucket: PREMADE_COMPANION_VIDEO_BUCKET,
    videoStoragePath: buildPremadeCompanionVideoStoragePath({
      productMode,
      species: normalizedSpecies,
      element: normalizedElement,
      previousBoundaryLevel,
      boundaryLevel,
    }),
  };
};

const stableFormationVariant = (
  seed: string,
): GracewardPremadeFormationVariant => {
  let hash = 2_166_136_261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (
    (Math.abs(hash) % GRACEWARD_PREMADE_FORMATION_VARIANTS.length) + 1
  ) as GracewardPremadeFormationVariant;
};

const buildPremadeGracewardFormationAssetDescriptor = ({
  species,
  element,
  boundaryLevel,
  category,
  variant,
}: {
  species: GracewardCompanionSpecies;
  element: CompanionElementId;
  boundaryLevel: number;
  category: GracewardPremadeFormationCategory;
  variant: GracewardPremadeFormationVariant;
}): PremadeGracewardFormationAssetDescriptor => ({
  version: PREMADE_COMPANION_ASSET_VERSION,
  productMode: "graceward",
  species,
  element,
  boundaryLevel,
  category,
  variant,
  stillBucket: PREMADE_COMPANION_PORTRAIT_BUCKET,
  stillStoragePath: buildPremadeGracewardFormationStoragePath({
    species,
    element,
    boundaryLevel,
    category,
    variant,
    extension: "jpg",
  }),
  videoBucket: PREMADE_COMPANION_VIDEO_BUCKET,
  videoStoragePath: buildPremadeGracewardFormationStoragePath({
    species,
    element,
    boundaryLevel,
    category,
    variant,
    extension: "mp4",
  }),
});

export const getPremadeGracewardFormationAssetDescriptor = ({
  species,
  element,
  stage,
  category,
  dateKey,
  variant,
}: {
  species: string | null | undefined;
  element: string | null | undefined;
  stage: number | null | undefined;
  category: GracewardPremadeFormationCategory;
  dateKey?: string;
  variant?: GracewardPremadeFormationVariant;
}): PremadeGracewardFormationAssetDescriptor | null => {
  if (typeof stage !== "number" || stage < 1) return null;
  const boundaryLevel = getCurrentVisualStageBoundaryLevel(stage);
  if (!(GRACEWARD_PREMADE_COMPANION_BOUNDARY_LEVELS as readonly number[])
    .includes(boundaryLevel)) {
    return null;
  }

  const normalizedSpecies = coercePremadeCompanionSpecies({
    productMode: "graceward",
    species,
  });
  if (
    !normalizedSpecies ||
    !(GRACEWARD_PREMADE_COMPANION_SPECIES as readonly string[])
      .includes(normalizedSpecies)
  ) {
    return null;
  }

  const normalizedElement = coerceCompanionElementId(element);
  if (!(GRACEWARD_PREMADE_COMPANION_ELEMENTS as readonly string[])
    .includes(normalizedElement)) {
    return null;
  }
  const requestedVariant = variant ?? stableFormationVariant(
    `${normalizedSpecies}:${normalizedElement}:${boundaryLevel}:${category}:${dateKey ?? "default"}`,
  );
  const formationSpecies = normalizedSpecies as GracewardCompanionSpecies;
  const launchEntry = GRACEWARD_PREMADE_FORMATION_LAUNCH_AVAILABILITY.find((entry) =>
    entry.species === formationSpecies
      && entry.element === normalizedElement
      && entry.boundaryLevel === boundaryLevel
  );
  const availableVariants = launchEntry
    ? getGracewardFormationVariants(launchEntry, category)
    : [];
  if (availableVariants.length === 0) return null;
  if (variant && !availableVariants.includes(variant)) return null;
  const resolvedVariant = availableVariants.includes(requestedVariant)
    ? requestedVariant
    : availableVariants[0];

  return buildPremadeGracewardFormationAssetDescriptor({
    species: formationSpecies,
    element: normalizedElement,
    boundaryLevel,
    category,
    variant: resolvedVariant,
  });
};

export const getPremadeCompanionPortraitDescriptorForStage = ({
  productMode,
  species,
  element,
  stage,
}: {
  productMode: PremadeCompanionProductMode | string | null | undefined;
  species: string | null | undefined;
  element: string | null | undefined;
  stage: number | null | undefined;
}): PremadeCompanionEvolutionAssetDescriptor | null => {
  if (typeof stage !== "number" || stage < 1) return null;
  const boundaryLevel = getCurrentVisualStageBoundaryLevel(stage);
  if (boundaryLevel < 1) return null;

  return getPremadeCompanionEvolutionAssetDescriptor({
    productMode,
    species,
    element,
    boundaryLevel,
  });
};

export const buildPremadeCompanionPublicStorageUrl = ({
  supabaseUrl,
  bucket,
  storagePath,
}: {
  supabaseUrl: string;
  bucket: string;
  storagePath: string;
}): string =>
  `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${bucket}/${storagePath}`;

export const getExpectedPremadeCompanionEvolutionAssets = (): readonly PremadeCompanionEvolutionAssetDescriptor[] =>
  (Object.entries(PREMADE_COMPANION_PRODUCT_SPECIES) as Array<
    [PremadeCompanionProductMode, readonly PremadeCompanionSpecies[]]
  >).flatMap(([productMode, speciesList]) =>
    speciesList.flatMap((species) =>
      PREMADE_COMPANION_PRODUCT_ELEMENTS[productMode].flatMap((element) =>
        PREMADE_COMPANION_PRODUCT_BOUNDARY_LEVELS[productMode].map((boundaryLevel) =>
          getPremadeCompanionEvolutionAssetDescriptor({
            productMode,
            species,
            element,
            boundaryLevel,
          })!
        )
      )
    )
  );

export const getExpectedPremadeGracewardFormationAssets = (): readonly PremadeGracewardFormationAssetDescriptor[] =>
  GRACEWARD_PREMADE_FORMATION_LAUNCH_AVAILABILITY.flatMap((entry) =>
    GRACEWARD_PREMADE_FORMATION_CATEGORIES.flatMap((category) =>
      getGracewardFormationVariants(entry, category).map((variant) =>
        buildPremadeGracewardFormationAssetDescriptor({
          species: entry.species,
          element: entry.element,
          boundaryLevel: entry.boundaryLevel,
          category,
          variant,
        })
      )
    )
  );
