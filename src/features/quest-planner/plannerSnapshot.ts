import { addDays, format } from 'date-fns';
import type { ScheduleAvailability } from '@/services/questScheduleAvailability';
import { buildScheduleIntervals } from '@/utils/questScheduleConflicts';
import { calendarZonedDate } from '@/utils/calendarTime';
import { findExistingPlannerQuest, type ExistingPlannerQuest } from '../../../supabase/functions/_shared/questPlanIdentity';
import type { PlanningReply } from '../../../supabase/functions/cosmiq-quest-planner/planning';

export function planningSnapshot(availability: ScheduleAvailability, date: string, timezone: string) {
  const start = calendarZonedDate(date, '00:00', timezone).getTime();
  const shifted = (days: number) => format(addDays(new Date(`${date}T12:00:00`), days), 'yyyy-MM-dd');
  const dayEnd = calendarZonedDate(shifted(1), '00:00', timezone).getTime();
  // A late task may extend into tomorrow; yesterday's repeat may extend into today.
  const end = calendarZonedDate(shifted(2), '00:00', timezone).getTime();
  const busy = [...buildScheduleIntervals(availability.tasks.map(task => ({...task, completed: false})), availability.events, { startDate: shifted(-1), throughDate: shifted(1) }, timezone), ...(availability.commitments ?? [])]
    .filter(block => !block.id.startsWith('mentioned:') && block.start < end && block.end > start);
  const existing: ExistingPlannerQuest[] = [
    ...availability.tasks.filter(task => !task.task_date || task.task_date === date).map(task => ({
      id: task.id, title: task.task_text, scheduled: !!(task.task_date && task.scheduled_time), completed: task.completed, editable: !task.completed && task.task_date === date && !task.is_recurring && !task.parent_template_id,
    })),
    ...busy.filter(block => block.start < dayEnd && block.end > start).map(block => ({ id: block.id, title: block.title, scheduled: true })),
  ];
  return { busy, existing };
}

export function reviewPlannerProposals(plan: PlanningReply, existing: ExistingPlannerQuest[], saved: string[] = []) {
  const removed: string[] = [];
  const quests = plan.quests.filter(quest => {
    if (saved.includes(quest.id)) return true;
    if (quest.repeat_requested && !quest.task_id) return plan.phase === 'review';
    if (quest.task_id && existing.some(t=>t.id===quest.task_id && t.editable)) return plan.phase === 'review';
    const match = findExistingPlannerQuest(quest, recurringPeersExcluded(quest,existing,plan,saved));
    if (match?.scheduled || match?.completed) { removed.push(match.title); return false; }
    return plan.phase === 'review';
  });
  return { plan: { ...plan, quests }, removed: [...new Set(removed)] };
}

export function recurringPeersExcluded(quest: PlanningReply['quests'][number], existing:ExistingPlannerQuest[], plan:PlanningReply, saved:string[]) {
 if(!quest.recurrence)return existing;
 const peers=new Set(plan.quests.filter(q=>q.recurrence&&q.id!==quest.id&&saved.includes(q.id)&&q.time!==quest.time).map(q=>q.task_id||q.id));
 return existing.filter(row=>!peers.has(row.id));
}
