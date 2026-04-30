import {
  COMPANION_ATTRIBUTE_LABELS,
  COMPANION_STAT_ATTRIBUTES,
  type CompanionMomentumState,
  type CompanionStatAttribute,
  type CompanionStatNeed,
  type CompanionStatNeedLevel,
  type CompanionStatProfileSummary,
} from "./companionStatSignals";

export interface CompanionFantasyTitle {
  title: string;
  archetype: string;
  explanation: string;
}

interface BuildCompanionFantasyTitleInput {
  analysisDate: string;
  statProfile: CompanionStatProfileSummary;
  statNeeds?: Partial<Record<CompanionStatAttribute, CompanionStatNeed>> | null;
  momentumState: CompanionMomentumState;
}

const TITLE_POOLS_BY_ATTRIBUTE: Record<CompanionStatAttribute, string[]> = {
  vitality: [
    "The Dawn-Breathed Guardian",
    "The Greenheart Champion",
    "The Life-Flame Keeper",
    "The Renewal Warden",
    "The Rest-Bright Sentinel",
    "The Wild Pulse Bearer",
    "The Sunwell Warden",
    "The Recovery Paladin",
  ],
  wisdom: [
    "The Star-Scribe",
    "The Moonlit Oracle",
    "The Scholar of Hidden Roads",
    "The Celestial Cartographer",
    "The Lantern-Seer",
    "The Archive-Bound Sage",
    "The Rune-Lit Scholar",
    "The Quiet Star Reader",
  ],
  discipline: [
    "The Oathbound Sentinel",
    "The Ritual Warden",
    "The Clockwork Paladin",
    "The Steady Star Keeper",
    "The Vow-Forged Marshal",
    "The Iron Routine Knight",
    "The Schedule-Bound Guardian",
    "The Orderlit Champion",
  ],
  resolve: [
    "The Iron Vow",
    "The Ember-Marched",
    "The Threshold Breaker",
    "The Trial-Forged Champion",
    "The Storm-Braced Vanguard",
    "The Unbowed Flame",
    "The Granite-Hearted",
    "The Last-Step Guardian",
  ],
  creativity: [
    "The Dream Weaver",
    "The Wildlight Muse",
    "The Spark-Sung Maker",
    "The Bright Thread Conjurer",
    "The Story-Forged Artisan",
    "The Imagination Herald",
    "The Starfire Artisan",
    "The Inkbright Summoner",
  ],
  alignment: [
    "The True North Wayfinder",
    "The Compass-Bound Guardian",
    "The Covenant Keeper",
    "The Heart-Oath Navigator",
    "The Soulpath Warden",
    "The Purpose-Lit Herald",
    "The Inner Compass",
    "The Vowlit Waykeeper",
  ],
};

const TITLE_POOLS_BY_PAIR: Partial<Record<`${CompanionStatAttribute}:${CompanionStatAttribute}`, string[]>> = {
  "discipline:alignment": [
    "The Oathbound Navigator",
    "The Ritual Wayfinder",
    "Sentinel of True North",
    "The Covenant Warden",
    "Keeper of the Steady Star",
    "The Compass-Bound Guardian",
    "The True North Oathkeeper",
    "The Steady Path Marshal",
  ],
  "alignment:discipline": [
    "The True North Sentinel",
    "The Compass Oathkeeper",
    "The Covenant Tactician",
    "The Soulpath Warden",
    "The Purpose-Forged Marshal",
    "The Steady Heart Knight",
    "The Vowlit Compass",
    "The Ritual Heartkeeper",
  ],
  "wisdom:creativity": [
    "The Star-Scribe",
    "The Dream Cartographer",
    "Oracle of Bright Thread",
    "The Lantern-Muse",
    "The Scholar of Wildlight",
    "The Celestial Storykeeper",
    "The Rune-Woven Seer",
    "The Bright Map Oracle",
  ],
  "creativity:wisdom": [
    "The Wildlight Oracle",
    "The Muse-Scribe",
    "The Dream Scholar",
    "The Bright Thread Seer",
    "The Idea Cartographer",
    "The Story-Bound Sage",
    "The Inkbright Oracle",
    "The Wild Map Scholar",
  ],
  "resolve:discipline": [
    "The Iron Vow",
    "The Threshold Sentinel",
    "The Trial-Forged Warden",
    "The Ember Oathkeeper",
    "The Storm-Braced Marshal",
    "The Unbowed Paladin",
    "The Granite Oath",
    "The Last-Step Warden",
  ],
  "discipline:resolve": [
    "The Vow-Forged Vanguard",
    "The Iron Routine Knight",
    "The Ritual Flamebearer",
    "The Steady Trialbreaker",
    "The Ember-Marked Sentinel",
    "The Oath and Ember",
    "The Trial-Bound Paladin",
    "The Steady Flame Marshal",
  ],
  "vitality:alignment": [
    "The Greenheart Wayfinder",
    "The Dawn-Breathed Guardian",
    "Keeper of the Living Flame",
    "The Heartroot Navigator",
    "The Renewal Compass",
    "The Life-Oath Warden",
    "The Dawnroot Guardian",
    "The Rest-Lit Wayfinder",
  ],
  "alignment:vitality": [
    "The Living Compass",
    "The Heartroot Guardian",
    "The Dawnlit Wayfinder",
    "The Green Oathkeeper",
    "The Soulflame Warden",
    "The Purpose-Breathed Champion",
    "The Greenheart Compass",
    "The Renewal Oathkeeper",
  ],
};

const NEED_WEIGHT: Record<CompanionStatNeedLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

const isNeedLevel = (value: unknown): value is CompanionStatNeedLevel =>
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

const getDateOrdinal = (analysisDate: string): number => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(analysisDate)) {
    return stableHash(analysisDate);
  }

  const timestamp = Date.parse(`${analysisDate}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp)) {
    return stableHash(analysisDate);
  }

  return Math.floor(timestamp / 86_400_000);
};

export const getCompanionFantasyTitleRebalanceStat = ({
  statProfile,
  statNeeds,
}: Pick<BuildCompanionFantasyTitleInput, "statProfile" | "statNeeds">): CompanionStatAttribute => {
  return [...COMPANION_STAT_ATTRIBUTES].sort((left, right) => {
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
};

const getExplanation = ({
  dominantStat,
  secondaryStat,
  rebalanceStat,
  momentumState,
}: {
  dominantStat: CompanionStatAttribute;
  secondaryStat: CompanionStatAttribute;
  rebalanceStat: CompanionStatAttribute;
  momentumState: CompanionMomentumState;
}): string => {
  const dominantLabel = COMPANION_ATTRIBUTE_LABELS[dominantStat];
  const secondaryLabel = COMPANION_ATTRIBUTE_LABELS[secondaryStat];
  const rebalanceLabel = COMPANION_ATTRIBUTE_LABELS[rebalanceStat];

  if (momentumState === "locked_in") {
    return `You're carrying ${dominantLabel} with ${secondaryLabel} close behind, and ${rebalanceLabel} is the place to protect as your next chapter expands.`;
  }

  if (momentumState === "rebuilding") {
    return `You're rebuilding through ${dominantLabel} with ${secondaryLabel} close behind, and ${rebalanceLabel} is the place your next chapter wants gentle support.`;
  }

  if (momentumState === "slipping") {
    return `You're still carrying ${dominantLabel} with ${secondaryLabel} close behind, and ${rebalanceLabel} is the place your next chapter wants support before the pressure rises.`;
  }

  return `You're carrying ${dominantLabel} with ${secondaryLabel} close behind, and ${rebalanceLabel} is the place your next chapter wants support.`;
};

export const buildCompanionFantasyTitle = ({
  analysisDate,
  statProfile,
  statNeeds,
  momentumState,
}: BuildCompanionFantasyTitleInput): CompanionFantasyTitle => {
  const dominantStat = statProfile.dominantStat;
  const secondaryStat = statProfile.secondaryStat;
  const rebalanceStat = getCompanionFantasyTitleRebalanceStat({ statProfile, statNeeds });
  const pairKey = `${dominantStat}:${secondaryStat}` as `${CompanionStatAttribute}:${CompanionStatAttribute}`;
  const titlePool = TITLE_POOLS_BY_PAIR[pairKey] ?? TITLE_POOLS_BY_ATTRIBUTE[dominantStat];
  const profileHash = stableHash(`${dominantStat}:${secondaryStat}:${rebalanceStat}:${momentumState}`);
  const selectedIndex = (profileHash + getDateOrdinal(analysisDate)) % titlePool.length;

  return {
    title: titlePool[selectedIndex],
    archetype: `${COMPANION_ATTRIBUTE_LABELS[dominantStat]} / ${COMPANION_ATTRIBUTE_LABELS[secondaryStat]}`,
    explanation: getExplanation({
      dominantStat,
      secondaryStat,
      rebalanceStat,
      momentumState,
    }),
  };
};
