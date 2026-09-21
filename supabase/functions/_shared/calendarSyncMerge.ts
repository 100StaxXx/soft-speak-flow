export interface CalendarQuestSnapshot {
  task_text: string;
  task_date: string | null;
  scheduled_time: string | null;
  estimated_duration: number | null;
  location: string | null;
  notes: string | null;
  completed?: boolean;
}
export const calendarSyncFields = ["task_text", "task_date", "scheduled_time", "estimated_duration", "location", "notes"] as const;
type Field = typeof calendarSyncFields[number];
export function calendarQuestSnapshot(task: Partial<CalendarQuestSnapshot>): CalendarQuestSnapshot {
  return {
    task_text: task.task_text ?? "Untitled", task_date: task.task_date ?? null,
    scheduled_time: task.scheduled_time?.slice(0, 5) ?? null,
    estimated_duration: task.estimated_duration ?? null,
    location: task.location || null, notes: task.notes || null,
    ...(typeof task.completed === "boolean" ? { completed: task.completed } : {}),
  };
}
/** Three-way merge: combine independent edits, never silently pick a winner. */
export function mergeCalendarQuest(base: CalendarQuestSnapshot, local: CalendarQuestSnapshot, remote: CalendarQuestSnapshot, syncCompletion = false) {
  const conflicts: Array<Field | "completed"> = [];
  const fields = syncCompletion ? [...calendarSyncFields, "completed" as const] : calendarSyncFields;
  const merged = { ...local };
  for (const field of fields) {
    const localChanged = local[field] !== base[field];
    const remoteChanged = remote[field] !== base[field];
    if (localChanged && remoteChanged && local[field] !== remote[field]) conflicts.push(field);
    else if (remoteChanged) Object.assign(merged, { [field]: remote[field] });
  }
  // Date/time/duration form one scheduling unit, even if different fields changed.
  const timing = ["task_date", "scheduled_time", "estimated_duration"] as const;
  if (timing.some((key) => local[key] !== base[key]) && timing.some((key) => remote[key] !== base[key])
      && timing.some((key) => local[key] !== remote[key])) {
    for (const key of timing) if (!conflicts.includes(key)) conflicts.push(key);
  }
  return { merged, conflicts,
    baselineChanged: fields.some((key) => merged[key] !== base[key]),
    push: conflicts.length === 0 && fields.some((key) => merged[key] !== remote[key]),
    pull: conflicts.length === 0 && fields.some((key) => merged[key] !== local[key]),
  };
}
