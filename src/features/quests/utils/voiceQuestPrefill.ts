import { parseNaturalLanguage } from "@/features/tasks/hooks/useNaturalLanguageParser";
import type { ParsedTask } from "@/features/tasks/hooks/useNaturalLanguageParser";
import type { QuestComposerPrefillDraft, QuestCreationSource } from "@/features/quests/types";
import { formatGeneratedTaskTitle } from "@/shared/taskTitleNormalization";
import { format, startOfDay } from "date-fns";

const QUEST_WEEKDAYS = [0, 1, 2, 3, 4] as const;
const MONTH_NAME_PATTERN = String.raw`(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)`;
const WEEKDAY_NAME_PATTERN = String.raw`(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)`;

const trimOrNull = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const resolveOrdinalVoiceDate = (transcript: string): string | null => {
  const ordinalMatch = transcript.match(
    /\b(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b/i,
  );

  if (!ordinalMatch) return null;

  const dayOfMonth = Number.parseInt(ordinalMatch[1] ?? "", 10);
  if (!Number.isFinite(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
    return null;
  }

  const today = startOfDay(new Date());

  for (let monthOffset = 0; monthOffset < 14; monthOffset += 1) {
    const candidate = new Date(today.getFullYear(), today.getMonth() + monthOffset, dayOfMonth);

    if (candidate.getDate() !== dayOfMonth) continue;
    if (candidate < today) continue;

    return format(candidate, "yyyy-MM-dd");
  }

  return null;
};

const resolveVoiceScheduledDate = (parsed: ParsedTask, transcript: string) =>
  parsed.scheduledDate ?? resolveOrdinalVoiceDate(transcript);

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
      /\sin\s+half\s*(?:an?\s*)?hour\b/i,
      /\sin\s+(?:\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety(?:[-\s](?:one|two|three|four|five|six|seven|eight|nine))?)\s*(?:h(?:ours?|rs?)|m(?:in(?:ute)?s?)?)\b/i,
      /\sday\s*after\s*tomorrow\b/i,
      /\stomorrow\b/i,
      /\stoday\b/i,
      new RegExp(String.raw`\snext\s+${WEEKDAY_NAME_PATTERN}\b`, "i"),
      /\snext\s+week(?:end)?\b/i,
      /\snext\s+month\b/i,
      /\sthis\s+weekend\b/i,
      new RegExp(String.raw`\s+on\s+the\s+\d{1,2}(?:st|nd|rd|th)\b`, "i"),
      new RegExp(String.raw`\s+the\s+\d{1,2}(?:st|nd|rd|th)\b`, "i"),
      new RegExp(String.raw`\s+on\s+\d{1,2}(?:st|nd|rd|th)\b`, "i"),
      new RegExp(String.raw`\s+on\s+${MONTH_NAME_PATTERN}\s+\d{1,2}(?:st|nd|rd|th)?\b`, "i"),
      new RegExp(String.raw`\s+${MONTH_NAME_PATTERN}\s+\d{1,2}(?:st|nd|rd|th)?\b`, "i"),
      new RegExp(String.raw`\s+on\s+\d{1,2}(?:st|nd|rd|th)?\s+${MONTH_NAME_PATTERN}\b`, "i"),
      new RegExp(String.raw`\s+\d{1,2}(?:st|nd|rd|th)?\s+${MONTH_NAME_PATTERN}\b`, "i"),
      /\s+on\s+\d{1,2}[/-]\d{1,2}\b/i,
      /\s+\d{1,2}[/-]\d{1,2}\b/i,
      /\sat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/i,
      /\s(?:for|with)\s+\d+\s*(?:h(?:ours?)?|m(?:in(?:ute)?s?)?)\b/i,
      /\s(?:it(?:'s| is)\s+)?(?:gonna|going\s+to|will|should|can|could)?\s*(?:last|take|run|be)\b/i,
      /\s(?:lasting|taking|running)\b/i,
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

  const parsedTitle = parsed.text.trim();
  const candidateTitle = /^notes?$/i.test(parsedTitle)
    ? transcript.trim()
    : parsedTitle || transcript.trim();
  return formatGeneratedTaskTitle(stripVoiceMetadata(candidateTitle)) ||
    formatGeneratedTaskTitle(sanitizeTitle(transcript));
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

export function buildQuestPrefillFromNaturalLanguage(
  input: string,
  creationSource: QuestCreationSource = "nlp",
): QuestComposerPrefillDraft {
  const cleanedInput = input.trim();
  const parsed = parseNaturalLanguage(cleanedInput);
  const resolvedScheduledDate = resolveVoiceScheduledDate(parsed, cleanedInput);
  const parsedWithVoiceSchedule =
    resolvedScheduledDate === parsed.scheduledDate
      ? parsed
      : { ...parsed, scheduledDate: resolvedScheduledDate };
  const recurrencePrefill = resolveRecurrencePrefill(parsedWithVoiceSchedule);

  return {
    text: resolvePrefillTitle(parsedWithVoiceSchedule, cleanedInput),
    taskDate: resolvedScheduledDate,
    difficulty: parsed.difficulty,
    scheduledTime: parsed.scheduledTime,
    estimatedDuration: parsed.estimatedDuration,
    recurrencePattern: recurrencePrefill.recurrencePattern,
    recurrenceDays: recurrencePrefill.recurrenceDays,
    recurrenceMonthDays: recurrencePrefill.recurrenceMonthDays,
    recurrenceCustomPeriod: recurrencePrefill.recurrenceCustomPeriod,
    reminderEnabled: parsed.reminderEnabled,
    reminderMinutesBefore: parsed.reminderMinutesBefore ?? undefined,
    reminderOffsetsMinutes: parsed.reminderOffsetsMinutes,
    moreInformation: trimOrNull(parsed.notes),
    location: null,
    creationSource,
  };
}

export function buildVoiceQuestPrefillFromTranscript(transcript: string): QuestComposerPrefillDraft {
  return buildQuestPrefillFromNaturalLanguage(transcript, "voice");
}
