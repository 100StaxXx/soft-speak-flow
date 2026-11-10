import { createCalendarReadHandler, normalizeEvent, parseRange } from "./index.ts";

function equal(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
const makeHarness = (options: { expired?: boolean; unauthorized?: boolean; provider?: string } = {}) => {
  const filters: Array<[string, unknown]> = [];
  const updates: Record<string, unknown>[] = [];
  const tables: string[] = [];
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const connection = { id: "connection-1", user_id: "owner", access_token: "old-access", refresh_token: "old-refresh",
    token_expires_at: options.expired ? "2020-01-01" : "2099-01-01", primary_calendar_id: "calendar-1", calendar_id: null,
    primary_calendar_name: "My calendar" };
  let responseQueue: Response[] = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: options.unauthorized ? null : { id: "owner" } }, error: null }) },
    from: (table: string) => {
      tables.push(table);
      const chain = {
        select: () => chain,
        eq: (key: string, value: unknown) => { filters.push([key, value]); return chain; },
        maybeSingle: async () => ({ data: connection, error: null }),
        update: (values: Record<string, unknown>) => { updates.push(values); return chain; },
        then: (resolve: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
      };
      return chain;
    },
  };
  const handler = createCalendarReadHandler({
    createClient: (() => client) as any,
    env: () => "configured",
    fetch: ((url: string, init?: RequestInit) => {
      requests.push({ url, init });
      return Promise.resolve(responseQueue.shift() ?? Response.json({ items: [], value: [] }));
    }) as typeof fetch,
  });
  return { filters, updates, tables, requests,
    responses: (...responses: unknown[]) => { responseQueue = responses.map((data) => Response.json(data)); },
    run: (body = {}, auth = true) => handler(new Request("https://example.test/calendar-read-events", {
      method: "POST", headers: auth ? { Authorization: "Bearer signed-user-token" } : {},
      body: JSON.stringify({ provider: options.provider ?? "google", action: "listEvents", startDate: "2026-09-01", endDate: "2026-10-01", ...body }),
    })),
  };
};

Deno.test("calendar read rejects missing and invalid authentication before accessing connections", async () => {
  const h = makeHarness(); equal((await h.run({}, false)).status, 401); equal(h.tables, []);
  const denied = makeHarness({ unauthorized: true }); equal((await denied.run()).status, 401); equal(denied.tables, []);
});
Deno.test("calendar read enforces connection ownership and cannot delete or sync quests", async () => {
  const h = makeHarness(); equal((await h.run({ userId: "someone-else" })).status, 200);
  equal(h.filters.includes(["user_id", "someone-else"]), false);
  equal(h.filters.some(([key, value]) => key === "user_id" && value === "owner"), true);
  equal(h.tables, ["user_calendar_connections"]); equal(h.updates, []);
  for (const action of ["deleteLinkedEvent", "syncPlannerWindow", "sync", "createLinkedEvent"]) {
    equal((await h.run({ action })).status, 400);
  }
});
Deno.test("calendar read validates range and selected calendar", async () => {
  const h = makeHarness(); equal((await h.run({ endDate: "2027-01-01" })).status, 400);
  equal((await h.run({ calendarId: "another-calendar" })).status, 409); equal(h.requests.length, 0);
  let threw = false; try { parseRange({ startDate: "invalid", endDate: "invalid" }); } catch { threw = true; }
  equal(threw, true);
});
Deno.test("calendar read handles Google pagination and filters cancelled events", async () => {
  const h = makeHarness();
  const event = { id: "event", summary: "Meeting", start: { dateTime: "2026-09-01T12:00:00Z" }, end: { dateTime: "2026-09-01T13:00:00Z" } };
  h.responses({ items: [event], nextPageToken: "next" }, { items: [{ ...event, id: "cancelled", status: "cancelled" }] });
  const response = await h.run(); equal(response.status, 200);
  equal((await response.json()).events.length, 1); equal(h.requests.length, 2);
  equal(new URL(h.requests[1].url).searchParams.get("pageToken"), "next");
});
Deno.test("calendar read saves rotated Outlook refresh tokens and never exposes them", async () => {
  const h = makeHarness({ expired: true, provider: "outlook" });
  h.responses({ access_token: "new-access", refresh_token: "new-refresh", expires_in: 3600 }, { value: [] });
  const response = await h.run(); equal(response.status, 200);
  equal(h.updates[0].refresh_token, "new-refresh");
  equal(h.tables.every((table) => table === "user_calendar_connections"), true);
  const body = await response.text(); equal(body.includes("new-access") || body.includes("new-refresh"), false);
});
Deno.test("calendar read preserves refresh token when provider omits a replacement", async () => {
  const h = makeHarness({ expired: true }); h.responses({ access_token: "new-access", expires_in: 3600 }, { items: [] });
  equal((await h.run()).status, 200); equal(h.updates[0].refresh_token, "old-refresh");
});
Deno.test("calendar read never sends bearer credentials to an unexpected pagination host", async () => {
  const h = makeHarness({ provider: "outlook" }); h.responses({ value: [], "@odata.nextLink": "https://attacker.test/events" });
  equal((await h.run()).status, 502); equal(h.requests.length, 1);
});
Deno.test("Outlook dates use UTC and all-day dates remain date-only", () => {
  const event = { id: "outlook-1", subject: "Focus", start: { dateTime: "2026-09-01T12:00:00" }, end: { dateTime: "2026-09-01T13:00:00" } };
  equal(normalizeEvent("outlook", event, "cal", "Calendar")?.startDate, "2026-09-01T12:00:00Z");
  equal(normalizeEvent("outlook", { ...event, isAllDay: true, end: { dateTime: "2026-09-02T00:00:00" } }, "cal", "Calendar")?.startDate, "2026-09-01");
});
