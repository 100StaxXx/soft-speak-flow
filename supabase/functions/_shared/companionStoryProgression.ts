export interface CompanionStoryTier {
  name:
    | "Egg"
    | "Hatchling"
    | "Initiate"
    | "Awakened"
    | "Guardian"
    | "Champion"
    | "Mythic"
    | "Ascended";
  theme: string;
  stakes: string;
  directive: string;
}

const STORY_TIERS: Array<CompanionStoryTier & { min: number; max: number }> = [
  {
    min: 0,
    max: 0,
    name: "Egg",
    theme: "Fate sleeping; an origin full of quiet potential",
    stakes: "an intimate discovery with wonder rather than danger",
    directive:
      "The companion is still an elemental egg. Do not depict or name a formed creature; focus on warmth, subtle movement, inner light, and the promise of a first bond.",
  },
  {
    min: 1,
    max: 4,
    name: "Hatchling",
    theme: "First awakening and vulnerable courage",
    stakes:
      "a local, natural challenge that feels large to a newly hatched companion",
    directive:
      "At level 1, show the first hatching. Keep the companion small, young, species-faithful, and clearly recognizable.",
  },
  {
    min: 5,
    max: 12,
    name: "Initiate",
    theme: "Curiosity becoming deliberate practice",
    stakes: "a meaningful first trial, puzzle, or magical obstacle",
    directive:
      "Show skill beginning to form through practice, restraint, and a conscious choice—not sudden mastery.",
  },
  {
    min: 13,
    max: 20,
    name: "Awakened",
    theme: "Identity, pattern recognition, and awakened purpose",
    stakes:
      "a named danger or revelation that tests what the pair now understands",
    directive:
      "Reveal a deeper pattern in the world and let the companion act from an emerging sense of identity.",
  },
  {
    min: 21,
    max: 35,
    name: "Guardian",
    theme: "Responsibility and the vow to protect what matters",
    stakes: "a consequential threat to a person, place, promise, or community",
    directive:
      "Power is expressed through protection and judgment. The pair must accept responsibility, not simply win a fight.",
  },
  {
    min: 36,
    max: 55,
    name: "Champion",
    theme: "Mastery, earned confidence, and worthy opposition",
    stakes:
      "a formidable rival or high-stakes challenge requiring practiced mastery",
    directive:
      "Show earned competence under pressure while preserving vulnerability and the need for cooperation.",
  },
  {
    min: 56,
    max: 80,
    name: "Mythic",
    theme: "Legacy, ancient forces, and choices that outlive the moment",
    stakes: "an ancient or legendary force with lasting consequences",
    directive:
      "Expand the mythology and ask what legacy the pair will leave. Keep the emotional conflict personal even when the scale is vast.",
  },
  {
    min: 81,
    max: 100,
    name: "Ascended",
    theme: "Integration, quiet command, and purpose fully inhabited",
    stakes:
      "a cosmic or civilization-scale choice resolved through wisdom as much as power",
    directive:
      "The companion is majestic but not unrecognizable. Favor integrated mastery and intimate emotional truth over empty spectacle.",
  },
];

export function resolveCompanionStoryTier(level: number): CompanionStoryTier {
  if (!Number.isInteger(level) || level < 0 || level > 100) {
    throw new Error("stage must be an integer between 0 and 100");
  }

  const tier = STORY_TIERS.find(({ min, max }) => level >= min && level <= max);
  if (!tier) {
    throw new Error("No companion story tier is configured for this stage");
  }
  const { min: _min, max: _max, ...storyTier } = tier;
  return storyTier;
}
