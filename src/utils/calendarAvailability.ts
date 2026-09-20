import type { ExternalCalendarEvent } from '@/types/externalCalendar';
import { calendarZonedDate } from '@/utils/calendarTime';

export interface AvailabilityQuest {
  id: string;
  task_text: string;
  task_date?: string | null;
  scheduled_time?: string | null;
  estimated_duration?: number | null;
  completed?: boolean;
}

/** Checks the loaded agenda only, not undisclosed/private provider free-busy data. */
export function findQuestConflicts(event: ExternalCalendarEvent, tasks: AvailabilityQuest[],
  excludedTaskIds: string[] = [], timezone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  if (event.isAllDay || event.availability === 'free') return [];
  const excluded = new Set(excludedTaskIds);
  const unique = new Map(tasks.map((task) => [task.id, task]));
  return [...unique.values()].filter((task) => {
    if (excluded.has(task.id) || task.id.startsWith('external:') || task.completed || !task.task_date || !task.scheduled_time) return false;
    try {
      const start = calendarZonedDate(task.task_date, task.scheduled_time.slice(0, 5), timezone).getTime();
      const duration = task.estimated_duration ?? 30;
      if (!Number.isFinite(duration) || duration <= 0) return false;
      const end = start + duration * 60000;
      return start < Date.parse(event.endDate) && end > Date.parse(event.startDate);
    } catch { return false; } // Invalid/unresolved task times are not fabricated appointments.
  });
}
