import { exportGoogleTask, taskExportMarker } from './export.ts';
const equal=(actual:unknown,expected:unknown)=>{if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);};
const id='11111111-1111-4111-8111-111111111111';
function harness(status='ready') {
  const intent={id,connection_id:'conn',provider:'google',list_id:'list/a',status,external_id:null as string|null,snapshot:{task_text:'Walk',task_date:'2026-09-19',notes:'Keep notes',completed:false}};
  const requests:Array<{url:string;init?:RequestInit}>=[];const filters:unknown[][]=[];
  let failPost=false;let postStatus=200;let recoveryItems:any[]=[];let claims=0;let finishFail=false;
  const db={from:(table:string)=>{const chain={select:()=>chain,eq:(key:string,value:unknown)=>{filters.push([table,key,value]);return chain;},maybeSingle:async()=>({data:table==='calendar_task_exports'?{...intent}: {id:'conn',user_id:'owner',provider:'google',access_token:'private',token_expires_at:'2099-01-01'},error:null})};return chain;},
    rpc:async(name:string,args:any)=>{
      if(name==='claim_calendar_task_export'){claims++;if(intent.status!=='ready')return{data:null,error:null};intent.status='dispatched';return{data:{...intent},error:null};}
      if(name==='complete_calendar_task_export'){if(finishFail)return{data:false,error:new Error('offline')};intent.status='complete';intent.external_id=args.p_external_id;return{data:true,error:null};}
      if(name==='reset_rejected_calendar_task_export'){intent.status='ready';return{error:null};}
      throw new Error('Unexpected RPC');
    }};
  const deps={env:()=> 'configured',fetch:(async(url:any,init?:RequestInit)=>{
    requests.push({url:String(url),init});
    if(init?.method==='POST'){if(failPost)throw new Error('lost connection');return Response.json({id:'created'}, {status:postStatus});}
    return String(url).includes('/users/@me/lists/')?Response.json({id:'list/a'}):Response.json({items:recoveryItems});
  }) as typeof fetch};
  return{intent,requests,filters,run:()=>exportGoogleTask(db,'owner',id,deps),claims:()=>claims,
    fail:()=>{failPost=true;},reject:(status:number)=>{postStatus=status;},recover:(items:any[])=>{recoveryItems=items;},finishFails:()=>{finishFail=true;}};
}
Deno.test('task export sends exactly one date-only task and preserves notes',async()=>{
  const h=harness();equal((await h.run()).status,200);await h.run();
  const posts=h.requests.filter(r=>r.init?.method==='POST');equal(posts.length,1);
  equal(JSON.parse(String(posts[0].init?.body)),{title:'Walk',notes:`Keep notes\n\n${taskExportMarker(id)}`,status:'needsAction',due:'2026-09-19T00:00:00Z'});
  equal(h.filters.filter(([,key])=>key==='user_id').every(([, ,value])=>value==='owner'),true);
});
Deno.test('two concurrent send requests cannot create duplicate tasks',async()=>{
  const h=harness();await Promise.all([h.run(),h.run()]);equal(h.requests.filter(r=>r.init?.method==='POST').length,1);
});
Deno.test('timeout recovery searches for the original without repeating its POST',async()=>{
  const h=harness();h.fail();equal((await h.run()).body.code,'EXPORT_UNCERTAIN');
  h.recover([{id:'already-created',notes:taskExportMarker(id)}]);equal((await h.run()).body.externalId,'already-created');
  equal(h.requests.filter(r=>r.init?.method==='POST').length,1);
});
Deno.test('missing recovery match never authorizes a second create',async()=>{
  const h=harness('dispatched');equal((await h.run()).body.code,'EXPORT_UNCERTAIN');equal(h.claims(),0);equal(h.requests.some(r=>r.init?.method==='POST'),false);
});
Deno.test('duplicate recovery markers require review instead of guessing',async()=>{
  const h=harness('dispatched');h.recover([{id:'one',notes:taskExportMarker(id)},{id:'two',notes:taskExportMarker(id)}]);equal((await h.run()).status,409);equal(h.intent.status,'dispatched');
});
Deno.test('only definitive rejection can reset a create attempt',async()=>{
  const rejected=harness();rejected.reject(403);await rejected.run();equal(rejected.intent.status,'ready');
  for(const status of [408,429,500,503]){const h=harness();h.reject(status);await h.run();equal(h.intent.status,'dispatched');}
});
Deno.test('failed link persistence retains the durable recovery state',async()=>{
  const h=harness();h.finishFails();equal((await h.run()).status,503);equal(h.intent.status,'dispatched');
  h.recover([{id:'created',notes:taskExportMarker(id)}]);await h.run();equal(h.requests.filter(r=>r.init?.method==='POST').length,1);
});
