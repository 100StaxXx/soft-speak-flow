/**
 * Habits feature types
 */

export type HabitDifficulty = "easy" | "medium" | "hard";
export type HabitFrequency = "daily" | "custom";

export type HabitCategory = 'mind' | 'body' | 'soul';

export interface Habit {
  id: string;
  user_id: string;
  title: string;
  frequency: string;
  custom_days: number[] | null;
  difficulty: string | null;
  category: HabitCategory | null;
  is_active: boolean | null;
  current_streak: number | null;
  longest_streak: number | null;
  created_at: string | null;
}

export interface HabitCompletion {
  id: string;
  habit_id: string | null;
  user_id: string;
  date: string;
  completed_at: string | null;
}
