import {
  DAILY_FORMATION_PRACTICES,
  getDailyFormationPracticeById,
  type DailyFormationCategory,
  type DailyFormationMode,
  type DailyFormationPractice,
} from "@/data/dailyFormationPractices";

export interface FormationAssignmentHistory {
  practiceKey: string;
  practiceDate: string;
  category: DailyFormationCategory;
  completedAt: string | null;
}

export interface FormationLearningSignals {
  overwhelmSignals?: number | null;
  successfulPatterns?: unknown;
}

export interface FormationReflectionSignal {
  mood: string;
  gratitude?: string | null;
  wins?: string | null;
  additionalReflection?: string | null;
  tomorrowAdjustment?: string | null;
}

export interface AdaptiveFormationSelection {
  practice: DailyFormationPractice;
  reason: string;
}

export type FormationPath = "starfall" | "void" | "stellar";

const PATH_CATEGORY_WEIGHTS: Record<FormationPath, readonly DailyFormationCategory[]> = {
  starfall: ["Mind", "Body", "Soul"],
  void: ["Soul", "Mind", "Body"],
  stellar: ["Soul", "Body", "Mind"],
};

const CATEGORY_KEYWORDS: Record<DailyFormationCategory, readonly string[]> = {
  Mind: [
    "anxious", "anxiety", "worry", "focus", "thought", "overthink", "learn", "study",
    "work", "clutter", "money", "prepare", "organize", "responsibility", "deadline", "home",
  ],
  Body: [
    "body", "sleep", "energy", "tired", "health", "walk", "exercise", "pain",
    "rest", "busy", "overwhelmed", "overwhelm", "exhausted", "burnout", "pause", "pressure",
  ],
  Soul: [
    "god", "faith", "pray", "prayer", "scripture", "church", "doubt", "spiritual",
    "relationship", "friend", "family", "marriage", "spouse", "conflict", "lonely", "listen",
    "serve", "help", "neighbor", "give", "generous", "community", "volunteer", "encourage",
  ],
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const formationCategoryCounts = (successfulPatterns: unknown): Record<string, number> => {
  if (!isRecord(successfulPatterns) || !isRecord(successfulPatterns.formation_categories)) return {};

  return Object.fromEntries(
    Object.entries(successfulPatterns.formation_categories)
      .filter((entry): entry is [string, number] => typeof entry[1] === "number"),
  );
};

const stableFraction = (value: string): number => {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0) / 4_294_967_295;
};

const reflectionText = (reflections: readonly FormationReflectionSignal[]): string =>
  reflections
    .map((reflection) => [
      reflection.mood,
      reflection.gratitude,
      reflection.wins,
      reflection.additionalReflection,
      reflection.tomorrowAdjustment,
    ].filter(Boolean).join(" "))
    .join(" ")
    .toLowerCase();

const includesKeyword = (text: string, keyword: string): boolean =>
  new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text);

export function selectAdaptiveDailyFormation({
  dateKey,
  userId,
  history = [],
  learning = {},
  reflections = [],
  path,
  focusCategory,
}: {
  dateKey: string;
  userId: string;
  history?: readonly FormationAssignmentHistory[];
  learning?: FormationLearningSignals;
  reflections?: readonly FormationReflectionSignal[];
  path?: FormationPath | null;
  focusCategory?: DailyFormationCategory | null;
}): AdaptiveFormationSelection {
  const orderedHistory = [...history].sort((left, right) =>
    right.practiceDate.localeCompare(left.practiceDate));
  const recentKeys = new Set(orderedHistory.slice(0, 10).map((item) => item.practiceKey));
  const categoryPractices = focusCategory
    ? DAILY_FORMATION_PRACTICES.filter((practice) => practice.category === focusCategory)
    : DAILY_FORMATION_PRACTICES;
  const availablePractices = categoryPractices.length > 0
    ? categoryPractices
    : DAILY_FORMATION_PRACTICES;
  const freshPractices = availablePractices.filter((practice) => !recentKeys.has(practice.id));
  const candidates = freshPractices.length > 0 ? freshPractices : [...availablePractices];

  const assignedByCategory = new Map<DailyFormationCategory, number>();
  for (const item of history) {
    assignedByCategory.set(item.category, (assignedByCategory.get(item.category) ?? 0) + 1);
  }
  const highestCategoryCount = Math.max(0, ...assignedByCategory.values());
  const recentModeHistory = orderedHistory.slice(0, 7);
  const assignedByMode = new Map<DailyFormationMode, number>();
  for (const item of recentModeHistory) {
    const mode = getDailyFormationPracticeById(item.practiceKey)?.mode;
    if (mode) assignedByMode.set(mode, (assignedByMode.get(mode) ?? 0) + 1);
  }
  const highestModeCount = Math.max(0, ...assignedByMode.values());
  const learnedCategoryCounts = formationCategoryCounts(learning.successfulPatterns);
  const recentReflectionText = reflectionText(reflections.slice(0, 3));
  const roughRecentDay = reflections.slice(0, 2).some((reflection) =>
    reflection.mood === "low" || reflection.mood === "rough");
  const overwhelmed = roughRecentDay
    || ["overwhelmed", "overwhelm", "exhausted", "burnout", "too much"].some((keyword) =>
      recentReflectionText.includes(keyword));

  const ranked = candidates.map((practice) => {
    let score = stableFraction(`${userId}:${dateKey}:${practice.id}`) * 0.5;
    const assignedCount = assignedByCategory.get(practice.category) ?? 0;
    score += (highestCategoryCount - assignedCount) * 1.15;
    const assignedModeCount = assignedByMode.get(practice.mode) ?? 0;
    score += (highestModeCount - assignedModeCount) * 0.65;
    if (recentModeHistory.length >= 4 && !assignedByMode.has(practice.mode)) score += 1.75;
    score += Math.min(2.25, (learnedCategoryCounts[practice.category] ?? 0) * 0.35);

    const pathCategories = path ? PATH_CATEGORY_WEIGHTS[path] : null;
    const pathCategoryIndex = pathCategories?.indexOf(practice.category) ?? -1;
    if (pathCategoryIndex >= 0) {
      score += 1.05 - (pathCategoryIndex * 0.2);
    }

    if (focusCategory && practice.category === focusCategory) {
      score += 9;
    }

    for (const keyword of CATEGORY_KEYWORDS[practice.category]) {
      if (includesKeyword(recentReflectionText, keyword)) score += 1.15;
    }

    if (overwhelmed) {
      if (practice.minutes <= 5) score += 2.5;
      if (practice.category === "Body") score += 2.25;
      if (practice.category === "Soul" || practice.category === "Mind") score += 0.75;
    } else if ((learning.overwhelmSignals ?? 0) > 0 && practice.minutes <= 5) {
      score += 0.35;
    }

    if (orderedHistory[0]?.category === practice.category) score -= 1.25;
    const latestMode = orderedHistory[0]
      ? getDailyFormationPracticeById(orderedHistory[0].practiceKey)?.mode
      : null;
    if (latestMode === practice.mode) score -= 0.75;
    return { practice, score };
  }).sort((left, right) => right.score - left.score);

  const practice = ranked[0]?.practice ?? DAILY_FORMATION_PRACTICES[0];
  const hasReflectionSignal = Object.values(CATEGORY_KEYWORDS)
    .flat()
    .some((keyword) => includesKeyword(recentReflectionText, keyword));
  const hasLearningSignal = Object.keys(learnedCategoryCounts).length > 0 || history.length > 0;

  return {
    practice,
    reason: focusCategory
      ? "Connected to the focus you chose with your Guide"
      : overwhelmed
      ? "A manageable step based on your recent reflection"
      : hasReflectionSignal
        ? "Chosen with your recent reflection in mind"
        : hasLearningSignal
          ? "Balanced from your recent practice patterns"
          : path
            ? "Prepared for your Path today"
            : "Prepared for today",
  };
}
