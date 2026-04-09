const LEGACY_ACHIEVEMENT_TYPE_ALIASES = {
  all_tasks_complete: "perfect_day",
  challenge_veteran: "challenge_5_complete",
  comeback_arc: "comeback",
  first_challenge: "challenge_complete",
  first_checkin: "first_check_in",
  first_mission: "first_quest",
  first_peptalk: "first_pep_talk",
  month_streak: "streak_30_day",
  peptalk_listener_10: "pep_talk_listener_10",
  peptalk_listener_50: "pep_talk_listener_50",
  three_day_streak: "streak_3_day",
  total_attributes_50: "total_attributes_250",
  two_week_streak: "streak_14_day",
  week_streak: "streak_7_day",
} as const;

const DYNAMIC_ACHIEVEMENT_TYPE_ALIASES: Array<[RegExp, string]> = [
  [/^story_chapter_\d+$/i, "story_chapter"],
];

const CANONICAL_TO_LEGACY = Object.entries(LEGACY_ACHIEVEMENT_TYPE_ALIASES).reduce<
  Record<string, string[]>
>((accumulator, [legacyType, canonicalType]) => {
  accumulator[canonicalType] ??= [];
  accumulator[canonicalType].push(legacyType);
  return accumulator;
}, {});

export const normalizeAchievementType = (type: string | null | undefined): string => {
  const trimmedType = type?.trim() ?? "";
  if (!trimmedType) return "";

  const staticAlias = LEGACY_ACHIEVEMENT_TYPE_ALIASES[
    trimmedType as keyof typeof LEGACY_ACHIEVEMENT_TYPE_ALIASES
  ];
  if (staticAlias) {
    return staticAlias;
  }

  for (const [pattern, canonicalType] of DYNAMIC_ACHIEVEMENT_TYPE_ALIASES) {
    if (pattern.test(trimmedType)) {
      return canonicalType;
    }
  }

  return trimmedType;
};

export const getAchievementTypeVariants = (type: string): string[] => {
  const canonicalType = normalizeAchievementType(type);
  if (!canonicalType) return [];

  return Array.from(
    new Set([canonicalType, ...(CANONICAL_TO_LEGACY[canonicalType] ?? [])]),
  );
};

export const hasDynamicAchievementTypeAlias = (type: string): boolean =>
  DYNAMIC_ACHIEVEMENT_TYPE_ALIASES.some(([pattern]) => pattern.test(type.trim()));
