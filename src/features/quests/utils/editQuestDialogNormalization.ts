import { isValid } from "date-fns";
import type { QuestDifficulty } from "../types";
import { normalizeScheduledTime } from "@/utils/scheduledTime";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const normalizeQuestDifficulty = (value: string | null | undefined): QuestDifficulty => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "easy" || normalized === "medium" || normalized === "hard") {
    return normalized;
  }
  if (normalized && ["simple", "beginner", "low"].includes(normalized)) {
    return "easy";
  }
  if (normalized && ["difficult", "advanced", "challenging", "high"].includes(normalized)) {
    return "hard";
  }
  return "medium";
};

export { normalizeScheduledTime };

export const normalizeTaskDate = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;

  const candidate = normalized.includes("T") ? normalized.slice(0, 10) : normalized;
  if (!DATE_ONLY_REGEX.test(candidate)) return null;

  const parsed = new Date(`${candidate}T00:00:00`);
  if (!isValid(parsed)) return null;

  return candidate;
};

export const parseTaskDate = (value: string | null | undefined): Date | null => {
  const normalized = normalizeTaskDate(value);
  if (!normalized) return null;
  const parsed = new Date(`${normalized}T00:00:00`);
  return isValid(parsed) ? parsed : null;
};
