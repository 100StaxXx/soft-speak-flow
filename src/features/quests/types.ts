/**
 * Quest feature types
 */

export type QuestDifficulty = "easy" | "medium" | "hard";

export interface PendingTaskData {
  text: string;
  difficulty: QuestDifficulty;
  date: string;
  scheduledTime: string | null;
  estimatedDuration: number | null;
  recurrencePattern: string | null;
  recurrenceDays: number[];
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
  recurrenceEndDate: string | null;
  reminderEnabled: boolean;
  reminderMinutesBefore: number;
  moreInformation: string | null;
}
