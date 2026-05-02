import {
  COMPANION_ATTRIBUTE_LABELS,
  COMPANION_STAT_ATTRIBUTES,
  type CompanionMomentumState,
  type CompanionStatAttribute,
  type CompanionStatNeed,
  type CompanionStatProfileSummary,
} from "./companionStatSignals";
import type { OnboardingVisualPersona } from "./onboardingVisualPersona";

export type CompanionCosmiqTitleRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "cosmic";

export type CompanionCosmiqTitleMomentum =
  | "rising"
  | "steady"
  | "recovering"
  | "slipping";

export type CompanionCosmiqTitleStability =
  | "new"
  | "stable"
  | "at_risk"
  | "evolving";

export const COMPANION_COSMIQ_TITLE_CARD_PROMPT_VERSION = 1;

export type CompanionCosmiqTitleBand = "Emerging" | "Building" | "Strong" | "Exceptional";

export interface CompanionCosmiqTitle {
  title: string;
  rarity: CompanionCosmiqTitleRarity;
  momentum: CompanionCosmiqTitleMomentum;
  dominantStat: CompanionStatAttribute;
  secondaryStat: CompanionStatAttribute;
  rebalanceStat: CompanionStatAttribute;
  fusion: boolean;
  rebalancePath: string;
  titleStability: CompanionCosmiqTitleStability;
}

export interface CompanionCosmiqTitleCard {
  profileKey: string;
  imageUrl: string | null;
  imageUrls?: string[];
  status: "ready" | "generating" | "unavailable";
  cached: boolean;
  promptVersion: number;
}

export interface CompanionCosmiqTitlePreviousState {
  title: string;
  rarity: CompanionCosmiqTitleRarity;
}

export interface CompanionCosmiqTitleActivityMetrics {
  activeDays7: number;
  completionRate7: number;
  currentStreak: number;
  epicLinkedCompletions: number;
  totalRecentExpression: number;
}

interface CompanionCosmiqTitleStatBreakdownInput {
  attribute: CompanionStatAttribute;
  score: number;
  band: CompanionCosmiqTitleBand;
}

interface BuildCompanionCosmiqTitleInput {
  statProfile: CompanionStatProfileSummary;
  statNeeds?: Partial<Record<CompanionStatAttribute, CompanionStatNeed>> | null;
  statBreakdowns?: CompanionCosmiqTitleStatBreakdownInput[];
  momentumState: CompanionMomentumState;
  recentExpression?: Partial<Record<CompanionStatAttribute, number>> | null;
  activityMetrics?: Partial<CompanionCosmiqTitleActivityMetrics> | null;
  previousTitle?: CompanionCosmiqTitlePreviousState | null;
}

export interface CompanionFantasyTitleAlias {
  title: string;
  archetype: string;
  explanation: string;
}

const RARITY_ORDER: CompanionCosmiqTitleRarity[] = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "cosmic",
];

const RARITY_RANK: Record<CompanionCosmiqTitleRarity, number> = Object.fromEntries(
  RARITY_ORDER.map((rarity, index) => [rarity, index]),
) as Record<CompanionCosmiqTitleRarity, number>;

const TITLE_POOLS: Record<
  CompanionStatAttribute,
  Record<CompanionCosmiqTitleBand, string> & { rareVariants: string[] }
> = {
  vitality: {
    Emerging: "The Waking Flame",
    Building: "The Life-Bound Strider",
    Strong: "The Verdant Guardian",
    Exceptional: "The Radiant Vanguard",
    rareVariants: [
      "Sunforged Sentinel",
      "The Blooming Titan",
      "The Dawn-Walker",
    ],
  },
  wisdom: {
    Emerging: "The Curious Seeker",
    Building: "The Pattern Reader",
    Strong: "The Astral Scholar",
    Exceptional: "The Celestial Sage",
    rareVariants: [
      "The Star-Eyed Oracle",
      "The Mindbound Seer",
      "Keeper of the Inner Map",
    ],
  },
  discipline: {
    Emerging: "The Promise Keeper",
    Building: "The Iron Apprentice",
    Strong: "The Steady Sentinel",
    Exceptional: "The Oathbound Champion",
    rareVariants: [
      "The Unbroken Knight",
      "The Clockwork Guardian",
      "The Iron-Willed Architect",
    ],
  },
  resolve: {
    Emerging: "The Rising Survivor",
    Building: "The Ember-Warden",
    Strong: "The Ironheart",
    Exceptional: "The Storm-Breaker",
    rareVariants: [
      "The Scarred Champion",
      "The Phoenix-Bound",
      "The Void-Walker",
    ],
  },
  creativity: {
    Emerging: "The Spark Crafter",
    Building: "The Dreamsmith",
    Strong: "The Vision Forger",
    Exceptional: "The Mythmaker",
    rareVariants: [
      "The Starforged Creator",
      "The Painted Flame",
      "The Reality Weaver",
    ],
  },
  alignment: {
    Emerging: "The Inner Compass",
    Building: "The Path Finder",
    Strong: "The Soulbound Guide",
    Exceptional: "The Cosmic Harmonizer",
    rareVariants: [
      "The True North",
      "The Heartbound Voyager",
      "The Purpose-Bearer",
    ],
  },
};

const FUSION_TITLES: Partial<Record<`${CompanionStatAttribute}:${CompanionStatAttribute}`, string>> = {
  "vitality:discipline": "The Iron Vanguard",
  "discipline:vitality": "The Iron Vanguard",
  "vitality:resolve": "The Storm-Hardened Titan",
  "resolve:vitality": "The Storm-Hardened Titan",
  "wisdom:creativity": "The Reality Weaver",
  "creativity:wisdom": "The Reality Weaver",
  "wisdom:discipline": "The Clockwork Sage",
  "discipline:wisdom": "The Clockwork Sage",
  "discipline:resolve": "The Unbroken Sentinel",
  "resolve:discipline": "The Unbroken Sentinel",
  "creativity:alignment": "The Soulforged Creator",
  "alignment:creativity": "The Soulforged Creator",
  "alignment:wisdom": "The Inner Oracle",
  "wisdom:alignment": "The Inner Oracle",
  "alignment:discipline": "The Oathbound Pathfinder",
  "discipline:alignment": "The Oathbound Pathfinder",
};

const SLIPPING_TITLES: Record<CompanionStatAttribute, string> = {
  vitality: "The Dimmed Flame",
  wisdom: "The Wandering Seeker",
  discipline: "The Restless Guardian",
  resolve: "The Sleeping Titan",
  creativity: "The Drifting Star",
  alignment: "The Wandering Seeker",
};

const NEED_WEIGHT: Record<CompanionStatNeed["level"], number> = {
  low: 1,
  medium: 2,
  high: 3,
};

const DEFAULT_ACTIVITY_METRICS: CompanionCosmiqTitleActivityMetrics = {
  activeDays7: 0,
  completionRate7: 0,
  currentStreak: 0,
  epicLinkedCompletions: 0,
  totalRecentExpression: 0,
};

const isNeedLevel = (value: unknown): value is CompanionStatNeed["level"] =>
  value === "low" || value === "medium" || value === "high";

const getNeedWeight = (need?: CompanionStatNeed | null): number =>
  need && isNeedLevel(need.level) ? NEED_WEIGHT[need.level] : 1;

const stableHash = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const getBandForScore = (score: number): CompanionCosmiqTitleBand => {
  if (score <= 299) return "Emerging";
  if (score <= 499) return "Building";
  if (score <= 699) return "Strong";
  return "Exceptional";
};

export const getCompanionCosmiqTitleRebalanceStat = ({
  statProfile,
  statNeeds,
}: Pick<BuildCompanionCosmiqTitleInput, "statProfile" | "statNeeds">): CompanionStatAttribute =>
  [...COMPANION_STAT_ATTRIBUTES].sort((left, right) => {
    const needDiff = getNeedWeight(statNeeds?.[right]) - getNeedWeight(statNeeds?.[left]);
    if (needDiff !== 0) return needDiff;

    const rightReasons = statNeeds?.[right]?.reasons?.length ?? 0;
    const leftReasons = statNeeds?.[left]?.reasons?.length ?? 0;
    const reasonDiff = rightReasons - leftReasons;
    if (reasonDiff !== 0) return reasonDiff;

    const scoreDiff = statProfile.scores[left] - statProfile.scores[right];
    if (scoreDiff !== 0) return scoreDiff;

    return COMPANION_STAT_ATTRIBUTES.indexOf(left) - COMPANION_STAT_ATTRIBUTES.indexOf(right);
  })[0] ?? "alignment";

const normalizeActivityMetrics = (
  value?: Partial<CompanionCosmiqTitleActivityMetrics> | null,
): CompanionCosmiqTitleActivityMetrics => ({
  activeDays7: Math.max(0, Math.min(7, Math.floor(value?.activeDays7 ?? DEFAULT_ACTIVITY_METRICS.activeDays7))),
  completionRate7: Math.max(0, Math.min(1, value?.completionRate7 ?? DEFAULT_ACTIVITY_METRICS.completionRate7)),
  currentStreak: Math.max(0, Math.floor(value?.currentStreak ?? DEFAULT_ACTIVITY_METRICS.currentStreak)),
  epicLinkedCompletions: Math.max(0, Math.floor(value?.epicLinkedCompletions ?? DEFAULT_ACTIVITY_METRICS.epicLinkedCompletions)),
  totalRecentExpression: Math.max(0, Math.floor(value?.totalRecentExpression ?? DEFAULT_ACTIVITY_METRICS.totalRecentExpression)),
});

const normalizeRecentExpression = (
  value?: Partial<Record<CompanionStatAttribute, number>> | null,
): Record<CompanionStatAttribute, number> =>
  Object.fromEntries(
    COMPANION_STAT_ATTRIBUTES.map((attribute) => [
      attribute,
      Math.max(0, Math.floor(value?.[attribute] ?? 0)),
    ]),
  ) as Record<CompanionStatAttribute, number>;

const getBandByAttribute = ({
  statProfile,
  statBreakdowns,
}: Pick<BuildCompanionCosmiqTitleInput, "statProfile" | "statBreakdowns">) => {
  const bands = Object.fromEntries(
    COMPANION_STAT_ATTRIBUTES.map((attribute) => [
      attribute,
      getBandForScore(statProfile.scores[attribute]),
    ]),
  ) as Record<CompanionStatAttribute, CompanionCosmiqTitleBand>;

  for (const breakdown of statBreakdowns ?? []) {
    bands[breakdown.attribute] = breakdown.band;
  }

  return bands;
};

const getWeightedStrength = (
  attribute: CompanionStatAttribute,
  statProfile: CompanionStatProfileSummary,
  recentExpression: Record<CompanionStatAttribute, number>,
) => Math.max(0, statProfile.scores[attribute] - 100) / 100 + recentExpression[attribute] * 4;

const getResolvedDominantPair = (
  statProfile: CompanionStatProfileSummary,
  recentExpression: Record<CompanionStatAttribute, number>,
) => {
  const sorted = [...COMPANION_STAT_ATTRIBUTES].sort((left, right) => {
    const strengthDiff =
      getWeightedStrength(right, statProfile, recentExpression)
      - getWeightedStrength(left, statProfile, recentExpression);
    if (strengthDiff !== 0) return strengthDiff;

    const scoreDiff = statProfile.scores[right] - statProfile.scores[left];
    if (scoreDiff !== 0) return scoreDiff;

    return COMPANION_STAT_ATTRIBUTES.indexOf(left) - COMPANION_STAT_ATTRIBUTES.indexOf(right);
  });

  return {
    dominantStat: sorted[0] ?? statProfile.dominantStat,
    secondaryStat: sorted[1] ?? statProfile.secondaryStat,
  };
};

const mapMomentum = (momentumState: CompanionMomentumState): CompanionCosmiqTitleMomentum => {
  if (momentumState === "locked_in") return "rising";
  if (momentumState === "rebuilding") return "recovering";
  if (momentumState === "slipping") return "slipping";
  return "steady";
};

const getRarityFromRank = (rank: number): CompanionCosmiqTitleRarity =>
  RARITY_ORDER[Math.max(0, Math.min(RARITY_ORDER.length - 1, rank))];

const getScoreCeiling = (
  bands: Record<CompanionStatAttribute, CompanionCosmiqTitleBand>,
  metrics: CompanionCosmiqTitleActivityMetrics,
): CompanionCosmiqTitleRarity => {
  const strongOrBetter = COMPANION_STAT_ATTRIBUTES.filter((attribute) =>
    bands[attribute] === "Strong" || bands[attribute] === "Exceptional"
  ).length;
  const exceptional = COMPANION_STAT_ATTRIBUTES.filter((attribute) => bands[attribute] === "Exceptional").length;

  if (exceptional >= 1 && strongOrBetter >= 4 && metrics.currentStreak >= 30) return "cosmic";
  if (exceptional >= 1) return "legendary";
  if (strongOrBetter >= 2) return "epic";
  if (strongOrBetter >= 1) return "rare";
  if (COMPANION_STAT_ATTRIBUTES.some((attribute) => bands[attribute] === "Building")) return "uncommon";
  return "common";
};

const getActivityRarity = (metrics: CompanionCosmiqTitleActivityMetrics): CompanionCosmiqTitleRarity => {
  if (
    metrics.currentStreak >= 30
    && metrics.activeDays7 >= 6
    && metrics.completionRate7 >= 0.8
    && metrics.epicLinkedCompletions >= 1
  ) {
    return "cosmic";
  }

  if (
    metrics.currentStreak >= 30
    || metrics.epicLinkedCompletions >= 3
  ) {
    return "legendary";
  }

  if (
    metrics.currentStreak >= 7
    || metrics.completionRate7 >= 0.8
    || (metrics.activeDays7 >= 5 && metrics.completionRate7 >= 0.72)
    || metrics.totalRecentExpression >= 24
  ) {
    return "epic";
  }

  if (metrics.activeDays7 >= 5 || metrics.epicLinkedCompletions >= 1 || metrics.totalRecentExpression >= 16) {
    return "rare";
  }

  if (metrics.activeDays7 >= 3 || metrics.totalRecentExpression >= 8) {
    return "uncommon";
  }

  return "common";
};

const getRarity = (
  bands: Record<CompanionStatAttribute, CompanionCosmiqTitleBand>,
  metrics: CompanionCosmiqTitleActivityMetrics,
): CompanionCosmiqTitleRarity => {
  const scoreCeiling = getScoreCeiling(bands, metrics);
  const activityRarity = getActivityRarity(metrics);
  return getRarityFromRank(Math.min(RARITY_RANK[scoreCeiling], RARITY_RANK[activityRarity]));
};

const shouldUseFusionTitle = ({
  dominantStat,
  secondaryStat,
  statProfile,
  recentExpression,
  bands,
}: {
  dominantStat: CompanionStatAttribute;
  secondaryStat: CompanionStatAttribute;
  statProfile: CompanionStatProfileSummary;
  recentExpression: Record<CompanionStatAttribute, number>;
  bands: Record<CompanionStatAttribute, CompanionCosmiqTitleBand>;
}) => {
  const fusionKey = `${dominantStat}:${secondaryStat}` as `${CompanionStatAttribute}:${CompanionStatAttribute}`;
  if (!FUSION_TITLES[fusionKey]) return false;
  if (bands[dominantStat] !== bands[secondaryStat]) return false;

  const scoreGap = Math.abs(statProfile.scores[dominantStat] - statProfile.scores[secondaryStat]);
  if (scoreGap <= 50) return true;

  const weightedGap = Math.abs(
    getWeightedStrength(dominantStat, statProfile, recentExpression)
    - getWeightedStrength(secondaryStat, statProfile, recentExpression),
  );
  return weightedGap <= 0.25;
};

const selectRareVariant = (
  dominantStat: CompanionStatAttribute,
  rarity: CompanionCosmiqTitleRarity,
  seed: string,
) => {
  const variants = TITLE_POOLS[dominantStat].rareVariants;
  if (rarity === "cosmic" && dominantStat === "alignment") return TITLE_POOLS.alignment.Exceptional;
  if (rarity !== "epic" || variants.length === 0) return null;
  return variants[stableHash(seed) % variants.length];
};

const getBaseTitle = ({
  dominantStat,
  secondaryStat,
  rebalanceStat,
  band,
  rarity,
  momentum,
  fusion,
}: {
  dominantStat: CompanionStatAttribute;
  secondaryStat: CompanionStatAttribute;
  rebalanceStat: CompanionStatAttribute;
  band: CompanionCosmiqTitleBand;
  rarity: CompanionCosmiqTitleRarity;
  momentum: CompanionCosmiqTitleMomentum;
  fusion: boolean;
}) => {
  if (momentum === "slipping") return SLIPPING_TITLES[dominantStat];

  const fusionKey = `${dominantStat}:${secondaryStat}` as `${CompanionStatAttribute}:${CompanionStatAttribute}`;
  if (fusion && FUSION_TITLES[fusionKey]) {
    return FUSION_TITLES[fusionKey];
  }

  const rareVariant = selectRareVariant(
    dominantStat,
    rarity,
    `${dominantStat}:${secondaryStat}:${rebalanceStat}:${rarity}:${fusion ? "F" : "S"}`,
  );
  if (rareVariant) return rareVariant;

  return TITLE_POOLS[dominantStat][band];
};

const getNextBand = (band: CompanionCosmiqTitleBand): CompanionCosmiqTitleBand => {
  if (band === "Emerging") return "Building";
  if (band === "Building") return "Strong";
  return "Exceptional";
};

const getRebalanceTargetTitle = (
  dominantStat: CompanionStatAttribute,
  rebalanceStat: CompanionStatAttribute,
  bands: Record<CompanionStatAttribute, CompanionCosmiqTitleBand>,
) => {
  const fusionKey = `${dominantStat}:${rebalanceStat}` as `${CompanionStatAttribute}:${CompanionStatAttribute}`;
  if (FUSION_TITLES[fusionKey]) return FUSION_TITLES[fusionKey];

  return TITLE_POOLS[rebalanceStat][getNextBand(bands[rebalanceStat])];
};

const getRebalancePath = (
  dominantStat: CompanionStatAttribute,
  rebalanceStat: CompanionStatAttribute,
  bands: Record<CompanionStatAttribute, CompanionCosmiqTitleBand>,
) => {
  const targetTitle = getRebalanceTargetTitle(dominantStat, rebalanceStat, bands);
  return `Strengthen ${COMPANION_ATTRIBUTE_LABELS[rebalanceStat]} to evolve toward ${targetTitle}.`;
};

const isNearEvolutionGate = (
  statProfile: CompanionStatProfileSummary,
  metrics: CompanionCosmiqTitleActivityMetrics,
) => {
  const highestScore = Math.max(...COMPANION_STAT_ATTRIBUTES.map((attribute) => statProfile.scores[attribute]));
  const nearBandGate =
    (highestScore >= 475 && highestScore < 500)
    || (highestScore >= 675 && highestScore < 700);

  return nearBandGate
    || metrics.activeDays7 === 4
    || metrics.currentStreak === 6
    || (metrics.currentStreak >= 25 && metrics.currentStreak < 30)
    || (metrics.completionRate7 >= 0.66 && metrics.completionRate7 < 0.72);
};

const getTitleStability = ({
  title,
  rarity,
  momentum,
  previousTitle,
  statProfile,
  metrics,
}: {
  title: string;
  rarity: CompanionCosmiqTitleRarity;
  momentum: CompanionCosmiqTitleMomentum;
  previousTitle?: CompanionCosmiqTitlePreviousState | null;
  statProfile: CompanionStatProfileSummary;
  metrics: CompanionCosmiqTitleActivityMetrics;
}): CompanionCosmiqTitleStability => {
  if (!previousTitle || previousTitle.title !== title) return "new";

  if (momentum === "slipping" || RARITY_RANK[rarity] < RARITY_RANK[previousTitle.rarity]) {
    return "at_risk";
  }

  if (isNearEvolutionGate(statProfile, metrics)) {
    return "evolving";
  }

  return "stable";
};

export const buildCompanionCosmiqTitle = ({
  statProfile,
  statNeeds,
  statBreakdowns,
  momentumState,
  recentExpression: recentExpressionInput,
  activityMetrics: activityMetricsInput,
  previousTitle,
}: BuildCompanionCosmiqTitleInput): CompanionCosmiqTitle => {
  const recentExpression = normalizeRecentExpression(recentExpressionInput);
  const metrics = normalizeActivityMetrics(activityMetricsInput);
  const bands = getBandByAttribute({ statProfile, statBreakdowns });
  const { dominantStat, secondaryStat } = getResolvedDominantPair(statProfile, recentExpression);
  const rebalanceStat = getCompanionCosmiqTitleRebalanceStat({ statProfile, statNeeds });
  const momentum = mapMomentum(momentumState);
  const rarity = getRarity(bands, metrics);
  const fusion = momentum === "slipping"
    ? false
    : shouldUseFusionTitle({
      dominantStat,
      secondaryStat,
      statProfile,
      recentExpression,
      bands,
    });
  const title = getBaseTitle({
    dominantStat,
    secondaryStat,
    rebalanceStat,
    band: bands[dominantStat],
    rarity,
    momentum,
    fusion,
  });
  const rebalancePath = getRebalancePath(dominantStat, rebalanceStat, bands);
  const titleStability = getTitleStability({
    title,
    rarity,
    momentum,
    previousTitle,
    statProfile,
    metrics,
  });

  return {
    title,
    rarity,
    momentum,
    dominantStat,
    secondaryStat,
    rebalanceStat,
    fusion,
    rebalancePath,
    titleStability,
  };
};

export const buildCompanionCosmiqTitleCardProfileKey = ({
  cosmiqTitle,
  statBreakdowns,
  promptVersion,
  visualPersona = "neutral",
}: {
  cosmiqTitle: CompanionCosmiqTitle;
  statBreakdowns: CompanionCosmiqTitleStatBreakdownInput[];
  promptVersion: number;
  visualPersona?: OnboardingVisualPersona;
}) => {
  const bandSignature = [...statBreakdowns]
    .sort((left, right) =>
      COMPANION_STAT_ATTRIBUTES.indexOf(left.attribute)
      - COMPANION_STAT_ATTRIBUTES.indexOf(right.attribute)
    )
    .map((breakdown) => `${breakdown.attribute}:${breakdown.band}`)
    .join("|");

  return [
    `v${promptVersion}`,
    cosmiqTitle.title,
    cosmiqTitle.rarity,
    cosmiqTitle.dominantStat,
    cosmiqTitle.secondaryStat,
    cosmiqTitle.rebalanceStat,
    cosmiqTitle.fusion ? "fusion" : "solo",
    visualPersona,
    bandSignature,
  ]
    .join("::")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
};

export const buildFantasyTitleAliasFromCosmiqTitle = (
  cosmiqTitle: CompanionCosmiqTitle,
): CompanionFantasyTitleAlias => ({
  title: cosmiqTitle.title,
  archetype: `${COMPANION_ATTRIBUTE_LABELS[cosmiqTitle.dominantStat]} / ${COMPANION_ATTRIBUTE_LABELS[cosmiqTitle.secondaryStat]}`,
  explanation: `${COMPANION_ATTRIBUTE_LABELS[cosmiqTitle.dominantStat]} is leading with ${COMPANION_ATTRIBUTE_LABELS[cosmiqTitle.secondaryStat]} close behind. ${cosmiqTitle.rebalancePath}`,
});

export const isCompanionCosmiqTitleRarity = (value: unknown): value is CompanionCosmiqTitleRarity =>
  typeof value === "string" && RARITY_ORDER.includes(value as CompanionCosmiqTitleRarity);

export const isCompanionCosmiqTitleMomentum = (value: unknown): value is CompanionCosmiqTitleMomentum =>
  value === "rising" || value === "steady" || value === "recovering" || value === "slipping";

export const isCompanionCosmiqTitleStability = (value: unknown): value is CompanionCosmiqTitleStability =>
  value === "new" || value === "stable" || value === "at_risk" || value === "evolving";
