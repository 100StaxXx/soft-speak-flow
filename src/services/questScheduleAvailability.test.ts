import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadQuestScheduleAvailability, type ScheduleAvailabilityOptions } from "./questScheduleAvailability";
import { scheduleReadMessage } from './scheduleReadMessage';
import type { ScheduleQuest } from "@/utils/questScheduleConflicts";
const mocks = vi.hoisted(() => ({ remote: vi.fn(), local: vi.fn(), readiness: vi.fn(), epoch: vi.fn(), calendar: vi.fn(), commitments: vi.fn(), eq: vi.fn(), lte: vi.fn() }));
vi.mock("./materializeQuests", () => ({ materializeQuests: mocks.commitments }));
vi.mock("@/utils/plannerLocalStore", () => ({ getAllLocalTasksForUser: mocks.local }));
vi.mock("./scheduleReadiness", () => ({ scheduleReadiness: mocks.readiness }));
vi.mock("@/utils/plannerSync", () => ({ getPlannerRemoteSyncEpoch: mocks.epoch }));
vi.mock("@/hooks/useExternalCalendarEvents", () => ({ loadConnectionEvents: mocks.calendar }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => {
  const query = { select: () => query, eq: (...args: unknown[]) => { mocks.eq(...args); return query; },
    lte: (...args: unknown[]) => { mocks.lte(...args); return query; }, or: () => query, order: () => query, range: mocks.remote };
  return query;
} } }));
const draft = { id: "new", task_text: "Read", task_date: "2026-10-05", scheduled_time: "09:00" };
const options: ScheduleAvailabilityOptions = { userId: "account", connections: [], timezone: "UTC", cachedTasks: [], cachedEvents: [], excludedEventKeys: new Set() };
beforeEach(() => {
  vi.clearAllMocks(); mocks.commitments.mockResolvedValue(null); mocks.local.mockResolvedValue([]); mocks.remote.mockResolvedValue({ data: [], error: null });
  mocks.readiness.mockResolvedValue(null); mocks.epoch.mockReset().mockReturnValue(0); mocks.calendar.mockResolvedValue([]);
});
describe("availability reads", () => {
  it("does not declare availability when calendar connections are unresolved", async () => {
    expect((await loadQuestScheduleAvailability(draft, { ...options, calendarsLoading: true })).incomplete).toBe(true);
  });
  it("scopes reads to the signed-in account and includes tomorrow for overnight quests", async () => {
    expect((await loadQuestScheduleAvailability(draft, options)).incomplete).toBe(false);
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "account");
    expect(mocks.lte).toHaveBeenCalledWith("task_date", "2026-10-06");
  });
  it("paginates rather than claiming free time after the first result page", async () => {
    mocks.remote.mockResolvedValueOnce({ data: Array.from({ length: 500 }, (_, id) => ({ ...draft, id: String(id) })), error: null })
      .mockResolvedValueOnce({ data: [{ ...draft, id: "last" }], error: null });
    expect((await loadQuestScheduleAvailability(draft, options)).tasks).toHaveLength(501);
    expect(mocks.remote).toHaveBeenLastCalledWith(500, 999);
  });
  it("uses local edits and reports incomplete availability when offline", async () => {
    mocks.readiness.mockResolvedValue('local-sync'); mocks.local.mockResolvedValue([{ ...draft, id: "local" }]);
    const result = await loadQuestScheduleAvailability(draft, options);
    expect(result.tasks[0].id).toBe("local"); expect(result.incomplete).toBe(true); expect(mocks.remote).not.toHaveBeenCalled();
  });
  it("does not treat a failed provider as an empty calendar", async () => {
    mocks.calendar.mockRejectedValue(new Error("Offline"));
    const result = await loadQuestScheduleAvailability(draft, { ...options, connections: [{ id: "connection", provider: "outlook", primary_calendar_id: "work" } as never] });
    expect(result.incomplete).toBe(true);
  });
  it("checks every visible calendar, respecting hidden calendars", async () => {
    await loadQuestScheduleAvailability(draft, { ...options, connections: [{ id: "connection", provider: "outlook", primary_calendar_id: "work" } as never],
      visibleCalendars: { outlook: ["work", "personal", "work"] } });
    expect(mocks.calendar).toHaveBeenCalledTimes(2);
    expect(mocks.calendar.mock.calls.map(call => call[0].primary_calendar_id)).toEqual(["work", "personal"]);
  });
  it("does not accept a remote snapshot across a local mutation", async () => {
    let epoch = 0; mocks.epoch.mockImplementation(() => epoch++);
    const local: ScheduleQuest = { ...draft, id: "local" }; mocks.local.mockResolvedValue([local]);
    const result = await loadQuestScheduleAvailability(draft, options);
    expect(result.incomplete).toBe(true); expect(result.tasks).toContainEqual(local);
  });
});

it('keeps unavailable commitment storage from being treated as free time', async () => {
  mocks.commitments.mockRejectedValue(new Error('Offline'));
  expect((await loadQuestScheduleAvailability(draft, options)).incomplete).toBe(true);
});
it('includes fixed recurring occurrences as ordinary quests', async () => {
  const work = { ...draft, id: 'work', task_text: 'Work', flexibility: 'fixed' };
  mocks.remote.mockResolvedValue({ data: [work], error: null });
  const result = await loadQuestScheduleAvailability(draft, options);
  expect(result.tasks).toEqual([work]);
  expect(result.commitments ?? []).toEqual([]);
});


it('identifies a local-sync issue without telling an unconnected user to reconnect a calendar', async () => {
  mocks.readiness.mockResolvedValue('local-sync');
  expect((await loadQuestScheduleAvailability(draft, options)).issues).toEqual(['local-sync']);
});
it.each([
  ['Calendar access not granted', 'Full Access'],
  ['Calendar not found', 'could not be found on this device'],
  ['Choose an Apple calendar in Preferences before syncing Agenda.', 'Choose an Apple calendar'],
  ['Apple Calendar is unavailable in this app build.', 'can’t read Apple Calendar here'],
  ['Schedule check timed out', 'too long to respond'],
  ['Invalid calendar event range', 'requested dates'],
  ['unrecognized private details', 'COSMIQ couldn’t read Apple Calendar. Try again.'],
])('explains the Apple calendar failure %s', async (reason, expected) => {
  mocks.calendar.mockRejectedValue(new Error(reason));
  const result = await loadQuestScheduleAvailability(draft, { ...options, connections: [{ id: 'apple', provider: 'apple', primary_calendar_id: 'primary' } as never] });
  expect(result.incomplete).toBe(true);
  const message = scheduleReadMessage(result.issues);
  expect(message).toContain(expected);
  if (reason !== 'Calendar access not granted') expect(message).not.toContain('iPhone Settings');
  expect(message).not.toContain('private details');
});
it('distinguishes unavailable fixed commitments from a calendar failure', async () => {
  mocks.commitments.mockRejectedValue(new Error('Offline'));
  expect((await loadQuestScheduleAvailability(draft, options)).issues).toEqual(['tasks']);
});

it('retries a brief write lock without reporting unsynced changes', async () => {
  mocks.readiness.mockResolvedValueOnce('schedule-updating');
  const result = await loadQuestScheduleAvailability(draft, options);
  expect(result.incomplete).toBe(false); expect(result.issues).toEqual([]);
});
it('re-reads after a concurrent change and uses only the stable remote result', async () => {
  mocks.epoch.mockReturnValueOnce(0).mockReturnValue(1);
  mocks.remote.mockResolvedValueOnce({ data: [{ ...draft, id: 'stale' }], error: null });
  const result = await loadQuestScheduleAvailability(draft, options);
  expect(result.incomplete).toBe(false); expect(result.tasks).toEqual([]);
  expect(mocks.remote).toHaveBeenCalledTimes(2);
});
it('keeps a persistent update incomplete instead of claiming free time', async () => {
  mocks.readiness.mockResolvedValue('schedule-updating');
  const result = await loadQuestScheduleAvailability(draft, options);
  expect(result.issues).toEqual(['schedule-updating']); expect(result.incomplete).toBe(true);
});

it('ends a stalled local schedule read instead of holding Add forever', async()=>{
 vi.useFakeTimers();
 try {
  mocks.local.mockReturnValueOnce(new Promise(()=>{}));
  const read=loadQuestScheduleAvailability(draft,options);
  await vi.advanceTimersByTimeAsync(20_001);
  expect(await read).toMatchObject({incomplete:true,issues:['timeout']});
 }finally{vi.useRealTimers();}
});

it('reads the full reviewed campaign range, not just the first task date',async()=>{
 await loadQuestScheduleAvailability(draft,options,{startDate:'2026-10-04',throughDate:'2027-01-04'});
 expect(mocks.lte).toHaveBeenCalledWith('task_date','2027-01-05');
});
