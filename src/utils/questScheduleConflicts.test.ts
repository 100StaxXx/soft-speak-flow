import { describe, expect, it } from "vitest";
import { analyzeQuestSchedule, buildVisibleQuestConflictMap, linkedScheduleExclusions, type ScheduleQuest, type QuestScheduleDraft } from "./questScheduleConflicts";
import { normalizeExternalCalendarEvent, externalCalendarEventKey } from "@/types/externalCalendar";

const quest = (patch: Partial<ScheduleQuest> = {}): ScheduleQuest => ({ id: "existing", task_text: "Workout",
  task_date: "2026-10-05", scheduled_time: "09:00", estimated_duration: 60, ...patch });
const draft = (patch: Partial<QuestScheduleDraft> = {}): QuestScheduleDraft => ({ ...quest(), id: "new", task_text: "Read", ...patch });
const event = (patch = {}) => normalizeExternalCalendarEvent({ id: "meeting", title: "Team meeting",
  startDate: "2026-10-05T09:00:00Z", endDate: "2026-10-05T10:00:00Z", availability: "busy", ...patch }, "outlook", "Work")!;
const check = (input = draft(), tasks = [quest()], events = [] as ReturnType<typeof event>[]) => analyzeQuestSchedule(input, tasks, events, "UTC");

describe("shared quest schedule review", () => {
  it("keeps out-of-sync calendar copies occupied instead of assuming they match their quest", () => {
    const meeting = event(); const links = [{ taskId: "existing", eventKey: externalCalendarEventKey(meeting) }];
    expect(linkedScheduleExclusions(draft(), [quest()], [meeting], links, "UTC").size).toBe(1);
    expect(linkedScheduleExclusions(draft(), [quest({ scheduled_time: "12:00" })], [meeting], links, "UTC").size).toBe(0);
    expect(linkedScheduleExclusions(draft(), [], [meeting], links, "UTC").size).toBe(0);
    expect(linkedScheduleExclusions(draft({ id: "existing" }), [], [meeting], links, "UTC").size).toBe(1);
  });
  it("reports the overlap duration and a later opening without changing the date", () => {
    const result = check(draft({ scheduled_time: "09:40", estimated_duration: 30 }));
    expect(result.conflicts[0]).toMatchObject({ title: "Workout", overlapMinutes: 20 });
    expect(result.nextTime).toBe("10:00");
    expect(result.throughDate).toBe("2026-10-05");
  });
  it("allows touching edges but detects containment", () => {
    expect(check(draft({ scheduled_time: "10:00" })).conflicts).toEqual([]);
    expect(check(draft({ scheduled_time: "09:10", estimated_duration: 10 })).conflicts[0].overlapMinutes).toBe(10);
  });
  it("ignores itself, completed, untimed and inbox quests", () => {
    expect(check(draft(), [quest({ id: "new" }), quest({ id: "done", completed: true }),
      quest({ id: "untimed", scheduled_time: null }), quest({ id: "inbox", task_date: null })]).conflicts).toEqual([]);
  });
  it("deduplicates the same quest loaded in day and month views", () => {
    expect(check(draft(), [quest(), quest()]).conflicts).toHaveLength(1);
  });
  it("checks connected events and ignores Free events", () => {
    expect(check(draft(), [], [event()]).conflicts[0]).toMatchObject({ source: "calendar", title: "Team meeting" });
    expect(check(draft(), [], [event({ availability: "free" })]).conflicts).toEqual([]);
  });
  it("does not count the linked calendar copy of a quest twice", () => {
    const meeting = event();
    expect(analyzeQuestSchedule(draft(), [quest()], [meeting], "UTC", new Set([externalCalendarEventKey(meeting)])).conflicts).toHaveLength(1);
  });
  it("blocks Busy all-day events but not Free all-day reminders", () => {
    const allDay = event({ isAllDay: true, startDate: "2026-10-05", endDate: "2026-10-06" });
    expect(check(draft(), [], [allDay]).nextTime).toBeNull();
    expect(check(draft(), [], [{ ...allDay, availability: "free" }]).conflicts).toEqual([]);
  });
  it("finds overnight conflicts from the prior day", () => {
    expect(check(draft({ scheduled_time: "00:15" }), [quest({ task_date: "2026-10-04", scheduled_time: "23:30", estimated_duration: 90 })]).conflicts).toHaveLength(1);
  });
  it("finds overnight conflicts against the following day, including templates", () => {
    const input = draft({ scheduled_time: "23:30", estimated_duration: 90 });
    expect(check(input, [quest({ task_date: "2026-10-06", scheduled_time: "00:15" })]).conflicts).toHaveLength(1);
    expect(check(input, [quest({ task_date: "2026-10-01", scheduled_time: "00:15", is_recurring: true, recurrence_pattern: "daily" })]).conflicts).toHaveLength(1);
  });
  it("checks future repeats and suggests one time that fits every checked occurrence", () => {
    const result = check(draft({ recurrence_pattern: "daily" }), [quest({ task_date: "2026-10-08", scheduled_time: "09:30" })]);
    expect(result.recurring).toBe(true);
    expect(result.throughDate).toBe("2026-11-03");
    expect(result.conflicts[0].date).toBe("2026-10-08");
    expect(result.nextTime).toBe("10:30");
  });
  it("uses the spawner's Monday-first weekly rule and month-end clamping", () => {
    const weekly = draft({ recurrence_pattern: "weekly", recurrence_days: [0] });
    expect(check(weekly, [quest({ task_date: "2026-10-06" })]).conflicts).toEqual([]);
    expect(check(weekly, [quest({ task_date: "2026-10-12" })]).conflicts).toHaveLength(1);
    const month = draft({ task_date: "2026-01-31", recurrence_pattern: "monthly", recurrence_month_days: [31] });
    expect(check(month, [quest({ task_date: "2026-02-28" })]).conflicts).toHaveLength(1);
  });
  it("respects a repeat end date", () => {
    expect(check(draft({ recurrence_pattern: "daily", recurrence_end_date: "2026-10-06" }), [quest({ task_date: "2026-10-08" })]).conflicts).toEqual([]);
  });
  it("projects existing recurring quests and honors modified/completed instances", () => {
    const template = quest({ task_date: "2026-10-01", is_recurring: true, recurrence_pattern: "daily", completed: true });
    expect(check(draft(), [template]).conflicts).toHaveLength(1);
    expect(check(draft(), [template, quest({ id: "instance", parent_template_id: template.id, completed: true })]).conflicts).toEqual([]);
    expect(check(draft(), [template, quest({ id: "instance", parent_template_id: template.id, scheduled_time: "12:00" })]).conflicts).toEqual([]);
  });
  it("excludes edited series' own instances, without excluding unrelated quests", () => {
    const input = draft({ recurrence_pattern: "daily" });
    expect(check(input, [quest({ parent_template_id: "new" }), quest({ id: "other" })]).conflicts).toHaveLength(1);
  });
  it("does not apply a repeat rule when moving only one occurrence", () => {
    expect(check(draft({ recurrence_pattern: "daily", checkRecurrence: false }), [quest({ task_date: "2026-10-06" })]).conflicts).toEqual([]);
  });
  it("does not invent an opening tomorrow when today's remaining time is full", () => {
    expect(check(draft({ scheduled_time: "23:30" }), [quest({ scheduled_time: "23:00", estimated_duration: 60 })]).nextTime).toBeNull();
  });
  it("checks provider instants in the user's timezone", () => {
    expect(analyzeQuestSchedule(draft(), [], [event({ startDate: "2026-10-05T16:00Z", endDate: "2026-10-05T17:00Z" })], "America/Los_Angeles").conflicts).toHaveLength(1);
  });
  it("rejects nonexistent daylight-saving times", () => {
    expect(analyzeQuestSchedule(draft({ task_date: "2026-03-08", scheduled_time: "02:30" }), [], [], "America/Los_Angeles").invalidTime).toBe(true);
  });
  it("gives badges the same completed/free/overnight rules", () => {
    const map = buildVisibleQuestConflictMap([quest(), quest({ id: "done", completed: true }),
      quest({ id: "night", task_date: "2026-10-04", scheduled_time: "23:30", estimated_duration: 630 })],
    [event(), event({ id: "free", availability: "free" })], "2026-10-05", "UTC");
    expect(map.get("existing")?.size).toBe(2);
    expect(map.has("done")).toBe(false);
  });
});

it('does not invent deleted occurrences of a migrated recurring quest',()=>{
 const template=quest({task_date:'2026-10-01',scheduled_time:'09:00',schedule_timezone:'UTC',schedule_end_time:'10:00',is_recurring:true,recurrence_pattern:'daily',flexibility:'fixed'});
 expect(check(draft(),[template]).conflicts).toEqual([]);
 expect(check(draft(),[template,quest({id:'occurrence',parent_template_id:template.id,completed:true,flexibility:'fixed',schedule_timezone:'UTC',schedule_end_time:'10:00'})]).conflicts).toHaveLength(1);
});

it("does not project a phantom repeat from a moved first session", () => {
  const root = quest({task_date:"2026-10-06", session_series_anchor:"2026-10-05", is_recurring:true, recurrence_pattern:"weekly"});
  expect(check(draft({task_date:"2026-10-13"}), [root]).conflicts).toEqual([]);
  expect(check(draft({task_date:"2026-10-06"}), [root]).conflicts).toHaveLength(1);
});
