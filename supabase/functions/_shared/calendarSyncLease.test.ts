import { calendarSyncWriteAllowed, validCalendarEtag, validCalendarDate } from './calendarSyncLease.ts';
const assert = (value: unknown, message = 'Unexpected result') => { if (!value) throw new Error(message); };
const token = '11111111-1111-4111-8111-111111111111';
function fixture(overrides: Record<string, unknown> = {}, connected = true) {
  const filters: unknown[] = [];
  const link = { connection_id: 'connection', revision: 2, sync_enabled: true, sync_token: token, sync_lease_until: '2099-01-01', ...overrides };
  const db = { from: (table: string) => {
    const chain = { select: () => chain, eq: (field: string, value: unknown) => { filters.push([table, field, value]); return chain; },
      maybeSingle: async () => ({ data: table === 'calendar_quest_imports' ? link : connected ? { id: 'connection' } : null, error: null }) };
    return chain;
  } };
  return { db, filters };
}
Deno.test('provider writes require the current enabled unexpired owner-scoped claim', async () => {
  const { db, filters } = fixture();
  assert(await calendarSyncWriteAllowed(db, 'owner', 'link', 2, token));
  assert(JSON.stringify(filters).includes('["calendar_quest_imports","user_id","owner"]'));
  assert(JSON.stringify(filters).includes('["user_calendar_connections","user_id","owner"]'));
  assert(JSON.stringify(filters).includes('["user_calendar_connections","sync_enabled",true]'));
});
Deno.test('paused, expired, released, stale and disconnected attempts cannot write', async () => {
  for (const change of [{ sync_enabled: false }, { sync_token: null }, { sync_lease_until: '2000-01-01' }, { sync_lease_until: null }, { revision: 3 }]) {
    assert(!await calendarSyncWriteAllowed(fixture(change).db, 'owner', 'link', 2, token));
  }
  assert(!await calendarSyncWriteAllowed(fixture({}, false).db, 'owner', 'link', 2, token));
  assert(!await calendarSyncWriteAllowed(fixture().db, 'owner', 'link', 2, 'wrong-token'));
  assert(!await calendarSyncWriteAllowed(fixture().db, 'owner', 'link', '2', token));
});
Deno.test('ETags cannot bypass concurrency checks with a wildcard or inject headers', () => {
  for (const bad of [undefined, null, '', ' ', '*', ' * ', 'value\r\nOther: header', 'a'.repeat(2049)]) assert(!validCalendarEtag(bad));
  assert(validCalendarEtag('"version1"')); assert(validCalendarEtag('W/"version2"'));
});
Deno.test('task due dates must be actual calendar dates', () => {
  for (const bad of [undefined, '2026-02-30', '2026-13-01', '2026-09-19T00:00Z', '2026-2-1']) assert(!validCalendarDate(bad));
  assert(validCalendarDate('2028-02-29')); assert(validCalendarDate('2026-09-19'));
});
