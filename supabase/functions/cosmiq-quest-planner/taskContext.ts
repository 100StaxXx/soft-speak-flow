import { boundary, shiftCommitmentDate } from '../_shared/commitmentSchedule.ts';
import { calendarLocalParts } from '../_shared/calendarTime.ts';
interface ScheduledTask {
  id: string; task_text: string; task_date: string | null; scheduled_time: string | null;
  estimated_duration: number | null; schedule_timezone: string | null; schedule_end_time: string | null;
}
/** Keep absolute occupied intervals before selecting local-day planning candidates.
 * The query includes neighboring source dates to cover timezone offsets and overnight quests. */
export function plannerTaskContext<T extends ScheduledTask>(rows: T[], date: string, timezone: string) {
  if (rows.length > 600) throw new Error('Too many tasks to safely review at once');
  const rangeStart=boundary(date,'00:00',timezone,false).getTime();
  const rangeEnd=boundary(shiftCommitmentDate(date,2),'00:00',timezone,true).getTime();
  const tasks:T[]=[], busy:{id:string;title:string;start:string;end:string}[]=[];
  for (const task of rows) {
    if (!task.task_date || !task.scheduled_time) {
      if (!task.task_date || task.task_date===date) tasks.push(task);
      continue;
    }
    const zone=task.schedule_timezone || timezone, clock=task.scheduled_time.slice(0,5);
    const start=boundary(task.task_date,clock,zone,false);
    const endClock=task.schedule_end_time?.slice(0,5);
    const end=endClock && endClock!==clock
      ? boundary(endClock<clock?shiftCommitmentDate(task.task_date,1):task.task_date,endClock,zone,true)
      : new Date(start.getTime()+Number(task.estimated_duration || 30)*60000);
    if (!Number.isFinite(end.getTime()) || end<=start) throw new Error('Invalid occupied task interval');
    if (start.getTime()<rangeEnd && end.getTime()>rangeStart) busy.push({id:task.id,title:task.task_text,start:start.toISOString(),end:end.toISOString()});
    const local=calendarLocalParts(start,timezone);
    if (local.date===date) tasks.push({...task,task_date:local.date,scheduled_time:local.time,estimated_duration:(end.getTime()-start.getTime())/60000});
  }
  if (tasks.length>200 || busy.length>200) throw new Error('Too many tasks to safely review at once');
  return {tasks,busy};
}
