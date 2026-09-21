import type { CompanionElementId, CompanionPresetId } from "./companionCatalog";

export const COSMIQ_PRODUCTION_SPECIES = [
  "dragon",
  "wolf",
  "fox",
  "owl",
  "lion",
  "phoenix",
  "pegasus",
  "griffin",
  "sphinx",
  "leviathan",
  "mechanicaldragon",
  "tanuki",
  "buttercat",
] as const satisfies readonly CompanionPresetId[];

export const COSMIQ_PRODUCTION_ELEMENTS = [
  "fire",
  "ice",
  "storm",
  "nature",
  "void",
  "light",
] as const satisfies readonly CompanionElementId[];

export type CosmiqProductionSpecies = (typeof COSMIQ_PRODUCTION_SPECIES)[number];
export type CosmiqProductionElement = (typeof COSMIQ_PRODUCTION_ELEMENTS)[number];

export interface CosmiqProductionCombination {
  species: CosmiqProductionSpecies;
  element: CosmiqProductionElement;
}

const normalizeValue = (value: string | null | undefined): string =>
  value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "") ?? "";

const SPECIES_ALIASES: Readonly<Record<string, CosmiqProductionSpecies>> = {
  dragon: "dragon",
  wolf: "wolf",
  fox: "fox",
  kitsune: "fox",
  owl: "owl",
  lion: "lion",
  phoenix: "phoenix",
  pegasus: "pegasus",
  griffin: "griffin",
  sphinx: "sphinx",
  leviathan: "leviathan",
  mechanicaldragon: "mechanicaldragon",
  mechdragon: "mechanicaldragon",
  tanuki: "tanuki",
  buttercat: "buttercat",
};

export const resolveCosmiqProductionCombination = ({
  species,
  element,
}: {
  species: string | null | undefined;
  element: string | null | undefined;
}): CosmiqProductionCombination | null => {
  const normalizedSpecies = SPECIES_ALIASES[normalizeValue(species)];
  const normalizedElement = normalizeValue(element);
  if (
    !normalizedSpecies
    || !(COSMIQ_PRODUCTION_ELEMENTS as readonly string[]).includes(normalizedElement)
  ) {
    return null;
  }

  return {
    species: normalizedSpecies,
    element: normalizedElement as CosmiqProductionElement,
  };
};
