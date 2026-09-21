import { normalizeProviderTask, createCalendarTaskHandler } from "./index.ts";
const equal = (a: unknown,b: unknown) => { if(JSON.stringify(a)!==JSON.stringify(b)) throw new Error("Unexpected task response"); };
Deno.test("Google task dates remain date-only and completion is preserved",()=>{
  equal(normalizeProviderTask("google",{id:"a",title:"Walk",due:"2026-09-19T00:00:00Z",status:"completed"},"list")?.dueDate,"2026-09-19");
  equal(normalizeProviderTask("google",{id:"a",status:"completed"},"list")?.completed,true);
  equal(normalizeProviderTask("google",{id:"a",deleted:true},"list"),null);
});
Deno.test("Outlook HTML bodies are not injected into imported task notes",()=>{
  equal(normalizeProviderTask("outlook",{id:"a",body:{contentType:"html",content:"<script>bad</script>"}},"list")?.notes,null);
});
Deno.test("task service cannot access provider data before authenticating",async()=>{
  const handler=createCalendarTaskHandler({createClient:(()=>{throw new Error("unauthenticated database access");}) as any,fetch,env:()=>"configured"});
  equal((await handler(new Request("https://app.test",{method:"POST",body:JSON.stringify({action:"tasks",provider:"google"})}))).status,401);
});

function harness(provider = 'google') {
  const syncToken = '11111111-1111-4111-8111-111111111111';
  const link = { id: 'link', provider, connection_id: 'connection', calendar_id: 'list/a', external_id: 'task/b',
    sync_enabled: true, revision: 1, sync_token: syncToken, sync_lease_until: '2099-01-01' };
  const connection = { id: 'connection', user_id: 'owner', provider, access_token: 'secret-access', refresh_token: 'secret-refresh', token_expires_at: '2099-01-01' };
  const filters: unknown[][] = []; const requests: Array<{ url: string; init?: RequestInit }> = [];
  let responses: Response[] = []; let duringRefresh: (() => void) | undefined;
  const db = { auth: { getUser: async () => ({ data: { user: { id: 'owner' } }, error: null }) }, from: (table: string) => {
    const chain = { select: () => chain, update: () => chain,
      eq: (field: string, value: unknown) => { filters.push([table,field,value]); return chain; },
      maybeSingle: async () => ({ data: table === 'calendar_quest_imports' ? link : connection, error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve) };
    return chain;
  } };
  const handler = createCalendarTaskHandler({ createClient: (() => db) as any, env: () => 'configured', fetch: (async (url, init) => {
    requests.push({ url: String(url), init });
    if (String(url).includes('/token')) { duringRefresh?.(); return Response.json({ access_token: 'refreshed-access', expires_in: 3600 }); }
    return responses.shift() ?? Response.json({ id: 'task/b', title: 'Walk', status: 'completed', etag: '"new"' });
  }) as typeof fetch });
  return { link, connection, requests, filters, queue: (...values: Response[]) => { responses = values; },
    onRefresh: (callback: () => void) => { duringRefresh = callback; },
    run: (body = {}) => handler(new Request('https://app.test', { method: 'POST', headers: { Authorization: 'Bearer signed-user' },
      body: JSON.stringify({ action: 'update', linkId: 'link', revision: 1, syncToken, etag: '"old"',
        task: { title: 'Walk', completed: true, dueDate: '2026-09-19' }, ...body }) })) };
}

for (const provider of ['google','outlook']) {
  Deno.test(`${provider} task updates are owner-scoped, conditional and preserve unrelated fields`, async () => {
    const h = harness(provider); const response = await h.run();
    equal(response.status,200); equal(h.requests.length,1);
    const request = h.requests[0]; equal(request.init?.method,'PATCH');
    equal((request.init?.headers as Record<string,string>)['If-Match'],'"old"');
    equal(request.url.includes('/lists/list%2Fa/tasks/task%2Fb'),true);
    const fields = Object.keys(JSON.parse(String(request.init?.body))).sort();
    equal(fields,[provider === 'google' ? 'due' : 'dueDateTime','status','title']);
    equal(h.filters.filter(([,field])=>field==='user_id').every(([, ,value])=>value==='owner'),true);
    equal((await response.text()).includes('secret-access'),false);
  });
}
Deno.test('stale task sync claims and invalid dates never reach provider writes', async () => {
  for (const body of [{ syncToken: 'invalid' }, { revision: 0 }, { etag: '*' }, { task: { title: 'Walk', completed: false, dueDate: '2026-02-30' } }]) {
    const h = harness(); const response = await h.run(body);
    equal(response.status >= 400,true); equal(h.requests.length,0);
  }
});
Deno.test('a pause during credential refresh cancels the pending task write', async () => {
  const h = harness(); h.connection.token_expires_at = '2000-01-01';
  h.onRefresh(() => { h.link.sync_enabled = false; });
  equal((await h.run()).status,409); equal(h.requests.length,1); equal(h.requests[0].url.includes('/token'),true);
});
Deno.test('missing and concurrently edited outside tasks are not recreated', async () => {
  const missing = harness(); missing.queue(new Response('',{ status:404 }));
  equal(await (await missing.run()).json(),{missing:true}); equal(missing.requests.length,1);
  const conflict = harness(); conflict.queue(new Response('',{status:412}));
  equal((await conflict.run()).status,409); equal(conflict.requests.length,1);
});
Deno.test('Microsoft task pagination never sends credentials to an outside host', async () => {
  const h = harness('outlook'); h.queue(Response.json({ value: [], '@odata.nextLink': 'https://outside.test/tasks' }));
  equal((await h.run({ action: 'lists', provider: 'outlook' })).status,502);
  equal(h.requests.length,1);
});
