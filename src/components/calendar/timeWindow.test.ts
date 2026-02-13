import { describe, expect, it } from "vitest";
import {
  bucketTaskToHalfHourSlot,
  computeDynamicWindow,
  snapPointerToFiveMinuteOffset,
} from "./timeWindow";

describe("computeDynamicWindow", () => {
  it("expands around scheduled tasks with 30-minute buffers", () => {
    const result = computeDynamicWindow([
      { scheduled_time: "09:00", estimated_duration: 30 },
      { scheduled_time: "11:30", estimated_duration: 30 },
    ]);

    expect(result).toEqual({
      startMinute: 8 * 60 + 30,
      endMinute: 12 * 60 + 30,
    });
  });

  it("uses a 4-hour now-centered window when no tasks exist", () => {
    const result = computeDynamicWindow([], new Date("2026-02-13T14:17:00"));

    expect(result).toEqual({
      startMinute: 12 * 60,
      endMinute: 16 * 60,
    });
  });

  it("clamps near day boundaries while preserving a 4-hour span", () => {
    const earlyResult = computeDynamicWindow([{ scheduled_time: "00:10", estimated_duration: 30 }]);
    const lateResult = computeDynamicWindow([{ scheduled_time: "23:50", estimated_duration: 30 }]);

    expect(earlyResult).toEqual({
      startMinute: 0,
      endMinute: 4 * 60,
    });
    expect(lateResult).toEqual({
      startMinute: 20 * 60,
      endMinute: 24 * 60,
    });
  });

  it("keeps half-hour boundaries even for very short tasks", () => {
    const result = computeDynamicWindow([{ scheduled_time: "09:00", estimated_duration: 5 }]);
    expect(result.startMinute % 30).toBe(0);
    expect(result.endMinute % 30).toBe(0);
    expect(result.endMinute - result.startMinute).toBeGreaterThanOrEqual(4 * 60);
  });
});

describe("bucketTaskToHalfHourSlot", () => {
  it("buckets off-grid times to the previous half-hour slot", () => {
    expect(bucketTaskToHalfHourSlot("08:35")).toBe(8 * 60 + 30);
  });
});

describe("snapPointerToFiveMinuteOffset", () => {
  it("maps row offsets to deterministic 5-minute increments", () => {
    expect(snapPointerToFiveMinuteOffset(0, 60)).toBe(0);
    expect(snapPointerToFiveMinuteOffset(9.9, 60)).toBe(0);
    expect(snapPointerToFiveMinuteOffset(10, 60)).toBe(5);
    expect(snapPointerToFiveMinuteOffset(19.9, 60)).toBe(5);
    expect(snapPointerToFiveMinuteOffset(20, 60)).toBe(10);
    expect(snapPointerToFiveMinuteOffset(30, 60)).toBe(15);
    expect(snapPointerToFiveMinuteOffset(40, 60)).toBe(20);
    expect(snapPointerToFiveMinuteOffset(59.9, 60)).toBe(25);
  });

  it("supports second-half hour rows when combined with a :30 base", () => {
    const baseMinute = 30;
    const offset = snapPointerToFiveMinuteOffset(50, 60); // :55 within a :30 row
    expect(baseMinute + offset).toBe(55);
  });
});
