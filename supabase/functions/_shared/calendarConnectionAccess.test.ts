import { calendarAccessToken } from "./calendarConnectionAccess.ts";
const equal = (a: unknown,b: unknown) => { if(JSON.stringify(a)!==JSON.stringify(b)) throw new Error("Unexpected credential result"); };
function harness() {
  const conn: any = {id:"connection",user_id:"owner",provider:"outlook",access_token:"old-access",
    refresh_token:"old-refresh",token_expires_at:"2000-01-01",updated_at:"2026-09-19T00:00:00Z",sync_enabled:true};
  let actual={...conn}; let tokenResponse: any={access_token:"new-access",refresh_token:"new-refresh",expires_in:3600};
  let beforeResponse=()=>{}; let fetches=0; let updates=0; let failSave=false;
  const filters: Array<[string,unknown]>=[];
  const db={from:()=>{let patch: any; const chain={
    update:(value: any)=>{patch=value;return chain;},select:()=>chain,
    eq:(key:string,value:unknown)=>{filters.push([key,value]);return chain;},
    is:(key:string,value:unknown)=>{filters.push([key,value]);return chain;},
    maybeSingle:async()=>{if(failSave) return{error:new Error("database unavailable"),data:null};
      if(filters.some(([key,value])=>actual[key]!==value)) return{data:null,error:null};
      actual={...actual,...patch};updates++;return{data:{id:actual.id},error:null};}
  };return chain;}};
  const fetcher=(async()=>{fetches++;beforeResponse();return Response.json(tokenResponse);}) as typeof fetch;
  return {conn,run:()=>calendarAccessToken(db,conn,()=>"configured",fetcher),actual:()=>actual,fetches:()=>fetches,updates:()=>updates,
    race:(patch: any)=>{beforeResponse=()=>{actual={...actual,...patch};};},
    tokens:(value:unknown)=>{tokenResponse=value;},failSave:()=>{failSave=true;},filters};
}
async function rejects(work:()=>Promise<unknown>) { let failed=false;try{await work();}catch{failed=true;}equal(failed,true); }
Deno.test("valid calendar credentials are reused without a refresh or write",async()=>{
  const h=harness();h.conn.token_expires_at="2099-01-01";equal(await h.run(),"old-access");equal(h.fetches(),0);equal(h.updates(),0);
});
Deno.test("rotation saves tokens only to the exact active owner connection",async()=>{
  const h=harness();equal(await h.run(),"new-access");equal(h.actual().refresh_token,"new-refresh");equal(h.updates(),1);
  equal(h.filters,[["id","connection"],["user_id","owner"],["provider","outlook"],["sync_enabled",true],["refresh_token","old-refresh"],["access_token","old-access"],["updated_at","2026-09-19T00:00:00Z"]]);
});
Deno.test("refresh cannot clobber a newer refresh, reconnect, pause or disconnect",async()=>{
  for(const patch of [{access_token:"other-access",refresh_token:"other-refresh"},{updated_at:"2099-01-01"},{sync_enabled:false},{id:"removed"}]) {
    const h=harness();h.race(patch);await rejects(h.run);equal(h.updates(),0);
    for(const [key,value] of Object.entries(patch)) equal(h.actual()[key],value);
  }
});
Deno.test("omitted replacement refresh token preserves the existing one",async()=>{
  const h=harness();h.tokens({access_token:"new-access",expires_in:3600});await h.run();equal(h.actual().refresh_token,"old-refresh");
});
Deno.test("invalid token responses and failed persistence never authorize provider work",async()=>{
  for(const tokens of [{access_token:""},{access_token:"new",expires_in:-1},{access_token:"new",expires_in:"invalid"},{access_token:"new",refresh_token:23}]) {
    const h=harness();h.tokens(tokens);await rejects(h.run);equal(h.updates(),0);
  }
  const h=harness();h.failSave();await rejects(h.run);equal(h.updates(),0);
});
