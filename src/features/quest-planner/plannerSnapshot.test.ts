import { describe, expect, it } from 'vitest';
import { planningSnapshot, reviewPlannerProposals } from './plannerSnapshot';
import type { PlanningReply } from '../../../supabase/functions/cosmiq-quest-planner/planning';
const plan: PlanningReply = { phase: 'review', reply: 'A small plan', choices: [], engagements: [], quests: [{ id: 'draft', task_id: null, title: 'Walk the Beast', goal: 'Get active', epic_id: null, time: '05:30', duration: 30, category: 'body' }] };
describe('planner snapshot identity', () => {
  it('recognizes recurring occurrences before their dated task is materialized', () => {
    const snapshot = planningSnapshot({ incomplete: false, events: [], tasks: [{ id: 'template', task_text: 'Walk the Beast', task_date: '2026-10-26', scheduled_time: '05:30', estimated_duration: 30, is_recurring: true, recurrence_pattern: 'daily' }] }, '2026-10-28', 'America/Los_Angeles');
    expect(snapshot.existing).toContainEqual(expect.objectContaining({ id: 'template', title: 'Walk the Beast', scheduled: true }));
    expect(reviewPlannerProposals(plan, snapshot.existing).plan.quests).toEqual([]);
  });
  it('does not suppress the same activity booked only on a different day', () => {
    const snapshot = planningSnapshot({ incomplete: false, events: [], tasks: [{ id: 'yesterday', task_text: 'Walk the Beast', task_date: '2026-10-27', scheduled_time: '05:30', estimated_duration: 30 }] }, '2026-10-28', 'America/Los_Angeles');
    expect(reviewPlannerProposals(plan, snapshot.existing).plan.quests).toHaveLength(1);
  });
  it('treats a completed occurrence as done rather than re-proposing the template', () => {
    const snapshot = planningSnapshot({ incomplete: false, events: [], tasks: [{ id: 'template', task_text: 'Walk the Beast', task_date: '2026-10-26', scheduled_time: '05:30', is_recurring: true, recurrence_pattern: 'daily' }, { id: 'done', parent_template_id: 'template', task_text: 'Walk the Beast', task_date: '2026-10-28', scheduled_time: '05:30', completed: true }] }, '2026-10-28', 'America/Los_Angeles');
    expect(reviewPlannerProposals(plan, snapshot.existing).plan.quests).toEqual([]);
  });
});

it('keeps completed quests occupied and includes adjacent-day repeats for overnight proposals', () => {
  const snapshot = planningSnapshot({incomplete:false,events:[],tasks:[
    {id:'done',task_text:'Completed appointment',task_date:'2026-10-28',scheduled_time:'10:00',estimated_duration:60,completed:true},
    {id:'night',task_text:'Night shift',task_date:'2026-10-25',scheduled_time:'23:00',estimated_duration:120,is_recurring:true,recurrence_pattern:'daily'},
    {id:'tomorrow',task_text:'Early appointment',task_date:'2026-10-29',scheduled_time:'00:30',estimated_duration:30},
  ]},'2026-10-28','America/Los_Angeles');
  expect(snapshot.busy).toContainEqual(expect.objectContaining({id:'done'}));
  expect(snapshot.busy).toContainEqual(expect.objectContaining({id:'night',start:Date.parse('2026-10-28T06:00:00Z')}));
  expect(snapshot.busy).toContainEqual(expect.objectContaining({id:'tomorrow'}));
  expect(snapshot.existing.some(q=>q.id==='tomorrow')).toBe(false);
});
