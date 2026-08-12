export interface GracewardCompanionStoryChapter {
  visualStage: number;
  levelStart: number;
  levelEnd: number;
  formName: string;
  chapterTitle: string;
  theme: string;
  worldScale: string;
  bondDevelopment: string;
}

export const GRACEWARD_COMPANION_STORY_CHAPTERS: readonly GracewardCompanionStoryChapter[] = [
  { visualStage: 0, levelStart: 0, levelEnd: 0, formName: "Beginning", chapterTitle: "The Quiet Spark", theme: "a living beginning that responds to patient presence", worldScale: "one intimate place of safety and anticipation", bondDevelopment: "recognition before language" },
  { visualStage: 1, levelStart: 1, levelEnd: 4, formName: "Young", chapterTitle: "First Footprints", theme: "trust, vulnerability, and the courage to begin", worldScale: "a first path close to home", bondDevelopment: "learning the user's rhythm" },
  { visualStage: 2, levelStart: 5, levelEnd: 12, formName: "Growing", chapterTitle: "The Listening Path", theme: "curiosity shaped by real choices and daily practice", worldScale: "a widening path with playful discoveries", bondDevelopment: "shared habits becoming memory" },
  { visualStage: 3, levelStart: 13, levelEnd: 20, formName: "Rooted", chapterTitle: "Roots Beneath the Road", theme: "returning, resilience, and what keeps a person grounded", worldScale: "a living region marked by earlier choices", bondDevelopment: "staying connected through difficult days" },
  { visualStage: 4, levelStart: 21, levelEnd: 35, formName: "Steady", chapterTitle: "The Shelter We Carry", theme: "protecting space for what matters without hardening", worldScale: "a community-sized challenge that needs steady care", bondDevelopment: "the companion learning how to comfort and guard" },
  { visualStage: 5, levelStart: 36, levelEnd: 55, formName: "Flourishing", chapterTitle: "The Widening Light", theme: "quiet formation becoming visible and generous", worldScale: "a flourishing world changed by consistent care", bondDevelopment: "confident expression and shared service" },
  { visualStage: 6, levelStart: 56, levelEnd: 80, formName: "Majestic", chapterTitle: "The High Country", theme: "strength and gentleness held together under pressure", worldScale: "a high-stakes passage requiring wisdom, courage, and restraint", bondDevelopment: "rare species-specific abilities earned through faithfulness" },
  { visualStage: 7, levelStart: 81, levelEnd: 100, formName: "Grand", chapterTitle: "The Everward Horizon", theme: "an enduring bond that keeps opening into new life", worldScale: "a grand horizon built from the whole remembered journey", bondDevelopment: "a living shared history rather than a final ending" },
] as const;

export const resolveGracewardCompanionStoryChapter = (
  level: number,
): GracewardCompanionStoryChapter => {
  const safeLevel = Math.max(0, Math.min(100, Math.floor(Number.isFinite(level) ? level : 0)));
  return GRACEWARD_COMPANION_STORY_CHAPTERS.find(
    (chapter) => safeLevel >= chapter.levelStart && safeLevel <= chapter.levelEnd,
  ) ?? GRACEWARD_COMPANION_STORY_CHAPTERS[0];
};

export interface GracewardDailyThreadStorySignal {
  thread_date?: string | null;
  mentor_name?: string | null;
  focus_label?: string | null;
  companion_answer_label?: string | null;
  encouragement_completed_at?: string | null;
  practice_completed_at?: string | null;
  evening_reflected_at?: string | null;
}

export const buildGracewardFormationMemory = (
  threads: readonly GracewardDailyThreadStorySignal[] | null | undefined,
): string => {
  const meaningful = (threads ?? []).flatMap((thread) => {
    const signals = [
      thread.focus_label ? `chose “${thread.focus_label}” as a daily focus` : null,
      thread.companion_answer_label ? `told the companion “${thread.companion_answer_label}”` : null,
      thread.encouragement_completed_at ? "received the Guide's encouragement" : null,
      thread.practice_completed_at ? "carried a daily practice into action" : null,
      thread.evening_reflected_at ? "made space for evening reflection" : null,
    ].filter(Boolean);
    return signals.length > 0
      ? [`${thread.thread_date ?? "A recent day"}: ${signals.join(", ")}.`]
      : [];
  });

  return meaningful.length > 0
    ? meaningful.join("\n")
    : "No recent Guide-thread choices are available. Keep the chapter welcoming and do not invent completed practices.";
};
