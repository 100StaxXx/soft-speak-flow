import {describe,it,expect} from 'vitest';
import {firstRecurrenceDate,validateRecurrence,recurrenceLabel,type PlannedRecurrence} from '../../../supabase/functions/cosmiq-quest-planner/recurrence';
import {validatePlanningReply,planningReplyForClient} from '../../../supabase/functions/cosmiq-quest-planner/planning';
import {proposalTaskDetails} from './proposalTaskDetails';
import {requestedPlanningDate} from './planningDate';
const weekly:PlannedRecurrence={pattern:'weekly',days:[0,2],month_days:[],end_date:'2026-12-18'};
const q=()=>({id:'q',task_id:null,title:'Class',goal:'Attend class',epic_id:null,time:'08:00',date:'2026-10-27',end_time:'11:00',duration:180,category:'mind' as const,recurrence:weekly});
const plan=()=>({phase:'review',reply:'Review classes',choices:[],engagements:[],quests:[q()]});
const context={date:'2026-10-27',timezone:'America/Los_Angeles',campaignIds:[],taskIds:[],busy:[],allowRecurrence:true};
describe('recurring natural-language proposals',()=>{
 it('starts on the first actual repeat day and preserves reminders and inclusive end date',()=>{
  const result=validatePlanningReply(plan(),context);expect(result.quests[0].date).toBe('2026-10-28');
  expect(proposalTaskDetails({...result.quests[0],reminder_offsets_minutes:[60]}).add).toMatchObject({recurrencePattern:'weekly',recurrenceDays:[0,2],recurrenceEndDate:'2026-12-18',reminderOffsetsMinutes:[60]});
 });
 it('supports separate same-name class periods, but rejects duplicate or overlapping ranges',()=>{
  const p=plan();p.quests.push({...q(),id:'q2',time:'14:00',end_time:'16:00'});expect(validatePlanningReply(p,context).quests.map(q=>q.duration)).toEqual([180,120]);
  const duplicate=plan();duplicate.quests.push({...q(),id:'q2'});expect(()=>validatePlanningReply(duplicate,context)).toThrow(/Duplicate/);
  const overlap=plan();overlap.quests.push({...q(),id:'q2',time:'10:00',end_time:'12:00'});expect(()=>validatePlanningReply(overlap,context)).toThrow(/overlaps/);
 });
 it('does not silently invent recurrence, change an explicit start, or convert an existing quest',()=>{
  expect(()=>validatePlanningReply(plan(),{...context,allowRecurrence:false})).toThrow(/explicit/);
  const other=plan();other.quests[0].date='2026-11-02';expect(()=>validatePlanningReply(other,context)).toThrow(/start date/);
  expect(()=>proposalTaskDetails({...q(),task_id:'existing'})).toThrow(/Agenda/);
 });
 it('prevents older clients from saving a lossy one-off',()=>{expect(planningReplyForClient(plan() as any,1).quests).toEqual([]);expect(planningReplyForClient(plan() as any,2).quests).toHaveLength(1);});
 it('handles weekends, biweekly anchors and short-month boundaries',()=>{
  expect(firstRecurrenceDate({...weekly,pattern:'weekends',days:[]},'2026-10-27')).toBe('2026-10-31');
  expect(firstRecurrenceDate({...weekly,pattern:'biweekly',days:[0]},'2026-10-27')).toBe('2026-11-02');
  expect(firstRecurrenceDate({pattern:'monthly',days:[],month_days:[31],end_date:null},'2027-02-01')).toBe('2027-02-28');
  expect(recurrenceLabel(weekly)).toContain('Mon, Wed');
 });
 it('rejects unsupported or contradictory schedules and no occurrences before end',()=>{
  for(const changes of [{pattern:'quarterly'},{days:[7]},{days:[0,0]},{days:[]},{end_date:'2026-02-30'},{end_date:'2026-10-01'},{month_days:[4]}])expect(()=>validateRecurrence({...weekly,...changes} as any,'2026-10-27')).toThrow();
  expect(()=>firstRecurrenceDate({...weekly,end_date:'2026-10-27'},'2026-10-27')).toThrow(/No occurrence/);
 });
 it('never mistakes a recurring end date for the date to start planning',()=>{for(const text of ['Classes Mondays and Wednesdays through December 18','Pay rent monthly through 2027-01-31','Read weekdays until November 12'])expect(requestedPlanningDate(text,'2026-10-27')).toBeNull();});
});

it('separates recurring frequency from permission to duplicate an existing activity',()=>{const p=plan();Object.assign(p.quests[0],{repeat_requested:true});expect(validatePlanningReply(p,context).quests[0].repeat_requested).toBe(false);const existing=plan();Object.assign(existing.quests[0],{repeat_requested:true});expect(()=>validatePlanningReply(existing,{...context,existingQuests:[{id:'old',title:'Class',scheduled:true}]})).toThrow(/explicit/);});
