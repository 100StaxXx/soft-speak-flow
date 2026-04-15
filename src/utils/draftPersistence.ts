import type { QuestDraftSnapshot } from "@/features/quests/types";
import { safeLocalStorage } from "@/utils/storage";
import {
  getMorningCheckInDraftStorageKey,
  getQuestDraftStorageKey,
} from "@/utils/accountLocalState";

export interface MorningCheckInDraftSnapshot {
  mood: string;
  intention: string;
  date: string;
  updatedAt: string;
}

const parseJson = <T>(raw: string | null): T | null => {
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

const isNumberArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "number");

const isQuestDraftSnapshot = (value: unknown): value is QuestDraftSnapshot => {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;
  const creationSource = candidate.creationSource;
  const recurrenceCustomPeriod = candidate.recurrenceCustomPeriod;

  return (
    typeof candidate.text === "string"
    && (candidate.taskDate === null || typeof candidate.taskDate === "string")
    && (candidate.difficulty === "easy" || candidate.difficulty === "medium" || candidate.difficulty === "hard")
    && (candidate.scheduledTime === null || typeof candidate.scheduledTime === "string")
    && (candidate.estimatedDuration === null || typeof candidate.estimatedDuration === "number")
    && (candidate.recurrencePattern === null || typeof candidate.recurrencePattern === "string")
    && isNumberArray(candidate.recurrenceDays)
    && isNumberArray(candidate.recurrenceMonthDays)
    && (recurrenceCustomPeriod === null || recurrenceCustomPeriod === "week" || recurrenceCustomPeriod === "month")
    && typeof candidate.reminderEnabled === "boolean"
    && typeof candidate.reminderMinutesBefore === "number"
    && (candidate.moreInformation === null || typeof candidate.moreInformation === "string")
    && (candidate.location === null || typeof candidate.location === "string")
    && typeof candidate.sendToCalendar === "boolean"
    && isStringArray(candidate.subtasks)
    && Array.isArray(candidate.attachments)
    && (creationSource === "manual" || creationSource === "inbox" || creationSource === "voice" || creationSource === "nlp")
    && (candidate.selectedTemplate === null || typeof candidate.selectedTemplate === "object")
    && typeof candidate.updatedAt === "string"
  );
};

const isMorningCheckInDraftSnapshot = (value: unknown): value is MorningCheckInDraftSnapshot => {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.mood === "string"
    && typeof candidate.intention === "string"
    && typeof candidate.date === "string"
    && typeof candidate.updatedAt === "string"
  );
};

export const readQuestDraftSnapshot = (userId: string | null | undefined): QuestDraftSnapshot | null => {
  if (!userId) return null;

  const parsed = parseJson<unknown>(safeLocalStorage.getItem(getQuestDraftStorageKey(userId)));
  return isQuestDraftSnapshot(parsed) ? parsed : null;
};

export const writeQuestDraftSnapshot = (
  userId: string | null | undefined,
  snapshot: QuestDraftSnapshot,
): boolean => {
  if (!userId) return false;

  return safeLocalStorage.setItem(getQuestDraftStorageKey(userId), JSON.stringify(snapshot));
};

export const clearQuestDraftSnapshot = (userId: string | null | undefined): boolean => {
  if (!userId) return false;

  return safeLocalStorage.removeItem(getQuestDraftStorageKey(userId));
};

export const readMorningCheckInDraftSnapshot = (
  userId: string | null | undefined,
): MorningCheckInDraftSnapshot | null => {
  if (!userId) return null;

  const parsed = parseJson<unknown>(safeLocalStorage.getItem(getMorningCheckInDraftStorageKey(userId)));
  return isMorningCheckInDraftSnapshot(parsed) ? parsed : null;
};

export const writeMorningCheckInDraftSnapshot = (
  userId: string | null | undefined,
  snapshot: MorningCheckInDraftSnapshot,
): boolean => {
  if (!userId) return false;

  return safeLocalStorage.setItem(getMorningCheckInDraftStorageKey(userId), JSON.stringify(snapshot));
};

export const clearMorningCheckInDraftSnapshot = (
  userId: string | null | undefined,
): boolean => {
  if (!userId) return false;

  return safeLocalStorage.removeItem(getMorningCheckInDraftStorageKey(userId));
};
