import { createLinkedEventHandler, eventPatch } from "./index.ts";
const equal = (a: unknown,b: unknown) => { if (JSON.stringify(a)!==JSON.stringify(b)) throw new Error(`Mismatch ${JSON.stringify(a)} / ${JSON.stringify(b)}`); };
Deno.test("event patch does not overwrite meetings, recurrence, attendees or notes", () => {
  const body = eventPatch("google", { title: "Walk", notes: "new notes", startDate: "2026-09-19T10:00Z", endDate: "2026-09-19T11:00Z", attendees: ["someone"] });
  equal(Object.keys(body).sort(), ["end","location","start","summary"]);
});
Deno.test("event patch validates time range and title", () => {
  for (const input of [{}, { title: "Walk", startDate: "invalid", endDate: "invalid" }, { title: "Walk", startDate: "2026-09-20", endDate: "2026-09-19" }]) {
    let failed = false; try { eventPatch("google", input); } catch { failed = true; } equal(failed,true);
  }
});
Deno.test("linked endpoint refuses requests without verified authentication", async () => {
  let fetches=0;
  const handler = createLinkedEventHandler({ env: () => "configured", fetch: (() => { fetches++; throw new Error("must not fetch"); }) as typeof fetch,
    createClient: (() => ({ auth: { getUser: () => ({ data: { user: null }, error: new Error("invalid") }) } })) as any });
  equal((await handler(new Request("https://app.test", { method: "POST", body: '{}' }))).status,401);
  equal((await handler(new Request("https://app.test", { method: "POST", headers: { Authorization: "Bearer invalid" }, body: '{}' }))).status,401);
  equal(fetches,0);
});
Deno.test("linked endpoint scopes connection and link ownership, and sends If-Match", async () => {
  const filters: any[]=[]; const requests: any[]=[];
  const connection = { id:"conn",provider:"google",user_id:"owner",access_token:"private-token",token_expires_at:"2099-01-01" };
  const syncToken = '11111111-1111-4111-8111-111111111111';
  const link = { id:"link",user_id:"owner",connection_id:"conn",provider:"google",calendar_id:"cal",external_id:"event",sync_enabled:true,
    revision: 1, sync_token: syncToken, sync_lease_until: '2099-01-01' };
  const client = { auth: { getUser: () => ({ data:{ user:{id:"owner"}},error:null }) }, from:(table:string) => {
    const chain = { select:()=>chain, eq:(key:string,value:unknown)=>{ filters.push([table,key,value]); return chain; }, maybeSingle:async()=>({data:table==="calendar_quest_imports"?link:connection,error:null}) }; return chain;
  } };
  const handler = createLinkedEventHandler({ createClient:(()=>client) as any,env:()=>"configured",fetch:(async(url:any,init:any)=>{
    requests.push([url,init]); return Response.json({id:"event",summary:"Walk",etag:'"v2"',start:{dateTime:"2026-09-19T10:00Z"},end:{dateTime:"2026-09-19T11:00Z"}});
  }) as typeof fetch });
  const response = await handler(new Request("https://app.test",{method:"POST",headers:{Authorization:"Bearer signed"},body:JSON.stringify({action:"update",linkId:"link",revision:1,syncToken,etag:'"v1"',userId:"attacker",event:{title:"Walk",startDate:"2026-09-19T10:00Z",endDate:"2026-09-19T11:00Z"}})}));
  equal(response.status,200); equal(filters.filter(([,key])=>key==="user_id").map(([, ,value])=>value),["owner","owner","owner","owner"]);
  equal(requests[0][1].headers["If-Match"],'"v1"'); equal((await response.text()).includes("private-token"),false);
});
