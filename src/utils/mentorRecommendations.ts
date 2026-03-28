import {
  MENTOR_FALLBACK_TAGS,
  canonicalizeTags,
  type CanonicalTrait,
} from "@/config/mentorMatching";

export const MOOD_TRAIT_MAP = {
  unmotivated: ["momentum", "supportive"],
  overthinking: ["calm", "healing"],
  stressed: ["calm", "supportive"],
  low_energy: ["supportive", "healing"],
  content: ["confidence", "calm"],
  disciplined: ["discipline", "momentum"],
  focused: ["discipline", "calm"],
  inspired: ["momentum", "confidence"],
} as const satisfies Record<string, readonly CanonicalTrait[]>;

const MOOD_LABELS: Record<string, string> = {
  unmotivated: "unmotivated",
  overthinking: "overthinking",
  stressed: "stress",
  low_energy: "low energy",
  content: "content",
  disciplined: "discipline",
  focused: "focus",
  inspired: "inspiration",
};

const TRAIT_REASON_LABELS: Record<CanonicalTrait, string> = {
  discipline: "discipline",
  calm: "calm",
  healing: "healing",
  confidence: "confidence",
  momentum: "momentum",
  supportive: "support",
};

export interface MentorRecommendationCandidate {
  id: string;
  name: string;
  slug?: string | null;
  tags?: string[] | null;
  themes?: string[] | null;
  tone_description?: string | null;
  style_description?: string | null;
  target_user?: string | null;
  intensity_level?: string | null;
  short_title?: string | null;
}

export interface MentorRecommendation<TMentor extends MentorRecommendationCandidate> {
  mentor: TMentor;
  score: number;
  matchedTraits: CanonicalTrait[];
  traits: CanonicalTrait[];
  reasonLabel: string;
}

const tokenizeText = (value?: string | null): string[] => {
  if (!value) return [];

  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return [];

  const tokens = normalized.split(" ");
  const bigrams = tokens.slice(0, -1).map((token, index) => `${token}_${tokens[index + 1]}`);

  return [normalized.replace(/\s+/g, "_"), ...tokens, ...bigrams];
};

export const getMoodTraits = (mood?: string | null): CanonicalTrait[] => {
  if (!mood) return [];
  const normalized = mood.trim().toLowerCase();
  const traits = MOOD_TRAIT_MAP[normalized as keyof typeof MOOD_TRAIT_MAP];
  return traits ? [...traits] : [];
};

export const getMoodLabel = (mood?: string | null): string | null => {
  if (!mood) return null;
  const normalized = mood.trim().toLowerCase();
  return MOOD_LABELS[normalized] ?? normalized.replace(/_/g, " ");
};

export const collectMentorTraits = (
  mentor: MentorRecommendationCandidate,
): CanonicalTrait[] => {
  const canonicalTraits = canonicalizeTags([
    ...(mentor.tags ?? []),
    ...(mentor.themes ?? []),
    ...tokenizeText(mentor.tone_description),
    ...tokenizeText(mentor.style_description),
    ...tokenizeText(mentor.target_user),
    ...tokenizeText(mentor.intensity_level),
    ...tokenizeText(mentor.short_title),
  ]);

  const slug = mentor.slug?.trim().toLowerCase();
  const fallbackTraits = slug ? MENTOR_FALLBACK_TAGS[slug] ?? [] : [];

  return Array.from(new Set<CanonicalTrait>([...canonicalTraits, ...fallbackTraits]));
};

const buildReasonLabel = (
  mood: string,
  desiredTraits: CanonicalTrait[],
  matchedTraits: CanonicalTrait[],
): string => {
  const moodLabel = getMoodLabel(mood) ?? "right now";
  const [primaryTrait, secondaryTrait] = desiredTraits;
  const matchesPrimary = Boolean(primaryTrait) && matchedTraits.includes(primaryTrait);
  const matchesSecondary = Boolean(secondaryTrait) && matchedTraits.includes(secondaryTrait);

  if (matchesPrimary && matchesSecondary) {
    return `Best for ${moodLabel}`;
  }

  if (matchesPrimary) {
    return `Strong fit for ${moodLabel}`;
  }

  const leadingTrait = matchedTraits[0] ?? secondaryTrait ?? primaryTrait;
  return leadingTrait
    ? `Good when you want ${TRAIT_REASON_LABELS[leadingTrait]}`
    : `Good for ${moodLabel}`;
};

export const getMentorRecommendations = <TMentor extends MentorRecommendationCandidate>(
  mentors: TMentor[],
  mood?: string | null,
  limit = 2,
): MentorRecommendation<TMentor>[] => {
  const desiredTraits = getMoodTraits(mood);
  if (!mood || desiredTraits.length === 0) return [];

  return mentors
    .map((mentor) => {
      const traits = collectMentorTraits(mentor);
      const matchedTraits = desiredTraits.filter((trait) => traits.includes(trait));
      if (matchedTraits.length === 0) {
        return null;
      }

      const score = desiredTraits.reduce((total, trait, index) => {
        if (!traits.includes(trait)) return total;
        return total + (index === 0 ? 5 : 3);
      }, matchedTraits.length > 1 ? 1 : 0);

      return {
        mentor,
        score,
        matchedTraits,
        traits,
        reasonLabel: buildReasonLabel(mood, desiredTraits, matchedTraits),
      } satisfies MentorRecommendation<TMentor>;
    })
    .filter((value): value is MentorRecommendation<TMentor> => Boolean(value))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (right.matchedTraits.length !== left.matchedTraits.length) {
        return right.matchedTraits.length - left.matchedTraits.length;
      }
      return left.mentor.name.localeCompare(right.mentor.name);
    })
    .slice(0, Math.max(0, limit));
};
