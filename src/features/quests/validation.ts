import type { QuestDifficulty } from "@/features/quests/types";

export type QuestCategory = "mind" | "body" | "soul";

export const isValidQuestCategory = (
  category: string | null | undefined,
): category is QuestCategory => (
  category === "mind" || category === "body" || category === "soul"
);

export const isValidQuestDifficulty = (
  difficulty: string | null | undefined,
): difficulty is QuestDifficulty => (
  difficulty === "easy" || difficulty === "medium" || difficulty === "hard"
);
