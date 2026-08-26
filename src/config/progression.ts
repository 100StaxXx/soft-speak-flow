export type ProgressionTier =
  | "egg"
  | "hatchling"
  | "initiate"
  | "awakened"
  | "guardian"
  | "champion"
  | "mythic"
  | "ascended";

export interface ProgressionThreshold {
  level: number;
  xpRequired: number;
  tier: ProgressionTier;
  evolvesAtBoundary: boolean;
}

export interface ProgressionVisualStage {
  stage: number;
  tier: ProgressionTier;
  label: string;
  levelStart: number;
  levelEnd: number;
}

export const PROGRESSION_LEVEL_CAP = 100;
export const HATCH_READY_LEVEL = 1;
export const REFERRAL_REWARD_LEVEL = 5;
export const PROGRESSION_ACHIEVEMENT_LEVELS = [5, 21, 56, 100] as const;
export const PROGRESSION_STORY_CHECKPOINT_LEVELS = [0, 1, 5, 13, 21, 36, 56, 81] as const;

export const PROGRESSION_TIER_LABELS: Record<ProgressionTier, string> = {
  egg: "Beginning",
  hatchling: "Young",
  initiate: "Growing",
  awakened: "Rooted",
  guardian: "Steady",
  champion: "Flourishing",
  mythic: "Majestic",
  ascended: "Grand",
};

export const PROGRESSION_TIER_BANDS = [
  { tier: "egg", levelStart: 0, levelEnd: 0 },
  { tier: "hatchling", levelStart: 1, levelEnd: 4 },
  { tier: "initiate", levelStart: 5, levelEnd: 12 },
  { tier: "awakened", levelStart: 13, levelEnd: 20 },
  { tier: "guardian", levelStart: 21, levelEnd: 35 },
  { tier: "champion", levelStart: 36, levelEnd: 55 },
  { tier: "mythic", levelStart: 56, levelEnd: 80 },
  { tier: "ascended", levelStart: 81, levelEnd: 100 },
] as const satisfies ReadonlyArray<{
  tier: ProgressionTier;
  levelStart: number;
  levelEnd: number;
}>;

export const PROGRESSION_VISUAL_STAGES = PROGRESSION_TIER_BANDS.map((band, stage) => ({
  stage,
  tier: band.tier,
  label: PROGRESSION_TIER_LABELS[band.tier],
  levelStart: band.levelStart,
  levelEnd: band.levelEnd,
})) satisfies ReadonlyArray<ProgressionVisualStage>;

export const PROGRESSION_VISUAL_BOUNDARY_LEVELS = PROGRESSION_VISUAL_STAGES
  .map((visualStage) => visualStage.levelStart)
  .filter((level) => level > 0);

export const PROGRESSION_XP_THRESHOLDS = {
  0: 0,
  1: 10,
  2: 30,
  3: 60,
  4: 80,
  5: 100,
  6: 240,
  7: 380,
  8: 510,
  9: 650,
  10: 790,
  11: 930,
  12: 1060,
  13: 1200,
  14: 1550,
  15: 1900,
  16: 2250,
  17: 2600,
  18: 2950,
  19: 3300,
  20: 3650,
  21: 4000,
  22: 4400,
  23: 4800,
  24: 5200,
  25: 5600,
  26: 6000,
  27: 6400,
  28: 6800,
  29: 7200,
  30: 7600,
  31: 8000,
  32: 8400,
  33: 8800,
  34: 9200,
  35: 9600,
  36: 10000,
  37: 10500,
  38: 11000,
  39: 11500,
  40: 12000,
  41: 12500,
  42: 13000,
  43: 13500,
  44: 14000,
  45: 14500,
  46: 15000,
  47: 15500,
  48: 16000,
  49: 16500,
  50: 17000,
  51: 17500,
  52: 18000,
  53: 18500,
  54: 19000,
  55: 19500,
  56: 20000,
  57: 20400,
  58: 20800,
  59: 21200,
  60: 21600,
  61: 22000,
  62: 22400,
  63: 22800,
  64: 23200,
  65: 23600,
  66: 24000,
  67: 24400,
  68: 24800,
  69: 25200,
  70: 25600,
  71: 26000,
  72: 26400,
  73: 26800,
  74: 27200,
  75: 27600,
  76: 28000,
  77: 28400,
  78: 28800,
  79: 29200,
  80: 29600,
  81: 30000,
  82: 30420,
  83: 30840,
  84: 31260,
  85: 31680,
  86: 32110,
  87: 32530,
  88: 32950,
  89: 33370,
  90: 33790,
  91: 34210,
  92: 34630,
  93: 35050,
  94: 35470,
  95: 35890,
  96: 36320,
  97: 36740,
  98: 37160,
  99: 37580,
  100: 38000,
} as const satisfies Record<number, number>;

export const clampProgressionLevel = (level: number): number =>
  Math.max(0, Math.min(PROGRESSION_LEVEL_CAP, Math.floor(Number.isFinite(level) ? level : 0)));

export const getProgressionTier = (level: number): ProgressionTier => {
  const safeLevel = clampProgressionLevel(level);
  return (
    PROGRESSION_TIER_BANDS.find(
      (band) => safeLevel >= band.levelStart && safeLevel <= band.levelEnd,
    )?.tier ?? "egg"
  );
};

export const getProgressionTierLabel = (tier: ProgressionTier): string =>
  PROGRESSION_TIER_LABELS[tier];

export const getProgressionTierLabelForLevel = (level: number): string =>
  getProgressionTierLabel(getProgressionTier(level));

export const getProgressionLevelLabel = (level: number): string =>
  `Level ${clampProgressionLevel(level)}`;

export const getProgressionLevelAndTierDisplay = (level: number): string =>
  `${getProgressionLevelLabel(level)} • ${getProgressionTierLabelForLevel(level)}`;

const getThresholdKey = (
  level: number,
): keyof typeof PROGRESSION_XP_THRESHOLDS => clampProgressionLevel(level) as keyof typeof PROGRESSION_XP_THRESHOLDS;

export const getProgressionThreshold = (level: number): number | null =>
  PROGRESSION_XP_THRESHOLDS[getThresholdKey(level)] ?? null;

export const getProgressionLevelDisplay = (level: number): string =>
  `Stage ${clampProgressionLevel(level)} • ${getProgressionTierLabelForLevel(level)}`;

export const getVisualStage = (level: number): number => {
  const safeLevel = clampProgressionLevel(level);
  return (
    PROGRESSION_VISUAL_STAGES.find(
      (visualStage) => safeLevel >= visualStage.levelStart && safeLevel <= visualStage.levelEnd,
    )?.stage ?? 0
  );
};

export const getVisualStageLabelForLevel = (level: number): string =>
  getProgressionTierLabelForLevel(level);

export const getVisualStageDisplay = (level: number): string =>
  `Stage ${getVisualStage(level)} • ${getVisualStageLabelForLevel(level)}`;

export const getNextProgressionLevel = (level: number): number | null => {
  const safeLevel = clampProgressionLevel(level);
  if (safeLevel >= PROGRESSION_LEVEL_CAP) return null;
  return safeLevel + 1;
};

export const getNextProgressionLevelXp = (level: number): number | null => {
  const nextLevel = getNextProgressionLevel(level);
  return nextLevel === null ? null : getProgressionThreshold(nextLevel);
};

export const getNextTierBoundary = (level: number): number | null => {
  const safeLevel = clampProgressionLevel(level);
  return PROGRESSION_TIER_BANDS.find((band) => band.levelStart > safeLevel)?.levelStart ?? null;
};

export const getNextVisualStageBoundaryLevel = (level: number): number | null => {
  const safeLevel = clampProgressionLevel(level);
  return PROGRESSION_VISUAL_STAGES.find((visualStage) => visualStage.levelStart > safeLevel)?.levelStart ?? null;
};

export const getCurrentVisualStageBoundaryLevel = (level: number): number => {
  const safeLevel = clampProgressionLevel(level);
  const currentVisualStage = [...PROGRESSION_VISUAL_STAGES]
    .reverse()
    .find((visualStage) => safeLevel >= visualStage.levelStart);

  return currentVisualStage?.levelStart ?? 0;
};

export const getNextUnclaimedVisualStageBoundaryLevel = (
  claimedLevel: number,
  earnedLevel: number,
): number | null => {
  const safeClaimedLevel = clampProgressionLevel(claimedLevel);
  const safeEarnedLevel = clampProgressionLevel(earnedLevel);

  return PROGRESSION_VISUAL_STAGES.find(
    (visualStage) =>
      visualStage.levelStart > safeClaimedLevel &&
      visualStage.levelStart <= safeEarnedLevel,
  )?.levelStart ?? null;
};

export const getPendingVisualStageBoundaryCount = (
  claimedLevel: number,
  earnedLevel: number,
): number => {
  const safeClaimedLevel = clampProgressionLevel(claimedLevel);
  const safeEarnedLevel = clampProgressionLevel(earnedLevel);

  return PROGRESSION_VISUAL_STAGES.filter(
    (visualStage) =>
      visualStage.levelStart > safeClaimedLevel &&
      visualStage.levelStart <= safeEarnedLevel,
  ).length;
};

export const isTierBoundaryLevel = (level: number): boolean => {
  const safeLevel = clampProgressionLevel(level);
  if (safeLevel <= 0) return false;
  return PROGRESSION_TIER_BANDS.some((band) => band.levelStart === safeLevel);
};

export const didTierChange = (levelBefore: number, levelAfter: number): boolean =>
  getProgressionTier(levelBefore) !== getProgressionTier(levelAfter);

export const resolveProgressionLevelFromXp = (xp: number): number => {
  const safeXp = Number.isFinite(xp) ? Math.max(0, Math.floor(xp)) : 0;
  let resolvedLevel = 0;

  for (const [levelKey, xpRequired] of Object.entries(PROGRESSION_XP_THRESHOLDS)) {
    const level = Number(levelKey);
    if (safeXp >= xpRequired) {
      resolvedLevel = level;
    }
  }

  return clampProgressionLevel(resolvedLevel);
};

export const getProgressPercentToNextLevel = (currentLevel: number, currentXp: number): number => {
  const safeLevel = clampProgressionLevel(currentLevel);
  const currentLevelXp = getProgressionThreshold(safeLevel) ?? 0;
  const nextLevelXp = getNextProgressionLevelXp(safeLevel);

  if (nextLevelXp === null) return 100;

  const range = nextLevelXp - currentLevelXp;
  if (range <= 0) return 100;

  const safeXp = Number.isFinite(currentXp) ? Math.max(0, currentXp) : 0;
  return Math.min(100, Math.max(0, ((safeXp - currentLevelXp) / range) * 100));
};

export const PROGRESSION_THRESHOLDS: readonly ProgressionThreshold[] = Array.from(
  { length: PROGRESSION_LEVEL_CAP + 1 },
  (_, level) => ({
    level,
    xpRequired: PROGRESSION_XP_THRESHOLDS[getThresholdKey(level)] ?? 0,
    tier: getProgressionTier(level),
    evolvesAtBoundary: isTierBoundaryLevel(level),
  }),
);
