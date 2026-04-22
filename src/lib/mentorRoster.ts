export const ACTIVE_MENTOR_SLUGS = [
  "sage",
  "lyra",
  "icon",
  "charles",
  "princess",
  "operator",
  "rival",
] as const;

export type ActiveMentorSlug = (typeof ACTIVE_MENTOR_SLUGS)[number];

export const MENTOR_DISPLAY_ORDER: readonly ActiveMentorSlug[] = [
  "sage",
  "lyra",
  "icon",
  "charles",
  "princess",
  "operator",
  "rival",
];

export const MENTOR_AVATAR_POSITION_MAP: Record<ActiveMentorSlug, string> = {
  sage: "center 22%",
  lyra: "center 18%",
  icon: "center 18%",
  charles: "center 35%",
  princess: "center 18%",
  operator: "center 25%",
  rival: "center 18%",
};

export const DEFAULT_MENTOR_AVATAR_POSITION = "center 25%";

const DISPLAY_ORDER_INDEX = new Map(
  MENTOR_DISPLAY_ORDER.map((slug, index) => [slug, index]),
);

type MentorSlugRecord = {
  slug?: string | null;
};

type MentorSortableRecord = MentorSlugRecord & {
  name?: string | null;
};

export const normalizeMentorSlug = (value?: string | null): string | null => {
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
};

export const isActiveMentorSlug = (value: string): value is ActiveMentorSlug =>
  (ACTIVE_MENTOR_SLUGS as readonly string[]).includes(value);

export const resolveMentorSlugAlias = (
  value?: string | null,
): ActiveMentorSlug | null => {
  const normalized = normalizeMentorSlug(value);
  if (!normalized) return null;

  if (isActiveMentorSlug(normalized)) return normalized;
  return null;
};

export const resolveActiveMentorSlug = (value?: string | null): ActiveMentorSlug | null => {
  const resolved = resolveMentorSlugAlias(value);
  return resolved && isActiveMentorSlug(resolved) ? resolved : null;
};

export const hasCanonicalActiveMentorSlug = <T extends MentorSlugRecord>(
  mentor: T | null | undefined,
): mentor is T & { slug: ActiveMentorSlug } => {
  return resolveActiveMentorSlug(mentor?.slug) !== null;
};

export const filterCanonicalActiveMentors = <T extends MentorSlugRecord>(
  mentors: readonly T[] | null | undefined,
): T[] => {
  if (!mentors || mentors.length === 0) return [];
  return mentors.filter(hasCanonicalActiveMentorSlug);
};

export const sortMentorsForDisplay = <T extends MentorSortableRecord>(
  mentors: readonly T[] | null | undefined,
): T[] => {
  if (!mentors || mentors.length === 0) return [];

  return [...mentors].sort((left, right) => {
    const leftIndex = getMentorDisplaySortIndex(left.slug);
    const rightIndex = getMentorDisplaySortIndex(right.slug);
    const leftIsCanonical = leftIndex !== Number.MAX_SAFE_INTEGER;
    const rightIsCanonical = rightIndex !== Number.MAX_SAFE_INTEGER;

    if (leftIsCanonical && rightIsCanonical && leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }

    if (leftIsCanonical !== rightIsCanonical) {
      return leftIsCanonical ? -1 : 1;
    }

    const leftName = left.name?.trim() ?? "";
    const rightName = right.name?.trim() ?? "";
    const nameDelta = leftName.localeCompare(rightName);
    if (nameDelta !== 0) return nameDelta;

    const leftSlug = normalizeMentorSlug(left.slug) ?? "";
    const rightSlug = normalizeMentorSlug(right.slug) ?? "";
    return leftSlug.localeCompare(rightSlug);
  });
};

export const sortCanonicalMentors = <T extends MentorSortableRecord>(
  mentors: readonly T[] | null | undefined,
): T[] => {
  return sortMentorsForDisplay(filterCanonicalActiveMentors(mentors));
};

export const getMentorDisplaySortIndex = (value?: string | null): number => {
  const resolved = resolveMentorSlugAlias(value);
  if (!resolved) return Number.MAX_SAFE_INTEGER;

  return DISPLAY_ORDER_INDEX.get(resolved) ?? Number.MAX_SAFE_INTEGER;
};
