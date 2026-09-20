import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), invoke: vi.fn(), rpc: vi.fn(), session: vi.fn(), nativeRead: vi.fn(), nativeWrite: vi.fn(), task: {} as Record<string,unknown> }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from, functions: { invoke: mocks.invoke }, rpc: mocks.rpc, auth: { getSession: mocks.session } } }));
vi.mock("@/plugins/NativeCalendarPlugin", () => ({ NativeCalendar: { getEvent: mocks.nativeRead, createOrUpdateEvent: mocks.nativeWrite } }));
import { syncImportedCalendarQuest } from "./calendarQuestSync";
import type { CalendarQuestImport } from "@/hooks/useCalendarQuestImports";
const baseline = { task_text: "Walk", task_date: "2026-09-19", scheduled_time: "10:00", estimated_duration: 30, notes: null, location: null };
const link: CalendarQuestImport = { id: "link-1", task_id: "task-1", connection_id: "conn-1", provider: "google", calendar_id: "calendar-1", external_id: "event-1", resource_kind: "event", timezone: "UTC", baseline, revision: 1, sync_enabled: true, sync_status: "linked", last_error: null };
const event = { id: "event-1", title: "Walk", startDate: "2026-09-19T10:00Z", endDate: "2026-09-19T10:30Z", isAllDay: false };
beforeEach(() => {
  vi.clearAllMocks(); mocks.task = { ...baseline, completed: false };
  const chain = { select: vi.fn(() => chain), eq: vi.fn(() => chain), maybeSingle: async () => ({ data: mocks.task, error: null }) };
  mocks.from.mockReturnValue(chain); mocks.rpc.mockImplementation(async (name) => ({ data: name === 'claim_calendar_quest_sync' ? 'lease-token' : true, error: null }));
  mocks.session.mockResolvedValue({ data: { session: { user: { id: 'user' } } }, error: null });
  mocks.invoke.mockResolvedValue({ data: { event, etag: '"version1"' }, error: null });
});
describe("linked quest synchronization", () => {
  it("does not write unchanged events and releases its claim", async () => {
    await syncImportedCalendarQuest(link,"user");
    expect(mocks.rpc).not.toHaveBeenCalledWith('apply_calendar_quest_sync', expect.anything());
    expect(mocks.rpc).toHaveBeenLastCalledWith('release_calendar_quest_sync', { p_link_id: link.id, p_token: 'lease-token' });
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
  });
  it("pulls remote changes with an optimistic local precondition", async () => {
    mocks.invoke.mockResolvedValue({ data: { event: { ...event, title: "Park" }, etag: "v1" }, error: null });
    await syncImportedCalendarQuest(link,"user");
    expect(mocks.rpc).toHaveBeenCalledWith("apply_calendar_quest_sync", expect.objectContaining({ p_expected: baseline, p_snapshot: { ...baseline, task_text: "Park" }, p_revision: 1 }));
  });
  it('advances the baseline when both sides already agree after a lost acknowledgment', async () => {
    mocks.task.task_text = 'Park';
    mocks.invoke.mockResolvedValue({ data: { event: { ...event, title: 'Park' }, etag: 'v2' }, error: null });
    await syncImportedCalendarQuest(link, 'user');
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith('apply_calendar_quest_sync', expect.objectContaining({ p_snapshot: { ...baseline, task_text: 'Park' }, p_status: 'linked' }));
  });
  it("pushes local changes using provider concurrency control", async () => {
    mocks.task.task_text = "Park"; await syncImportedCalendarQuest(link,"user");
    expect(mocks.invoke).toHaveBeenLastCalledWith("calendar-linked-event", { body: expect.objectContaining({ action: "update", etag: '"version1"', event: expect.objectContaining({ title: "Park" }) }) });
  });
  it("preserves quests when an outside event is deleted", async () => {
    mocks.invoke.mockResolvedValue({ data: { missing: true }, error: null }); await syncImportedCalendarQuest(link,"user");
    expect(mocks.rpc).toHaveBeenCalledWith("apply_calendar_quest_sync", expect.objectContaining({ p_status: "missing" }));
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
  });
  it("does not overwrite either side of a conflict", async () => {
    mocks.task.task_text = "Local"; mocks.invoke.mockResolvedValue({ data: { event: { ...event, title: "Remote" } }, error: null });
    await syncImportedCalendarQuest(link,"user"); expect(mocks.rpc).toHaveBeenCalledWith("apply_calendar_quest_sync", expect.objectContaining({ p_status: "conflict" })); expect(mocks.invoke).toHaveBeenCalledTimes(1);
  });
  it("retains retry status after provider failure", async () => {
    mocks.invoke.mockResolvedValue({ data: null, error: new Error("offline") }); await syncImportedCalendarQuest(link,"user");
    expect(mocks.rpc).toHaveBeenCalledWith("apply_calendar_quest_sync", expect.objectContaining({ p_status: "retry" }));
  });
  it("does not sync read-only imports", async () => { await syncImportedCalendarQuest({ ...link, sync_enabled: false },"user"); expect(mocks.invoke).not.toHaveBeenCalled(); });
  it("syncs task completion without changing quest XP", async () => {
    mocks.task.scheduled_time = null;
    mocks.invoke.mockResolvedValue({ data: { task: { title: "Walk", dueDate: baseline.task_date, completed: true, etag: "v1" } }, error: null });
    await syncImportedCalendarQuest({ ...link, resource_kind: "task", baseline: { ...baseline, scheduled_time: null, completed: false } },"user");
    expect(mocks.rpc).toHaveBeenCalledWith("apply_calendar_quest_sync", expect.objectContaining({ p_snapshot: expect.objectContaining({ completed: true }) }));
    expect(mocks.rpc.mock.calls.find(([name]) => name === 'apply_calendar_quest_sync')?.[1].p_snapshot).not.toHaveProperty("xp_reward");
  });
  it("does not touch a provider when another device owns the sync", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    await syncImportedCalendarQuest(link, 'user');
    expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it("does not touch a provider when the server cannot validate its claim", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error('offline') });
    await expect(syncImportedCalendarQuest(link, 'user')).rejects.toThrow('offline');
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it("passes its exact revision and claim to cloud writes", async () => {
    mocks.task.task_text = 'Updated'; await syncImportedCalendarQuest(link, 'user');
    expect(mocks.invoke).toHaveBeenLastCalledWith('calendar-linked-event', { body: expect.objectContaining({ action: 'update', revision: 1, syncToken: 'lease-token' }) });
  });
  it("rechecks pauses before writing an Apple event", async () => {
    mocks.task.task_text = 'Updated'; mocks.nativeRead.mockResolvedValue({ event });
    mocks.rpc.mockImplementation(async (name) => ({ data: name === 'claim_calendar_quest_sync' ? 'lease-token' : name !== 'calendar_quest_sync_is_current', error: null }));
    await syncImportedCalendarQuest({ ...link, provider: 'apple' }, 'user');
    expect(mocks.nativeWrite).not.toHaveBeenCalled();
  });
  it("does not write device events after switching accounts", async () => {
    mocks.task.task_text = 'Updated'; mocks.nativeRead.mockResolvedValue({ event });
    mocks.session.mockResolvedValue({ data: { session: { user: { id: 'another-user' } } }, error: null });
    await syncImportedCalendarQuest({ ...link, provider: 'apple' }, 'user');
    expect(mocks.nativeWrite).not.toHaveBeenCalled();
  });
});
