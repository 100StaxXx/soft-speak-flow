import type { ParsedTask } from "@/features/tasks/hooks";
import { parseNaturalLanguage } from "@/features/tasks/hooks";
import type { QuestComposerPrefillDraft } from "@/features/quests/types";

const QUEST_WEEKDAYS = [0, 1, 2, 3, 4] as const;

const trimOrNull = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const resolvePrefillTitle = (parsed: ParsedTask, transcript: string) => {
  const sanitizeTitle = (value: string) =>
    value
      .trim()
      .replace(/[\s,:;-]+$/g, "")
      .replace(/\b(?:on|at|for|with|by|before|after)\b\s*$/i, "")
      .trim();

  const stripVoiceMetadata = (value: string) => {
    const breakPatterns = [
      /\snotes?:/i,
      /\stomorrow\b/i,
      /\stoday\b/i,
      /\sday\s*after\s*tomorrow\b/i,
      /\snext\s+\w+/i,
      /\sat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/i,
      /\s(?:for|with)\s+\d+\s*(?:h(?:ours?)?|m(?:in(?:ute)?s?)?)\b/i,
      /\s(?:daily|weekly|monthly|weekdays?|weekends?)\b/i,
      /\severy\s+\w+/i,
      /\sremind(?:er| me)?\b/i,
    ];

    const earliestMatch = breakPatterns
      .map((pattern) => value.match(pattern))
      .filter((match): match is RegExpMatchArray => Boolean(match && typeof match.index === "number"))
      .reduce<number | null>((earliest, match) => {
        if (typeof match.index !== "number") return earliest;
        return earliest === null ? match.index : Math.min(earliest, match.index);
      }, null);

    if (earliestMatch === null) {
      return sanitizeTitle(value);
    }

    return sanitizeTitle(value.slice(0, earliestMatch));
  };

  const candidateTitle = parsed.text.trim() || transcript.trim();
  return stripVoiceMetadata(candidateTitle) || sanitizeTitle(transcript);
};

const toQuestDayIndex = (parserDayIndex: number) => (parserDayIndex === 0 ? 6 : parserDayIndex - 1);

const normalizeQuestDays = (days: number[] | null | undefined) => {
  if (!days?.length) return [];
  return [...new Set(days.map(toQuestDayIndex).filter((day) => day >= 0 && day <= 6))].sort((a, b) => a - b);
};

const isQuestWeekdays = (days: number[]) =>
  days.length === QUEST_WEEKDAYS.length && days.every((day, index) => day === QUEST_WEEKDAYS[index]);

const resolveMonthlyRecurrenceDays = (parsed: ParsedTask) => {
  if (parsed.recurrenceMonthDays.length > 0) {
    return parsed.recurrenceMonthDays;
  }

  if (!parsed.scheduledDate) {
    return [];
  }

  const [, , dayToken] = parsed.scheduledDate.split("-");
  const dayOfMonth = Number(dayToken);
  return Number.isFinite(dayOfMonth) && dayOfMonth >= 1 && dayOfMonth <= 31
    ? [dayOfMonth]
    : [];
};

const resolveRecurrencePrefill = (
  parsed: ParsedTask,
): Pick<
  QuestComposerPrefillDraft,
  "recurrencePattern" | "recurrenceDays" | "recurrenceMonthDays" | "recurrenceCustomPeriod"
> => {
  const normalizedCustomDays = normalizeQuestDays(parsed.customDays);
  const hasWeekdaySelection = isQuestWeekdays(normalizedCustomDays);

  if (parsed.recurrencePattern === "daily") {
    return {
      recurrencePattern: "daily",
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
    };
  }

  if (parsed.recurrencePattern === "weekdays" || hasWeekdaySelection) {
    return {
      recurrencePattern: "weekdays",
      recurrenceDays: [...QUEST_WEEKDAYS],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
    };
  }

  if (parsed.recurrencePattern === "weekly" || parsed.recurrencePattern === "biweekly") {
    return {
      recurrencePattern: parsed.recurrencePattern,
      recurrenceDays: normalizedCustomDays.slice(0, 1),
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: null,
    };
  }

  if (parsed.recurrencePattern === "monthly") {
    return {
      recurrencePattern: "monthly",
      recurrenceDays: [],
      recurrenceMonthDays: resolveMonthlyRecurrenceDays(parsed),
      recurrenceCustomPeriod: null,
    };
  }

  if (normalizedCustomDays.length > 0) {
    return {
      recurrencePattern: "custom",
      recurrenceDays: normalizedCustomDays,
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: "week",
    };
  }

  if (parsed.frequency === "custom" || parsed.frequency === "2x_week" || parsed.frequency === "3x_week" || parsed.frequency === "5x_week") {
    return {
      recurrencePattern: "custom",
      recurrenceDays: [],
      recurrenceMonthDays: [],
      recurrenceCustomPeriod: "week",
    };
  }

  return {
    recurrencePattern: parsed.recurrencePattern,
    recurrenceDays: parsed.recurrenceDays,
    recurrenceMonthDays: parsed.recurrenceMonthDays,
    recurrenceCustomPeriod: parsed.recurrenceCustomPeriod,
  };
};

export function buildVoiceQuestPrefillFromTranscript(transcript: string): QuestComposerPrefillDraft {
  const cleanedTranscript = transcript.trim();
  const parsed = parseNaturalLanguage(cleanedTranscript);
  const recurrencePrefill = resolveRecurrencePrefill(parsed);

  return {
    text: resolvePrefillTitle(parsed, cleanedTranscript),
    taskDate: parsed.scheduledDate,
    difficulty: parsed.difficulty,
    scheduledTime: parsed.scheduledTime,
    estimatedDuration: parsed.estimatedDuration,
    recurrencePattern: recurrencePrefill.recurrencePattern,
    recurrenceDays: recurrencePrefill.recurrenceDays,
    recurrenceMonthDays: recurrencePrefill.recurrenceMonthDays,
    recurrenceCustomPeriod: recurrencePrefill.recurrenceCustomPeriod,
    reminderEnabled: parsed.reminderEnabled,
    reminderMinutesBefore: parsed.reminderMinutesBefore ?? undefined,
    moreInformation: trimOrNull(parsed.notes),
    location: null,
    creationSource: "voice",
  };
}
