const DAY_PLANNING_EXCLUSION_REGEX =
  /\b(plan(?: my)? (?:day|today|tomorrow|week)|organize(?: my)? (?:day|today|week)|prioritize(?: my)? (?:day|today|week)|show me (?:today|tomorrow|my|this|next|upcoming).*(?:route|schedule)|how does (?:today|tomorrow|my day|my upcoming|this|next|upcoming).*(?:look|feel)|help me make room for what matters|help me figure out(?: my day| today| what matters| what to focus on)?|what matters most)\b/i;

const GOAL_BREAKDOWN_STARTER_REGEX =
  /\b(help me break a big goal into steps|break a big goal into steps|break this goal down|turn this into steps)\b/i;

const GOAL_BREAKDOWN_SCAFFOLD_REGEXES = [
  /^(?:help me\s+)?break a big goal into steps[\s:,-]*/i,
  /^break a big goal into steps[\s:,-]*/i,
  /^break this goal down[\s:,-]*/i,
  /^turn this into steps[\s:,-]*/i,
  /^(?:i need help(?: with)?|help me(?: with)?)\s+/i,
] as const;

const ACTION_KEYWORDS = [
  "launch",
  "build",
  "create",
  "develop",
  "design",
  "implement",
  "plan",
  "organize",
  "set up",
  "setup",
  "finish",
  "complete",
  "start",
  "begin",
  "make",
  "write",
  "research",
  "learn",
  "master",
  "study",
  "pass",
  "get",
  "achieve",
  "earn",
  "become",
] as const;

const PREPARATION_PHRASES = [
  "prepare for",
  "get ready for",
  "study for",
  "practice for",
  "train for",
  "prep for",
  "preparing for",
  "ready for",
  "work toward",
  "working toward",
  "aim for",
  "aiming for",
  "for the",
] as const;

const GOAL_SUBJECTS = [
  "exam",
  "certification",
  "degree",
  "license",
  "marathon",
  "wedding",
  "business",
  "company",
  "app",
  "website",
  "project",
  "move",
  "house",
  "career",
  "job",
  "promotion",
  "interview",
  "presentation",
  "launch",
  "renovation",
  "trip",
  "vacation",
] as const;

const FUTURE_DATE_REGEX =
  /\bby\s+(january|february|march|april|may|june|july|august|september|october|november|december|\d{4})\b/i;
const FUTURE_DATE_PHRASE_REGEX =
  /\b(this year|next year|end of year|by end of|by the end)\b/i;
const GENERIC_PLANNING_LEAD_IN_REGEX =
  /^(?:help me\s+)?(?:plan|organize|prioritize)\b/i;

const normalizeSpacing = (value: string | null | undefined): string =>
  (value ?? "")
    .replace(/\s+/g, " ")
    .trim();

const resolveNow = (now?: Date | number): number => {
  if (now instanceof Date) return now.getTime();
  if (typeof now === "number") return now;
  return Date.now();
};

export interface LooksLikeBigGoalOptions {
  now?: Date | number;
}

export const isGoalBreakdownStarterMessage = (message: string): boolean =>
  GOAL_BREAKDOWN_STARTER_REGEX.test(message.trim());

export function looksLikeBigGoal(
  text: string,
  estimatedDuration?: number | null,
  scheduledDate?: string | null,
  options: LooksLikeBigGoalOptions = {},
): boolean {
  if (!text) return false;

  const cleanText = text.toLowerCase().trim();
  if (!cleanText) return false;
  if (DAY_PLANNING_EXCLUSION_REGEX.test(cleanText)) return false;

  const hasFutureDatePhrase = FUTURE_DATE_REGEX.test(cleanText) ||
    FUTURE_DATE_PHRASE_REGEX.test(cleanText);
  const scheduledDateValue = scheduledDate ? new Date(scheduledDate).getTime() : Number.NaN;
  const isFarOut = Number.isFinite(scheduledDateValue) &&
    (scheduledDateValue - resolveNow(options.now)) > 14 * 24 * 60 * 60 * 1000;

  const hasActionKeyword = ACTION_KEYWORDS.some((keyword) => cleanText.includes(keyword));
  const hasPreparationPhrase = PREPARATION_PHRASES.some((phrase) => cleanText.includes(phrase));
  const hasGoalSubject = GOAL_SUBJECTS.some((subject) => cleanText.includes(subject));
  const isLongText = cleanText.length > 35;
  const hasNoDuration = !estimatedDuration;

  if (
    GENERIC_PLANNING_LEAD_IN_REGEX.test(cleanText) &&
    !hasPreparationPhrase &&
    !hasGoalSubject &&
    !hasFutureDatePhrase &&
    !isLongText
  ) {
    return false;
  }

  return (
    hasPreparationPhrase ||
    (hasGoalSubject && (hasFutureDatePhrase || isFarOut || isLongText)) ||
    (hasActionKeyword && (hasNoDuration || isLongText)) ||
    (isFarOut && hasNoDuration) ||
    (hasFutureDatePhrase && hasNoDuration)
  );
}

export function resolveCampaignBuilderInitialGoal(
  message: string,
  parsedText: string | null | undefined,
): string | null {
  let cleaned = normalizeSpacing(parsedText);
  if (!cleaned) return null;

  for (const pattern of GOAL_BREAKDOWN_SCAFFOLD_REGEXES) {
    cleaned = normalizeSpacing(cleaned.replace(pattern, ""));
  }

  cleaned = cleaned
    .replace(/^[\s:,-]+/, "")
    .replace(/[\s:,-]+$/, "")
    .trim();

  if (!cleaned) return null;
  if (isGoalBreakdownStarterMessage(message) && cleaned === normalizeSpacing(message)) {
    return null;
  }

  return cleaned;
}
