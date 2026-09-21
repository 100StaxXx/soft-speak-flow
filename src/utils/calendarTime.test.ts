import { describe, it, expect } from "vitest";
import { calendarLocalParts, calendarZonedDate } from "./calendarTime";
describe("calendar timezone consistency", () => {
  it("keeps a Los Angeles quest at the same instant while the device travels", () => {
    expect(calendarZonedDate("2026-09-19", "10:00", "America/Los_Angeles").toISOString()).toBe("2026-09-19T17:00:00.000Z");
    expect(calendarLocalParts(new Date("2026-09-19T17:00:00Z"), "America/Los_Angeles")).toEqual({ date: "2026-09-19", time: "10:00" });
  });
  it("handles positive UTC offsets", () => expect(calendarZonedDate("2026-09-19", "01:00", "Asia/Tokyo").toISOString()).toBe("2026-09-18T16:00:00.000Z"));
  it("rejects a nonexistent DST time instead of silently shifting it", () => expect(() => calendarZonedDate("2026-03-08", "02:30", "America/Los_Angeles")).toThrow(/daylight saving/));
  it('rejects impossible dates and midnight rollover rather than changing the day', () => {
    for (const [date,time] of [['2026-02-30','10:00'],['2026-09-19','24:00'],['2026-13-01','10:00'],['2026-09-19','10:60']]) {
      expect(() => calendarZonedDate(date,time,'UTC')).toThrow(/Invalid/);
    }
  });
});
