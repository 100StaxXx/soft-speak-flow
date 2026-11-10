import { describe, expect, it } from 'vitest';
import { plannerTaskContext } from '../../../supabase/functions/cosmiq-quest-planner/taskContext';
const date='2026-10-29',timezone='America/Los_Angeles';
const task=(extra={})=>({id:'night',task_text:'Night shift',task_date:'2026-10-28',scheduled_time:'22:00:00',estimated_duration:240,completed:false,schedule_timezone:null,schedule_end_time:null,...extra});
describe('server occupied quest intervals',()=>{
 it('reserves yesterday’s overnight tail without treating it as today’s editable task',()=>{
  const result=plannerTaskContext([task()],date,timezone);
  expect(result.tasks).toEqual([]);
  expect(result.busy).toEqual([{id:'night',title:'Night shift',start:'2026-10-29T05:00:00.000Z',end:'2026-10-29T09:00:00.000Z'}]);
 });
 it('uses explicit overnight ends and source time zones',()=>{
  const result=plannerTaskContext([task({schedule_timezone:'America/New_York',schedule_end_time:'06:00:00'})],date,timezone);
  expect(result.busy[0]).toMatchObject({start:'2026-10-29T02:00:00.000Z',end:'2026-10-29T10:00:00.000Z'});
 });
 it('keeps tomorrow’s early booking to check quests that extend past midnight',()=>{
  expect(plannerTaskContext([task({task_date:'2026-10-30',scheduled_time:'00:30:00',estimated_duration:30})],date,timezone).busy).toHaveLength(1);
 });
 it('excludes finished-before-midnight intervals and preserves unscheduled quests',()=>{
  const result=plannerTaskContext([task({scheduled_time:'18:00:00',estimated_duration:60}),task({id:'inbox',task_date:null,scheduled_time:null})],date,timezone);
  expect(result.busy).toEqual([]);expect(result.tasks.map(t=>t.id)).toEqual(['inbox']);
 });
 it('preserves both copies of a fall-back hour when explicit endpoints cross the fold',()=>{
  const result=plannerTaskContext([task({task_date:'2026-11-01',scheduled_time:'01:15:00',schedule_end_time:'01:45:00',schedule_timezone:timezone})],'2026-11-01',timezone);
  expect(result.busy[0]).toMatchObject({start:'2026-11-01T08:15:00.000Z',end:'2026-11-01T09:45:00.000Z'});
 });
 it('fails closed before filtering a truncated query result',()=>{
  expect(()=>plannerTaskContext(Array.from({length:601},()=>task()),date,timezone)).toThrow(/Too many/);
 });
});
