export type PlannerTaskTimingLabel =
  | "morning"
  | "afternoon"
  | "evening"
  | "later"
  | "tonight"
  | "after_work";

export type PlannerTaskEnergyType =
  | "deep"
  | "admin"
  | "physical"
  | "errand"
  | "social";

export type PlannerSchedulingMode =
  | "aggressive"
  | "balanced"
  | "light";

export type PlannerDraftStatus =
  | "scheduled_draft"
  | "needs_scheduling"
  | "tentative_time";

export type PlannerOptimizerPriority = 1 | 2 | 3 | 4 | 5;

export interface PlannerOptimizerTaskToSchedule {
  id: string;
  title: string;
  category?: string | null;
  duration_min: number;
  timing_preference?: {
    label?: PlannerTaskTimingLabel;
    earliest_start?: string;
    latest_end?: string;
  };
  energy_type: PlannerTaskEnergyType;
  priority?: PlannerOptimizerPriority;
  confidence: number;
  derived_from_message: string;
  notes?: string | null;
}

export interface PlannerOptimizerExistingTask {
  id: string;
  start: string;
  end: string;
  energy_type?: PlannerTaskEnergyType | null;
  status?: string | null;
}

export interface PlannerOptimizerCalendarEvent {
  id: string;
  title?: string | null;
  start: string;
  end: string;
  source?: "google" | "outlook" | "internal";
  hard_block: boolean;
}

export interface PlannerOptimizerHabit {
  id: string;
  title: string;
  preferred_windows?: string[];
  duration_min?: number | null;
}

export interface PlannerOptimizerMemory {
  wake_time?: string | null;
  wind_down_time?: string | null;
  work_hours?: {
    start: string;
    end: string;
  } | null;
  preferred_workout_windows?: string[];
  preferred_deep_work_windows?: string[];
}

export interface PlannerOptimizerConstraints {
  slot_granularity_min: number;
  min_buffer_min: number;
  max_scheduled_minutes_per_day?: number;
  max_deep_work_blocks_per_day?: number;
  suggested_slots?: Array<{
    date: string;
    time: string;
    end_time: string;
    score: number;
    reason: string;
  }>;
}

export interface PlannerOptimizerRequest {
  current_datetime: string;
  timezone: string;
  planning_window: {
    start_date: string;
    end_date: string;
  };
  tasks_to_schedule: PlannerOptimizerTaskToSchedule[];
  existing_tasks: PlannerOptimizerExistingTask[];
  calendar_events: PlannerOptimizerCalendarEvent[];
  habits: PlannerOptimizerHabit[];
  planner_memory: PlannerOptimizerMemory;
  constraints: PlannerOptimizerConstraints;
  scheduling_mode: PlannerSchedulingMode;
}

export interface PlannerOptimizerDraft {
  task_id: string;
  title: string;
  start?: string;
  end?: string;
  status: PlannerDraftStatus;
  slot_score: number;
  hard_conflict: boolean;
  soft_conflicts: string[];
  reason_codes: string[];
  reason_summary: string;
  fallback_to_inbox: boolean;
  category?: string | null;
  notes?: string | null;
}

export interface PlannerOptimizerUnscheduledTask {
  task_id: string;
  title: string;
  estimated_duration: number;
  reason_codes: string[];
}

export interface PlannerOptimizerResponse {
  drafts: PlannerOptimizerDraft[];
  unscheduled: PlannerOptimizerUnscheduledTask[];
}
