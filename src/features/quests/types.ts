/**
 * Quest feature types
 */

export type QuestDifficulty = "easy" | "medium" | "hard";
export type QuestTemplateCategory = "work" | "health" | "home" | "admin" | "personal";
export type QuestTemplateBrowserTab = "common" | "yours";
export type QuestTemplateOrigin = "common" | "personal_explicit" | "personal_derived";

export interface QuestTemplatePrefill {
  id: string;
  title: string;
  difficulty: QuestDifficulty;
  estimatedDuration: number | null;
  notes: string | null;
  subtasks: string[];
  templateOrigin: QuestTemplateOrigin;
  sourceCommonTemplateId: string | null;
}

export interface CommonQuestTemplate extends QuestTemplatePrefill {
  description: string;
  category: QuestTemplateCategory;
  keywords: string[];
  featured: boolean;
}

export interface PersonalQuestTemplate extends QuestTemplatePrefill {
  frequency: number;
  lastUsedAt: string | null;
}

export interface PendingTaskData {
  text: string;
  difficulty: QuestDifficulty;
  date: string;
  scheduledTime: string | null;
  estimatedDuration: number | null;
  recurrencePattern: string | null;
  recurrenceDays: number[];
  recurrenceMonthDays: number[];
  recurrenceCustomPeriod: "week" | "month" | null;
  recurrenceEndDate: string | null;
  reminderEnabled: boolean;
  reminderMinutesBefore: number;
  moreInformation: string | null;
}

export interface QuestFormState {
  newTaskText: string;
  taskDifficulty: QuestDifficulty;
  showAdvanced: boolean;
  scheduledTime: string | null;
  estimatedDuration: number | null;
  recurrencePattern: string | null;
  recurrenceDays: number[];
  recurrenceMonthDays: number[];
  recurrenceCustomPeriod: "week" | "month" | null;
  recurrenceEndDate: string | null;
  reminderEnabled: boolean;
  reminderMinutesBefore: number;
  moreInformation: string | null;
}
