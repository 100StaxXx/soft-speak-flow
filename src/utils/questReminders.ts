import { getScheduledTimeParts } from "./scheduledTime";

export const DEFAULT_QUEST_REMINDER_MINUTES = 15;
export const MAX_QUEST_REMINDER_MINUTES = 10080;
export const MAX_QUEST_REMINDER_OFFSETS = 5;
export const QUEST_REMINDER_PRESET_MINUTES = [5, 10, 15, 30, 60, 120, 1440, 2880, 10080] as const;

const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const MINUTE_MS = 60_000;

type QuestReminderDateInput = Date | string | null | undefined;

function getLocalDateParts(value: QuestReminderDateInput): { year: number; month: number; day: number } | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return {
      year: value.getFullYear(),
      month: value.getMonth() + 1,
      day: value.getDate(),
    };
  }

  if (typeof value !== "string") return null;
  const match = value.trim().match(DATE_ONLY_REGEX);
  if (!match) return null;

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const parsed = new Date(year, month - 1, day);

  if (
    Number.isNaN(parsed.getTime())
    || parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function parseQuestReminderDateTime(
  date: QuestReminderDateInput,
  time: string | null | undefined,
): Date | null {
  const dateParts = getLocalDateParts(date);
  const timeParts = getScheduledTimeParts(time);
  if (!dateParts || !timeParts) return null;

  const parsed = new Date(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day,
    timeParts.hour,
    timeParts.minute,
    0,
    0,
  );

  if (
    Number.isNaN(parsed.getTime())
    || parsed.getFullYear() !== dateParts.year
    || parsed.getMonth() !== dateParts.month - 1
    || parsed.getDate() !== dateParts.day
    || parsed.getHours() !== timeParts.hour
    || parsed.getMinutes() !== timeParts.minute
  ) {
    return null;
  }

  return parsed;
}

export function resolveCustomQuestReminderOffset(input: {
  questDate: QuestReminderDateInput;
  questTime: string | null | undefined;
  reminderDate: QuestReminderDateInput;
  reminderTime: string | null | undefined;
}): number | null {
  const questStart = parseQuestReminderDateTime(input.questDate, input.questTime);
  const reminderAt = parseQuestReminderDateTime(input.reminderDate, input.reminderTime);
  if (!questStart || !reminderAt) return null;

  const diffMinutes = Math.round((questStart.getTime() - reminderAt.getTime()) / MINUTE_MS);
  if (diffMinutes < 1 || diffMinutes > MAX_QUEST_REMINDER_MINUTES) return null;

  return diffMinutes;
}

export function normalizeQuestReminderOffsets(values: readonly unknown[] | null | undefined): number[] {
  if (!Array.isArray(values)) return [];

  return Array.from(
    new Set(
      values
        .map((value) => {
          if (typeof value !== "number" || !Number.isFinite(value)) return null;
          const minutes = Math.trunc(value);
          return minutes >= 1 && minutes <= MAX_QUEST_REMINDER_MINUTES ? minutes : null;
        })
        .filter((value): value is number => value !== null),
    ),
  )
    .sort((a, b) => a - b)
    .slice(0, MAX_QUEST_REMINDER_OFFSETS);
}

export function resolveQuestReminderOffsets(input: {
  reminderEnabled?: boolean | null;
  reminderMinutesBefore?: number | null;
  reminderOffsetsMinutes?: readonly unknown[] | null;
}): number[] {
  const explicitOffsets = normalizeQuestReminderOffsets(input.reminderOffsetsMinutes);
  if (explicitOffsets.length > 0) return explicitOffsets;

  if (input.reminderEnabled) {
    return normalizeQuestReminderOffsets([input.reminderMinutesBefore ?? DEFAULT_QUEST_REMINDER_MINUTES]);
  }

  return [];
}

export function getPrimaryQuestReminderOffset(offsets: readonly number[]): number {
  return normalizeQuestReminderOffsets(offsets)[0] ?? DEFAULT_QUEST_REMINDER_MINUTES;
}

export function formatQuestReminderOffset(minutes: number): string {
  if (minutes === 60) return "1 hour before";
  if (minutes > 60 && minutes % 60 === 0 && minutes < 1440) return `${minutes / 60} hours before`;
  if (minutes === 1440) return "1 day before";
  if (minutes > 1440 && minutes % 1440 === 0 && minutes < 10080) return `${minutes / 1440} days before`;
  if (minutes === 10080) return "1 week before";
  return `${minutes} minutes before`;
}

export const QUEST_REMINDER_PRESET_OPTIONS = QUEST_REMINDER_PRESET_MINUTES.map((value) => ({
  value,
  label: formatQuestReminderOffset(value),
}));
