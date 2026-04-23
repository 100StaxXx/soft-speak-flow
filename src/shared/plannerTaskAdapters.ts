import type { Quest } from "@/types/domain";

export type PlannerTaskContextSource = {
  id: string;
  task_text: string;
  task_date: string | null;
  category?: string | null;
  scheduled_time: string | null;
  estimated_duration?: number | null;
  notes?: string | null;
  subtasks?: Array<{ title: string | null } | null> | null;
  difficulty?: string | null;
  recurrence_pattern: string | null;
  recurrence_end_date?: string | null;
  completed?: boolean | null;
  priority?: string | null;
  source?: string | null;
  habit_source_id?: string | null;
  epic_id?: string | null;
  epic_title?: string | null;
  contact_id?: string | null;
};

export const toLegacyPlannerTask = (quest: Quest): PlannerTaskContextSource => ({
  id: quest.id,
  task_text: quest.title,
  task_date: quest.taskDate,
  category: quest.category ?? null,
  scheduled_time: quest.scheduledTime,
  estimated_duration: quest.estimatedDuration ?? null,
  notes: quest.notes ?? null,
  subtasks: quest.subtasks.map((subtask) => ({
    title: subtask.title,
  })),
  difficulty: quest.difficulty ?? null,
  recurrence_pattern: quest.recurrencePattern,
  recurrence_end_date: quest.recurrenceEndDate ?? null,
  completed: quest.completed,
  priority: quest.priority ?? null,
  source: quest.source ?? null,
  habit_source_id: quest.habitSourceId ?? null,
  epic_id: quest.campaignId ?? null,
  epic_title: quest.campaignTitle ?? null,
  contact_id: quest.contactId ?? null,
});
