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

export const LEGACY_ONLY_MENTOR_SLUGS = ["reign"] as const;
export type LegacyOnlyMentorSlug = (typeof LEGACY_ONLY_MENTOR_SLUGS)[number];

export const LEGACY_MENTOR_ALIASES: Record<string, ActiveMentorSlug> = {
  atlas: "sage",
  carmen: "icon",
  solace: "charles",
  elizabeth: "charles",
  sienna: "princess",
  stryker: "operator",
  eli: "rival",
};

export const MENTOR_DISPLAY_ORDER: readonly ActiveMentorSlug[] = [
  "sage",
  "lyra",
  "icon",
  "charles",
  "princess",
  "operator",
  "rival",
];

export const MENTOR_AVATAR_POSITION_MAP: Record<ActiveMentorSlug | LegacyOnlyMentorSlug, string> = {
  sage: "center 22%",
  lyra: "center 22%",
  icon: "center 18%",
  charles: "center 35%",
  princess: "center 18%",
  operator: "center 25%",
  rival: "center 18%",
  reign: "center 20%",
};

export const DEFAULT_MENTOR_AVATAR_POSITION = "center 25%";

const DISPLAY_ORDER_INDEX = new Map(
  MENTOR_DISPLAY_ORDER.map((slug, index) => [slug, index]),
);

export const normalizeMentorSlug = (value?: string | null): string | null => {
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
};

export const isActiveMentorSlug = (value: string): value is ActiveMentorSlug =>
  (ACTIVE_MENTOR_SLUGS as readonly string[]).includes(value);

export const isLegacyOnlyMentorSlug = (value: string): value is LegacyOnlyMentorSlug =>
  (LEGACY_ONLY_MENTOR_SLUGS as readonly string[]).includes(value);

export const resolveMentorSlugAlias = (
  value?: string | null,
): ActiveMentorSlug | LegacyOnlyMentorSlug | null => {
  const normalized = normalizeMentorSlug(value);
  if (!normalized) return null;

  if (isActiveMentorSlug(normalized)) return normalized;
  if (isLegacyOnlyMentorSlug(normalized)) return normalized;

  return LEGACY_MENTOR_ALIASES[normalized] ?? null;
};

export const resolveActiveMentorSlug = (value?: string | null): ActiveMentorSlug | null => {
  const resolved = resolveMentorSlugAlias(value);
  return resolved && isActiveMentorSlug(resolved) ? resolved : null;
};

export const getMentorDisplaySortIndex = (value?: string | null): number => {
  const resolved = resolveMentorSlugAlias(value);
  if (!resolved) return Number.MAX_SAFE_INTEGER;
  if (resolved === "reign") return Number.MAX_SAFE_INTEGER - 1;

  return DISPLAY_ORDER_INDEX.get(resolved) ?? Number.MAX_SAFE_INTEGER;
};
