import { describe, expect, it } from "vitest";

import { isEveningReflectionAvailableAtHour } from "./eveningReflectionSchedule";

describe("Evening Reflection schedule", () => {
  it("stays locked before 6 PM local time", () => {
    expect(isEveningReflectionAvailableAtHour(17)).toBe(false);
  });

  it("opens at 6 PM and remains open through late evening", () => {
    expect(isEveningReflectionAvailableAtHour(18)).toBe(true);
    expect(isEveningReflectionAvailableAtHour(23)).toBe(true);
  });

  it("remains open until the 2 AM reset", () => {
    expect(isEveningReflectionAvailableAtHour(0)).toBe(true);
    expect(isEveningReflectionAvailableAtHour(1)).toBe(true);
    expect(isEveningReflectionAvailableAtHour(2)).toBe(false);
  });
});
