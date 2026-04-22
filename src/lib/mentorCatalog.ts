import lyraMentorImage from "@/assets/lyra-mentor.png";
import theGuyMentorImage from "@/assets/the-guy-mentor.png";
import { normalizeMentorSlug, sortMentorsForDisplay } from "@/lib/mentorRoster";

export type MentorAvailability = "active" | "upcoming_unlockable";

export interface MentorBrowseEntry {
  id: string;
  name: string;
  slug: string;
  archetype: string;
  short_title: string | null;
  tone_description: string | null;
  style_description: string | null;
  target_user: string | null;
  signature_line: string | null;
  primary_color: string;
  avatar_url?: string | null;
  themes: string[];
  availability: MentorAvailability;
  unavailable_label?: string | null;
  unavailable_description?: string | null;
}

const LYRA_ACTIVE_FALLBACK: Partial<MentorBrowseEntry> = {
  name: "Lyra",
  slug: "lyra",
  archetype: "A luminous synthetic oracle who sees the pattern before anyone else does.",
  short_title: "Synthetic Oracle",
  tone_description: "Futuristic, poised, and all-seeing guidance for people who want clarity at a higher altitude.",
  style_description: "She speaks like an intelligence already three steps ahead, turning noise into signal and uncertainty into elegant direction.",
  target_user: "Builders, overthinkers, and strategists who want a brilliant feminine AI voice that makes complexity feel legible.",
  signature_line: "The pattern is already there. I will help you see it.",
  primary_color: "#A855F7",
  avatar_url: lyraMentorImage,
  themes: ["signal", "clarity", "future-facing"],
};

const UPCOMING_MENTOR_ORDER = ["the-guy"] as const;

const UPCOMING_MENTORS: readonly MentorBrowseEntry[] = [
  {
    id: "upcoming-the-guy",
    name: "The Guy",
    slug: "the-guy",
    archetype: "A hard-nosed field commander built for pressure, discipline, and decisive action.",
    short_title: "Field Commander",
    tone_description: "Direct, tactical, and battle-tested guidance for moments that need grit instead of hand-holding.",
    style_description: "He cuts straight to the mission, clears away hesitation, and pushes for clean execution under stress.",
    target_user: "People who want a soldier's voice in their corner when the path forward needs toughness, structure, and resolve.",
    signature_line: "You do not need perfect conditions. You need a plan and the will to execute it.",
    primary_color: "#C26B3C",
    avatar_url: theGuyMentorImage,
    themes: ["discipline", "mission", "execution"],
    availability: "upcoming_unlockable",
    unavailable_label: "Upcoming Unlockable",
    unavailable_description: "The Guy is visible in the mentor lineup, but he is not available to use yet.",
  },
] as const;

const upcomingSortIndex = new Map<string, number>(
  UPCOMING_MENTOR_ORDER.map((slug, index) => [slug, index]),
);

export const buildBrowseMentorCatalog = (
  activeMentors: MentorBrowseEntry[],
): MentorBrowseEntry[] => {
  const normalizedActiveMentors = sortMentorsForDisplay(activeMentors)
    .map((mentor) => {
      const lyraFallback = mentor.slug === "lyra" ? LYRA_ACTIVE_FALLBACK : null;

      return {
        ...lyraFallback,
        ...mentor,
        archetype: mentor.archetype ?? lyraFallback?.archetype ?? "Guide",
        short_title: mentor.short_title ?? lyraFallback?.short_title ?? null,
        tone_description: mentor.tone_description ?? lyraFallback?.tone_description ?? null,
        style_description: mentor.style_description ?? lyraFallback?.style_description ?? null,
        target_user: mentor.target_user ?? lyraFallback?.target_user ?? null,
        signature_line: mentor.signature_line ?? lyraFallback?.signature_line ?? null,
        themes: mentor.themes && mentor.themes.length > 0
          ? mentor.themes
          : lyraFallback?.themes ?? [],
        avatar_url: mentor.avatar_url ?? lyraFallback?.avatar_url ?? null,
        availability: "active" as const,
        unavailable_label: null,
        unavailable_description: null,
      };
    });
  const activeMentorSlugs = new Set(
    normalizedActiveMentors
      .map((mentor) => normalizeMentorSlug(mentor.slug))
      .filter((slug): slug is string => Boolean(slug)),
  );

  const sortedUpcomingMentors = [...UPCOMING_MENTORS]
    .filter((mentor) => !activeMentorSlugs.has(mentor.slug))
    .sort((left, right) => {
      const leftIndex = upcomingSortIndex.get(left.slug) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = upcomingSortIndex.get(right.slug) ?? Number.MAX_SAFE_INTEGER;
      if (leftIndex !== rightIndex) return leftIndex - rightIndex;
      return left.name.localeCompare(right.name);
    });

  return [...normalizedActiveMentors, ...sortedUpcomingMentors];
};
