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

export const MENTOR_DISPLAY_NAMES: Record<ActiveMentorSlug, string> = {
  sage: "Micah",
  lyra: "Clara",
  icon: "Lydia",
  charles: "Jude",
  princess: "Grace",
  operator: "Ezra",
  rival: "Caleb",
};

export const LEGACY_SUPPORTED_MENTOR_SLUGS = ["reign"] as const;
export type LegacySupportedMentorSlug = (typeof LEGACY_SUPPORTED_MENTOR_SLUGS)[number];

export type SupportedMentorSlug = ActiveMentorSlug | LegacySupportedMentorSlug;

export const LEGACY_MENTOR_ALIASES: Record<string, ActiveMentorSlug> = {
  atlas: "sage",
  micah: "sage",
  "the sage": "sage",
  carmen: "icon",
  lydia: "icon",
  "the icon": "icon",
  solace: "charles",
  elizabeth: "charles",
  jude: "charles",
  sienna: "princess",
  grace: "princess",
  "the princess": "princess",
  stryker: "operator",
  ezra: "operator",
  "the operator": "operator",
  eli: "rival",
  caleb: "rival",
  "the rival": "rival",
  clara: "lyra",
};

export const normalizeMentorSlug = (value?: string | null): string | null => {
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
};

export const isActiveMentorSlug = (value: string): value is ActiveMentorSlug =>
  (ACTIVE_MENTOR_SLUGS as readonly string[]).includes(value);

export const isLegacySupportedMentorSlug = (
  value: string,
): value is LegacySupportedMentorSlug =>
  (LEGACY_SUPPORTED_MENTOR_SLUGS as readonly string[]).includes(value);

export const resolveSupportedMentorSlug = (
  value?: string | null,
): SupportedMentorSlug | null => {
  const normalized = normalizeMentorSlug(value);
  if (!normalized) return null;

  if (isActiveMentorSlug(normalized)) return normalized;
  if (isLegacySupportedMentorSlug(normalized)) return normalized;

  return LEGACY_MENTOR_ALIASES[normalized] ?? null;
};

export const resolveActiveMentorSlug = (value?: string | null): ActiveMentorSlug | null => {
  const resolved = resolveSupportedMentorSlug(value);
  return resolved && isActiveMentorSlug(resolved) ? resolved : null;
};
