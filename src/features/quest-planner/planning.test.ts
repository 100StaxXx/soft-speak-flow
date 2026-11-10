import { asksAboutScheduleFit, scheduleFitReply, unsupportedReminderQuestion, allowsEmptyPlanningReview } from "../../../supabase/functions/cosmiq-quest-planner/planning";
import { describe, expect, it } from 'vitest';
import { PLANNING_INSTRUCTIONS, validatePlanningReply, validatePlannerResponse, recheckPlannerTimeChoices, plannerFreeWindows, type PlanningReply } from '../../../supabase/functions/cosmiq-quest-planner/planning';
const context = { date: '2026-10-27', timezone: 'America/Los_Angeles', campaignIds: ['campaign'], taskIds: ['existing'], busy: [{ id: 'work', start: '2026-10-27T16:00:00Z', end: '2026-10-28T00:00:00Z' }] };
const proposal = (): PlanningReply => ({ phase: 'review', reply: 'Here is one small step toward your goal.', choices: [], engagements: [], quests: [{ id: 'quest', task_id: null, title: 'Read one chapter', goal: 'Build my astronomy knowledge', epic_id: 'campaign', time: '18:00', duration: 20, category: 'mind' }] });
describe('focused quest planning', () => {
  it('requires engagements first and one question at a time, without old menu branching', () => {
    expect(PLANNING_INSTRUCTIONS).toContain('FIRST check prior engagements');
    expect(PLANNING_INSTRUCTIONS).toContain('Ask one question at a time');
    expect(PLANNING_INSTRUCTIONS).toContain('Do not offer Logistics / Priorities / Lighter');
  });
  it('accepts a timed goal-linked task outside work', () => expect(validatePlanningReply(proposal(), context).quests).toHaveLength(1));
  it('rejects work overlaps, unknown goals and unknown task IDs', () => {
    for (const changes of [{ time: '10:00' }, { epic_id: 'someone-elses-goal' }, { task_id: 'someone-elses-task' }]) {
      const plan = proposal(); Object.assign(plan.quests[0], changes);
      expect(() => validatePlanningReply(plan, context)).toThrow();
    }
  });
  it('does not let a scheduled task bypass duplicate checking by reusing its ID', () => {
    const plan = proposal(); plan.quests[0].task_id = 'existing';
    expect(() => validatePlanningReply(plan, { ...context, busy: [{ id: 'existing', start: '2026-10-28T01:00:00Z', end: '2026-10-28T01:20:00Z' }] })).toThrow(/already scheduled/);
  });
  it('checks appointments mentioned in the conversation and conflicts within the draft', () => {
    const plan = proposal(); plan.engagements.push({ title: 'Dinner', start: '2026-10-28T01:00:00Z', end: '2026-10-28T02:00:00Z' });
    expect(() => validatePlanningReply(plan, context)).toThrow(/overlaps/);
    const duplicate = proposal(); duplicate.quests.push({ ...duplicate.quests[0], id: 'another', title: 'Draw a constellation' });
    expect(() => validatePlanningReply(duplicate, context)).toThrow(/overlaps/);
  });
  it('converts local engagement times on the server, including overnight appointments', () => {
    const plan = proposal(); plan.engagements = [{ title: 'Dinner', start: '19:00', end: '20:00' }, { title: 'Night shift', start: '23:00', end: '07:00' }];
    const result = validatePlanningReply(plan, context);
    expect(result.engagements[0]).toMatchObject({ start: '2026-10-28T02:00:00.000Z', end: '2026-10-28T03:00:00.000Z' });
    expect(result.engagements[1]).toMatchObject({ start: '2026-10-28T06:00:00.000Z', end: '2026-10-28T14:00:00.000Z' });
  });
  it('permits a question-only turn or a rest day without inventing quests', () => {
    const plan = proposal(); plan.quests = [];
    expect(validatePlanningReply(plan, context).quests).toEqual([]);
  });
  it('rejects invalid duration, missing goals and nonexistent DST wall times', () => {
    for (const changes of [{ duration: 0 }, { goal: '' }, { time: '25:00' }]) {
      const plan = proposal(); Object.assign(plan.quests[0], changes);
      expect(() => validatePlanningReply(plan, context)).toThrow();
    }
  });
});


describe('proposal identity and explicit requests', () => {
  it('rejects already-scheduled quests even when their original ID would exempt their time', () => {
    const plan = proposal(); plan.quests[0].task_id = 'existing';
    expect(() => validatePlanningReply(plan, { ...context, existingQuests: [{ id: 'existing', title: 'Read one chapter', scheduled: true }] })).toThrow(/already scheduled/);
  });
  it('rejects an existing quest disguised as a new ID or moved to a different hour', () => {
    const plan = proposal(); plan.quests[0].title = 'Read the one chapter'; plan.quests[0].time = '20:00';
    expect(() => validatePlanningReply(plan, { ...context, existingQuests: [{ id: 'existing', title: 'Read one chapter', scheduled: true }] })).toThrow(/already scheduled/);
  });
  it('retains identity when scheduling an unscheduled task', () => {
    const plan = proposal(); plan.quests[0].task_id = 'existing';
    expect(validatePlanningReply(plan, { ...context, existingQuests: [{ id: 'existing', title: 'Read one chapter', scheduled: false }] }).quests[0].task_id).toBe('existing');
    plan.quests[0].task_id = null;
    expect(() => validatePlanningReply(plan, { ...context, existingQuests: [{ id: 'existing', title: 'Read one chapter', scheduled: false }] })).toThrow(/existing unscheduled task ID/);
  });
  it('does not offer a completed task or repeat a draft activity at a second time', () => {
    expect(() => validatePlanningReply(proposal(), { ...context, existingQuests: [{ id: 'done', title: 'Read one chapter', scheduled: false, completed: true }] })).toThrow(/completed/);
    const plan = proposal(); plan.quests.push({ ...plan.quests[0], id: 'second', time: '20:00' });
    expect(() => validatePlanningReply(plan, context)).toThrow(/Duplicate quest/);
  });
  it('does not expose proposals during an unfinished questions phase', () => {
    const plan = proposal(); plan.phase = 'goals'; plan.choices = ['Read something', 'Practice a skill'];
    expect(() => validatePlanningReply(plan, context)).toThrow(/ready for review/);
  });
  it('supports explicit personal activities without forcing a campaign', () => {
    const plan = proposal(); Object.assign(plan.quests[0], { title: 'Walk Dog', time: '19:00', goal: 'Care for my dog', epic_id: null, duration_suggested: true });
    expect(validatePlanningReply(plan, context).quests[0]).toMatchObject({ time: '19:00', duration_suggested: true, epic_id: null });
  });
});

it('permits explicit edits to eligible existing quests without excluding other bookings',()=>{const plan=proposal();plan.quests[0].task_id='existing';expect(validatePlanningReply(plan,{...context,editableTaskIds:['existing'],existingQuests:[{id:'existing',title:'Read one chapter',scheduled:true}],busy:[{id:'existing',start:'2026-10-28T01:00:00Z',end:'2026-10-28T01:20:00Z'}]}).quests).toHaveLength(1);});
it('permits an explicitly requested second session but rejects an unsolicited repeat',()=>{const plan=proposal();plan.quests[0].repeat_requested=true;const c={...context,existingQuests:[{id:'another',title:'Read one chapter',scheduled:true}]};expect(()=>validatePlanningReply(plan,c)).toThrow(/explicit request/);expect(validatePlanningReply(plan,{...c,allowRepeat:true}).quests).toHaveLength(1);});
it('rejects invalid times and semantic dog-walk duplicates',()=>{const plan=proposal();plan.quests[0].time='25:00';expect(()=>validatePlanningReply(plan,context)).toThrow();plan.quests[0].time='18:00';plan.quests[0].title='Walk Dog';expect(()=>validatePlanningReply(plan,{...context,existingQuests:[{id:'walk',title:'Walk the Beast',scheduled:true}]})).toThrow(/already scheduled/);});

it('requires distinct answer choices for every question but allows review controls to carry the next step', () => {
  for (const phase of ['commitments','goals','details'] as const) {
    const plan = { ...proposal(), phase, quests: [], choices: [] as string[] };
    expect(() => validatePlanningReply(plan, context)).toThrow(/answer choices/);
    plan.choices = ['20 minutes','20 MINUTES'];
    expect(() => validatePlanningReply(plan, context)).toThrow(/answer choices/);
    plan.choices = ['15 minutes','30 minutes'];
    expect(validatePlanningReply(plan, context).choices).toEqual(['15 minutes','30 minutes']);
  }
  expect(validatePlanningReply(proposal(), context).phase).toBe('review');
});

it('accepts a contextual input hint, rejects malformed hints, and supports older drafts',()=>{
 expect(validatePlanningReply({...proposal(),input_hint:'Tell me what you would like to change…'},context).input_hint).toContain('change');
 for(const input_hint of ['', 'x'.repeat(91), 42])expect(()=>validatePlanningReply({...proposal(),input_hint},context)).toThrow(/hint/);
 expect(validatePlanningReply(proposal(),context).input_hint).toContain('change');
});


describe('unsupported reminder clarification', () => {
  it.each([
    'Sketch at 9 PM for 20 minutes. Remind me 10 minutes after it starts.',
    'Notify me five minutes after the appointment ends.',
    'Set a reminder at the end of this task.',
  ])('asks for a supported reminder instead of dropping it: %s', message => {
    const reply = unsupportedReminderQuestion(message);
    expect(reply?.phase).toBe('details');
    expect(reply?.quests).toEqual([]);
    expect(reply?.choices).toEqual(['10 minutes before it starts', 'No reminder']);
  });
  it.each([
    'Sketch at 9 PM and remind me 10 minutes before it starts.',
    'Remind me to call home after work.',
    'After it starts I want to focus on drawing.',
  ])('does not intercept ordinary requests: %s', message => {
    expect(unsupportedReminderQuestion(message)).toBeNull();
  });
});

describe('time answer choices use the full occupied schedule', () => {
  const question = (time: string, label: string, duration = 30): PlanningReply => ({
    phase: 'details', reply: 'What time would you prefer?', input_hint: 'Choose or enter a time…',
    choices: [label, 'Find an open time for me'], engagements: [], quests: [],
    time_choices: [{choice: label, date: context.date, time, duration}],
  });
  it('rejects the reproduced 9 AM reply option during Work', () => {
    expect(() => validatePlanningReply(question('09:00','9:00 AM'),context)).toThrow(/answer choice overlaps/);
  });
  it('rejects a free start when the requested duration runs into work', () => {
    expect(() => validatePlanningReply(question('08:45','8:45 AM'),context)).toThrow(/answer choice overlaps/);
  });
  it('allows exact end/start boundaries without manufacturing conflicts', () => {
    expect(validatePlanningReply(question('08:30','8:30 AM'),context).choices[0]).toBe('8:30 AM');
    expect(validatePlanningReply(question('17:00','5:00 PM'),context).choices[0]).toBe('5:00 PM');
  });
  it('requires duration evidence rather than accepting an unchecked clock option', () => {
    const p=question('18:00','6:00 PM'); delete p.time_choices;
    expect(() => validatePlanningReply(p,context)).toThrow(/full task duration/);
  });
  it('rejects mismatched labels and dates', () => {
    const p=question('18:00','9:00 AM');
    expect(() => validatePlanningReply(p,context)).toThrow(/match its label/);
    p.time_choices![0].time='09:00';p.time_choices![0].date='2026-10-28';
    expect(() => validatePlanningReply(p,context)).toThrow(/selected date/);
  });
  it('checks conversational engagements and overnight intervals', () => {
    const p=question('20:00','8:00 PM');p.engagements=[{title:'Dinner',start:'19:30',end:'20:30'}];
    expect(() => validatePlanningReply(p,context)).toThrow(/answer choice overlaps/);
    expect(() => validatePlanningReply(question('23:45','11:45 PM'),{...context,busy:[{start:'2026-10-28T07:00:00Z',end:'2026-10-28T08:00:00Z'}]})).toThrow(/answer choice overlaps/);
  });
  it('keeps duration questions and non-clock options available', () => {
    const p=question('18:00','6:00 PM');p.time_choices=[];p.choices=['15 minutes','30 minutes'];
    expect(validatePlanningReply(p,context).choices).toEqual(p.choices);
    p.choices=['Find an open time for me','I’ll enter another time'];
    expect(validatePlanningReply(p,context).choices).toEqual(p.choices);
  });
});


it('recovers an unsafe time question without showing a conflicting suggestion or failing the chat', () => {
 const plan:PlanningReply={phase:'details',reply:'Try 9 AM.',choices:['9 AM','Find an open time for me'],quests:[],engagements:[],time_choices:[{choice:'9 AM',date:context.date,time:'09:00',duration:30}]};
 const safe=validatePlannerResponse(plan,context);
 expect(safe.choices).toEqual(['Find an open time for me','I’ll enter another time']);
 expect(safe.reply).not.toContain('9 AM');
 expect(safe.quests).toEqual([]);
 expect(safe.phase).toBe('details');
});
it('never repairs an overlapping actual quest by skipping validation', () => {
 const plan=proposal();plan.quests[0].time='09:00';
 expect(()=>validatePlannerResponse(plan,context)).toThrow(/overlaps/);
});

it('rechecks restored time choices against newly occupied time and old clients without metadata', () => {
 const old:PlanningReply={phase:'details',reply:'How about 6 PM?',choices:['6 PM','Find an open time for me'],quests:[],engagements:[],time_choices:[{choice:'6 PM',date:context.date,time:'18:00',duration:30}]};
 expect(recheckPlannerTimeChoices(old,context).choices[0]).toBe('6 PM');
 const occupied={...context,busy:[{start:'2026-10-28T01:00:00Z',end:'2026-10-28T02:00:00Z'}]};
 expect(recheckPlannerTimeChoices(old,occupied).choices).not.toContain('6 PM');
 delete old.time_choices;
 expect(recheckPlannerTimeChoices(old,context).choices).not.toContain('6 PM');
});

it('provides real free windows after merging work, calendar, and overlapping bookings', () => {
 const windows=plannerFreeWindows('2026-10-28',context.timezone,[
  {start:'2026-10-28T15:00:00Z',end:'2026-10-29T01:00:00Z'},
  {start:'2026-10-28T16:00:00Z',end:'2026-10-28T17:00:00Z'},
  {start:'2026-10-29T01:30:00Z',end:'2026-10-29T02:30:00Z'},
 ]);
 expect(windows.map(w=>[w.local_start.time,w.local_end.time,w.duration_minutes])).toEqual([['00:00','08:00',480],['18:00','18:30',30],['19:30','00:00',270]]);
});
it('does not offer free windows inside an all-day booking or overnight carryover', () => {
 expect(plannerFreeWindows(context.date,context.timezone,[{start:'2026-10-27T00:00:00Z',end:'2026-10-29T00:00:00Z'}])).toEqual([]);
 const windows=plannerFreeWindows(context.date,context.timezone,[{start:'2026-10-27T06:00:00Z',end:'2026-10-27T09:00:00Z'}]);
 expect(windows[0].local_start.time).toBe('02:00');
});

it('does not treat old review choices as extra bookings against the proposal itself', () => {
 const p=proposal();p.choices=['6 PM','Find an open time for me'];p.time_choices=[{choice:'6 PM',date:context.date,time:'18:00',duration:20}];
 const reviewed=validatePlannerResponse(p,context);
 expect(reviewed.quests).toHaveLength(1);
 expect(reviewed.choices).toEqual([]);
 expect(reviewed.time_choices).toEqual([]);
});

it('keeps a verified alternative when another AI time runs into a booking', () => {
 const p:PlanningReply={phase:'details',reply:'Try 9 AM or 6 PM.',choices:['9 AM','6 PM','Find an open time for me'],quests:[],engagements:[],time_choices:[{choice:'9 AM',date:context.date,time:'09:00',duration:30},{choice:'6 PM',date:context.date,time:'18:00',duration:30},{choice:'Find an open time for me',date:context.date,time:'09:00',duration:30}]};
 const safe=validatePlannerResponse(p,context);
 expect(safe.choices).toEqual(['6 PM','I’ll enter another time']);
 expect(safe.reply).not.toContain('9 AM');
});
it('builds review wording from the validated quest instead of a stale time question', () => {
 const p=proposal();p.reply='Choose 9 AM or 6 PM and I will show a card.';
 const safe=validatePlannerResponse(p,context);
 expect(safe.reply).toContain('Read one chapter');expect(safe.reply).toContain('6:00 PM');
 expect(safe.reply).not.toContain('9 AM');expect(safe.input_hint).toContain('change');
});

describe('empty review must not hide an unanswered question',()=>{
 it.each([
  'The two activities overlap. Please change one time, or I can help you enter new times for both.',
  'Which time would you like to change?',
  'Choose a different day or finish planning.',
  'Reading overlaps stretching. I can review both if you move one: change Reading, change Stretching, or enter new times.',
 ])('requires answer choices for an unresolved response: %s',reply=>{
  expect(()=>validatePlanningReply({...proposal(),quests:[],reply},{...context,allowEmptyReview:false})).toThrow(/answer choices/);
 });
 it.each(['All set. Your saved quests stay in Agenda.','No problem — I will not add it.','Rest is a valid plan. Nothing else is needed.'])('allows a completed conversation: %s',reply=>{
  expect(validatePlanningReply({...proposal(),quests:[],reply},{...context,allowEmptyReview:true}).phase).toBe('review');
 });
});

it('permits an empty terminal screen only when the latest input expresses stopping or skipping',()=>{
 for(const message of ['I am done','Never mind, do not add that','No more quests','Rest day','I’ll skip it'])expect(allowsEmptyPlanningReview(message)).toBe(true);
 for(const message of ['Read at 7 PM and stretch at 7:15 PM','Move stretching to 7:45 PM','Find a time for me'])expect(allowsEmptyPlanningReview(message)).toBe(false);
});

it('requires an explicit no-reminder request to survive into a single reviewed quest',()=>{
 const plan=proposal();plan.quests[0].reminder_offsets_minutes=null;
 expect(()=>validatePlanningReply(plan,{...context,latestMessage:'Add reading at 8 PM for 20 minutes. No reminder.'})).toThrow(/reminder/i);
 plan.quests[0].reminder_offsets_minutes=[];
 expect(validatePlanningReply(plan,{...context,latestMessage:'Add reading at 8 PM for 20 minutes. No reminder.'}).quests[0].reminder_offsets_minutes).toEqual([]);
});
it('explains an occupied booking when removing an unsafe time option',()=>{
 const plan={...proposal(),phase:'details' as const,quests:[],reply:'How about 10 AM or 6 PM?',choices:['10 AM','6 PM'],time_choices:[{choice:'10 AM',date:context.date,time:'10:00',duration:30},{choice:'6 PM',date:context.date,time:'18:00',duration:30}]};
 const result=recheckPlannerTimeChoices(plan,{...context,busy:[{...context.busy[0],title:'Work'}]});
 expect(result.reply).toContain('Work');expect(result.choices).not.toContain('10 AM');expect(result.choices).toContain('6 PM');
});

it('allows today’s activity when the same activity is booked tomorrow',()=>{
 const plan=proposal();
 expect(validatePlanningReply(plan,{...context,busy:[{id:'tomorrow',title:plan.quests[0].title,start:'2026-10-29T01:00:00Z',end:'2026-10-29T01:30:00Z'}]}).quests).toHaveLength(1);
});
it('still blocks an overnight proposal that runs into tomorrow’s booking',()=>{
 const plan=proposal();plan.quests[0].time='23:30';plan.quests[0].duration=120;
 expect(()=>validatePlanningReply(plan,{...context,busy:[{id:'tomorrow',title:'Class',start:'2026-10-28T07:30:00Z',end:'2026-10-28T08:00:00Z'}]})).toThrow(/overlap/);
});
it('does not treat a scoped or subsequently overridden reminder instruction as global',()=>{
 for (const latestMessage of ['No reminder for the dog walk. Remind me about reading an hour before.','No reminder for my other appointment.','Add a note: “No reminder”.']) {
  const plan=proposal();plan.quests[0].reminder_offsets_minutes=[60];
  expect(validatePlanningReply(plan,{...context,latestMessage}).quests[0].reminder_offsets_minutes).toEqual([60]);
 }
});

describe('questions about how a time fits', () => {
  const question = 'I’m thinking at night like 8 pm. How’s my schedule then?';
  const zone = 'America/Los_Angeles';
  const date = '2026-11-10';
  const draft = {...proposal(), quests:[], time_choices:[{choice:'8 AM',date,time:'08:00',duration:30}]};
  const before = {title:'Work review',start:'2026-11-11T03:30:00Z',end:'2026-11-11T04:00:00Z'};
  const after = {title:'Call',start:'2026-11-11T04:35:00Z',end:'2026-11-11T05:00:00Z'};
  it('names both neighbors, distinguishes touching from overlapping and asks about transition time', () => {
    const plan = scheduleFitReply(question,date,zone,[before,after],draft)!;
    expect(plan).toMatchObject({phase:'details',quests:[]});
    expect(plan.reply).toContain('Work review ends at 8:00 PM, right when you’d start.');
    expect(plan.reply).toContain('Call starts at 8:35 PM, 5 minutes after you’d finish.');
    expect(plan.choices).toContain('Leave a buffer');
  });
  it('uses mentioned commitments and never offers to keep an overlapping time', () => {
    const plan = scheduleFitReply(question,date,zone,[],{...draft,engagements:[{...before,end:'2026-11-11T04:15:00Z'}]})!;
    expect(plan.reply).toContain('overlaps Work review');
    expect(plan.choices).not.toContain('Use that time');
  });
  it('does not guess when the duration or the referred time is uncertain', () => {
    expect(scheduleFitReply(question,date,zone,[],null)).toBeNull();
    expect(scheduleFitReply('How’s my schedule then?',date,zone,[],draft)).toBeNull();
    expect(asksAboutScheduleFit('Use that time')).toBe(false);
    expect(asksAboutScheduleFit('I’m thinking of adding a reading ritual.')).toBe(false);
    expect(scheduleFitReply('How’s my schedule at 8 PM if I need 20 minutes to commute?',date,zone,[],draft)).toBeNull();
    expect(() => validatePlanningReply(proposal(),{...context,latestMessage:'How’s my schedule then?'})).toThrow(/confirmation/);
    expect(validatePlanningReply(proposal(),{...context,latestMessage:'Use that time'}).quests).toHaveLength(1);
  });
});
