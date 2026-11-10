import { calendarLocalParts, calendarZonedDate } from '@/utils/calendarTime';
import { shiftCommitmentDate, boundary } from '../../supabase/functions/_shared/commitmentSchedule';
export interface ZonedQuest {
 task_date?: string|null; scheduled_time?: string|null; estimated_duration?: number|null;
 schedule_timezone?: string|null; schedule_end_time?: string|null;
 schedule_source_date?: string|null; schedule_source_time?: string|null; schedule_source_duration?: number|null;
}
/** Canonical rows retain their original zone. Only presentation is projected to the viewer's day. */
export function projectQuest<T extends ZonedQuest>(task:T, timezone=Intl.DateTimeFormat().resolvedOptions().timeZone):T {
 if(!task.schedule_timezone || !task.task_date || !task.scheduled_time || task.schedule_source_date) return task;
 const start=boundary(task.task_date,task.scheduled_time.slice(0,5),task.schedule_timezone,false);
 const local=calendarLocalParts(start,timezone);
 let duration=task.estimated_duration;
 if(task.schedule_end_time){
  const endDate=task.schedule_end_time<task.scheduled_time?shiftCommitmentDate(task.task_date,1):task.task_date;
  const end=boundary(endDate,task.schedule_end_time.slice(0,5),task.schedule_timezone,true);
  duration=Math.max(1,Math.round((end.getTime()-start.getTime())/60000));
 }
 return {...task,task_date:local.date,scheduled_time:local.time,estimated_duration:duration,
  schedule_source_date:task.task_date,schedule_source_time:task.scheduled_time,schedule_source_duration:task.estimated_duration};
}
export function canonicalQuest<T extends ZonedQuest>(task:T):T {
 if(!task.schedule_source_date)return task;
 return {...task,task_date:task.schedule_source_date,scheduled_time:task.schedule_source_time,
  estimated_duration:task.schedule_source_duration ?? task.estimated_duration,
  schedule_source_date:undefined,schedule_source_time:undefined,schedule_source_duration:undefined};
}

/** Dragging edits the visible local clock; the persisted series keeps its original zone. */
export function canonicalScheduleChange<T extends ZonedQuest>(task: ZonedQuest | null | undefined, updates:T, viewerTimezone=Intl.DateTimeFormat().resolvedOptions().timeZone):T {
 if(!task?.schedule_timezone || updates.schedule_timezone !== undefined || (updates.task_date === undefined && updates.scheduled_time === undefined)) return updates;
 const visible=projectQuest(task,viewerTimezone);
 const date=updates.task_date === undefined ? visible.task_date : updates.task_date;
 const time=updates.scheduled_time === undefined ? visible.scheduled_time : updates.scheduled_time;
 if(!date || !time)return updates;
 const local=calendarLocalParts(calendarZonedDate(date,time.slice(0,5),viewerTimezone),task.schedule_timezone);
 return {...updates,task_date:local.date,scheduled_time:local.time};
}
