/**
 * Shared types for Quest/Task system
 * Centralizes task type definitions to ensure consistency across calendar and task components
 */

export type TaskCategory = 'mind' | 'body' | 'soul';
export type TaskDifficulty = 'easy' | 'medium' | 'hard';

/**
 * Milestone interface for calendar display
 */
export interface CalendarMilestone {
  id: string;
  title: string;
  target_date: string;
  milestone_percent: number;
  completed_at: string | null;
  epic_id: string;
  epic_title?: string;
  phase_name?: string | null;
}

/**
 * Base task interface with fields commonly needed across calendar components
 */
export interface CalendarTask {
  id: string;
  task_text: string;
  task_date: string;
  scheduled_time: string | null;
  estimated_duration: number | null;
  completed: boolean;
  is_main_quest: boolean;
  difficulty: string | null;
  xp_reward: number;
  category?: string | null;
}

/**
 * Minimal task interface for scheduling/conflict detection
 */
export interface ScheduleTask {
  id: string;
  task_text?: string;
  scheduled_time: string | null;
  estimated_duration: number | null;
  is_main_quest?: boolean;
  xp_reward?: number;
}

/**
 * Task interface for drag/drop operations
 */
export interface DragTask {
  id: string;
  task_text: string;
  scheduled_time?: string | null;
  estimated_duration?: number | null;
  is_main_quest?: boolean | null;
  difficulty?: string | null;
  category?: string | null;
  xp_reward?: number;
  completed?: boolean | null;
}

/**
 * Type guard to check if category is a valid TaskCategory
 */
export function isValidCategory(category: string | null | undefined): category is TaskCategory {
  return category === 'mind' || category === 'body' || category === 'soul';
}

/**
 * Type guard to check if difficulty is a valid TaskDifficulty
 */
export function isValidDifficulty(difficulty: string | null | undefined): difficulty is TaskDifficulty {
  return difficulty === 'easy' || difficulty === 'medium' || difficulty === 'hard';
}
