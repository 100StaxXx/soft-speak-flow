const MIN_MILESTONE_PERCENT = 1;
const MAX_MILESTONE_PERCENT = 100;

const clampMilestonePercent = (value: number): number =>
  Math.max(MIN_MILESTONE_PERCENT, Math.min(MAX_MILESTONE_PERCENT, value));

const parseMilestonePercent = (value: unknown, fallback: number): number => {
  const parsed = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim().length > 0
      ? Number(value)
      : Number.NaN;

  return clampMilestonePercent(Number.isFinite(parsed) ? Math.round(parsed) : fallback);
};

const reserveNearestAvailablePercent = (preferred: number, used: Set<number>): number => {
  if (!used.has(preferred)) {
    used.add(preferred);
    return preferred;
  }

  for (let offset = 1; offset < MAX_MILESTONE_PERCENT; offset += 1) {
    const higher = preferred + offset;
    if (higher <= MAX_MILESTONE_PERCENT && !used.has(higher)) {
      used.add(higher);
      return higher;
    }

    const lower = preferred - offset;
    if (lower >= MIN_MILESTONE_PERCENT && !used.has(lower)) {
      used.add(lower);
      return lower;
    }
  }

  return preferred;
};

export const isValidCampaignMilestonePercent = (value: unknown): value is number =>
  typeof value === "number"
  && Number.isInteger(value)
  && value >= MIN_MILESTONE_PERCENT
  && value <= MAX_MILESTONE_PERCENT;

export const normalizeCampaignMilestonePercentArray = (values: unknown[]): number[] => {
  const total = Math.max(values.length, 1);
  const used = new Set<number>();

  return values.map((value, index) => {
    const fallback = clampMilestonePercent(Math.round(((index + 1) / total) * MAX_MILESTONE_PERCENT));
    const preferred = parseMilestonePercent(value, fallback);
    return reserveNearestAvailablePercent(preferred, used);
  });
};
