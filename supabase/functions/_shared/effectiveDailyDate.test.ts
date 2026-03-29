import {
  formatDateInTimezone,
  getDateAnchorForIsoDate,
  getEffectiveDailyDate,
  getEffectiveDailyDateAnchor,
  getUtcIsoDate,
  normalizeTimezone,
} from "./effectiveDailyDate.ts";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.test("normalizeTimezone falls back to UTC for invalid values", () => {
  assert(normalizeTimezone("America/Los_Angeles") === "America/Los_Angeles", "Expected valid timezone to pass through");
  assert(normalizeTimezone("not/a-timezone") === "UTC", "Expected invalid timezone to fall back to UTC");
});

Deno.test("getEffectiveDailyDate returns the previous day before the 2 AM reset", () => {
  const now = new Date("2026-03-10T11:30:00.000Z");
  const effectiveDate = getEffectiveDailyDate("Pacific/Honolulu", 2, now);

  assert(effectiveDate === "2026-03-09", `Expected previous day before reset, got ${effectiveDate}`);
});

Deno.test("getEffectiveDailyDate keeps the current day at or after the 2 AM reset", () => {
  const now = new Date("2026-03-10T12:00:00.000Z");
  const effectiveDate = getEffectiveDailyDate("Pacific/Honolulu", 2, now);

  assert(effectiveDate === "2026-03-10", `Expected same day after reset, got ${effectiveDate}`);
});

Deno.test("getEffectiveDailyDateAnchor preserves UTC+14 and UTC-10 boundaries", () => {
  const utcPlus14 = getEffectiveDailyDateAnchor("Pacific/Kiritimati", 2, new Date("2026-03-10T13:30:00.000Z"));
  const utcMinus10 = getEffectiveDailyDateAnchor("Pacific/Honolulu", 2, new Date("2026-03-10T11:30:00.000Z"));

  assert(utcPlus14.effectiveDate === "2026-03-11", `Expected UTC+14 to resolve to 2026-03-11, got ${utcPlus14.effectiveDate}`);
  assert(utcMinus10.effectiveDate === "2026-03-09", `Expected UTC-10 to resolve to 2026-03-09, got ${utcMinus10.effectiveDate}`);
  assert(utcPlus14.anchorDate.toISOString() === "2026-03-11T12:00:00.000Z", `Unexpected UTC+14 anchor ${utcPlus14.anchorDate.toISOString()}`);
  assert(utcMinus10.anchorDate.toISOString() === "2026-03-09T12:00:00.000Z", `Unexpected UTC-10 anchor ${utcMinus10.anchorDate.toISOString()}`);
});

Deno.test("formatDateInTimezone and getUtcIsoDate return strict ISO dates", () => {
  const sample = new Date("2026-03-10T23:30:00.000Z");
  const localDate = formatDateInTimezone(sample, "America/Los_Angeles");
  const utcDate = getUtcIsoDate(sample, 1);

  assert(localDate === "2026-03-10", `Expected local date 2026-03-10, got ${localDate}`);
  assert(utcDate === "2026-03-11", `Expected UTC date 2026-03-11, got ${utcDate}`);
});

Deno.test("getDateAnchorForIsoDate normalizes to noon UTC", () => {
  const anchor = getDateAnchorForIsoDate("2026-03-27");
  assert(anchor.toISOString() === "2026-03-27T12:00:00.000Z", `Unexpected anchor ${anchor.toISOString()}`);
});
