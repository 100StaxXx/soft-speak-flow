import {
  parseNaturalLanguage,
  type ParseNaturalLanguageOptions,
} from "./naturalLanguageTaskParser.ts";
import {
  cleanGeneratedTaskTitle,
  formatGeneratedTaskTitle,
} from "./taskTitleNormalization.ts";
import type {
  PlannerTaskEnergyType,
  PlannerTaskTimingLabel,
} from "./plannerOptimizer.ts";

export interface ExtractedActionBundleCandidate {
  id: string;
  title: string;
  category: string | null;
  timingPreference: PlannerTaskTimingLabel | null;
  durationGuess: number;
  energyType: PlannerTaskEnergyType;
  confidence: number;
  derivedFromMessage: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  notes: string | null;
}

const ACTION_PREFIX_REGEX =
  /\b(?:i want to|i wanna|i need to|i have to|i should|i plan to|i'm going to|i am going to|i gotta|let me)\b/i;
const ACTION_LEAD_IN_REGEX =
  /^(?:to\s+|also\s+|then\s+|later\s+|after that\s+|and\s+)/i;
const ACTION_VERB_REGEX =
  /^(?:clean|work(?:\s+on)?|workout|work\s*out|exercise|lift|run|walk|build|code|ship|finish|do|call|write|review|prep|organize|fold|vacuum|cook|shop|pay|reply|email|study|practice|meditate|journal|stretch|tidy)\b/i;
const DAY_SHAPING_REGEX =
  /\b(?:later today|tonight|later|after work|after my meeting|after this|wrapping up|almost done with work|rest of today|this evening|this afternoon)\b/i;

const SENTENCE_SPLIT_REGEX = /[.!?]\s+/;
const INLINE_SEPARATOR_REGEX = /\s*(?:,\s*|\band then\b\s+|\bthen\b\s+|,\s*and\s+|\band\b\s+)\s*/i;
const STRIP_TIMING_REGEX =
  /\b(?:later today|tonight|later|after work|this evening|this afternoon|this morning|tomorrow|today|after dinner|before dinner)\b/gi;

const createActionId = (value: string, index: number) =>
  `action-${index}-${value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;

const extractActionListSeed = (sentence: string): string | null => {
  const prefixMatch = sentence.match(ACTION_PREFIX_REGEX);
  if (prefixMatch?.index !== undefined) {
    return sentence.slice(prefixMatch.index + prefixMatch[0].length).trim();
  }

  return ACTION_VERB_REGEX.test(sentence.trim()) ? sentence.trim() : null;
};

const splitActionCandidates = (seed: string): string[] =>
  seed
    .split(INLINE_SEPARATOR_REGEX)
    .map((part) => part.replace(ACTION_LEAD_IN_REGEX, "").trim())
    .filter(Boolean);

const normalizeActionTitle = (fragment: string): string | null => {
  const withoutTiming = fragment.replace(STRIP_TIMING_REGEX, " ");
  const cleaned = cleanGeneratedTaskTitle(withoutTiming).replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned.split(/\s+/).length > 12) return null;
  return formatGeneratedTaskTitle(cleaned);
};

const inferActionCategory = (value: string): string | null => {
  const normalized = value.toLowerCase();
  if (/\b(workout|exercise|lift|run|walk|stretch|gym)\b/.test(normalized)) return "body";
  if (/\b(clean|vacuum|laundry|dishes|organize|tidy|house)\b/.test(normalized)) return "soul";
  if (/\b(code|build|app|write|study|review|ship|plan|prep|work on)\b/.test(normalized)) return "mind";
  return null;
};

const inferTimingPreference = (value: string): PlannerTaskTimingLabel | null => {
  const normalized = value.toLowerCase();
  if (/\bafter work\b/.test(normalized)) return "after_work";
  if (/\bmorning\b/.test(normalized)) return "morning";
  if (/\bafternoon\b/.test(normalized)) return "afternoon";
  if (/\btonight\b/.test(normalized)) return "tonight";
  if (/\bevening|after dinner\b/.test(normalized)) return "evening";
  if (/\blater\b/.test(normalized)) return "later";
  return null;
};

const inferEnergyType = (value: string): PlannerTaskEnergyType => {
  const normalized = value.toLowerCase();
  if (/\b(workout|exercise|lift|run|walk|stretch|gym)\b/.test(normalized)) return "physical";
  if (/\b(clean|vacuum|laundry|dishes|organize|tidy|house)\b/.test(normalized)) return "errand";
  if (/\b(code|build|app|study|ship|write)\b/.test(normalized)) return "deep";
  if (/\b(plan|review|reply|email|call|pay)\b/.test(normalized)) return "admin";
  return "social";
};

const inferDurationGuess = (value: string, parsedDuration: number | null): number => {
  if (parsedDuration && parsedDuration > 0) return parsedDuration;

  const normalized = value.toLowerCase();
  if (/\b(workout|exercise|lift|run|gym)\b/.test(normalized)) return 60;
  if (/\b(clean|vacuum|laundry|dishes|tidy|house)\b/.test(normalized)) return 45;
  if (/\b(code|build|app|study|write|ship)\b/.test(normalized)) return 90;
  if (/\b(call|reply|email|pay)\b/.test(normalized)) return 30;
  return 45;
};

export const hasDayShapingLanguage = (message: string): boolean =>
  DAY_SHAPING_REGEX.test(message);

export const extractActionBundleCandidates = (
  message: string,
  options?: ParseNaturalLanguageOptions,
): ExtractedActionBundleCandidate[] => {
  const seen = new Set<string>();
  const sentences = message
    .split(SENTENCE_SPLIT_REGEX)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const candidates: ExtractedActionBundleCandidate[] = [];

  for (const sentence of sentences) {
    const seed = extractActionListSeed(sentence);
    if (!seed) continue;

    for (const fragment of splitActionCandidates(seed)) {
      if (!ACTION_VERB_REGEX.test(fragment)) continue;

      const title = normalizeActionTitle(fragment);
      if (!title) continue;

      const dedupeKey = title.toLowerCase();
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const parsed = parseNaturalLanguage(fragment, options);
      candidates.push({
        id: createActionId(title, candidates.length),
        title,
        category: inferActionCategory(fragment),
        timingPreference: inferTimingPreference(fragment),
        durationGuess: inferDurationGuess(fragment, parsed.estimatedDuration),
        energyType: inferEnergyType(fragment),
        confidence: 0.88,
        derivedFromMessage: fragment.trim(),
        scheduledDate: parsed.scheduledDate,
        scheduledTime: parsed.scheduledTime,
        notes: parsed.notes,
      });
    }
  }

  return candidates;
};

export const isAggressiveActionBundleMessage = (
  message: string,
  options?: ParseNaturalLanguageOptions,
): boolean => extractActionBundleCandidates(message, options).length >= 2;
