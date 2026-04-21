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

export type SupportedMentorSlug = ActiveMentorSlug;

export const normalizeMentorSlug = (value?: string | null): string | null => {
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
};

export const isActiveMentorSlug = (value: string): value is ActiveMentorSlug =>
  (ACTIVE_MENTOR_SLUGS as readonly string[]).includes(value);

export const resolveSupportedMentorSlug = (
  value?: string | null,
): SupportedMentorSlug | null => {
  const normalized = normalizeMentorSlug(value);
  if (!normalized) return null;

  if (isActiveMentorSlug(normalized)) return normalized;
  return null;
};

export const resolveActiveMentorSlug = (value?: string | null): ActiveMentorSlug | null => {
  const resolved = resolveSupportedMentorSlug(value);
  return resolved && isActiveMentorSlug(resolved) ? resolved : null;
};
