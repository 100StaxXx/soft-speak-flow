import { describe, expect, it } from 'vitest';
import { existingSessionReply, nextMemorySuggestion, requestedExtraSession, scheduleAnchors, scheduleCheckQuestion, upcomingRoutineDays } from '../../../supabase/functions/cosmiq-quest-planner/scheduleAdvice';
import { selectedDayOffer, choosePlanningDay, isPlanningDayAnswer, scheduleFitReply, selectedTimeChoice, reviewSelectedTime, replacementActivity, validatePlanningReply } from '../../../supabase/functions/cosmiq-quest-planner/planning';

const zone = 'America/Los_Angeles', date = '2099-01-02';
const start = '2099-01-03T04:00:00.000Z';
const booking = {id:'cooking',title:'Cooking session',start};
const groceries = {id:'shop',title:'Grocery pickup',start:'2099-01-04T16:00:00Z'};
const tasks = [{id:'cooking',task_text:'Cooking session',task_date:'2099-01-03',scheduled_time:'04:00',schedule_timezone:'UTC'}];
const anchors = scheduleAnchors(tasks,[booking,{...booking,start:'2099-01-04T04:00:00Z'},groceries],date,'2099-01-09',zone);
const check = {kind:'reuse' as const, booking_id:anchors[0].id, activity:'trying the new recipe'};

describe('planning from dated commitments', () => {
  it('merges matching occurrences and keeps distinct dates for a single series', () => {
    expect(anchors.map(a=>a.title)).toEqual(['Cooking session','Cooking session','Grocery pickup']);
    expect(new Set(anchors.map(a=>a.id)).size).toBe(3);
    expect(scheduleAnchors(tasks,[booking],date,'2099-01-09',zone,Date.parse(start)+1)).toEqual([]);
  });

  it('answers with a verified local session and finishes reuse without a proposal', () => {
    const question = {...scheduleCheckQuestion(check,anchors,zone),engagements:[]};
    expect(question.reply).toMatch(/Cooking session.*Jan 2.*8:00 PM.*trying the new recipe/);
    expect(existingSessionReply(question.choices[0],question,anchors)).toMatchObject({phase:'goals',quests:[]});
    expect(existingSessionReply(question.choices[0],question,[])).toMatchObject({phase:'details',quests:[]});
    expect(existingSessionReply(question.choices[1],question,anchors)).toBeNull();
    expect(requestedExtraSession(question.choices[1])).toBe(true);
    for(const answer of ['Find another time','Plan another quest','I don’t want an extra session']) expect(requestedExtraSession(answer)).toBe(false);
  });

  it('asks about ingredients and anchors the question to a real grocery booking', () => {
    const question=scheduleCheckQuestion({...check,kind:'prerequisite',needed_item:'the ingredients',booking_id:anchors[2].id},anchors,zone);
    expect(question.reply).toMatch(/Grocery pickup.*Jan 4.*8:00 AM.*already have the ingredients/);
    expect(question.quests).toEqual([]);
    expect(()=>scheduleCheckQuestion({...check,booking_id:'unknown'},anchors,zone)).toThrow(/real/);
  });
});

describe('comparing nearby options', () => {
  const before={title:'Class',start:'2099-01-03T03:30:00Z',end:start};
  const query='How does my schedule look at 8 pm for 30 minutes?';
  it('compares the original slot to a full-length buffered option', () => {
    const plan=scheduleFitReply(query,date,zone,[before])!;
    expect(plan.time_choices?.map(slot=>[slot.time,slot.duration])).toEqual([['20:00',30],['20:15',30]]);
    expect(plan.reply).toMatch(/Class ends at 8:00 PM.*8:15 PM to 8:45 PM/);
    expect(validatePlanningReply(plan,{date,timezone:zone,campaignIds:[],taskIds:[],busy:[before]}).quests).toEqual([]);
  });
  it('rejects an alternative that runs into the following commitment', () => {
    const after={title:'Call',start:'2099-01-03T04:40:00Z',end:'2099-01-03T05:00:00Z'};
    expect(scheduleFitReply(query,date,zone,[before,after])!.time_choices).toEqual([]);
  });
  it('can offer an earlier start when the next task is the tight side', () => {
    const after={title:'Call',start:'2099-01-03T04:30:00Z',end:'2099-01-03T05:00:00Z'};
    expect(scheduleFitReply(query,date,zone,[after])!.time_choices?.map(slot=>slot.time)).toContain('19:45');
  });
});

it('offers a reusable correction once and honors explicit one-time exceptions', () => {
  const rule='Leave 20 minutes after in-person classes';
  expect(nextMemorySuggestion(rule,'I need 20 minutes after in-person classes',[])).toBe(rule);
  expect(nextMemorySuggestion(rule,'Just for today use a 20-minute gap',[])).toBeNull();
  expect(nextMemorySuggestion(rule,'I need the usual gap',[rule.toUpperCase()])).toBeNull();
});

it('offers a moved ritual on its real day without claiming its preferred time is booked', () => {
  const routine={id:'cook',title:'Practice cooking',frequency:'daily',ritual_settings:{exceptions:{'2099-01-03':{kind:'move',to:'2099-01-04'}}}};
  const upcoming=upcomingRoutineDays([routine,{...routine,id:'paused',ritual_settings:{paused:true}}],date,'2099-01-09');
  expect(upcoming).toHaveLength(1);
  expect(upcoming[0].routineDate).toBe('2099-01-04');
  const reference={...check,booking_id:upcoming[0].id};
  const question=scheduleCheckQuestion(reference,upcoming,zone);
  expect(question.reply).toContain('part of your routine on');
  expect(question.reply).not.toMatch(/AM|PM/);
  expect(()=>scheduleCheckQuestion({...reference,kind:'prerequisite'},upcoming,zone)).toThrow(/confirmed booking/);
});

describe('conversational schedule comparisons', () => {
  const question = 'Suppose a class runs from 7:30 PM to 8 PM. How would reading for 30 minutes at 8 PM fit?';
  function answer(busy: { start: string; end: string }[] = [], buffer = 15) {
    return validatePlanningReply({
      phase:'details', reply:'Would you like to move it later?', choices:['Keep that time','Move it later'],
      engagements:[{title:'Evening class',start:'19:30',end:'20:00'}], quests:[],
      fit_comparison:{time:'20:00',duration:30,buffer_minutes:buffer},
    }, {date, timezone:zone, latestMessage:question, campaignIds:[], taskIds:[], busy});
  }
  it('turns the hypothetical class into a full-length checked button, including an exact endpoint', () => {
    const plan = answer([{start:'2099-01-03T04:45:00Z',end:'2099-01-03T05:30:00Z'}]);
    expect(plan.choices).toContain('Use 8:15 PM');
    expect(plan.reply).toContain('8:15 PM to 8:45 PM fits the full 30 minutes with 15 minutes after Evening class');
    expect(plan.time_choices).toContainEqual({date,time:'20:15',duration:30,choice:'Use 8:15 PM'});
    expect(plan.quests).toEqual([]);
  });
  it('withholds the later button when the last minute conflicts', () => {
    const plan = answer([{start:'2099-01-03T04:44:00Z',end:'2099-01-03T05:30:00Z'}]);
    expect(plan.choices).not.toContain('Use 8:15 PM');
    expect(plan.reply).not.toContain('8:15 PM');
  });
  it('uses the requested buffer when it differs from 15 minutes', () => {
    expect(answer([],20).choices).toContain('Use 8:20 PM');
  });
});

it('uses the literal class range in a compound question and repairs a shifted model range', () => {
  const question='Suppose an evening class runs from 7:30 PM to 8:00 PM that day. With that in mind, how would reading for 30 minutes at 8 PM fit?';
  const wrong = {title:'Evening class', start:'2099-01-03T04:30:00Z', end:'2099-01-03T05:00:00Z'};
  const draft = {phase:'details' as const, reply:'How does that fit?', choices:['Keep it','Move it later'], quests:[], engagements:[wrong]};
  const direct=scheduleFitReply(question,date,zone,[],draft)!;
  const conversational=validatePlanningReply({...draft,fit_comparison:{time:'20:00',duration:30,buffer_minutes:15}}, {date,timezone:zone,campaignIds:[],taskIds:[],latestMessage:question,busy:[]});
  for (const plan of [direct,conversational]) {
    expect(plan.choices).toContain('Use 8:15 PM');
    expect(plan.engagements).toHaveLength(1);
    expect(plan.engagements[0].end).toBe('2099-01-03T04:00:00.000Z');
    expect(plan.quests).toEqual([]);
  }
});

describe('accepting an offered schedule-fit time', () => {
  const original = 'Suppose an evening class runs from 7:30 PM to 8:00 PM that day. With that in mind, how would reading for 30 minutes at 8 PM fit?';
  const draft = scheduleFitReply(original,date,zone,[])!;
  const selection = selectedTimeChoice('Use 8:15 PM',date,draft)!;
  const activity = {title:'Reading', goal:'Make time to read', category:'mind' as const, epic_id:null, task_id:null, notes:'Continue the current chapter', reminder_offsets_minutes:[5]};
  const context = {date,timezone:zone,busy:[],campaignIds:[],taskIds:[],latestMessage:'Use 8:15 PM'};
  it('opens review for the exact full interval using the original class and the latest calendar', () => {
    const plan = reviewSelectedTime(selection,activity,{...context,busy:[{start:'2099-01-03T04:45:00Z',end:'2099-01-03T05:00:00Z'}]});
    expect(plan).toMatchObject({phase:'review',choices:[],quests:[{...activity,time:'20:15',end_time:'20:45',duration:30,date}]});
    expect(plan.reply.replace(/\s/g,' ')).toContain('8:15 PM to 8:45 PM');
    expect(plan.engagements).toEqual(draft.engagements);
  });
  const lateBooking = {title:'Call',start:'2099-01-03T04:44:00Z',end:'2099-01-03T05:00:00Z'};
  it('names a last-minute conflict and accepts the full replacement interval in one tap', () => {
    const busy = [lateBooking];
    const offer = reviewSelectedTime(selection, activity, {...context,busy});
    expect(offer.reply).toContain('overlaps Call');
    expect(offer).toMatchObject({phase:'details',quests:[],choices:['Use 9:00 PM','Find another time'],
      time_choices:[{choice:'Use 9:00 PM',date,time:'21:00',duration:30}]});
    const next = selectedTimeChoice(offer.choices[0],date,offer)!;
    const accepted = reviewSelectedTime(next,replacementActivity(offer),{...context,busy,latestMessage:offer.choices[0]});
    expect(accepted).toMatchObject({phase:'review',choices:[],quests:[{...activity,date,time:'21:00',end_time:'21:30',duration:30}]});
  });
  it('rechecks the replacement and skips a 29-minute gap and a partial minute', () => {
    const offer = reviewSelectedTime(selection,activity,{...context,busy:[lateBooking]});
    const later = {title:'Pickup',start:'2099-01-03T05:29:00Z',end:'2099-01-03T05:40:10Z'};
    const next = reviewSelectedTime(selectedTimeChoice(offer.choices[0],date,offer)!,replacementActivity(offer),
      {...context,busy:[later,lateBooking],latestMessage:offer.choices[0]});
    expect(next.reply).toContain('overlaps Pickup');
    expect(next).toMatchObject({phase:'details',quests:[],time_choices:[{time:'21:41',duration:30}]});
    const both = reviewSelectedTime(selection,activity,{...context,busy:[later,lateBooking]});
    expect(both.time_choices).toEqual(next.time_choices);
  });
  it('offers no same-day time when the remaining 29 minutes are too short', () => {
    const plan = reviewSelectedTime(selection,activity,{...context,busy:[{...lateBooking,end:'2099-01-03T07:31:00Z'}]});
    expect(plan.phase).toBe('details');
    expect(plan.quests).toEqual([]);
    expect(plan.time_choices ?? []).toEqual([]);
    expect(plan.reply).toContain('later that day');
  });
  it('requires a matching live choice, date, duration and clock, including on older drafts', () => {
    expect(selectedTimeChoice('Use 8:15\u202fPM',date,draft)).toEqual(selection);
    expect(selectedTimeChoice('Use 8:30 PM',date,draft)).toBeNull();
    expect(selectedTimeChoice('Use 8:15 PM','2099-01-03',draft)).toBeNull();
    expect(selectedTimeChoice('Use 8:15 PM',date,{...draft,time_choices:[{...selection.slot,time:'19:45'}]})).toBeNull();
    expect(selectedTimeChoice('Use 8:15 PM',date,{...draft,time_choices:[{...selection.slot,duration:-5}]})).toBeNull();
  });
});

describe('carrying an activity to the selected day', () => {
  const activity = {title:'Reading',goal:'Read',category:'mind' as const,task_id:null,epic_id:null};
  const facts = {activity,duration:30,preferred_time:null,bookings:[
    {title:'Daytime',start:'00:00',end:'19:31'},
    {title:'Call',start:'20:00',end:'20:15'},
    {title:'Evening',start:'20:45',end:'24:00'},
  ]};
  it('offers the entire free interval on the chosen day and retains the bookings for the next tap', () => {
    const old = {phase:'details' as const,reply:'Which date do you want to use?',choices:['2099-01-02','2099-01-03'],engagements:[],quests:[]};
    expect(isPlanningDayAnswer(date,old,'')).toBe(true);
    expect(isPlanningDayAnswer('January 2, 2099',old,'')).toBe(true);
    expect(isPlanningDayAnswer('Use 8:15 PM',old,'')).toBe(false);
    const plan=selectedDayOffer(facts,old,date,zone,[]);
    expect(plan).toMatchObject({phase:'details',quests:[],time_choices:[{choice:'Use 8:15 PM',date,time:'20:15',duration:30}]});
    expect(plan.reply).toMatch(/Reading.+8:15\sPM to 8:45\sPM/);
    const tap=selectedTimeChoice(plan.choices[0],date,plan)!;
    const validated=reviewSelectedTime(tap,replacementActivity(plan),{date,timezone:zone,busy:[],taskIds:[],campaignIds:[]});
    expect(validated.quests[0]).toMatchObject({...activity,time:'20:15',end_time:'20:45',duration:30});
  });
  it('honors the new calendar and carries the known activity and duration through a second day change', () => {
    const busy=[{title:'New booking',start:'2099-01-03T04:44:00Z',end:'2099-01-03T05:00:00Z'}];
    const blocked=selectedDayOffer(facts,null,date,zone,busy);
    expect(blocked).toMatchObject({quests:[],carried_duration:30,replacement_activity:activity,choices:['Choose another day','I’ll enter a time']});
    const ask=choosePlanningDay(date,blocked);
    expect(ask.engagements).toEqual([]);
    const next=selectedDayOffer({activity:null,duration:null,preferred_time:'12:00',bookings:[]},ask,'2099-01-03',zone,[]);
    expect(next).toMatchObject({replacement_activity:activity,time_choices:[{date:'2099-01-03',time:'12:00',duration:30}]});
  });
});
