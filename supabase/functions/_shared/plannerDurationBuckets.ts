// Keep this in sync with src/shared/plannerDurationBuckets.ts.
export const PLANNER_DURATION_BUCKETS = [
  10,
  15,
  20,
  30,
  45,
  60,
  90,
  120,
] as const;

export type PlannerDurationBucket = (typeof PLANNER_DURATION_BUCKETS)[number];

export const normalizePlannerDurationBucket = (
  value: number | null | undefined,
): PlannerDurationBucket | null => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  let closest: PlannerDurationBucket = PLANNER_DURATION_BUCKETS[0];
  let closestDistance = Math.abs(value - closest);

  for (
    const bucket of PLANNER_DURATION_BUCKETS.slice(
      1,
    ) as readonly PlannerDurationBucket[]
  ) {
    const distance = Math.abs(value - bucket);
    if (distance < closestDistance) {
      closest = bucket;
      closestDistance = distance;
    }
  }

  return closest;
};

export const fitPlannerDurationBucketWithin = (
  value: number | null | undefined,
): PlannerDurationBucket | null => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  for (
    const bucket of [...PLANNER_DURATION_BUCKETS]
      .reverse() as PlannerDurationBucket[]
  ) {
    if (bucket <= value) {
      return bucket;
    }
  }

  return null;
};
