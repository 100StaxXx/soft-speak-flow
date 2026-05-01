export const DEFAULT_QUEST_REMINDER_MINUTES = 15;
export const MAX_QUEST_REMINDER_MINUTES = 10080;
export const MAX_QUEST_REMINDER_OFFSETS = 5;

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
