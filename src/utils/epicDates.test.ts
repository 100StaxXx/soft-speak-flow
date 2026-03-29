import { describe, expect, it } from "vitest";

import { getEpicDaysRemaining, resolveEpicEndDate } from "./epicDates";

describe("epicDates", () => {
  it("computes an end date from the start date plus target days", () => {
    expect(resolveEpicEndDate({
      start_date: "2026-03-29",
      target_days: 14,
      end_date: null,
    })).toBe("2026-04-12");
  });

  it("prevents bogus negative countdowns when the stored end date is missing", () => {
    expect(getEpicDaysRemaining({
      start_date: "2026-03-29",
      target_days: 14,
      end_date: null,
    }, new Date("2026-03-29T20:00:00.000Z"))).toBe(14);
  });

  it("clamps past dates at zero days remaining", () => {
    expect(getEpicDaysRemaining("1970-01-01", new Date("2026-03-29T20:00:00.000Z"))).toBe(0);
  });
});
