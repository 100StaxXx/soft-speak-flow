import { describe, expect, it } from "vitest";
import {
  fitPlannerDurationBucketWithin,
  normalizePlannerDurationBucket,
  PLANNER_DURATION_BUCKETS,
} from "./plannerDurationBuckets";

describe("planner duration buckets", () => {
  it("exposes the planner minute buckets in ascending order", () => {
    expect(PLANNER_DURATION_BUCKETS).toEqual([10, 15, 20, 30, 45, 60, 90, 120]);
  });

  it.each([null, undefined, Number.NaN, Infinity, 0, -5])(
    "returns null for invalid input %s",
    (value) => {
      expect(normalizePlannerDurationBucket(value)).toBeNull();
      expect(fitPlannerDurationBucketWithin(value)).toBeNull();
    },
  );

  it("normalizes to the nearest bucket and clamps out-of-range positive values", () => {
    expect(normalizePlannerDurationBucket(1)).toBe(10);
    expect(normalizePlannerDurationBucket(52)).toBe(45);
    expect(normalizePlannerDurationBucket(119)).toBe(120);
    expect(normalizePlannerDurationBucket(240)).toBe(120);
  });

  it("keeps tie breaks on the lower bucket", () => {
    expect(normalizePlannerDurationBucket(12.5)).toBe(10);
  });

  it("fits to the largest bucket within the value", () => {
    expect(fitPlannerDurationBucketWithin(1)).toBeNull();
    expect(fitPlannerDurationBucketWithin(10)).toBe(10);
    expect(fitPlannerDurationBucketWithin(52)).toBe(45);
    expect(fitPlannerDurationBucketWithin(240)).toBe(120);
  });
});
