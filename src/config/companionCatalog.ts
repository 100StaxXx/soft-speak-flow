import {
  PROGRESSION_ACHIEVEMENT_LEVELS,
  PROGRESSION_LEVEL_CAP,
  PROGRESSION_THRESHOLDS,
  PROGRESSION_XP_THRESHOLDS,
  clampProgressionLevel,
  getProgressionThreshold,
  getProgressionTier,
  getProgressionTierLabelForLevel,
  resolveProgressionLevelFromXp,
  type ProgressionTier,
} from "./progression";

export const COMPANION_PRESET_BUCKET = "companion-presets";
export const COMPANION_PREVIEW_TIER = "t1_hatchling" as const;
export const MAX_COMPANION_STAGE = PROGRESSION_LEVEL_CAP;

export const COMPANION_STAGE_NAMES = Object.fromEntries(
  PROGRESSION_THRESHOLDS.map(({ level, tier }) => [level, getProgressionTierLabelForLevel(level)]),
) as Record<number, string>;

export const COMPANION_XP_THRESHOLDS = { ...PROGRESSION_XP_THRESHOLDS } as const satisfies Record<number, number>;

export const COMPANION_BADGE_MILESTONES = PROGRESSION_ACHIEVEMENT_LEVELS;

export type CompanionPresetId =
  | "dragon"
  | "wolf"
  | "fox"
  | "owl"
  | "lion"
  | "phoenix"
  | "pegasus"
  | "griffin"
  | "sphinx"
  | "leviathan"
  | "mechanicaldragon"
  | "tanuki"
  | "raven"
  | "buttercat";

export type CompanionElementId =
  | "fire"
  | "ice"
  | "storm"
  | "nature"
  | "void"
  | "light";

export type CompanionVisualState = "normal" | "neglected" | "dormant";

export type CompanionArtTier =
  | "t0_egg"
  | "t1_hatchling"
  | "t2_initiate"
  | "t3_awakened"
  | "t4_guardian"
  | "t5_champion"
  | "t6_mythic"
  | "t7_ascended";

export type CompanionStoryTone =
  | "soft_gentle"
  | "epic_adventure"
  | "emotional_heartfelt"
  | "dark_intense"
  | "whimsical_playful";

export interface CompanionPresetDefinition {
  id: CompanionPresetId;
  displayName: string;
  carouselOrder: number;
  role: string;
  signatureIdentity: string;
  anatomyLock: string;
  revealCopy: string;
}

export interface CompanionElementDefinition {
  id: CompanionElementId;
  label: string;
  productLabel: string;
  anchorColor: string;
  accentColor: string;
  summary: string;
}

export interface CompanionStoryToneDefinition {
  value: CompanionStoryTone;
  label: string;
  summary: string;
}

export const COMPANION_PRESETS: readonly CompanionPresetDefinition[] = [
  {
    id: "dragon",
    displayName: "Dragon",
    carouselOrder: 1,
    role: "flagship mythic",
    signatureIdentity: "western dragon silhouette, swept horns, luminous chest core, long tail",
    anatomyLock: "4 legs + 2 wings; no feathers",
    revealCopy: "Ancient, bold, and born for legendary arcs.",
  },
  {
    id: "wolf",
    displayName: "Wolf",
    carouselOrder: 2,
    role: "grounded protector",
    signatureIdentity: "thick neck ruff, alert ears, confident forward stance",
    anatomyLock: "4 legs; no wings",
    revealCopy: "Loyal, sharp, and steady through every trial.",
  },
  {
    id: "fox",
    displayName: "Kitsune",
    carouselOrder: 3,
    role: "mystic trickster",
    signatureIdentity: "fox spirit silhouette, oversized ears, luminous cheek markings, and a flowing tail fan",
    anatomyLock: "4 legs; fox silhouette with magical tails",
    revealCopy: "Mystical, clever, and lit by fox-fire.",
  },
  {
    id: "owl",
    displayName: "Owl",
    carouselOrder: 4,
    role: "quiet oracle",
    signatureIdentity: "round facial disk, ear tufts, bright moon-eyes",
    anatomyLock: "2 legs + 2 wings",
    revealCopy: "Watchful, wise, and calm under moonlit pressure.",
  },
  {
    id: "lion",
    displayName: "Lion",
    carouselOrder: 5,
    role: "regal guardian",
    signatureIdentity: "solar mane, broad paws, tufted tail",
    anatomyLock: "4 legs; no wings",
    revealCopy: "Majestic, brave, and built to hold the line.",
  },
  {
    id: "phoenix",
    displayName: "Phoenix",
    carouselOrder: 6,
    role: "rebel mythic",
    signatureIdentity: "flame crest, ember tail streamers, radiant wing edges",
    anatomyLock: "2 legs + 2 wings",
    revealCopy: "Fiery, defiant, and impossible to keep down.",
  },
  {
    id: "pegasus",
    displayName: "Pegasus",
    carouselOrder: 7,
    role: "noble aspirational",
    signatureIdentity: "feathered wings, windswept mane, athletic horse build",
    anatomyLock: "4 legs + 2 wings; no horn",
    revealCopy: "Graceful, bright, and always reaching upward.",
  },
  {
    id: "griffin",
    displayName: "Griffin",
    carouselOrder: 8,
    role: "skybound sentinel",
    signatureIdentity: "eagle beak, feathered forequarters, leonine hindquarters, proud hybrid silhouette",
    anatomyLock: "4 lion legs + 2 feathered wings + eagle head",
    revealCopy: "Regal, fierce, and born to guard the high places.",
  },
  {
    id: "sphinx",
    displayName: "Sphinx",
    carouselOrder: 9,
    role: "enigmatic oracle",
    signatureIdentity: "lion body, feathered wings, poised regal posture, knowing gaze",
    anatomyLock: "4 lion legs + 2 feathered wings; no beak",
    revealCopy: "Ancient, unreadable, and full of hidden answers.",
  },
  {
    id: "leviathan",
    displayName: "Leviathan",
    carouselOrder: 10,
    role: "abyssal legend",
    signatureIdentity: "serpentine body, fin-frill silhouette, luminous gill lines",
    anatomyLock: "aquatic serpent; no legs",
    revealCopy: "Deep, colossal, and pulled from ancient tides.",
  },
  {
    id: "mechanicaldragon",
    displayName: "Mechanical Dragon",
    carouselOrder: 11,
    role: "forged mythic",
    signatureIdentity: "clockwork dragon silhouette, plated alloy scales, articulated wings, glowing reactor core",
    anatomyLock: "4 legs + 2 wings; fully mechanical body with no organic traits",
    revealCopy: "Forged, relentless, and humming with engineered fire.",
  },
  {
    id: "tanuki",
    displayName: "Tanuki",
    carouselOrder: 12,
    role: "playful shapeshifter",
    signatureIdentity: "round canine body, dark eye mask, plush striped tail, mischievous expression",
    anatomyLock: "4 legs; raccoon-dog silhouette with no wings",
    revealCopy: "Wry, cozy, and always halfway into a trick.",
  },
  {
    id: "buttercat",
    displayName: "Buttercat",
    carouselOrder: 13,
    role: "whimsical rare",
    signatureIdentity: "cat face, butterfly wings, soft antennae optional, plush tail",
    anatomyLock: "4 cat legs + 2 butterfly wings; no insect eyes",
    revealCopy: "Dreamy, playful, and delightfully strange.",
  },
] as const;

export const LEGACY_COMPANION_PRESETS: readonly CompanionPresetDefinition[] = [
  {
    id: "raven",
    displayName: "Raven",
    carouselOrder: 14,
    role: "shadow scout",
    signatureIdentity: "sleek hooked beak, iridescent neck sheen, intelligent stare",
    anatomyLock: "2 legs + 2 wings",
    revealCopy: "Clever, mysterious, and always one step ahead.",
  },
] as const;

export const COMPANION_ONBOARDING_SILHOUETTE_SOURCES = {
  dragon: "/onboarding/locked-species-silhouettes/dragon.png",
  wolf: "/onboarding/locked-species-silhouettes/wolf.png",
  fox: "/onboarding/locked-species-silhouettes/fox.png",
  owl: "/onboarding/locked-species-silhouettes/owl.png",
  lion: "/onboarding/locked-species-silhouettes/lion.png",
  phoenix: "/onboarding/locked-species-silhouettes/phoenix.png",
  pegasus: "/onboarding/locked-species-silhouettes/pegasus.png",
  griffin: "/onboarding/locked-species-silhouettes/griffin.png",
  sphinx: "/onboarding/locked-species-silhouettes/sphinx.png",
  leviathan: "/onboarding/locked-species-silhouettes/leviathan.png",
  mechanicaldragon: "/onboarding/locked-species-silhouettes/mechanicaldragon.png",
  tanuki: "/onboarding/locked-species-silhouettes/tanuki.png",
  buttercat: "/onboarding/locked-species-silhouettes/buttercat.png",
} as const satisfies Partial<Record<CompanionPresetId, string>>;

const ALL_COMPANION_PRESETS: readonly CompanionPresetDefinition[] = [
  ...COMPANION_PRESETS,
  ...LEGACY_COMPANION_PRESETS,
];

const COMPANION_PRESETS_WITH_FULL_REMOTE_ASSET_COVERAGE: readonly CompanionPresetId[] = [
  "dragon",
  "wolf",
  "fox",
  "owl",
  "lion",
  "phoenix",
  "pegasus",
  "raven",
  "leviathan",
  "buttercat",
] as const;

export const COMPANION_PRESETS_WITH_BUNDLED_YOUTH_ASSETS: readonly CompanionPresetId[] = [
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
] as const;

const COMPANION_PRESETS_WITH_INITIATE_NORMAL_REMOTE_ASSETS: readonly CompanionPresetId[] = [
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
] as const;

export const COMPANION_ELEMENTS: readonly CompanionElementDefinition[] = [
  {
    id: "fire",
    label: "Fire",
    productLabel: "Ember",
    anchorColor: "#F97316",
    accentColor: "#FDBA74",
    summary: "Molten highlights and ember heat.",
  },
  {
    id: "ice",
    label: "Ice",
    productLabel: "Frost",
    anchorColor: "#60A5FA",
    accentColor: "#BFDBFE",
    summary: "Glacial blues and crisp luminous edges.",
  },
  {
    id: "storm",
    label: "Storm",
    productLabel: "Storm",
    anchorColor: "#38BDF8",
    accentColor: "#C4B5FD",
    summary: "Lightning charge, wind streaks, and electric skies.",
  },
  {
    id: "nature",
    label: "Nature",
    productLabel: "Terra",
    anchorColor: "#34D399",
    accentColor: "#86EFAC",
    summary: "Verdant glow, mossy warmth, and living energy.",
  },
  {
    id: "void",
    label: "Void",
    productLabel: "Void",
    anchorColor: "#7C3AED",
    accentColor: "#C084FC",
    summary: "Nebula shadows, deep contrast, and astral hush.",
  },
  {
    id: "light",
    label: "Light",
    productLabel: "Light",
    anchorColor: "#FACC15",
    accentColor: "#FDE68A",
    summary: "Radiant gold, halo shimmer, and celestial bloom.",
  },
] as const;

export const COMPANION_STORY_TONES: readonly CompanionStoryToneDefinition[] = [
  {
    value: "soft_gentle",
    label: "Soft & Gentle",
    summary: "Tender chapters with warmth and care.",
  },
  {
    value: "epic_adventure",
    label: "Epic Adventure",
    summary: "Cinematic growth with bold heroic stakes.",
  },
  {
    value: "emotional_heartfelt",
    label: "Emotional & Heartfelt",
    summary: "Bond-focused stories that lean into feeling.",
  },
  {
    value: "dark_intense",
    label: "Dark & Intense",
    summary: "Higher tension, shadowed trials, sharper drama.",
  },
  {
    value: "whimsical_playful",
    label: "Whimsical & Playful",
    summary: "Lighter wonder, odd magic, and bright turns.",
  },
] as const;

export const COMPANION_ART_TIER_RANGES: ReadonlyArray<{
  id: CompanionArtTier;
  label: string;
  stageStart: number;
  stageEnd: number;
}> = [
  { id: "t0_egg", label: "Egg", stageStart: 0, stageEnd: 0 },
  { id: "t1_hatchling", label: "Hatchling", stageStart: 1, stageEnd: 4 },
  { id: "t2_initiate", label: "Initiate", stageStart: 5, stageEnd: 12 },
  { id: "t3_awakened", label: "Awakened", stageStart: 13, stageEnd: 20 },
  { id: "t4_guardian", label: "Guardian", stageStart: 21, stageEnd: 35 },
  { id: "t5_champion", label: "Champion", stageStart: 36, stageEnd: 55 },
  { id: "t6_mythic", label: "Mythic", stageStart: 56, stageEnd: 80 },
  { id: "t7_ascended", label: "Ascended", stageStart: 81, stageEnd: 100 },
] as const;

const ALL_COMPANION_VISUAL_STATES: readonly CompanionVisualState[] = [
  "normal",
  "neglected",
  "dormant",
] as const;

const ELEMENT_ALIASES: Record<string, CompanionElementId> = {
  fire: "fire",
  water: "ice",
  ice: "ice",
  frost: "ice",
  lightning: "storm",
  storm: "storm",
  air: "storm",
  earth: "nature",
  nature: "nature",
  shadow: "void",
  dark: "void",
  void: "void",
  cosmic: "void",
  light: "light",
};

// Preserve the launch storage slug while supporting the Kitsune brand in inputs.
const PRESET_ALIASES: Record<string, CompanionPresetId> = {
  kitsune: "fox",
};

const PRESET_LOOKUP = new Map(
  ALL_COMPANION_PRESETS.map((preset) => [preset.id, preset] as const),
);

const ELEMENT_LOOKUP = new Map(
  COMPANION_ELEMENTS.map((element) => [element.id, element] as const),
);

export type CompanionStorageArtTier =
  | "t0_egg"
  | "t1_youth"
  | "t2_guardian"
  | "t3_champion"
  | "t4_mythic"
  | "t5_apex";

const COMPANION_ART_TIER_STORAGE_FALLBACKS: Record<CompanionArtTier, CompanionStorageArtTier> = {
  t0_egg: "t0_egg",
  t1_hatchling: "t1_youth",
  t2_initiate: "t2_guardian",
  t3_awakened: "t2_guardian",
  t4_guardian: "t3_champion",
  t5_champion: "t4_mythic",
  t6_mythic: "t5_apex",
  t7_ascended: "t5_apex",
};

const buildRemoteCompanionPresetAssetCoverageKey = ({
  presetId,
  tier,
  state,
}: {
  presetId: CompanionPresetId;
  tier: CompanionArtTier;
  state: CompanionVisualState;
}): string => `${presetId}:${tier}:${state}`;

const REMOTE_COMPANION_PRESET_ASSET_COVERAGE = new Set<string>([
  ...COMPANION_PRESETS_WITH_FULL_REMOTE_ASSET_COVERAGE.flatMap((presetId) =>
    COMPANION_ART_TIER_RANGES.flatMap(({ id: tier }) =>
      ALL_COMPANION_VISUAL_STATES.map((state) =>
        buildRemoteCompanionPresetAssetCoverageKey({
          presetId,
          tier,
          state,
        }),
      ),
    ),
  ),
  ...COMPANION_PRESETS_WITH_INITIATE_NORMAL_REMOTE_ASSETS.map((presetId) =>
    buildRemoteCompanionPresetAssetCoverageKey({
      presetId,
      tier: "t2_initiate",
      state: "normal",
    })),
]);

const normalizeKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export const getCompanionStageName = (stage: number): string =>
  getProgressionTierLabelForLevel(stage);

export const getCompanionStageThreshold = (stage: number): number | null =>
  getProgressionThreshold(stage);

export const getMaxCompanionXpThreshold = (): number =>
  getProgressionThreshold(MAX_COMPANION_STAGE) ?? 0;

export const resolveCompanionStageFromXp = (xp: number): number =>
  resolveProgressionLevelFromXp(xp);

export const getCompanionStoryTheme = (stage: number): string => {
  switch (getProgressionTier(stage)) {
    case "egg":
      return "Fate sleeping";
    case "hatchling":
      return "First awakening";
    case "initiate":
      return "A first calling";
    case "awakened":
      return "Power stirring";
    case "guardian":
      return "A vow to protect";
    case "champion":
      return "Victory calls";
    case "mythic":
      return "Legend gathering";
    case "ascended":
      return "Beyond the horizon";
    default:
      return "Mythic growth";
  }
};

export const coerceCompanionPresetId = (value: string | null | undefined): CompanionPresetId | null => {
  if (!value) return null;
  const normalized = normalizeKey(value);
  const resolved = PRESET_ALIASES[normalized] ?? normalized;
  if (PRESET_LOOKUP.has(resolved as CompanionPresetId)) {
    return resolved as CompanionPresetId;
  }
  return null;
};

export const coerceCompanionElementId = (value: string | null | undefined): CompanionElementId => {
  const normalized = value ? normalizeKey(value) : "";
  return ELEMENT_ALIASES[normalized] ?? "fire";
};

export const getCompanionPreset = (presetId: string | null | undefined): CompanionPresetDefinition | null => {
  const normalized = coerceCompanionPresetId(presetId);
  return normalized ? PRESET_LOOKUP.get(normalized) ?? null : null;
};

export const hasRemoteCompanionPresetAssetCoverage = ({
  presetId,
  tier,
  state,
}: {
  presetId: string | null | undefined;
  tier: CompanionArtTier;
  state: CompanionVisualState;
}): boolean => {
  const normalizedPresetId = coerceCompanionPresetId(presetId);
  if (!normalizedPresetId) return false;

  return REMOTE_COMPANION_PRESET_ASSET_COVERAGE.has(
    buildRemoteCompanionPresetAssetCoverageKey({
      presetId: normalizedPresetId,
      tier,
      state,
    }),
  );
};

export const hasRemoteCompanionPresetStageAssetCoverage = ({
  presetId,
  stage,
  state = "normal",
}: {
  presetId: string | null | undefined;
  stage: number;
  state?: CompanionVisualState;
}): boolean =>
  hasRemoteCompanionPresetAssetCoverage({
    presetId,
    tier: resolveCompanionArtTier(stage),
    state,
  });

export const hasBundledYouthCompanionPresetAssets = (presetId: CompanionPresetId): boolean =>
  COMPANION_PRESETS_WITH_BUNDLED_YOUTH_ASSETS.includes(presetId);

export const getCompanionElement = (elementId: string | null | undefined): CompanionElementDefinition => {
  const normalized = coerceCompanionElementId(elementId);
  return ELEMENT_LOOKUP.get(normalized) ?? COMPANION_ELEMENTS[0];
};

export const getCompanionElementProductLabel = (
  elementId: string | null | undefined,
): string => getCompanionElement(elementId).productLabel;

export const resolveCompanionArtTier = (stage: number): CompanionArtTier => {
  const safeStage = clampProgressionLevel(stage);
  return (
    COMPANION_ART_TIER_RANGES.find(
      (tier) => safeStage >= tier.stageStart && safeStage <= tier.stageEnd,
    )?.id ?? "t0_egg"
  );
};

export const resolveCompanionStorageArtTier = (stage: number): CompanionStorageArtTier =>
  COMPANION_ART_TIER_STORAGE_FALLBACKS[resolveCompanionArtTier(stage)];

export const buildCompanionPresetAssetFilename = ({
  presetId,
  tier,
  state,
  element,
}: {
  presetId: CompanionPresetId;
  tier: CompanionArtTier;
  state: CompanionVisualState;
  element: CompanionElementId;
}): string => {
  const storageTier = COMPANION_ART_TIER_STORAGE_FALLBACKS[tier];
  return `${presetId}__${storageTier}__${state}__${element}.png`;
};

export const buildCompanionPresetAssetPath = ({
  presetId,
  tier,
  state,
  element,
}: {
  presetId: CompanionPresetId;
  tier: CompanionArtTier;
  state: CompanionVisualState;
  element: CompanionElementId;
}): string => {
  const storageTier = COMPANION_ART_TIER_STORAGE_FALLBACKS[tier];
  return `${presetId}/${storageTier}/${state}/${buildCompanionPresetAssetFilename({ presetId, tier, state, element })}`;
};

export const resolveCompanionAssetPath = ({
  presetId,
  stage,
  state = "normal",
  element,
}: {
  presetId: CompanionPresetId;
  stage: number;
  state?: CompanionVisualState;
  element: CompanionElementId;
}): string =>
  buildCompanionPresetAssetPath({
    presetId,
    tier: resolveCompanionArtTier(stage),
    state,
    element,
  });

export const resolveCompanionCarouselAssetPath = ({
  presetId,
  element,
}: {
  presetId: CompanionPresetId;
  element: CompanionElementId;
}): string =>
  buildCompanionPresetAssetPath({
    presetId,
    tier: COMPANION_PREVIEW_TIER,
    state: "normal",
    element,
  });

export const resolveBundledYouthCompanionAssetPath = ({
  presetId,
  element,
}: {
  presetId: CompanionPresetId;
  element: CompanionElementId;
}): string =>
  buildCompanionPresetAssetPath({
    presetId,
    tier: COMPANION_PREVIEW_TIER,
    state: "normal",
    element,
  });

export const getCompanionElementAnchorColor = (elementId: string | null | undefined): string =>
  getCompanionElement(elementId).anchorColor;

export const getCompanionEvolutionCardRarity = (stage: number): string => {
  if (stage >= 81) return "Origin";
  if (stage >= 56) return "Primal";
  if (stage >= 36) return "Celestial";
  if (stage >= 21) return "Mythic";
  if (stage >= 13) return "Legendary";
  if (stage >= 5) return "Epic";
  if (stage >= 1) return "Rare";
  return "Common";
};
