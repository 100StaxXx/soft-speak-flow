export const COSMIQ_CANONICAL_SPECIES = ["fox", "phoenix", "leviathan"] as const;
export const COSMIQ_CANONICAL_ELEMENTS = ["fire", "ice", "nature"] as const;

export type CosmiqCanonicalSpecies = (typeof COSMIQ_CANONICAL_SPECIES)[number];
export type CosmiqCanonicalElement = (typeof COSMIQ_CANONICAL_ELEMENTS)[number];

export interface CosmiqCanonicalCombination {
  species: CosmiqCanonicalSpecies;
  element: CosmiqCanonicalElement;
}

export const COSMIQ_CANONICAL_ASSET_BUCKET = "companion-presets" as const;

export const COSMIQ_CANONICAL_STAGE_ASSET_FOLDERS = {
  1: "t1_youth",
  5: "t2_guardian",
  13: "t3_awakened",
  21: "t4_guardian",
  36: "t5_champion",
  56: "t6_mythic",
  81: "t7_ascended",
} as const;

export type CosmiqCanonicalStage = keyof typeof COSMIQ_CANONICAL_STAGE_ASSET_FOLDERS;
export type CosmiqCanonicalAssetSource = "bundled" | "remote";

export interface CosmiqCanonicalAssetDescriptor extends CosmiqCanonicalCombination {
  boundaryLevel: CosmiqCanonicalStage;
  tier: (typeof COSMIQ_CANONICAL_STAGE_ASSET_FOLDERS)[CosmiqCanonicalStage];
  source: CosmiqCanonicalAssetSource;
  storagePath: string;
}

const COSMIQ_CANONICAL_BOUNDARY_LEVELS = [81, 56, 36, 21, 13, 5, 1] as const;

const SPECIES_ALIASES: Record<string, CosmiqCanonicalSpecies> = {
  fox: "fox",
  kitsune: "fox",
  phoenix: "phoenix",
  leviathan: "leviathan",
};

const normalizeValue = (value: string | null | undefined) =>
  value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "") ?? "";

export const resolveCosmiqCanonicalCombination = ({
  species,
  element,
}: {
  species: string | null | undefined;
  element: string | null | undefined;
}): CosmiqCanonicalCombination | null => {
  const normalizedSpecies = SPECIES_ALIASES[normalizeValue(species)];
  const normalizedElement = normalizeValue(element);

  if (
    !normalizedSpecies
    || !COSMIQ_CANONICAL_ELEMENTS.includes(normalizedElement as CosmiqCanonicalElement)
  ) {
    return null;
  }

  return {
    species: normalizedSpecies,
    element: normalizedElement as CosmiqCanonicalElement,
  };
};

export const getCosmiqCanonicalCompanionAssetDescriptor = ({
  species,
  element,
  stage,
}: {
  species: string | null | undefined;
  element: string | null | undefined;
  stage: number | null | undefined;
}): CosmiqCanonicalAssetDescriptor | null => {
  const combination = resolveCosmiqCanonicalCombination({ species, element });
  if (!combination || typeof stage !== "number" || stage < 1) return null;

  const boundaryLevel = COSMIQ_CANONICAL_BOUNDARY_LEVELS.find((candidate) =>
    stage >= candidate
  );
  if (!boundaryLevel) return null;

  const tier = COSMIQ_CANONICAL_STAGE_ASSET_FOLDERS[boundaryLevel];
  return {
    ...combination,
    boundaryLevel,
    tier,
    source: boundaryLevel === 5 ? "remote" : "bundled",
    storagePath:
      `${combination.species}/${tier}/normal/${combination.species}__${tier}__normal__${combination.element}.png`,
  };
};

export const getCosmiqCanonicalCompanionAssetUrl = ({
  species,
  element,
  stage,
}: {
  species: string | null | undefined;
  element: string | null | undefined;
  stage: number | null | undefined;
}): string | null => {
  const descriptor = getCosmiqCanonicalCompanionAssetDescriptor({
    species,
    element,
    stage,
  });
  if (!descriptor || descriptor.source !== "bundled") return null;

  return `/${COSMIQ_CANONICAL_ASSET_BUCKET}/${descriptor.storagePath}`;
};

export const isBundledCosmiqCanonicalCompanionAssetUrl = (
  value: string | null | undefined,
): value is string => {
  if (typeof value !== "string") return false;

  const normalized = value.trim().replace(/^\/+/, "");
  return COSMIQ_CANONICAL_SPECIES.some((species) =>
    COSMIQ_CANONICAL_ELEMENTS.some((element) =>
      COSMIQ_CANONICAL_BOUNDARY_LEVELS
        .filter((boundaryLevel) => boundaryLevel !== 5)
        .some((boundaryLevel) => {
          const tier = COSMIQ_CANONICAL_STAGE_ASSET_FOLDERS[boundaryLevel];
          return normalized ===
            `${COSMIQ_CANONICAL_ASSET_BUCKET}/${species}/${tier}/normal/${species}__${tier}__normal__${element}.png`;
        })
    )
  );
};
