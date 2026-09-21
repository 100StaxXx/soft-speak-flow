export type PostcardSpeciesTag =
  | "aquatic"
  | "flying"
  | "land"
  | "mythic"
  | "all";

export interface PostcardLocation {
  name: string;
  description: string;
  tags?: PostcardSpeciesTag[];
}

export interface PostcardCompanionIdentity {
  spiritAnimal: string;
  coreElement?: string | null;
  favoriteColor?: string | null;
  eyeColor?: string | null;
  furColor?: string | null;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function resolvePostcardTier(
  milestonePercent: number,
): 25 | 50 | 75 | 100 {
  if (milestonePercent <= 25) return 25;
  if (milestonePercent <= 50) return 50;
  if (milestonePercent <= 75) return 75;
  return 100;
}

export function getPostcardSpeciesType(
  spiritAnimal: string,
): PostcardSpeciesTag {
  const animal = spiritAnimal?.toLowerCase() || "";

  if (
    [
      "whale",
      "dolphin",
      "shark",
      "fish",
      "octopus",
      "jellyfish",
      "seahorse",
      "turtle",
      "seal",
      "otter",
      "penguin",
      "ray",
      "eel",
    ].some((candidate) => animal.includes(candidate))
  ) {
    return "aquatic";
  }

  if (
    [
      "eagle",
      "hawk",
      "owl",
      "phoenix",
      "dragon",
      "butterfly",
      "hummingbird",
      "raven",
      "crow",
      "falcon",
      "dove",
      "swan",
      "bat",
      "moth",
      "firefly",
      "parrot",
      "crane",
      "heron",
    ].some((candidate) => animal.includes(candidate))
  ) {
    return "flying";
  }

  if (
    [
      "unicorn",
      "griffin",
      "chimera",
      "sphinx",
      "basilisk",
      "hydra",
      "cerberus",
      "pegasus",
      "thunderbird",
      "kitsune",
    ].some((candidate) => animal.includes(candidate))
  ) {
    return "mythic";
  }

  return "land";
}

function compatibleLocations(
  locations: PostcardLocation[],
  speciesType: PostcardSpeciesTag,
): PostcardLocation[] {
  const compatible = locations.filter((location) =>
    !location.tags?.length ||
    location.tags.includes(speciesType) ||
    location.tags.includes("all")
  );
  return compatible.length > 0 ? compatible : locations;
}

export function selectDeterministicPostcardLocation(input: {
  locations: PostcardLocation[];
  bonusLocations?: PostcardLocation[];
  speciesType: PostcardSpeciesTag;
  seed: string;
  excludedNames?: string[];
}): PostcardLocation {
  const tierPool = compatibleLocations(input.locations, input.speciesType);
  const bonusPool = compatibleLocations(
    input.bonusLocations ?? [],
    input.speciesType,
  );
  const useBonus = bonusPool.length > 0 &&
    stableHash(`${input.seed}:pool`) % 5 === 0;
  const preferredPool = useBonus ? bonusPool : tierPool;
  const alternatePool = useBonus ? tierPool : bonusPool;
  const excluded = new Set(
    (input.excludedNames ?? []).map((name) => name.toLowerCase()),
  );
  const unusedPool = preferredPool.filter((location) =>
    !excluded.has(location.name.toLowerCase())
  );
  const unusedAlternatePool = alternatePool.filter((location) =>
    !excluded.has(location.name.toLowerCase())
  );
  const pool = unusedPool.length > 0
    ? unusedPool
    : unusedAlternatePool.length > 0
    ? unusedAlternatePool
    : preferredPool.length > 0
    ? preferredPool
    : tierPool;

  if (pool.length === 0) {
    throw new Error("No postcard locations are configured");
  }

  return pool[stableHash(`${input.seed}:location`) % pool.length];
}

function describe(value: string | null | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

export function buildCosmicPostcardImagePrompt(input: {
  location: PostcardLocation;
  companion: PostcardCompanionIdentity;
}): string {
  const { companion, location } = input;

  return `Create a premium Cosmiq travel-postcard illustration by placing the EXACT companion from the reference image in this destination.

DESTINATION
${location.name}: ${location.description}

IDENTITY LOCK — preserve exactly
- One companion only: the same ${companion.spiritAnimal}, never a redesign or evolution.
- Preserve the exact face, anatomy, silhouette, proportions, markings, colors, accessories, and elemental identity from the reference.
- Preserve the source image's polished 2D/2.5D fantasy game illustration medium and rendering language.
- Eye color: ${describe(companion.eyeColor, "match the reference exactly")}.
- Fur, feather, scale, or skin color and texture: ${
    describe(companion.furColor, "match the reference exactly")
  }.
- Signature color: ${
    describe(companion.favoriteColor, "match the reference exactly")
  }.

SERIES CONTINUITY
- Match the same soft-cinematic 2D/2.5D fantasy game art direction, material detail, restrained particle density, and luminous rim-light language used across every Cosmiq companion scene.
- This should read as another frame from the same world and the same production art bible, never a new franchise or artist interpretation.

COMPOSITION
- Cinematic 4:3 landscape with a readable foreground, midground, and background.
- Show the companion's full body at roughly 35–45% of the frame, near the center or lower third, with generous safe margins and no cropping.
- Place the companion naturally in the environment with convincing contact shadows, reflections, and lighting.
- Keep the destination palette secondary to the companion so the companion remains immediately recognizable.
- Use restrained atmosphere and subtle ${
    describe(companion.coreElement, "elemental")
  } accents; the effects may support the scene but must not cover or transform the companion.
- Make it feel like a treasured, cinematic travel memory from one unified Cosmiq art world.

DO NOT INCLUDE
- Text, letters, captions, logos, watermarks, stamps, borders, frames, or UI.
- Duplicate companions, extra creatures that resemble the companion, extra limbs, extra heads, anatomy errors, costume changes, or style drift.
- Photorealism, 3D toy rendering, flat clip art, or a different illustration medium from the reference.

Return the finished image only.`;
}

export function normalizeGeneratedNarrative(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .replace(/^```(?:text|markdown)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .replace(/^#{1,6}\s+.*$/gm, "")
    .trim();
  return normalized.length > 0 ? normalized : null;
}

export function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}
