import { boundary, shiftCommitmentDate } from '../../supabase/functions/_shared/commitmentSchedule';
import { canonicalQuest } from "@/utils/zonedQuest";
import { addDays, format, parseISO } from "date-fns";
import { calendarZonedDate } from "@/utils/calendarTime";
import { resolveTimedTaskDurationMinutes } from "@/utils/taskDurationLayout";
import { shouldSpawnToday, toAppDayIndex, type QuestRecurrenceRule } from "@/utils/questRecurrence";
import { externalCalendarEventKey, type ExternalCalendarEvent } from "@/types/externalCalendar";

export interface ScheduleQuest extends QuestRecurrenceRule {
  id: string;
  session_series_anchor?: string | null;
  schedule_timezone?: string | null;
  schedule_end_time?: string | null;
  schedule_source_date?: string | null;
  schedule_source_time?: string | null;
  flexibility?: string | null;
  task_text: string;
  scheduled_time?: string | null;
  estimated_duration?: number | null;
  completed?: boolean | null;
  is_recurring?: boolean | null;
  parent_template_id?: string | null;
  habit_source_id?: string | null;
  recurrence_end_date?: string | null;
}

export interface QuestScheduleDraft extends ScheduleQuest {
  /** Moving an occurrence must not move or exclude the rest of its series. */
  checkRecurrence?: boolean;
  excludeHabitId?: string;
}

export interface ScheduleInterval {
  id: string;
  title: string;
  date: string;
  start: number;
  end: number;
  source: "quest" | "calendar" | "commitment";
}
export interface QuestScheduleConflict extends ScheduleInterval { overlapMinutes: number }
export interface QuestScheduleAnalysis {
  conflicts: QuestScheduleConflict[];
  nextTime: string | null;
  throughDate: string;
  recurring: boolean;
  invalidTime: boolean;
}

export const isRepeatingSchedule = (draft: QuestScheduleDraft) => draft.checkRecurrence !== false
  && !!draft.recurrence_pattern && draft.recurrence_pattern !== "none";

export interface ScheduleCalendarLink { taskId: string; eventKey: string }

/** Hide mirrors only when they really represent a checked quest, or the quest being edited. */
export function linkedScheduleExclusions(draft: QuestScheduleDraft, tasks: ScheduleQuest[], events: ExternalCalendarEvent[],
  links: ScheduleCalendarLink[], timezone: string): Set<string> {
  const byId = new Map(tasks.map(task => [task.id, canonicalQuest(task)]));
  const byKey = new Map(events.map(event => [externalCalendarEventKey(event), event]));
  return new Set(links.filter(link => {
    if (link.taskId === draft.id) return true;
    const task = byId.get(link.taskId);
    if (!task) return false;
    if ((isRepeatingSchedule(draft) && task.parent_template_id === draft.id)
      || (draft.excludeHabitId && task.habit_source_id === draft.excludeHabitId)) return true;
    const event = byKey.get(link.eventKey);
    const interval = task.task_date ? questInterval(task, task.task_date, timezone) : null;
    return event && interval && !event.isAllDay && interval.start === Date.parse(event.startDate) && interval.end === Date.parse(event.endDate);
  }).map(link => link.eventKey));
}

export function getScheduleCheckRange(draft: QuestScheduleDraft) {
  const date = draft.task_date!;
  return { startDate: format(addDays(parseISO(date), -1), "yyyy-MM-dd"),
    throughDate: format(addDays(parseISO(date), isRepeatingSchedule(draft) ? 29 : 0), "yyyy-MM-dd") };
}

function questInterval(task: ScheduleQuest, date: string, timezone: string): ScheduleInterval | null {
  if (!task.scheduled_time) return null;
  try {
    const zone = task.schedule_source_date ? timezone : task.schedule_timezone || timezone;
    const start = task.schedule_timezone && !task.schedule_source_date ? boundary(date,task.scheduled_time.slice(0,5),zone,false).getTime() : calendarZonedDate(date, task.scheduled_time.slice(0, 5), zone).getTime();
    const end = task.schedule_timezone && task.schedule_end_time && !task.schedule_source_date
      ? boundary(task.schedule_end_time < task.scheduled_time ? shiftCommitmentDate(date,1) : date,task.schedule_end_time.slice(0,5),zone,true).getTime()
      : start + resolveTimedTaskDurationMinutes(task.estimated_duration) * 60000;
    return { id: task.id, title: task.task_text, date, start, end, source: "quest" };
  } catch { return null; }
}

function datesBetween(start: string, end: string) {
  const dates: string[] = [];
  for (let date = parseISO(start); format(date, "yyyy-MM-dd") <= end; date = addDays(date, 1)) {
    dates.push(format(date, "yyyy-MM-dd"));
  }
  return dates;
}

/** Includes materialized occurrences only once; edited/completed occurrences override their template. */
export function buildScheduleIntervals(tasks: ScheduleQuest[], events: ExternalCalendarEvent[],
  range: { startDate: string; throughDate: string }, timezone: string, excludedEventKeys = new Set<string>()): ScheduleInterval[] {
  const unique = [...new Map(tasks.map(task => [task.id, canonicalQuest(task)])).values()];
  const instances = new Set(unique.filter(task => task.parent_template_id && task.task_date)
    .map(task => `${task.parent_template_id}:${task.task_date}`));
  const intervals: ScheduleInterval[] = [];
  for (const task of unique) {
    if (!task.task_date || !task.scheduled_time) continue;
    if ((!task.completed || task.flexibility === "fixed") && !instances.has(`${task.id}:${task.task_date}`)) {
      const interval = questInterval(task, task.task_date, timezone);
      if (interval) intervals.push(interval);
    }
    // Zoned series have real server-materialized rows; missing dates are intentional skips.
    if (task.session_series_anchor || task.schedule_timezone || !task.is_recurring || !task.recurrence_pattern) continue;
    for (const date of datesBetween(range.startDate, range.throughDate)) {
      if (date <= task.task_date || (task.recurrence_end_date && date > task.recurrence_end_date)
        || instances.has(`${task.id}:${date}`)) continue;
      if (!shouldSpawnToday(task, toAppDayIndex(parseISO(date).getDay()), parseISO(date))) continue;
      const interval = questInterval(task, date, timezone);
      if (interval) intervals.push(interval);
    }
  }
  for (const event of new Map(events.map(event => [externalCalendarEventKey(event), event])).values()) {
    if (event.availability?.toLowerCase() === "free" || excludedEventKeys.has(externalCalendarEventKey(event))) continue;
    try {
      // A busy all-day event blocks time; an all-day reminder marked Free does not.
      const start = event.isAllDay ? calendarZonedDate(event.startDate.slice(0, 10), "00:00", timezone).getTime() : Date.parse(event.startDate);
      const end = event.isAllDay ? calendarZonedDate(event.endDate.slice(0, 10), "00:00", timezone).getTime() : Date.parse(event.endDate);
      if (Number.isFinite(start) && end > start) intervals.push({ id: `external:${externalCalendarEventKey(event)}`,
        title: event.title, date: event.taskDate, start, end, source: "calendar" });
    } catch { /* Invalid provider times are not fabricated. */ }
  }
  return intervals.sort((a, b) => a.start - b.start);
}

export function analyzeQuestSchedule(draft: QuestScheduleDraft, tasks: ScheduleQuest[], events: ExternalCalendarEvent[],
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone, excludedEventKeys = new Set<string>(), commitments: ScheduleInterval[] = []): QuestScheduleAnalysis {
  const range = getScheduleCheckRange(draft);
  const recurring = isRepeatingSchedule(draft);
  const dates = datesBetween(draft.task_date!, range.throughDate).filter(date => date === draft.task_date
    || ((!draft.recurrence_end_date || date <= draft.recurrence_end_date)
      && shouldSpawnToday(draft, toAppDayIndex(parseISO(date).getDay()), parseISO(date))));
  const intervals = buildScheduleIntervals(tasks.filter(task => task.id !== draft.id
    && !(recurring && task.parent_template_id === draft.id)
    && !(draft.excludeHabitId && task.habit_source_id === draft.excludeHabitId)), events,
    { ...range, throughDate: format(addDays(parseISO(range.throughDate), 1), "yyyy-MM-dd") }, timezone, excludedEventKeys);
  intervals.push(...commitments);
  const atTime = (time: string) => dates.map(date => questInterval({ ...draft, scheduled_time: time }, date, timezone));
  const proposed = atTime(draft.scheduled_time!);
  const conflicts = proposed.flatMap(occurrence => occurrence ? intervals.flatMap(interval => {
    const overlapMinutes = Math.ceil((Math.min(occurrence.end, interval.end) - Math.max(occurrence.start, interval.start)) / 60000);
    return overlapMinutes > 0 ? [{ ...interval, date: occurrence.date, overlapMinutes }] : [];
  }) : []);
  let nextTime: string | null = null;
  const [hour, minute] = draft.scheduled_time!.split(":").map(Number);
  // Keep the selected date / recurrence days. Never silently move a quest to tomorrow.
  for (let candidate = Math.ceil((hour * 60 + minute + 1) / 5) * 5; candidate < 1440; candidate += 5) {
    const time = `${String(Math.floor(candidate / 60)).padStart(2, "0")}:${String(candidate % 60).padStart(2, "0")}`;
    const occurrences = atTime(time);
    if (occurrences.every((occurrence, index) => occurrence
      && occurrence.end <= calendarZonedDate(format(addDays(parseISO(dates[index]), 1), "yyyy-MM-dd"), "00:00", timezone).getTime()
      && !intervals.some(interval => occurrence.start < interval.end && occurrence.end > interval.start))) {
      nextTime = time;
      break;
    }
  }
  return { conflicts, nextTime, throughDate: range.throughDate, recurring, invalidTime: proposed.some(value => !value) };
}

/** Badges describe actual time intersections, not the minimum height of a rendered card. */
export function buildVisibleQuestConflictMap(tasks: ScheduleQuest[], events: ExternalCalendarEvent[], date: string,
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone): Map<string, Set<string>> {
  const intervals = buildScheduleIntervals(tasks.map(task => ({ ...task, task_date: task.task_date ?? date, is_recurring: false })),
    events, { startDate: date, throughDate: date }, timezone);
  const start = calendarZonedDate(date, "00:00", timezone).getTime();
  const end = calendarZonedDate(format(addDays(parseISO(date), 1), "yyyy-MM-dd"), "00:00", timezone).getTime();
  const visible = intervals.filter(item => item.start < end && item.end > start);
  const map = new Map<string, Set<string>>();
  visible.forEach((a, index) => visible.slice(index + 1).forEach(b => {
    if (a.id === b.id || a.start >= b.end || a.end <= b.start) return;
    if (!map.has(a.id)) map.set(a.id, new Set());
    if (!map.has(b.id)) map.set(b.id, new Set());
    map.get(a.id)!.add(b.id); map.get(b.id)!.add(a.id);
  }));
  return map;
}
