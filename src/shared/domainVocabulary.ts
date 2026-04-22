/**
 * Canonical domain vocabulary at the app boundary.
 *
 * Storage, endpoints, and legacy hook names remain unchanged while the
 * compatibility-first normalization work is in progress.
 */
export const CANONICAL_DOMAIN_TERMS = {
  userProfile: "UserProfile",
  campaign: "Campaign",
  quest: "Quest",
  subtask: "Subtask",
  journalEntry: "JournalEntry",
  calendarItem: "CalendarItem",
  memoryItem: "MemoryItem",
  aiActivity: "AiActivity",
} as const;

export type CanonicalDomainTerm =
  (typeof CANONICAL_DOMAIN_TERMS)[keyof typeof CANONICAL_DOMAIN_TERMS];

/**
 * Alias map for storage-era and legacy UI nouns.
 * `MemoryItem` is intentionally present only as future vocabulary in this pass.
 */
export const LEGACY_DOMAIN_ALIASES = {
  profile: CANONICAL_DOMAIN_TERMS.userProfile,
  epic: CANONICAL_DOMAIN_TERMS.campaign,
  epics: CANONICAL_DOMAIN_TERMS.campaign,
  task: CANONICAL_DOMAIN_TERMS.quest,
  tasks: CANONICAL_DOMAIN_TERMS.quest,
  daily_task: CANONICAL_DOMAIN_TERMS.quest,
  daily_tasks: CANONICAL_DOMAIN_TERMS.quest,
  checklist_item: CANONICAL_DOMAIN_TERMS.subtask,
  subtask: CANONICAL_DOMAIN_TERMS.subtask,
  reflection: CANONICAL_DOMAIN_TERMS.journalEntry,
  reflections: CANONICAL_DOMAIN_TERMS.journalEntry,
  evening_reflection: CANONICAL_DOMAIN_TERMS.journalEntry,
  check_in: CANONICAL_DOMAIN_TERMS.journalEntry,
  daily_check_in: CANONICAL_DOMAIN_TERMS.journalEntry,
  calendar_event: CANONICAL_DOMAIN_TERMS.calendarItem,
  external_calendar_event: CANONICAL_DOMAIN_TERMS.calendarItem,
  ai_interaction: CANONICAL_DOMAIN_TERMS.aiActivity,
  companion_chat: CANONICAL_DOMAIN_TERMS.aiActivity,
  companion_pending_action: CANONICAL_DOMAIN_TERMS.aiActivity,
} as const;

export type LegacyDomainAlias = keyof typeof LEGACY_DOMAIN_ALIASES;

export const resolveCanonicalDomainTerm = (
  value: string,
): CanonicalDomainTerm | null => {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");

  if (normalized in LEGACY_DOMAIN_ALIASES) {
    return LEGACY_DOMAIN_ALIASES[normalized as LegacyDomainAlias];
  }

  const canonical = Object.values(CANONICAL_DOMAIN_TERMS).find(
    (term) => term.toLowerCase() === normalized,
  );

  return canonical ?? null;
};
