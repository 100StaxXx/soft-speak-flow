import {describe,it,expect} from 'vitest';
import {proposalTaskDetails} from './proposalTaskDetails';
import {validatePlanningReply,planningReplyForClient,ambiguousTimeQuestion,planningScopeQuestion,type PlannedQuest} from '../../../supabase/functions/cosmiq-quest-planner/planning';
const quest:PlannedQuest={id:'q',task_id:null,title:'Appointment with Cynthia Fuentes',goal:'Attend your appointment',epic_id:null,time:'10:00',duration:30,category:'soul',location:'360 E 2nd DTLA',notes:'Bring documents',reminder_offsets_minutes:[60],time_fixed:true};
describe('appointment proposal persistence',()=>{
 it('preserves a requested address and reminder in both create and update payloads',()=>{
  const result=proposalTaskDetails(quest);expect(result.add).toMatchObject({location:quest.location,notes:quest.notes,keepTimeFixed:true,reminderEnabled:true,reminderMinutesBefore:60,reminderOffsetsMinutes:[60]});
  expect(result.update).toMatchObject({location:quest.location,notes:quest.notes,flexibility:'fixed',reminder_enabled:true,reminder_offsets_minutes:[60]});
 });
 it('distinguishes unspecified reminders from explicit removal',()=>{
  expect(proposalTaskDetails({...quest,reminder_offsets_minutes:null}).update).not.toHaveProperty('reminder_enabled');
  expect(proposalTaskDetails({...quest,reminder_offsets_minutes:[]}).update).toMatchObject({reminder_enabled:false,reminder_offsets_minutes:[]});
 });
 it('rejects invalid details before mutation',()=>{
  for(const offsets of [[0],[-60],[10081],[1.5],[60,60],[1,2,3,4,5,6]])expect(()=>proposalTaskDetails({...quest,reminder_offsets_minutes:offsets})).toThrow(/reminder/);
  expect(()=>proposalTaskDetails({...quest,location:'x'.repeat(501)})).toThrow(/details/);
 });
 it('retains structured metadata through server plan validation and still rejects booking conflicts',()=>{
  const plan={phase:'review',reply:'Review your appointment.',choices:[],engagements:[],quests:[quest]};
  const context={date:'2026-10-28',timezone:'America/Los_Angeles',campaignIds:[],taskIds:[],busy:[]};
  expect(validatePlanningReply(plan,context).quests[0]).toEqual(quest);
  expect(()=>validatePlanningReply(plan,{...context,busy:[{id:'meeting',start:'2026-10-28T17:00:00Z',end:'2026-10-28T18:00:00Z'}]})).toThrow(/overlaps/);
 });
});

it('prevents older installed clients from silently discarding appointment metadata',()=>{
 const plan:any={phase:'review',reply:'Review.',choices:[],engagements:[],quests:[quest]};
 expect(planningReplyForClient(plan,undefined).quests).toEqual([]);
 expect(planningReplyForClient(plan,1)).toBe(plan);
 const simple:any={...plan,quests:[{...quest,location:null,notes:null,reminder_offsets_minutes:null,time_fixed:false}]};
 expect(planningReplyForClient(simple,undefined)).toBe(simple);
});

describe('ambiguous appointment times',()=>{
 it('asks AM/PM for the screenshot request without guessing',()=>{
  expect(ambiguousTimeQuestion('I have an appointment at 360 e 2nd dtla tomorrow at 10 with Cynthia Fuentes. I need to be reminded an hour earlier')?.choices).toEqual(['10 AM','10 PM']);
  expect(ambiguousTimeQuestion('Meet Sam at 7:30 tomorrow')?.choices).toEqual(['7:30 AM','7:30 PM']);
 });
 it('does not confuse addresses, explicit times, quantities or dayparts with ambiguity',()=>{
  for(const text of ['Meet at 10 Main Street tomorrow at 2pm','Appointment at 10 AM','Meeting at 14:00','Meet at 10 in the morning','Call at 7 tonight','Read at 10 pages per day','Visit 360 E 2nd tomorrow','Meet at 00:30'])expect(ambiguousTimeQuestion(text),text).toBeNull();
 });
});

 describe('natural-language scope and interval safeguards',()=>{
 const context={date:'2026-10-28',timezone:'America/Los_Angeles',campaignIds:[],taskIds:[],busy:[]};
 const plan=(changes:Partial<PlannedQuest>)=>({phase:'review' as const,reply:'Review.',choices:[],engagements:[],quests:[{...quest,...changes}]});
 it('rejects a proposal for a different day rather than saving under the selected date',()=>{
  expect(()=>validatePlanningReply(plan({date:'2026-11-05'}),context)).toThrow(/date/);
 });
 it('computes full shift duration from an explicit range, including overnight',()=>{
  expect(validatePlanningReply(plan({time:'08:00',end_time:'18:00',duration:10}),context).quests[0].duration).toBe(600);
  expect(validatePlanningReply(plan({time:'22:00',end_time:'02:00',duration:4}),context).quests[0].duration).toBe(240);
  expect(()=>validatePlanningReply(plan({time:'10:00',end_time:'10:00'}),context)).toThrow(/ambiguous/);
 });
 it('does not manufacture a generic task when an activity is missing',()=>expect(()=>validatePlanningReply(plan({title:'Task'}),context)).toThrow(/Activity is missing/));
 it('clarifies numeric dates, multiple days, and recurrence without offering a lossy proposal',()=>{
  expect(planningScopeQuestion('Haircut on 11/12 at 2pm')?.choices).toEqual(['November 12','December 11']);
  expect(planningScopeQuestion('Walk today and call Mom tomorrow')?.quests).toEqual([]);
  expect(planningScopeQuestion('Add yoga every Monday and Wednesday at 6pm')).toBeNull();
  expect(planningScopeQuestion('Add yoga tomorrow at 6pm')).toBeNull();
 });
 });

it('uses elapsed duration across a daylight-saving boundary',()=>{
 const p={phase:'review' as const,reply:'Review.',choices:[],engagements:[],quests:[{...quest,time:'22:00',end_time:'03:00',duration:300}]};
 expect(validatePlanningReply(p,{date:'2026-10-31',timezone:'America/Los_Angeles',campaignIds:[],taskIds:[],busy:[]}).quests[0].duration).toBe(360);
});
