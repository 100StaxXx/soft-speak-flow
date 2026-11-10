import { withTimeout, TimeoutError } from '@/utils/asyncTimeout';
import { scheduleReadiness } from './scheduleReadiness';
import { calendarReadIssue, type ScheduleReadIssue } from './scheduleReadMessage';
import { materializeQuests } from './materializeQuests';
import type { ScheduleInterval } from '@/utils/questScheduleConflicts';
import { addDays, format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { getAllLocalTasksForUser } from "@/utils/plannerLocalStore";
import { getPlannerRemoteSyncEpoch } from "@/utils/plannerSync";
import { loadConnectionEvents } from "@/hooks/useExternalCalendarEvents";
import type { ConnectedCalendar, CalendarProvider } from "@/hooks/useCalendarIntegrations";
import { calendarZonedDate } from "@/utils/calendarTime";
import { getScheduleCheckRange, type QuestScheduleDraft, type ScheduleQuest, type ScheduleCalendarLink } from "@/utils/questScheduleConflicts";
import type { ExternalCalendarEvent } from "@/types/externalCalendar";

export interface ScheduleAvailabilityOptions {
  userId: string;
  connections: ConnectedCalendar[];
  visibleCalendars?: Partial<Record<CalendarProvider, string[]>>;
  timezone: string;
  cachedTasks: ScheduleQuest[];
  extraCommitments?: ScheduleInterval[];
  cachedEvents: ExternalCalendarEvent[];
  excludedEventKeys: Set<string>;
  linkedEvents?: ScheduleCalendarLink[];
  calendarsLoading?: boolean;
}

export interface ScheduleAvailability {
  tasks: ScheduleQuest[];
  events: ExternalCalendarEvent[];
  incomplete: boolean;
  issues?: ScheduleReadIssue[];
  commitments?: ScheduleInterval[];
}

async function deadline<T>(job: PromiseLike<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try { return await Promise.race([Promise.resolve(job), new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Schedule check timed out")), 10000);
  })]); } finally { clearTimeout(timer!); }
}

/** Read only. Never applies a remote snapshot or flushes the user's offline changes. */
export async function loadQuestScheduleAvailability(draft: QuestScheduleDraft, options: ScheduleAvailabilityOptions, range?: {startDate: string; throughDate: string}): Promise<ScheduleAvailability> {
  try {
    return await withTimeout(() => readQuestScheduleAvailability(draft, options, range), {timeoutMs: 20_000, operation: 'Schedule check'});
  } catch(error) {
    if(!(error instanceof TimeoutError))throw error;
    return {tasks:options.cachedTasks,events:options.cachedEvents,commitments:options.extraCommitments??[],incomplete:true,issues:['timeout']};
  }
}

async function readQuestScheduleAvailability(draft: QuestScheduleDraft, options: ScheduleAvailabilityOptions, range?: {startDate: string; throughDate: string}): Promise<ScheduleAvailability> {
  const { startDate, throughDate } = range ?? getScheduleCheckRange(draft);
  let localTasks = options.cachedTasks;
  const issues: ScheduleReadIssue[] = options.calendarsLoading ? ['calendar-settings'] : [];
  try { localTasks = [...localTasks, ...await getAllLocalTasksForUser<ScheduleQuest>(options.userId)]; }
  catch { issues.push('device-storage'); }
  const selectedConnections = options.connections.flatMap(connection => [...new Set(options.visibleCalendars?.[connection.provider]
    ?? [connection.primary_calendar_id ?? ''])].map(calendarId => ({ ...connection, primary_calendar_id: calendarId })));
  const [taskResult, ...calendarResults] = await Promise.allSettled([
    (async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const epoch = getPlannerRemoteSyncEpoch(options.userId);
        const issue = await scheduleReadiness(options.userId);
        if (issue) throw new Error(issue);
        await materializeQuests(startDate,throughDate);
        const tasks: ScheduleQuest[] = [];
        // Include old templates and unusually long overnight quests, and paginate busy accounts.
        for (let offset = 0; ; offset += 500) {
          const result = await deadline(supabase.from("daily_tasks")
            .select("id,task_text,task_date,scheduled_time,estimated_duration,completed,is_recurring,parent_template_id,habit_source_id,recurrence_pattern,recurrence_days,recurrence_month_days,recurrence_custom_period,recurrence_end_date,created_at,session_series_anchor,schedule_timezone,schedule_end_time,flexibility")
            .eq("user_id", options.userId).lte("task_date", format(addDays(parseISO(throughDate), 1), "yyyy-MM-dd"))
            .or(`task_date.gte.${startDate},is_recurring.eq.true,estimated_duration.gt.1440`)
            .order("id").range(offset, offset + 499));
          if (result.error) throw result.error;
          tasks.push(...(result.data ?? []) as ScheduleQuest[]);
          if ((result.data?.length ?? 0) < 500) break;
        }
        const afterIssue = await scheduleReadiness(options.userId);
        if (afterIssue) throw new Error(afterIssue);
        if (epoch !== getPlannerRemoteSyncEpoch(options.userId)) throw new Error('schedule-updating');
        return tasks;
      } catch (error) {
        if (!(error instanceof Error) || error.message !== 'schedule-updating' || attempt === 2) throw error;
        // A task write or background refresh may briefly hold the local-store lock.
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      }
      throw new Error('schedule-updating');
    })(),
    ...selectedConnections.map(connection => deadline(loadConnectionEvents(connection, {
        startDate: calendarZonedDate(startDate, "00:00", options.timezone).toISOString(),
        // Include the following day so overnight durations are checked against its events too.
        endDate: calendarZonedDate(format(addDays(parseISO(throughDate), 2), "yyyy-MM-dd"), "00:00", options.timezone).toISOString(),
      }))),
  ]);
  const tasks = taskResult.status === "fulfilled" ? taskResult.value as ScheduleQuest[] : localTasks;
  if (taskResult.status === 'rejected') issues.push(
    ['local-sync', 'schedule-updating', 'offline', 'device-storage'].includes(taskResult.reason?.message) ? taskResult.reason.message as ScheduleReadIssue : 'tasks');
  const events: ExternalCalendarEvent[] = [];
  calendarResults.forEach((result, index) => {
    if (result.status === "fulfilled") events.push(...result.value as ExternalCalendarEvent[]);
    else issues.push(calendarReadIssue(selectedConnections[index].provider, result.reason));
  });
  if (calendarResults.some(result => result.status === "rejected")) events.push(...options.cachedEvents);
  const commitments: ScheduleInterval[] = [];
  commitments.push(...(options.extraCommitments || []));
  return { tasks, events, incomplete: issues.length > 0, issues: [...new Set(issues)], commitments };
}
