import {
  type CompanionDialogueBucketKey,
  type CompanionDialogueLine,
  type CompanionDialogueTonePack,
  type CompanionShimmerType,
  COMPANION_DIALOGUE_TONE_PACKS,
  getAllLinesForBucket,
  getLinesForToneAndBucket,
} from "@/config/companionDialoguePacks";
import { safeLocalStorage } from "@/utils/storage";

export type DialogueMood = "thriving" | "content" | "concerned" | "desperate" | "recovering";
export type DialogueTriggerSource =
  | "idle"
  | "task-completed"
  | "focus-sprint-completed"
  // Legacy aliases
  | "quest-completed"
  | "mission-completed"
  | "morning-checkin-completed"
  | "companion-evolved";

export type DialogueOutcomeTag =
  | "basic_checkin"
  | "momentum_boost"
  | "clarity_prompt"
  | "mystery_event"
  | "reset_flow"
  | "turning_point";

export interface DialogueSelectionContext {
  userId?: string | null;
  dialogueMood: DialogueMood;
  overallCare: number;
  hasDormancyWarning: boolean;
  inactiveDays: number;
  progressToNext: number;
  xpToNext: number;
  voiceStyle?: string;
  needsClarity?: boolean;
  triggerSource: DialogueTriggerSource;
  now?: Date;
  seedKey?: string;
  forceBaseFallback?: boolean;
}

export interface DialogueHistoryEntry {
  userId?: string | null;
  lineId: string;
  bucketKey: CompanionDialogueBucketKey;
  tonePack: CompanionDialogueTonePack;
  shimmerType: CompanionShimmerType;
  shownAt: string;
}

export interface DialogueSelectionResult {
  greeting: string;
  shimmerType: CompanionShimmerType;
  microTitle: string | null;
  outcomeTag: DialogueOutcomeTag;
  tonePack: CompanionDialogueTonePack;
  bucketKey: CompanionDialogueBucketKey;
  lineId: string;
  updatedHistory: DialogueHistoryEntry[];
  fallbackStage: "primary" | "same_bucket_any_tone" | "same_shimmer_any_bucket" | "base_fallback";
}

type ShimmerWeights = Record<CompanionShimmerType, number>;

const HISTORY_STORAGE_KEY = "companion_dialogue_history_v1";
const HISTORY_MAX = 50;
const RECENT_LINE_BLOCK_DAYS = 14;
const RED_COOLDOWN_MS = 20 * 60 * 1000;
const GOLD_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const COLORED_DAILY_CAP = 5;
const RNG_BUCKET_MS = 90 * 1000;

const BASE_SHIMMER_WEIGHTS: ShimmerWeights = {
  none: 70,
  green: 15,
  blue: 7,
  purple: 4,
  red: 3,
  gold: 1,
};

export const MICRO_TITLE_BY_SHIMMER: Record<CompanionShimmerType, string | null> = {
  none: null,
  green: "Momentum Boost",
  blue: "Clarity Moment",
  purple: "Surprise Support",
  red: "Reset Moment",
  gold: "Turning Point",
};

export const OUTCOME_BY_SHIMMER: Record<CompanionShimmerType, DialogueOutcomeTag> = {
  none: "basic_checkin",
  green: "momentum_boost",
  blue: "clarity_prompt",
  purple: "mystery_event",
  red: "reset_flow",
  gold: "turning_point",
};

const BUCKETS_BY_SHIMMER: Record<CompanionShimmerType, CompanionDialogueBucketKey[]> = {
  none: ["base_greetings"],
  green: ["growth_moments", "recovery_moments"],
  blue: ["clarity_moments"],
  purple: ["mystery_moments"],
  red: ["repair_moments", "critical_gentle_moments"],
  gold: ["legendary_moments"],
};

const TONE_PRIORS: Record<DialogueMood, Record<CompanionDialogueTonePack, number>> = {
  thriving: { soft: 0.15, playful: 0.45, witty_sassy: 0.4 },
  content: { soft: 0.25, playful: 0.4, witty_sassy: 0.35 },
  concerned: { soft: 0.5, playful: 0.2, witty_sassy: 0.3 },
  desperate: { soft: 0.65, playful: 0.1, witty_sassy: 0.25 },
  recovering: { soft: 0.5, playful: 0.35, witty_sassy: 0.15 },
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const hashString = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash || 1;
};

const createSeededRng = (seed: string) => {
  let state = hashString(seed);
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

const normalizeWeights = <T extends string>(weights: Record<T, number>): Record<T, number> => {
  const keys = Object.keys(weights) as T[];
  const cleaned = {} as Record<T, number>;
  let total = 0;

  for (const key of keys) {
    const value = weights[key];
    const sanitized = value > 0 ? value : 0;
    cleaned[key] = sanitized;
    total += sanitized;
  }

  if (total <= 0) {
    return cleaned;
  }

  const normalized = {} as Record<T, number>;
  for (const key of keys) {
    normalized[key] = cleaned[key] / total;
  }
  return normalized;
};

const pickWeighted = <T extends string>(weights: Record<T, number>, rng: () => number): T => {
  const normalized = normalizeWeights(weights);
  const entries = Object.entries(normalized) as Array<[T, number]>;
  const roll = rng();
  let cursor = 0;

  for (const [key, weight] of entries) {
    cursor += weight;
    if (roll <= cursor) {
      return key;
    }
  }

  return entries[entries.length - 1][0];
};

const getToneWeightsForMood = (mood: DialogueMood) => ({ ...TONE_PRIORS[mood] });

const applyVoiceStyleBias = (
  weights: Record<CompanionDialogueTonePack, number>,
  voiceStyle?: string,
) => {
  if (!voiceStyle) return weights;

  const normalizedStyle = voiceStyle.toLowerCase();
  if (/(warm|gentle|calm|nurtur|compassion|soft)/.test(normalizedStyle)) {
    weights.soft += 0.15;
  }
  if (/(playful|energetic|light|fun|upbeat)/.test(normalizedStyle)) {
    weights.playful += 0.15;
  }
  if (/(direct|sharp|bold|blunt|crisp)/.test(normalizedStyle)) {
    weights.witty_sassy += 0.15;
  }

  return weights;
};

const getBucketsForShimmer = (shimmerType: CompanionShimmerType) => BUCKETS_BY_SHIMMER[shimmerType];

const isColoredShimmer = (shimmerType: CompanionShimmerType) => shimmerType !== "none";

const parseHistory = (raw: string | null): DialogueHistoryEntry[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is DialogueHistoryEntry => {
        if (!entry || typeof entry !== "object") return false;
        if (typeof entry.lineId !== "string") return false;
        if (typeof entry.bucketKey !== "string") return false;
        if (typeof entry.tonePack !== "string") return false;
        if (typeof entry.shimmerType !== "string") return false;
        if (typeof entry.shownAt !== "string") return false;
        return true;
      })
      .slice(-HISTORY_MAX);
  } catch {
    return [];
  }
};

const readGlobalHistory = () => parseHistory(safeLocalStorage.getItem(HISTORY_STORAGE_KEY));

const writeGlobalHistory = (entries: DialogueHistoryEntry[]) => {
  safeLocalStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries.slice(-HISTORY_MAX)));
};

const filterHistoryForUser = (history: DialogueHistoryEntry[], userId?: string | null) => {
  if (!userId) return history;
  return history.filter((entry) => (entry.userId ?? null) === userId);
};

const mergeHistoryForUser = (
  globalHistory: DialogueHistoryEntry[],
  updatedUserHistory: DialogueHistoryEntry[],
  userId?: string | null,
) => {
  if (!userId) {
    return updatedUserHistory.slice(-HISTORY_MAX);
  }

  const otherUsers = globalHistory.filter((entry) => (entry.userId ?? null) !== userId);
  return [...otherUsers, ...updatedUserHistory].slice(-HISTORY_MAX);
};

const appendHistoryEntry = (
  history: DialogueHistoryEntry[],
  entry: DialogueHistoryEntry,
): DialogueHistoryEntry[] => [...history, entry].slice(-HISTORY_MAX);

const getNewestHistoryEntry = (history: DialogueHistoryEntry[]) => history[history.length - 1] ?? null;

const countColoredShimmersToday = (history: DialogueHistoryEntry[], now: Date) => {
  const today = now.toISOString().slice(0, 10);
  return history.filter((entry) => {
    if (!isColoredShimmer(entry.shimmerType)) return false;
    return entry.shownAt.slice(0, 10) === today;
  }).length;
};

const wasShimmerShownWithin = (
  history: DialogueHistoryEntry[],
  shimmerType: CompanionShimmerType,
  windowMs: number,
  nowMs: number,
) => history.some((entry) => entry.shimmerType === shimmerType && nowMs - Date.parse(entry.shownAt) < windowMs);

const getSeed = (context: DialogueSelectionContext, history: DialogueHistoryEntry[], now: Date) => {
  if (context.seedKey) return context.seedKey;
  const bucket = Math.floor(now.getTime() / RNG_BUCKET_MS);
  const parts = [
    context.userId ?? "anon",
    context.dialogueMood,
    context.triggerSource,
    bucket,
    Math.round(context.overallCare * 1000),
    context.inactiveDays,
    Math.round(context.progressToNext),
    Math.round(context.xpToNext),
    history.length,
  ];
  return parts.join(":");
};

const resolveBaseShimmerWeights = (
  context: DialogueSelectionContext,
  history: DialogueHistoryEntry[],
  now: Date,
): ShimmerWeights => {
  const weights: ShimmerWeights = { ...BASE_SHIMMER_WEIGHTS };
  const nowMs = now.getTime();
  const nearEvolution = context.progressToNext >= 85 || context.xpToNext <= 25;
  const mood = context.dialogueMood;

  if (nearEvolution) {
    weights.green *= 1.7;
    weights.gold *= 1.6;
    weights.none *= 0.85;
  }

  if (mood === "recovering") {
    weights.green *= 1.6;
    weights.red *= 0.7;
    weights.none *= 0.9;
  }

  if (mood === "concerned") {
    weights.red *= 1.8;
    weights.blue *= 1.2;
    weights.none *= 0.8;
  }

  if (mood === "desperate" || context.hasDormancyWarning) {
    weights.red *= 3;
    weights.blue *= 1.3;
    weights.none *= 0.5;
    weights.purple *= 0.5;
    weights.gold = 0;
  }

  if (context.overallCare > 0.8) {
    weights.purple *= 1.25;
    weights.green *= 1.15;
  }

  if (context.needsClarity) {
    weights.blue *= 1.8;
    weights.none *= 0.85;
    weights.purple *= 0.9;
  }

  if (context.inactiveDays >= 3) {
    weights.red *= 1.8;
    weights.none *= 0.75;
    weights.purple *= 0.6;
    weights.gold = 0;
  }

  const isTaskComplete =
    context.triggerSource === "task-completed"
    || context.triggerSource === "quest-completed";
  const isFocusComplete =
    context.triggerSource === "focus-sprint-completed"
    || context.triggerSource === "mission-completed";

  if (isTaskComplete) {
    weights.green *= 1.4;
  } else if (isFocusComplete) {
    weights.green *= 1.55;
  } else if (context.triggerSource === "morning-checkin-completed") {
    weights.blue *= 1.35;
  } else if (context.triggerSource === "companion-evolved") {
    if (!wasShimmerShownWithin(history, "gold", GOLD_COOLDOWN_MS, nowMs)) {
      weights.gold *= 2;
    } else {
      weights.green *= 1.5;
    }
  }

  if (countColoredShimmersToday(history, now) >= COLORED_DAILY_CAP) {
    return { none: 1, green: 0, blue: 0, purple: 0, red: 0, gold: 0 };
  }

  const newest = getNewestHistoryEntry(history);
  if (newest?.shimmerType === "purple") {
    weights.purple = 0;
  }

  if (wasShimmerShownWithin(history, "gold", GOLD_COOLDOWN_MS, nowMs)) {
    weights.gold = 0;
  }

  if (wasShimmerShownWithin(history, "red", RED_COOLDOWN_MS, nowMs)) {
    weights.red = 0;
  }

  if (Object.values(weights).every((weight) => weight <= 0)) {
    return { none: 1, green: 0, blue: 0, purple: 0, red: 0, gold: 0 };
  }

  return weights;
};

const selectBucketForShimmer = (
  shimmerType: CompanionShimmerType,
  context: DialogueSelectionContext,
  rng: () => number,
): CompanionDialogueBucketKey => {
  if (shimmerType === "green") {
    if (context.dialogueMood === "recovering") {
      return rng() < 0.6 ? "recovery_moments" : "growth_moments";
    }
    return "growth_moments";
  }

  if (shimmerType === "red") {
    if (context.dialogueMood === "desperate" || context.hasDormancyWarning) {
      return "critical_gentle_moments";
    }
    return "repair_moments";
  }

  if (shimmerType === "none") return "base_greetings";
  if (shimmerType === "blue") return "clarity_moments";
  if (shimmerType === "purple") return "mystery_moments";
  return "legendary_moments";
};

const shouldAvoidBucketForRecentRepeats = (
  history: DialogueHistoryEntry[],
  bucketKey: CompanionDialogueBucketKey,
  shimmerType: CompanionShimmerType,
) => {
  const lastTwo = history.slice(-2);
  const wasRecentBucket = lastTwo.some((entry) => entry.bucketKey === bucketKey);
  const hasAlternatives = getBucketsForShimmer(shimmerType).length > 1;
  return wasRecentBucket && hasAlternatives;
};

const filterLinesAgainstHistory = (
  lines: CompanionDialogueLine[],
  history: DialogueHistoryEntry[],
  now: Date,
) => {
  const nowMs = now.getTime();
  const recentWindowMs = RECENT_LINE_BLOCK_DAYS * 24 * 60 * 60 * 1000;
  const blockedForWindow = new Set(
    history
      .filter((entry) => nowMs - Date.parse(entry.shownAt) <= recentWindowMs)
      .map((entry) => entry.lineId),
  );
  const blockedRecentThree = new Set(history.slice(-3).map((entry) => entry.lineId));

  return lines.filter((line) => !blockedForWindow.has(line.id) && !blockedRecentThree.has(line.id));
};

const pickLineFromCandidates = (
  candidates: CompanionDialogueLine[],
  rng: () => number,
): CompanionDialogueLine | null => {
  if (candidates.length === 0) return null;
  const index = Math.floor(clamp(rng(), 0, 0.999999) * candidates.length);
  return candidates[index] ?? candidates[0];
};

interface LineSelectionInput {
  tonePack: CompanionDialogueTonePack;
  bucketKey: CompanionDialogueBucketKey;
  shimmerType: CompanionShimmerType;
  history: DialogueHistoryEntry[];
  now: Date;
  rng: () => number;
}

interface LineSelectionResult {
  line: CompanionDialogueLine;
  tonePack: CompanionDialogueTonePack;
  bucketKey: CompanionDialogueBucketKey;
  fallbackStage: "primary" | "same_bucket_any_tone" | "same_shimmer_any_bucket" | "base_fallback";
}

export const selectDialogueLineCandidate = ({
  tonePack,
  bucketKey,
  shimmerType,
  history,
  now,
  rng,
}: LineSelectionInput): LineSelectionResult => {
  const avoidPrimaryBucket = shouldAvoidBucketForRecentRepeats(history, bucketKey, shimmerType);

  const stageOneCandidates = avoidPrimaryBucket
    ? []
    : filterLinesAgainstHistory(getLinesForToneAndBucket(tonePack, bucketKey), history, now);
  const stageOneLine = pickLineFromCandidates(stageOneCandidates, rng);
  if (stageOneLine) {
    return { line: stageOneLine, tonePack: stageOneLine.tonePack, bucketKey: stageOneLine.bucketKey, fallbackStage: "primary" };
  }

  const stageTwoCandidates = avoidPrimaryBucket
    ? []
    : filterLinesAgainstHistory(getAllLinesForBucket(bucketKey), history, now);
  const stageTwoLine = pickLineFromCandidates(stageTwoCandidates, rng);
  if (stageTwoLine) {
    return {
      line: stageTwoLine,
      tonePack: stageTwoLine.tonePack,
      bucketKey: stageTwoLine.bucketKey,
      fallbackStage: "same_bucket_any_tone",
    };
  }

  const shimmerBuckets = getBucketsForShimmer(shimmerType).filter(
    (candidateBucket) => !(avoidPrimaryBucket && candidateBucket === bucketKey),
  );
  const stageThreeCandidates = filterLinesAgainstHistory(
    shimmerBuckets.flatMap((candidateBucket) => getAllLinesForBucket(candidateBucket)),
    history,
    now,
  );
  const stageThreeLine = pickLineFromCandidates(stageThreeCandidates, rng);
  if (stageThreeLine) {
    return {
      line: stageThreeLine,
      tonePack: stageThreeLine.tonePack,
      bucketKey: stageThreeLine.bucketKey,
      fallbackStage: "same_shimmer_any_bucket",
    };
  }

  const baseCandidates = filterLinesAgainstHistory(getAllLinesForBucket("base_greetings"), history, now);
  const baseLine =
    pickLineFromCandidates(baseCandidates, rng)
    ?? getLinesForToneAndBucket("soft", "base_greetings")[0];

  return {
    line: baseLine,
    tonePack: baseLine.tonePack,
    bucketKey: baseLine.bucketKey,
    fallbackStage: "base_fallback",
  };
};

const selectTonePack = (
  context: DialogueSelectionContext,
  rng: () => number,
): CompanionDialogueTonePack => {
  const weighted = applyVoiceStyleBias(getToneWeightsForMood(context.dialogueMood), context.voiceStyle);
  return pickWeighted(weighted, rng);
};

export const selectCompanionDialogueEventFromHistory = (
  context: DialogueSelectionContext,
  history: DialogueHistoryEntry[],
): DialogueSelectionResult => {
  const now = context.now ?? new Date();
  const filteredHistory = filterHistoryForUser(history, context.userId);
  const seed = getSeed(context, filteredHistory, now);
  const rng = createSeededRng(seed);
  const shimmerType: CompanionShimmerType = context.forceBaseFallback
    ? "none"
    : pickWeighted(resolveBaseShimmerWeights(context, filteredHistory, now), rng);
  const bucketKey: CompanionDialogueBucketKey = context.forceBaseFallback
    ? "base_greetings"
    : selectBucketForShimmer(shimmerType, context, rng);
  const tonePack = selectTonePack(context, rng);
  const selectedLine = selectDialogueLineCandidate({
    tonePack,
    bucketKey,
    shimmerType,
    history: filteredHistory,
    now,
    rng,
  });

  const historyEntry: DialogueHistoryEntry = {
    userId: context.userId ?? null,
    lineId: selectedLine.line.id,
    bucketKey: selectedLine.bucketKey,
    tonePack: selectedLine.tonePack,
    shimmerType,
    shownAt: now.toISOString(),
  };
  const updatedHistory = appendHistoryEntry(filteredHistory, historyEntry);
  const microTitle =
    selectedLine.bucketKey === "recovery_moments"
      ? "Back Online"
      : MICRO_TITLE_BY_SHIMMER[shimmerType];

  return {
    greeting: normalizeWhitespace(selectedLine.line.text),
    shimmerType,
    microTitle,
    outcomeTag: OUTCOME_BY_SHIMMER[shimmerType],
    tonePack: selectedLine.tonePack,
    bucketKey: selectedLine.bucketKey,
    lineId: selectedLine.line.id,
    fallbackStage: selectedLine.fallbackStage,
    updatedHistory,
  };
};

export const selectCompanionDialogueEvent = (
  context: DialogueSelectionContext,
): Omit<DialogueSelectionResult, "updatedHistory"> => {
  const globalHistory = readGlobalHistory();
  const userHistory = filterHistoryForUser(globalHistory, context.userId);
  const selected = selectCompanionDialogueEventFromHistory(context, userHistory);

  const mergedHistory = mergeHistoryForUser(globalHistory, selected.updatedHistory, context.userId);
  writeGlobalHistory(mergedHistory);

  const { updatedHistory: _updatedHistory, ...result } = selected;
  return result;
};
