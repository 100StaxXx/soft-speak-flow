import type { CompanionTomorrowSummary } from "./companionStructuredOutput.ts";

export type AdaptiveLoadWorkloadTolerance = "light" | "normal" | "heavy";
export type AdaptiveLoadMomentumState =
  | "locked_in"
  | "coasting"
  | "slipping"
  | "rebuilding";
export type AdaptiveLoadMissInterpretation =
  | "overload"
  | "low_energy"
  | "avoidance"
  | "interruption"
  | "normal_variance";

export type AdaptiveLoadBlockSource = "task" | "calendar" | "ritual";

export interface AdaptiveLoadBlock {
  id?: string | null;
  title?: string | null;
  source: AdaptiveLoadBlockSource;
  startMinutes?: number | null;
  endMinutes?: number | null;
  durationMinutes?: number | null;
  energyType?: string | null;
  priority?: string | null;
  difficulty?: string | null;
  flexibility?: string | null;
  category?: string | null;
  isAllDay?: boolean | null;
}

export interface AdaptiveComingUpLoadInput {
  blocks: AdaptiveLoadBlock[];
  workloadTolerance?: AdaptiveLoadWorkloadTolerance | null;
  momentumState?: AdaptiveLoadMomentumState | null;
  recentMissInterpretation?: AdaptiveLoadMissInterpretation | null;
  missedCount?: number | null;
  overdueCount?: number | null;
}

export interface AdaptiveComingUpLoadResult {
  label: CompanionTomorrowSummary;
  effectiveWorkloadTolerance: AdaptiveLoadWorkloadTolerance;
  scheduledMinutes: number;
  gapMinutes: number;
  contextSwitches: number;
  intenseBlockCount: number;
  overdueOrMissedCount: number;
  pressureScore: number;
  reliefScore: number;
}

type LoadThresholds = {
  lightMax: number;
  productiveMax: number;
  busyMax: number;
};

const TOLERANCE_RANK = {
  light: 0,
  normal: 1,
  heavy: 2,
} satisfies Record<AdaptiveLoadWorkloadTolerance, number>;

const TOLERANCE_BY_RANK: AdaptiveLoadWorkloadTolerance[] = [
  "light",
  "normal",
  "heavy",
];

const LABEL_RANK = {
  open: 0,
  light: 1,
  productive: 2,
  busy: 3,
  overwhelming: 4,
} satisfies Record<CompanionTomorrowSummary, number>;

const LABEL_BY_RANK: CompanionTomorrowSummary[] = [
  "open",
  "light",
  "productive",
  "busy",
  "overwhelming",
];

const LOAD_THRESHOLDS = {
  light: {
    lightMax: 120,
    productiveMax: 240,
    busyMax: 360,
  },
  normal: {
    lightMax: 150,
    productiveMax: 300,
    busyMax: 450,
  },
  heavy: {
    lightMax: 180,
    productiveMax: 360,
    busyMax: 510,
  },
} satisfies Record<AdaptiveLoadWorkloadTolerance, LoadThresholds>;

const ROUTINE_ENERGY_TYPES = new Set([
  "admin",
  "errand",
  "physical",
  "recovery",
  "social",
]);

const INTENSE_ENERGY_TYPES = new Set(["deep", "creative"]);
const HIGH_PRIORITY_VALUES = new Set(["high", "urgent"]);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const normalizeTolerance = (
  tolerance: AdaptiveLoadWorkloadTolerance | null | undefined,
): AdaptiveLoadWorkloadTolerance =>
  tolerance === "light" || tolerance === "heavy" ? tolerance : "normal";

const shiftTolerance = (
  tolerance: AdaptiveLoadWorkloadTolerance,
  amount: number,
): AdaptiveLoadWorkloadTolerance =>
  TOLERANCE_BY_RANK[
    clamp(TOLERANCE_RANK[tolerance] + amount, 0, TOLERANCE_BY_RANK.length - 1)
  ] ?? tolerance;

const shiftLabel = (
  label: CompanionTomorrowSummary,
  amount: number,
): CompanionTomorrowSummary =>
  LABEL_BY_RANK[
    clamp(LABEL_RANK[label] + amount, 0, LABEL_BY_RANK.length - 1)
  ] ?? label;

const finitePositive = (value: number | null | undefined): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;

const getBlockDurationMinutes = (block: AdaptiveLoadBlock): number => {
  if (block.isAllDay) return 0;

  const explicitDuration = finitePositive(block.durationMinutes);
  if (explicitDuration !== null) return explicitDuration;

  if (
    typeof block.startMinutes === "number" &&
    Number.isFinite(block.startMinutes) &&
    typeof block.endMinutes === "number" &&
    Number.isFinite(block.endMinutes) &&
    block.endMinutes > block.startMinutes
  ) {
    return block.endMinutes - block.startMinutes;
  }

  return 0;
};

const normalizeDedupeText = (value: string | null | undefined): string =>
  (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const getBlockDedupeKey = (block: AdaptiveLoadBlock): string => {
  const duration = getBlockDurationMinutes(block);
  const title = normalizeDedupeText(block.title);
  if (
    title &&
    typeof block.startMinutes === "number" &&
    Number.isFinite(block.startMinutes)
  ) {
    return `${title}|${block.startMinutes}|${duration}|${
      block.isAllDay ? "all-day" : "timed"
    }`;
  }

  return block.id
    ? `${block.source}:${block.id}`
    : `${block.source}:${title}:${duration}:${block.isAllDay ? "all-day" : "timed"}`;
};

const dedupeBlocks = (blocks: AdaptiveLoadBlock[]): AdaptiveLoadBlock[] => {
  const seen = new Set<string>();
  return blocks.filter((block) => {
    const key = getBlockDedupeKey(block);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const getTimedIntervals = (blocks: AdaptiveLoadBlock[]) =>
  blocks
    .map((block) => {
      if (
        block.isAllDay ||
        typeof block.startMinutes !== "number" ||
        !Number.isFinite(block.startMinutes)
      ) {
        return null;
      }

      const duration = getBlockDurationMinutes(block);
      const endMinutes = typeof block.endMinutes === "number" &&
          Number.isFinite(block.endMinutes) &&
          block.endMinutes > block.startMinutes
        ? block.endMinutes
        : duration > 0
        ? block.startMinutes + duration
        : null;

      return endMinutes && endMinutes > block.startMinutes
        ? {
          startMinutes: block.startMinutes,
          endMinutes,
          block,
        }
        : null;
    })
    .filter((entry): entry is {
      startMinutes: number;
      endMinutes: number;
      block: AdaptiveLoadBlock;
    } => entry !== null)
    .sort((left, right) => left.startMinutes - right.startMinutes);

const sumGapMinutes = (
  intervals: Array<{ startMinutes: number; endMinutes: number }>,
): number => {
  if (intervals.length < 2) return 0;

  let gapMinutes = 0;
  let previousEnd = intervals[0]?.endMinutes ?? 0;

  for (let index = 1; index < intervals.length; index += 1) {
    const interval = intervals[index];
    if (!interval) continue;
    if (interval.startMinutes > previousEnd) {
      gapMinutes += interval.startMinutes - previousEnd;
    }
    previousEnd = Math.max(previousEnd, interval.endMinutes);
  }

  return gapMinutes;
};

const getContextKey = (block: AdaptiveLoadBlock): string =>
  [
    block.source,
    block.energyType?.trim().toLowerCase() || "",
    block.category?.trim().toLowerCase() || "",
  ].join(":");

const countContextSwitches = (blocks: AdaptiveLoadBlock[]): number => {
  const sorted = getTimedIntervals(blocks).map((entry) => entry.block);
  if (sorted.length < 2) return 0;

  let switches = 0;
  let previousKey = getContextKey(sorted[0] as AdaptiveLoadBlock);
  for (const block of sorted.slice(1)) {
    const nextKey = getContextKey(block);
    if (nextKey !== previousKey) switches += 1;
    previousKey = nextKey;
  }
  return switches;
};

const isIntenseBlock = (block: AdaptiveLoadBlock): boolean => {
  const energy = block.energyType?.trim().toLowerCase();
  const priority = block.priority?.trim().toLowerCase();
  const difficulty = block.difficulty?.trim().toLowerCase();

  return Boolean(
    (energy && INTENSE_ENERGY_TYPES.has(energy)) ||
      (priority && HIGH_PRIORITY_VALUES.has(priority)) ||
      difficulty === "hard",
  );
};

const isRoutineBlock = (block: AdaptiveLoadBlock): boolean => {
  const energy = block.energyType?.trim().toLowerCase();
  const flexibility = block.flexibility?.trim().toLowerCase();

  return Boolean(
    block.source === "ritual" ||
      (energy && ROUTINE_ENERGY_TYPES.has(energy)) ||
      flexibility === "flexible" ||
      flexibility === "preferred",
  );
};

const classifyBaseLoad = (
  scheduledMinutes: number,
  blockCount: number,
  thresholds: LoadThresholds,
): CompanionTomorrowSummary => {
  if (scheduledMinutes <= 0) return blockCount > 0 ? "light" : "open";
  if (scheduledMinutes < thresholds.lightMax) return "light";
  if (scheduledMinutes <= thresholds.productiveMax) return "productive";
  if (scheduledMinutes < thresholds.busyMax) return "busy";
  return "overwhelming";
};

export const resolveAdaptiveWorkloadTolerance = ({
  workloadTolerance,
  momentumState,
  recentMissInterpretation,
  missedCount,
  overdueCount,
}: Omit<AdaptiveComingUpLoadInput, "blocks">): AdaptiveLoadWorkloadTolerance => {
  let effectiveTolerance = normalizeTolerance(workloadTolerance);
  const overdueOrMissedCount = Math.max(0, missedCount ?? 0) +
    Math.max(0, overdueCount ?? 0);
  const looksStrong =
    momentumState === "locked_in" &&
    recentMissInterpretation === "normal_variance";
  const looksStrained =
    recentMissInterpretation === "overload" ||
    recentMissInterpretation === "low_energy" ||
    (momentumState === "slipping" && overdueOrMissedCount > 0);

  if (looksStrong) effectiveTolerance = shiftTolerance(effectiveTolerance, 1);
  if (looksStrained) effectiveTolerance = shiftTolerance(effectiveTolerance, -1);

  return effectiveTolerance;
};

export const classifyAdaptiveComingUpLoad = (
  input: AdaptiveComingUpLoadInput,
): AdaptiveComingUpLoadResult => {
  const activeBlocks = dedupeBlocks(input.blocks).filter((block) =>
    getBlockDurationMinutes(block) > 0 || !block.isAllDay
  );
  const scheduledMinutes = activeBlocks.reduce(
    (sum, block) => sum + getBlockDurationMinutes(block),
    0,
  );
  const effectiveWorkloadTolerance = resolveAdaptiveWorkloadTolerance(input);
  const thresholds = LOAD_THRESHOLDS[effectiveWorkloadTolerance];
  const timedIntervals = getTimedIntervals(activeBlocks);
  const gapMinutes = sumGapMinutes(timedIntervals);
  const contextSwitches = countContextSwitches(activeBlocks);
  const intenseBlockCount = activeBlocks.filter(isIntenseBlock).length;
  const routineBlockCount = activeBlocks.filter(isRoutineBlock).length;
  const overdueOrMissedCount = Math.max(0, input.missedCount ?? 0) +
    Math.max(0, input.overdueCount ?? 0);

  const compressedGaps = timedIntervals.length >= 2 && gapMinutes < 45;
  const manyContextSwitches = contextSwitches >= 3;
  const heavyMentalLoad = intenseBlockCount >= 2;
  const overduePressure = overdueOrMissedCount >= 2;

  const pressureScore = [
    compressedGaps,
    manyContextSwitches,
    heavyMentalLoad,
    overduePressure,
  ].filter(Boolean).length;

  const largeGaps = timedIntervals.length >= 2 &&
    gapMinutes >= Math.max(180, scheduledMinutes * 0.5);
  const mostlyRoutine = activeBlocks.length > 0 &&
    routineBlockCount / activeBlocks.length >= 0.7;
  const strongMomentum =
    input.momentumState === "locked_in" &&
    input.recentMissInterpretation === "normal_variance";
  const lowUrgency = intenseBlockCount === 0 && overdueOrMissedCount === 0;
  const reliefScore = [
    largeGaps,
    mostlyRoutine,
    strongMomentum,
    lowUrgency,
  ].filter(Boolean).length;

  let label = classifyBaseLoad(
    scheduledMinutes,
    activeBlocks.length,
    thresholds,
  );

  if (pressureScore > 0 && LABEL_RANK[label] < LABEL_RANK.busy) {
    label = "busy";
  }

  if (
    pressureScore >= 2 &&
    scheduledMinutes >= thresholds.productiveMax - 30 &&
    LABEL_RANK[label] >= LABEL_RANK.busy
  ) {
    label = "overwhelming";
  }

  if (reliefScore >= 3 && LABEL_RANK[label] > LABEL_RANK.productive) {
    label = shiftLabel(label, -1);
    if (
      scheduledMinutes >= thresholds.lightMax &&
      LABEL_RANK[label] < LABEL_RANK.productive
    ) {
      label = "productive";
    }
  }

  return {
    label,
    effectiveWorkloadTolerance,
    scheduledMinutes,
    gapMinutes,
    contextSwitches,
    intenseBlockCount,
    overdueOrMissedCount,
    pressureScore,
    reliefScore,
  };
};
