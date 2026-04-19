const CONVERSATIONAL_TITLE_LEAD_IN_PATTERN =
  /^(?:i(?:'m| am|m)?\s+(?:going\s+to|gonna)|i\s+(?:need|want|have)\s+to)\s+/i;

export function stripConversationalTaskLeadIn(
  value: string | null | undefined,
): string {
  let cleaned = (value ?? "").trim();

  while (CONVERSATIONAL_TITLE_LEAD_IN_PATTERN.test(cleaned)) {
    cleaned = cleaned.replace(CONVERSATIONAL_TITLE_LEAD_IN_PATTERN, "").trim();
  }

  return cleaned;
}

export function cleanGeneratedTaskTitle(
  value: string | null | undefined,
): string {
  return stripConversationalTaskLeadIn(value)
    .replace(/\s+/g, " ")
    .trim();
}

export function formatGeneratedTaskTitle(
  value: string | null | undefined,
): string {
  const cleaned = cleanGeneratedTaskTitle(value);
  if (!cleaned) return "";

  return cleaned
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
