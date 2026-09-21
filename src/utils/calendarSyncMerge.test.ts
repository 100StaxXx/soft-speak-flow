import { describe, it, expect } from "vitest";
import { calendarQuestSnapshot, mergeCalendarQuest } from "./calendarSyncMerge";
const base = calendarQuestSnapshot({ task_text: "Walk", task_date: "2026-09-19", scheduled_time: "10:00", estimated_duration: 30 });
describe("safe calendar merge", () => {
  it("leaves identical snapshots alone", () => expect(mergeCalendarQuest(base, base, base)).toMatchObject({ push: false, pull: false, conflicts: [] }));
  it("pulls remote edits", () => expect(mergeCalendarQuest(base, base, { ...base, task_text: "Long walk" })).toMatchObject({ pull: true, push: false }));
  it("pushes local edits", () => expect(mergeCalendarQuest(base, { ...base, notes: "Bring water" }, base)).toMatchObject({ pull: false, push: true }));
  it("merges independent fields", () => expect(mergeCalendarQuest(base, { ...base, notes: "Water" }, { ...base, task_text: "Park" })).toMatchObject({ pull: true, push: true, conflicts: [] }));
  it("blocks conflicting titles", () => expect(mergeCalendarQuest(base, { ...base, task_text: "A" }, { ...base, task_text: "B" }).conflicts).toContain("task_text"));
  it("does not combine incompatible date/time changes", () => expect(mergeCalendarQuest(base, { ...base, task_date: "2026-09-20" }, { ...base, scheduled_time: "11:00" }).conflicts).toContain("scheduled_time"));
  it("never synchronizes completion from calendar events", () => expect(mergeCalendarQuest(base, { ...base, completed: true }, { ...base, completed: false })).toMatchObject({ push: false, pull: false }));
  it("synchronizes task completion only when explicitly enabled", () => expect(mergeCalendarQuest({ ...base, completed: false }, { ...base, completed: false }, { ...base, completed: true }, true)).toMatchObject({ pull: true }));
  it("never carries XP from a provider", () => expect(calendarQuestSnapshot({ ...base, xp_reward: 500 } as never)).not.toHaveProperty("xp_reward"));
});
