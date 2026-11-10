export interface PlannerPreferences {
 interests: string[]; aspirations: string[]; excluded_interests: string[]; explicit_preferences: string[];
 learning_enabled: boolean; learning_since: string; forgotten_patterns: string[]; reviewed_at: string | null;
}
export interface PlannerEvent {
 id?: string; kind: string; task_id?: string | null; proposal_id?: string | null; title: string; task_date?: string | null;
 before_time?: string | null; after_time?: string | null; before_duration?: number | null; after_duration?: number | null;
 reason?: string | null; created_at: string;
}
export const interestCatalog = ['Basketball','Reading','Cooking','Dog walking','Gaming','Hiking','Photography','Music','Art','Running','Yoga','Cycling','Swimming','Gardening','Writing','Dancing','Pickleball','Strength training','Birdwatching','Learning languages','Crafts','Volunteering','Meditation','Skateboarding'];
export const aspirationCatalog = ['Learn guitar','Get outdoors','Read more','Try a new sport','Make something creative','Meet people','Cook more often','Build strength','Learn a language','Get back into a hobby'];
export const interestKey = (s: string) => s.normalize('NFKC').trim().toLocaleLowerCase('en-US').replace(/\s+/g,' ');
export function cleanInterests(values: string[]): string[] { return [...new Map(values.map(s=>s.trim().replace(/\s+/g,' ').slice(0,120)).filter(Boolean).map(s=>[interestKey(s),s])).values()].slice(0,100); }
export function defaultPlannerPreferences(): PlannerPreferences { return {interests:[],aspirations:[],excluded_interests:[],explicit_preferences:[],learning_enabled:true,learning_since:new Date().toISOString(),forgotten_patterns:[],reviewed_at:null}; }
export function activityKey(title: string): string {
 const s=interestKey(title);
 if (/\b(walk|walking)\b/.test(s)&&/\b(dog|dogs|beast|puppy)\b/.test(s)) return 'dog-walking';
 if (/\b(read|reading)\b/.test(s)) return 'reading';
 if (/\b(guitar)\b/.test(s)) return 'guitar';
 if (/\b(workout|work out|strength|gym|lift weights)\b/.test(s)) return 'strength-training';
 if (/\b(run|running|jog|jogging)\b/.test(s)) return 'running';
 return s.replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\b(the|a|an|my|your)\b/g,'').trim().replace(/\s+/g,' ');
}
export interface LearnedPattern { id: string; activity: string; kind: 'time'|'duration'|'interest'|'workload'; value: string | number; evidence: number; explanation: string }
export function learnPlannerPatterns(preferences: PlannerPreferences, events: PlannerEvent[], now = new Date()): LearnedPattern[] {
 if (!preferences.learning_enabled) return [];
 const cutoff=Math.max(Date.parse(preferences.learning_since),now.getTime()-42*86400000);
 const recent=events.filter(e=>Date.parse(e.created_at)>=cutoff && Date.parse(e.created_at)<=now.getTime()).sort((a,b)=>a.created_at.localeCompare(b.created_at));
 const buckets=new Map<string,{activity:string;kind:LearnedPattern['kind'];values:Map<string,string|number>}>();
 const add=(activity:string,kind:LearnedPattern['kind'],key:string,value:string|number)=>{const id=`${activity}:${kind}`; const b=buckets.get(id)||{activity,kind,values:new Map()};b.values.set(key,value);buckets.set(id,b);};
 for(const e of recent){
  const a=activityKey(e.title),day=e.task_date||e.created_at.slice(0,10);
  // One vote per activity/day, so repeated editing cannot manufacture confidence.
  if(['edited','accepted'].includes(e.kind)){
   if(e.before_time&&e.after_time&&e.before_time.slice(0,5)!==e.after_time.slice(0,5)) add(a,'time',day,e.after_time.slice(0,5));
   if(e.before_duration&&e.after_duration&&e.before_duration!==e.after_duration&&e.after_duration>=5&&e.after_duration<=240) add(a,'duration',day,e.after_duration);
  }
  if(e.reason==='not_interested')add(a,'interest',day,'less often');
 }
 const result:LearnedPattern[]=[];
 for(const [id,b] of buckets){
  const values=[...b.values.values()];if(values.length<3)continue;
  let value:string|number;
  if(b.kind==='duration'){const numbers=values.map(Number).sort((a,b)=>a-b);value=numbers[Math.floor(numbers.length/2)];}
  else {const counts=new Map<string,number>();for(const v of values)counts.set(String(v),(counts.get(String(v))||0)+1);const best=[...counts].sort((a,b)=>b[1]-a[1])[0];if(best[1]/values.length<0.6)continue;value=best[0];}
  const explanation=b.kind==='time'?`You moved ${b.activity.replaceAll('-',' ')} to ${value} on several days.`:b.kind==='duration'?`You adjusted ${b.activity.replaceAll('-',' ')} sessions to around ${value} minutes.`:`You marked ${b.activity.replaceAll('-',' ')} as not interesting on several days.`;
  result.push({id,activity:b.activity,kind:b.kind,value,evidence:values.length,explanation});
 }
 // Requested shorter sessions across several days supports a lighter draft, not a productivity score.
 const shortened=recent.filter(e=>['accepted','edited'].includes(e.kind)&&e.before_duration&&e.after_duration&&e.after_duration<e.before_duration);
 if(new Set(shortened.map(e=>e.task_date||e.created_at.slice(0,10))).size>=3) result.push({id:'all:workload',activity:'all',kind:'workload',value:1,evidence:shortened.length,explanation:'You have been shortening sessions. Start with one manageable suggestion.'});
 return result.filter(p=>!preferences.forgotten_patterns.includes(p.id));
}
export function plannerPersonalization(preferences: PlannerPreferences, events: PlannerEvent[], now=new Date()) {
 const excluded=new Set(preferences.excluded_interests.map(interestKey));
 return {interests:preferences.interests.filter(x=>!excluded.has(interestKey(x))),aspirations:preferences.aspirations.filter(x=>!excluded.has(interestKey(x))),excludedInterests:preferences.excluded_interests,explicitPreferences:preferences.explicit_preferences,patterns:learnPlannerPatterns(preferences,events,now)};
}
