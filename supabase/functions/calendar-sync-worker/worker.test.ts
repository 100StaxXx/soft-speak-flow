import { syncBackgroundLink, runCalendarSyncWorker, type WorkerLink } from "./worker.ts";
import { createCalendarSyncWorkerHandler } from "./index.ts";
import { requireInternalRequest } from "../_shared/auth.ts";
const equal = (a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`Mismatch: ${JSON.stringify(a)} / ${JSON.stringify(b)}`); };
const baseline = { task_text: "Walk", task_date: "2026-09-19", scheduled_time: "10:00", estimated_duration: 60, location: null, notes: null };
const token = "11111111-1111-4111-8111-111111111111";
function fixture(kind: "event" | "task" = "event", provider: "google" | "outlook" = "google") {
  const link: WorkerLink = { id: "link", user_id: "owner", task_id: "quest", connection_id: "conn", provider,
    calendar_id: "list", external_id: "item", baseline: { ...baseline, ...(kind === "task" ? { completed: false } : {}) },
    timezone: "UTC", resource_kind: kind, sync_status: "linked", sync_enabled: true, revision: 0, sync_token: token };
  const task = { ...link.baseline };
  const conn = { id: "conn", user_id: "owner", provider, sync_enabled: true, access_token: "private-token", token_expires_at: "2099-01-01" };
  const current = { ...link, sync_lease_until: "2099-01-01" };
  const control = { enabled: true, run_token: "run", lease_until: "2099-01-01" };
  const filters: unknown[] = [], calls: any[] = [], requests: any[] = [];
  let response: any = kind === "task" ? { id: "item", title: "Walk", status: "needsAction", due: "2026-09-19T00:00:00Z", etag: '"v1"' }
    : { id: "item", summary: "Walk", etag: '"v1"', start: { dateTime: "2026-09-19T10:00:00Z" }, end: { dateTime: "2026-09-19T11:00:00Z" } };
  let readStatus = 200, writeStatus = 200, afterRead = () => {};
  const db: any = { from: (table: string) => {
    const chain = { select: () => chain, eq: (k: string, v: unknown) => { filters.push([table,k,v]); return chain; },
      maybeSingle: async () => ({ data: table === "daily_tasks" ? task : table === "user_calendar_connections" ? conn : table === "calendar_sync_worker_control" ? control : current, error: null }) };
    return chain;
  }, rpc: async (name: string, args?: unknown) => { calls.push([name,args]); return { data: true, error: null }; } };
  const fetcher = (async (url: unknown, init: RequestInit) => {
    requests.push({ url, ...init });
    const write = init.method === "PATCH";
    if (!write) afterRead();
    return Response.json(write ? {} : response, { status: write ? writeStatus : readStatus, headers: { "Retry-After": "900" } });
  }) as typeof fetch;
  const deps = { db, fetch: fetcher, env: () => "configured" };
  return { link, task, conn, current, control, calls, filters, requests, deps,
    response: (data: unknown) => { response = data; }, readStatus: (status: number) => { readStatus = status; },
    writeStatus: (status: number) => { writeStatus = status; }, afterRead: (fn: () => void) => { afterRead = fn; },
    finish: () => calls.find(([name]) => name === "finish_calendar_background_sync")?.[1] };
}
Deno.test("worker pulls a remote edit with owner-scoped queries and no provider write", async () => {
  const f = fixture(); f.response({ id: "item", summary: "New title", start: { dateTime: "2026-09-19T10:00Z" }, end: { dateTime: "2026-09-19T11:00Z" } });
  await syncBackgroundLink(f.link,"run",f.deps);
  equal(f.requests.length,1); equal(f.finish().p_snapshot.task_text,"New title"); equal(f.finish().p_user_id,"owner");
  equal(f.filters.filter((v: any) => v[1] === "user_id").map((v: any) => v[2]), ["owner","owner"]);
});
Deno.test("worker sends only safe fields with If-Match and never creates or deletes", async () => {
  const f = fixture(); f.task.task_text = "Local title";
  await syncBackgroundLink(f.link,"run",f.deps);
  equal(f.requests.map(r=>r.method ?? "GET"),["GET","PATCH"]);
  equal(f.requests[1].headers["If-Match"],'"v1"');
  equal(Object.keys(JSON.parse(f.requests[1].body)).sort(),["end","location","start","summary"]);
  equal(f.finish().p_status,"linked"); equal(JSON.stringify(f.calls).includes("private-token"),false);
});
Deno.test("worker pauses conflicts without choosing a winner", async () => {
  const f = fixture(); f.task.task_text="Local";
  f.response({ id:"item",summary:"Remote",start:{dateTime:"2026-09-19T10:00Z"},end:{dateTime:"2026-09-19T11:00Z"} });
  await syncBackgroundLink(f.link,"run",f.deps);
  equal(f.requests.length,1); equal(f.finish().p_status,"conflict");
});
Deno.test("worker retains local quest when outside item is deleted", async () => {
  const f=fixture(); f.readStatus(404);
  await syncBackgroundLink(f.link,"run",f.deps);
  equal(f.finish().p_status,"missing"); equal(f.requests.length,1);
});
Deno.test("worker handles rate limits with persisted retry delay", async () => {
  const f=fixture(); f.readStatus(429);
  await syncBackgroundLink(f.link,"run",f.deps);
  equal(f.finish().p_status,"retry"); equal(f.finish().p_retry_seconds,900);
});
Deno.test("worker rechecks pause, kill switch and lease immediately before patch", async () => {
  for (const change of ["pause","kill","expired","revision"]) {
    const f=fixture(); f.task.task_text="Local";
    f.afterRead(() => {
      if (change==="pause") f.current.sync_enabled=false;
      if (change==="kill") f.control.enabled=false;
      if (change==="expired") f.current.sync_lease_until="2000-01-01";
      if (change==="revision") f.current.revision++;
    });
    await syncBackgroundLink(f.link,"run",f.deps);
    equal(f.requests.length,1); equal(f.finish().p_status,"retry");
  }
});
Deno.test("worker refuses missing/wildcard versions and handles concurrent remote edits", async () => {
  for (const etag of [undefined,"*"]) {
    const f=fixture(); f.task.task_text="Local";
    f.response({ id:"item",summary:"Walk",etag,start:{dateTime:"2026-09-19T10:00Z"},end:{dateTime:"2026-09-19T11:00Z"} });
    await syncBackgroundLink(f.link,"run",f.deps);
    equal(f.requests.length,1); equal(f.finish().p_status,"retry");
  }
  const f=fixture(); f.task.task_text="Local"; f.writeStatus(412);
  await syncBackgroundLink(f.link,"run",f.deps);
  equal(f.finish().p_status,"retry"); equal(f.finish().p_snapshot.task_text,"Local");
});
Deno.test("worker does not mistake malformed provider data for a deletion", async () => {
  const f=fixture(); f.response({id:"item"});
  await syncBackgroundLink(f.link,"run",f.deps);
  equal(f.finish().p_status,"retry");
});
Deno.test("worker repairs lost acknowledgements without a repeated provider write", async () => {
  const f=fixture("task"); f.task.task_text="Already sent";
  f.response({id:"item",title:"Already sent",due:"2026-09-19T00:00Z",status:"needsAction"});
  await syncBackgroundLink(f.link,"run",f.deps);
  equal(f.requests.length,1); equal(f.finish().p_snapshot.task_text,"Already sent"); equal(f.finish().p_status,"linked");
});
Deno.test("worker task patches preserve notes and send only date/title/completion", async () => {
  for (const provider of ["google","outlook"] as const) {
    const f=fixture("task",provider); f.task.completed=true;
    if (provider==="outlook") f.response({id:"item",title:"Walk",status:"notStarted",dueDateTime:{dateTime:"2026-09-19T00:00:00"},"@odata.etag":'"v1"'});
    await syncBackgroundLink(f.link,"run",f.deps);
    const patch=JSON.parse(f.requests[1].body);
    equal(patch.status,"completed"); equal(Object.keys(patch).sort(),provider==="google"?["due","status","title"]:["dueDateTime","status","title"]);
  }
});
Deno.test("worker ignores Apple, disabled and unresolved links", async () => {
  for (const patch of [{provider:"apple"},{sync_enabled:false},{sync_status:"conflict"},{sync_status:"missing"}]) {
    const f=fixture(); Object.assign(f.link,patch);
    await syncBackgroundLink(f.link,"run",f.deps); equal(f.requests.length,0); equal(f.calls.length,0);
  }
});
Deno.test("dispatcher is disabled/concurrency safe and releases its lease on queue errors", async () => {
  const f=fixture(); const calls:string[]=[];
  f.deps.db.rpc=async(name:string) => { calls.push(name); return {data: null, error:null}; };
  equal(await runCalendarSyncWorker(f.deps),{processed:0,failed:0}); equal(calls,["claim_calendar_sync_worker"]);
  calls.length=0;
  f.deps.db.rpc=async(name:string) => { calls.push(name); return {data: name==="claim_calendar_sync_worker"?"run":null,error:name==="claim_next_calendar_background_sync"?new Error("db unavailable"):null}; };
  let failed=false; try { await runCalendarSyncWorker(f.deps); } catch { failed=true; }
  equal(failed,true); equal(calls.at(-1),"release_calendar_sync_worker");
});
Deno.test("dispatcher processes at most ten items and ignores request body selections", async () => {
  const f=fixture(); let finishes=0;
  f.deps.db.rpc=async(name:string) => {
    if(name==="finish_calendar_background_sync") finishes++;
    return {data:name==="claim_calendar_sync_worker"?"run":name==="claim_next_calendar_background_sync"?[f.link]:true,error:null};
  };
  equal(await runCalendarSyncWorker({...f.deps,now:()=>0}),{processed:10,failed:0}); equal(finishes,10);
  const jobs:Promise<unknown>[]=[]; let runs=0;
  const handler=createCalendarSyncWorkerHandler({authorize:async()=>({isInternal:true}),run:async()=>{runs++;},waitUntil:p=>jobs.push(p)});
  const response=await handler(new Request("https://worker.test",{method:"POST",body:'{"userId":"attacker","url":"https://evil.test"}'}));
  equal(response.status,202); await Promise.all(jobs); equal(runs,1);
});
Deno.test("worker HTTP entry requires internal secret, not a signed-in user's bearer token", async () => {
  const old=Deno.env.get("INTERNAL_FUNCTION_SECRET"); Deno.env.set("INTERNAL_FUNCTION_SECRET","worker-test-secret");
  try {
    let runs=0;
    const handler=createCalendarSyncWorkerHandler({authorize:req=>requireInternalRequest(req,{}),run:async()=>{runs++;},waitUntil:()=>{}});
    for(const headers of [{}, {Authorization:"Bearer user-token"}, {"x-internal-key":"wrong"}] as Record<string,string>[]) {
      const response=await handler(new Request("https://worker.test",{method:"POST",headers}));
      equal([401,403].includes(response.status),true);
    }
    equal((await handler(new Request("https://worker.test"))).status,405); equal(runs,0);
  } finally { if(old===undefined) Deno.env.delete("INTERNAL_FUNCTION_SECRET"); else Deno.env.set("INTERNAL_FUNCTION_SECRET",old); }
});
