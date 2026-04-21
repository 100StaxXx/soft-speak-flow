import {
  ACTIVE_MENTOR_SLUGS,
  resolveSupportedMentorSlug,
  type ActiveMentorSlug,
  type SupportedMentorSlug,
} from "./mentorRoster.ts";

export interface MentorDailyTheme {
  topic_category: string;
  intensity: string;
  triggers: string[];
}

export { ACTIVE_MENTOR_SLUGS };
export type { ActiveMentorSlug };

const SAFE_DEFAULT_THEME: MentorDailyTheme = {
  topic_category: "mindset",
  intensity: "medium",
  triggers: ["Feeling Stuck", "In Transition"],
};

const THEMES_BY_MENTOR: Record<SupportedMentorSlug, MentorDailyTheme[]> = {
  sage: [
    {
      topic_category: "focus",
      intensity: "soft",
      triggers: ["Anxious & Overthinking", "Feeling Stuck"],
    },
    {
      topic_category: "mindset",
      intensity: "soft",
      triggers: ["Heavy or Low", "Emotionally Hurt"],
    },
    {
      topic_category: "reflection",
      intensity: "medium",
      triggers: ["In Transition", "Late Night Spiral"],
    },
  ],
  lyra: [
    {
      topic_category: "clarity",
      intensity: "medium",
      triggers: ["Anxious & Overthinking", "Feeling Stuck"],
    },
    {
      topic_category: "strategy",
      intensity: "medium",
      triggers: ["In Transition", "Avoiding Action"],
    },
    {
      topic_category: "signal",
      intensity: "soft",
      triggers: ["Late Night Spiral", "Self-Doubt"],
    },
  ],
  icon: [
    {
      topic_category: "confidence",
      intensity: "medium",
      triggers: ["Self-Doubt", "Feeling Stuck"],
    },
    {
      topic_category: "identity",
      intensity: "medium",
      triggers: ["In Transition", "Avoiding Action"],
    },
    {
      topic_category: "boundaries",
      intensity: "medium",
      triggers: ["Emotionally Hurt", "Self-Doubt"],
    },
  ],
  charles: [
    {
      topic_category: "discipline",
      intensity: "strong",
      triggers: ["Avoiding Action", "Unmotivated"],
    },
    {
      topic_category: "focus",
      intensity: "strong",
      triggers: ["Feeling Stuck", "Frustrated"],
    },
  ],
  princess: [
    {
      topic_category: "mindset",
      intensity: "soft",
      triggers: ["Emotionally Hurt", "Heavy or Low"],
    },
    {
      topic_category: "confidence",
      intensity: "soft",
      triggers: ["Self-Doubt", "Heavy or Low"],
    },
    {
      topic_category: "habits",
      intensity: "medium",
      triggers: ["In Transition", "Feeling Stuck"],
    },
  ],
  operator: [
    {
      topic_category: "discipline",
      intensity: "strong",
      triggers: ["Needing Discipline", "Feeling Stuck"],
    },
    {
      topic_category: "focus",
      intensity: "medium",
      triggers: ["Anxious & Overthinking", "Motivated & Ready"],
    },
    {
      topic_category: "business",
      intensity: "strong",
      triggers: ["In Transition", "Avoiding Action"],
    },
  ],
  rival: [
    {
      topic_category: "physique",
      intensity: "strong",
      triggers: ["Unmotivated", "Frustrated", "Needing Discipline"],
    },
    {
      topic_category: "discipline",
      intensity: "strong",
      triggers: ["Avoiding Action", "Motivated & Ready"],
    },
    {
      topic_category: "confidence",
      intensity: "medium",
      triggers: ["Self-Doubt", "Feeling Stuck"],
    },
  ],
};

export function resolveMentorSlug(
  mentorSlug: string | null | undefined,
): SupportedMentorSlug | null {
  return resolveSupportedMentorSlug(mentorSlug);
}

export function getMentorThemes(
  mentorSlug: string | null | undefined,
): MentorDailyTheme[] {
  const resolved = resolveMentorSlug(mentorSlug);
  if (!resolved) {
    return [SAFE_DEFAULT_THEME];
  }
  return THEMES_BY_MENTOR[resolved] ?? [SAFE_DEFAULT_THEME];
}

export function selectThemeForDate(
  mentorSlug: string | null | undefined,
  date: Date,
): {
  requestedMentorSlug: string | null;
  resolvedMentorSlug: SupportedMentorSlug | null;
  theme: MentorDailyTheme;
  usedFallbackTheme: boolean;
} {
  const requestedMentorSlug =
    typeof mentorSlug === "string" ? mentorSlug.trim().toLowerCase() || null : null;
  const resolvedMentorSlug = resolveMentorSlug(mentorSlug);
  const themes = getMentorThemes(mentorSlug);

  const startOfYearUtc = Date.UTC(date.getUTCFullYear(), 0, 0);
  const currentDayUtc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const dayOfYear = Math.floor((currentDayUtc - startOfYearUtc) / 86400000);
  const themeIndex = dayOfYear % themes.length;
  const theme = themes[themeIndex] ?? SAFE_DEFAULT_THEME;

  return {
    requestedMentorSlug,
    resolvedMentorSlug,
    theme,
    usedFallbackTheme: resolvedMentorSlug === null,
  };
}
