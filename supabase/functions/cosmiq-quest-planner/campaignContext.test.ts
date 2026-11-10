import {loadCampaignPlanningContext} from './campaignContext.ts';
const assert=(x:unknown)=>{if(!x)throw Error('Assertion failed');};
function fixture(fail=false){
 const calls:any[]=[];
 const rows:any={cosmiq_campaign_plans:[{epic_id:'a',plan:{subject:'My book',current:84}}],epic_milestones:[{id:'later',epic_id:'a',phase_order:2,milestone_percent:20},{id:'next',epic_id:'a',phase_order:1,milestone_percent:30}],epic_habits:[{epic_id:'a',habits:{id:'mine',user_id:'owner'}},{epic_id:'a',habits:{id:'other',user_id:'other'}}],cosmiq_campaign_reflections:[{epic_id:'a',answer:'Too much'}]};
 const db={from:(table:string)=>{const q:any={select:()=>q,eq:(...a:any[])=>{calls.push([table,...a]);return q;},in:()=>q,lte:()=>q,order:()=>q,limit:()=>q,then:(resolve:any)=>Promise.resolve({data:rows[table],error:fail?{message:'unavailable'}:null}).then(resolve)};return q;}};
 return {db,calls};
}
Deno.test('campaign context includes targets and feedback but excludes another member’s routine',async()=>{const f=fixture();const c=await loadCampaignPlanningContext(f.db,'owner',[{id:'a',title:'Read'}],'2026-10-29');assert(c[0].plan.current===84);assert(c[0].milestones[0].id==='next');assert(c[0].routines.length===1);assert(c[0].recentFeedback[0].answer==='Too much');for(const table of ['cosmiq_campaign_plans','epic_milestones','cosmiq_campaign_reflections'])assert(f.calls.some(c=>c[0]===table&&c[1]==='user_id'&&c[2]==='owner'));});
Deno.test('does not silently invent an empty plan when campaign data fails',async()=>{let failed=false;try{await loadCampaignPlanningContext(fixture(true).db,'owner',[{id:'a'}],'2026-10-29');}catch{failed=true;}assert(failed);});
Deno.test('no active campaigns require no extra reads',async()=>assert((await loadCampaignPlanningContext({from:()=>{throw Error('Unexpected read');}},'owner',[],'2026-10-29')).length===0));
