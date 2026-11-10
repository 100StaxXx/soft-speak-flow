/** Group for cross-date summaries only. Scheduling, rewards and edits still use occurrence IDs. */
export interface TaskItemRow {
  id: string; task_text: string;
  parent_template_id?: string | null; habit_source_id?: string | null; manual_series_id?: string | null;
  epic_id?: string | null; is_recurring?: boolean | null; recurrence_override?: boolean | null;
  scheduled_time?: string | null; schedule_end_time?: string | null; schedule_timezone?: string | null;
  estimated_duration?: number | null; notes?: string | null; location?: string | null;
  flexibility?: string | null; contact_id?: string | null; reminder_enabled?: boolean | null;
  reminder_minutes_before?: number | null; reminder_offsets_minutes?: number[] | null;
  difficulty?: string | null; category?: string | null; priority?: string | null;
}
export const TASK_ITEM_FIELDS = 'id,task_text,parent_template_id,habit_source_id,manual_series_id,epic_id,is_recurring,recurrence_override,scheduled_time,schedule_end_time,schedule_timezone,estimated_duration,notes,location,difficulty,category,priority,flexibility,contact_id,reminder_enabled,reminder_minutes_before,reminder_offsets_minutes' as const;
export function isSeriesTask(t: TaskItemRow) {
  return Boolean(t.habit_source_id || t.manual_series_id || t.parent_template_id || t.is_recurring);
}
const clockTime = (value?: string | null) => value && /^\d{2}:\d{2}$/.test(value) ? value+':00' : value ?? null;
export function taskItemKey(t: TaskItemRow): string {
  if (!isSeriesTask(t) || t.recurrence_override) return JSON.stringify(['task', t.id]);
  const lineage = t.habit_source_id ? ['habit', t.habit_source_id] : t.manual_series_id ? ['manual', t.manual_series_id] : ['template', t.parent_template_id || t.id];
  return JSON.stringify([lineage,t.epic_id ?? null,t.task_text,clockTime(t.scheduled_time),clockTime(t.schedule_end_time),t.schedule_timezone ?? null,t.estimated_duration ?? null,t.notes || '',t.location || '',t.difficulty ?? null,t.category ?? null,t.priority ?? null,t.flexibility ?? null,t.contact_id ?? null,
    t.reminder_enabled ? [t.reminder_minutes_before ?? null,t.reminder_offsets_minutes ?? []] : null]);
}
export function groupTaskItems<T extends TaskItemRow>(rows: readonly T[]): T[][] {
  const groups = new Map<string,T[]>(), seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    const key = taskItemKey(row), group = groups.get(key);
    if (group) group.push(row); else groups.set(key,[row]);
  }
  return [...groups.values()];
}

/** Fetch until the result limit is filled with distinct tasks, not repeat occurrences. */
export async function recentTaskItems<T extends TaskItemRow>(readPage:(offset:number, size:number)=>Promise<T[]>, limit:number) {
  const picked:T[]=[], seen=new Set<string>(), size=Math.max(40,limit);
  for (let offset=0; picked.length<limit; offset+=size) {
    const page=await readPage(offset,size);
    for (const row of page) {
      const key=taskItemKey(row);
      if (!seen.has(key)) { seen.add(key); picked.push(row); }
      if (picked.length===limit) break;
    }
    if (page.length<size) break;
  }
  return picked;
}
