import {createClient} from '@supabase/supabase-js';
import {appendFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const origin='https://opbfpbbqvuksuvmtmssd.supabase.co';
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!key)throw Error('worker_credentials_missing');
const db=createClient(origin,key,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:health,error}=await db.rpc('companion_media_quality_health');
if(error)throw Error('worker_health_unavailable');
const {data:rollout,error:rolloutError}=await db.from('companion_animation_rollout').select('queue_enabled').eq('singleton',true).single();
if(rolloutError)throw Error('worker_rollout_unavailable');
const {count,error:queueError}=await db.from('companion_animation_packages').select('id',{count:'exact',head:true}).in('status',['queued','processing']);
if(queueError)throw Error('worker_queue_unavailable');
const work=Boolean((health.workerEnabled&&(health.queued>0||health.processing>0))||(rollout.queue_enabled&&count>0));
if(process.argv.includes('--probe')) {
 if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,`work=${work}\n`);
 console.log(JSON.stringify({work,queued:health.queued,processing:health.processing,needsReview:health.needsReview,packages:count}));
}else{
 let failed=false;
 // A run is finite. The database owns leases, limits and retry accounting.
 for(let i=0;i<12;i++){
  const {data:h,error:e}=await db.rpc('companion_media_quality_health');
  if(e)throw Error('worker_health_unavailable');
  if(!h.workerEnabled||h.queued+h.processing===0)break;
  try{execFileSync(process.execPath,['scripts/companion-media-worker.mjs','--once'],{stdio:'inherit',timeout:9*60000,env:{...process.env,SUPABASE_URL:origin,COMPANION_MEDIA_WORKER_ENABLED:'1'}});}catch{failed=true;}
 }
 if(rollout.queue_enabled&&count>0)try{execFileSync(process.execPath,['scripts/companion-animation-worker.mjs','--once'],{stdio:'inherit',timeout:46*60000,env:{...process.env,SUPABASE_URL:origin,COMPANION_ANIMATION_WORKER_ENABLED:'1'}});}catch{failed=true;}
 if(failed)process.exitCode=1;
}
