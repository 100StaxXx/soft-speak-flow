import { calendarQuestSnapshot, mergeCalendarQuest, type CalendarQuestSnapshot } from "./calendarSyncMerge.ts";
import { calendarLocalParts, calendarZonedDate } from "./calendarTime.ts";

export interface SyncEvent {
  title: string; startDate: string; endDate: string; isAllDay: boolean;
  location?: string | null; notes?: string | null;
}
export interface SyncTask { title: string; dueDate: string | null; completed: boolean }
export interface SyncLink {
  baseline: CalendarQuestSnapshot; timezone: string; resource_kind: "event" | "task"; sync_status: string;
}
export type CalendarSyncPlan =
  | { status: "unchanged" }
  | { status: "conflict"; error: string }
  | { status: "linked"; snapshot: CalendarQuestSnapshot; event?: SyncEvent; task?: SyncTask };

export function eventQuestSnapshot(event: SyncEvent, timezone = Intl.DateTimeFormat().resolvedOptions().timeZone): CalendarQuestSnapshot {
  const start = new Date(event.startDate);
  if (!Number.isFinite(start.getTime()) || !(Date.parse(event.endDate) > start.getTime())) throw new Error("This event could not be read safely.");
  const local = calendarLocalParts(start, timezone);
  // Match the UI's event normalization so background reads cannot introduce
  // whitespace-only differences or a different baseline from the phone.
  const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
  return calendarQuestSnapshot({ task_text: text(event.title) ?? "Busy",
    task_date: event.isAllDay ? event.startDate.slice(0, 10) : local.date,
    scheduled_time: event.isAllDay ? null : local.time,
    estimated_duration: event.isAllDay ? 1440 : Math.round((Date.parse(event.endDate) - start.getTime()) / 60000),
    location: text(event.location), notes: text(event.notes) });
}

/** One pure decision engine shared by the phone and the closed-app worker. */
export function planCalendarSync(link: SyncLink, local: CalendarQuestSnapshot,
  item: SyncEvent | SyncTask, resolution?: "local" | "remote"): CalendarSyncPlan {
  const isTask = link.resource_kind === "task";
  const task = item as SyncTask;
  const event = item as SyncEvent;
  const remote = isTask
    ? { ...local, task_text: task.title, task_date: task.dueDate, completed: task.completed }
    : { ...eventQuestSnapshot(event, link.timezone), notes: local.notes };
  const base = isTask
    ? { ...local, task_text: link.baseline.task_text, task_date: link.baseline.task_date, completed: link.baseline.completed }
    : { ...link.baseline, notes: local.notes };
  const result = mergeCalendarQuest(base, local, remote, isTask);
  if (result.conflicts.length && !resolution) return { status: "conflict", error: "Both versions changed. Choose which version to keep in Preferences." };
  const merged = { ...(resolution === "local" ? local : resolution === "remote" ? remote : result.merged) };
  if (isTask && !merged.task_date) merged.scheduled_time = null;
  if (!resolution && !result.push && !result.pull && !result.baselineChanged && link.sync_status === "linked") return { status: "unchanged" };
  const plan: CalendarSyncPlan = { status: "linked", snapshot: merged };
  if (!(resolution === "local" || (!resolution && result.push))) return plan;
  if (isTask) return { ...plan, task: { title: merged.task_text, dueDate: merged.task_date, completed: merged.completed === true } };
  if (!merged.task_date || (!event.isAllDay && !merged.scheduled_time)) return { status: "conflict", error: "Choose a date and time before updating this calendar event." };
  const timingUnchanged = (["task_date", "scheduled_time", "estimated_duration"] as const).every(field => merged[field] === remote[field]);
  // Preserve exact provider instants (including a repeated DST hour) for title-only edits.
  const patch: SyncEvent = { title: merged.task_text, location: merged.location, notes: event.notes,
    startDate: event.startDate, endDate: event.endDate, isAllDay: event.isAllDay };
  if (!timingUnchanged) {
    if (event.isAllDay) {
      const days = Math.max(1, Math.round((Date.parse(event.endDate) - Date.parse(event.startDate)) / 86400000));
      patch.startDate = merged.task_date;
      patch.endDate = new Date(Date.parse(merged.task_date) + days * 86400000).toISOString().slice(0, 10);
    } else {
      const start = calendarZonedDate(merged.task_date, merged.scheduled_time!, link.timezone);
      patch.startDate = start.toISOString();
      patch.endDate = new Date(start.getTime() + (merged.estimated_duration || 30) * 60000).toISOString();
    }
  }
  return { ...plan, event: patch };
}
