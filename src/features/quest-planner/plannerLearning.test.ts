import {describe,it,expect} from 'vitest';
import {defaultPlannerPreferences,learnPlannerPatterns,plannerPersonalization,cleanInterests,type PlannerEvent} from '../../../supabase/functions/_shared/plannerLearning';
import {requestedPlanningDate} from './planningDate';
const now=new Date('2026-10-27T18:00:00Z');
const prefs=()=>({...defaultPlannerPreferences(),learning_since:'2026-10-01T00:00:00Z'});
const events:PlannerEvent[]=[21,23,25].map(d=>({kind:'edited',title:'Walk my dog',task_id:`task${d}`,task_date:`2026-10-${d}`,before_time:'07:00',after_time:'19:00',before_duration:45,after_duration:20,created_at:`2026-10-${d}T18:00:00Z`}));
describe('adaptive planner memory',()=>{
 it('requires repeated choices on distinct days',()=>{expect(learnPlannerPatterns(prefs(),events.slice(0,2),now)).toEqual([]);expect(learnPlannerPatterns(prefs(),[events[0],events[0],events[0]],now)).toEqual([]);});
 it('learns time and session length with explanations after repeated edits',()=>{expect(learnPlannerPatterns(prefs(),events,now)).toEqual(expect.arrayContaining([expect.objectContaining({id:'dog-walking:time',value:'19:00',evidence:3}),expect.objectContaining({id:'dog-walking:duration',value:20})]));});
 it('never treats checkoff timestamps as durations or one dismissal as dislike',()=>{expect(learnPlannerPatterns(prefs(),events.map(e=>({...e,kind:'completed',before_duration:null})),now)).toEqual([]);expect(learnPlannerPatterns(prefs(),[{...events[0],kind:'dismissed',reason:'not_interested'}],now)).toEqual([]);});
 it('honors learning off, reset dates, and forgotten patterns',()=>{expect(learnPlannerPatterns({...prefs(),learning_enabled:false},events,now)).toEqual([]);expect(learnPlannerPatterns({...prefs(),learning_since:now.toISOString()},events,now)).toEqual([]);expect(learnPlannerPatterns({...prefs(),forgotten_patterns:['dog-walking:time']},events,now).some(p=>p.kind==='time')).toBe(false);});
 it('does not change interests for not-today feedback',()=>{expect(learnPlannerPatterns(prefs(),events.map(e=>({...e,kind:'dismissed',reason:'not_today'})),now)).toEqual([]);});
 it('excludes future and old evidence',()=>{expect(learnPlannerPatterns(prefs(),events.map(e=>({...e,created_at:'2027-01-01T00:00:00Z'})),now)).toEqual([]);});
 it('supports custom interests, preserves explicit preferences, and excludes opted-out activities',()=>{const p={...prefs(),interests:['Pottery','Gaming'],excluded_interests:['gaming'],explicit_preferences:['I prefer quiet evenings']};const context=plannerPersonalization(p,events,now);expect(context.interests).toEqual(['Pottery']);expect(context.explicitPreferences).toEqual(p.explicit_preferences);});
 it('deduplicates custom input case and whitespace without restricting vocabulary',()=>expect(cleanInterests(['  Bird watching ','bird   watching','Pottery'])).toEqual(['bird watching','Pottery']));
});
describe('natural language planning dates',()=>{
 it('uses the supplied local day across midnight and month boundaries',()=>{expect(requestedPlanningDate('walk tomorrow at 7pm','2026-10-31')).toBe('2026-11-01');expect(requestedPlanningDate('read tonight','2026-10-27')).toBe('2026-10-27');});
 it('resolves weekdays and valid ISO dates without guessing invalid dates',()=>{expect(requestedPlanningDate('play basketball Friday','2026-10-27')).toBe('2026-10-30');expect(requestedPlanningDate('next Tuesday','2026-10-27')).toBe('2026-11-03');expect(requestedPlanningDate('on 2026-02-30','2026-10-27')).toBe(null);});
});

it('does not silently route multi-day or recurring requests to the first date mentioned',()=>{
 expect(requestedPlanningDate('Walk today and call tomorrow','2026-10-27')).toBeNull();
 expect(requestedPlanningDate('Yoga every Monday and Wednesday','2026-10-27')).toBeNull();
 expect(requestedPlanningDate('Walk tmrw at 7pm','2026-10-31')).toBe('2026-11-01');
});

it('resolves the named date selected after numeric-date clarification',()=>expect(requestedPlanningDate('November 12','2026-10-27')).toBe('2026-11-12'));
