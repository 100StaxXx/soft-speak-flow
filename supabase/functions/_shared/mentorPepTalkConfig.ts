export interface MentorDailyTheme {
  topic_category: string;
  intensity: string;
  triggers: string[];
}

export const ACTIVE_MENTOR_SLUGS = [
  "atlas",
  "eli",
  "stryker",
  "sienna",
  "carmen",
  "reign",
  "solace",
] as const;

export type ActiveMentorSlug = (typeof ACTIVE_MENTOR_SLUGS)[number];

export const LEGACY_MENTOR_ALIASES: Record<string, ActiveMentorSlug> = {
  elizabeth: "solace",
};

const SAFE_DEFAULT_THEME: MentorDailyTheme = {
  topic_category: "mindset",
  intensity: "medium",
  triggers: ["Feeling Stuck", "In Transition"],
};

const THEMES_BY_MENTOR: Record<ActiveMentorSlug, MentorDailyTheme[]> = {
  atlas: [
    {
      topic_category: "focus",
      intensity: "medium",
      triggers: ["Anxious & Overthinking", "Feeling Stuck"],
    },
    {
      topic_category: "mindset",
      intensity: "medium",
      triggers: ["In Transition", "Self-Doubt"],
    },
    {
      topic_category: "business",
      intensity: "medium",
      triggers: ["In Transition", "Avoiding Action"],
    },
  ],
  eli: [
    {
      topic_category: "confidence",
      intensity: "soft",
      triggers: ["Self-Doubt", "Heavy or Low"],
    },
    {
      topic_category: "mindset",
      intensity: "medium",
      triggers: ["Heavy or Low", "Emotionally Hurt"],
    },
  ],
  stryker: [
    {
      topic_category: "physique",
      intensity: "strong",
      triggers: ["Unmotivated", "Needing Discipline", "Frustrated"],
    },
    {
      topic_category: "business",
      intensity: "strong",
      triggers: ["Motivated & Ready", "Feeling Stuck"],
    },
  ],
  sienna: [
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
  ],
  carmen: [
    {
      topic_category: "discipline",
      intensity: "strong",
      triggers: ["Avoiding Action", "Needing Discipline"],
    },
    {
      topic_category: "business",
      intensity: "strong",
      triggers: ["In Transition", "Feeling Stuck"],
    },
  ],
  reign: [
    {
      topic_category: "physique",
      intensity: "strong",
      triggers: ["Unmotivated", "Needing Discipline", "Frustrated"],
    },
    {
      topic_category: "business",
      intensity: "strong",
      triggers: ["Motivated & Ready", "Feeling Stuck"],
    },
    {
      topic_category: "discipline",
      intensity: "strong",
      triggers: ["Avoiding Action", "Needing Discipline"],
    },
  ],
  solace: [
    {
      topic_category: "mindset",
      intensity: "soft",
      triggers: ["Heavy or Low", "Emotionally Hurt"],
    },
    {
      topic_category: "focus",
      intensity: "soft",
      triggers: ["Anxious & Overthinking", "Feeling Stuck"],
    },
  ],
};

function normalizeMentorSlug(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function resolveMentorSlug(
  mentorSlug: string | null | undefined,
): ActiveMentorSlug | null {
  const normalized = normalizeMentorSlug(mentorSlug);
  if (!normalized) return null;

  if ((ACTIVE_MENTOR_SLUGS as readonly string[]).includes(normalized)) {
    return normalized as ActiveMentorSlug;
  }

  return LEGACY_MENTOR_ALIASES[normalized] ?? null;
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
  resolvedMentorSlug: ActiveMentorSlug | null;
  theme: MentorDailyTheme;
  usedFallbackTheme: boolean;
} {
  const requestedMentorSlug = normalizeMentorSlug(mentorSlug);
  const resolvedMentorSlug = resolveMentorSlug(mentorSlug);
  const themes = getMentorThemes(mentorSlug);

  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000,
  );
  const themeIndex = dayOfYear % themes.length;
  const theme = themes[themeIndex] ?? SAFE_DEFAULT_THEME;

  return {
    requestedMentorSlug,
    resolvedMentorSlug,
    theme,
    usedFallbackTheme: resolvedMentorSlug === null,
  };
}
