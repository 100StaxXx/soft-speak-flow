import type { RequestUrgency, RitualType } from "@/types/companionLife";

export interface DayTickInput {
  careScore: number;
  careConsistency: number;
  routineStabilityScore: number;
  requestFatigue: number;
  isDormant: boolean;
}

export interface DayTickResult {
  routineStabilityScore: number;
  requestFatigue: number;
  emotionalArc: string;
}

export interface RitualPlanInput {
  dateSeed: string;
  careScore: number;
  careConsistency?: number;
}

export interface RequestPlanInput {
  dateSeed: string;
  careScore: number;
  careConsistency?: number;
  requestFatigue: number;
  openRequests: number;
  maxRequests: number;
}

const RITUAL_ROTATION: RitualType[] = ["attention", "nurture", "growth", "reflection", "nurture"];

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const hashString = (seed: string): number => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

export const seededFloat = (seed: string): number => (hashString(seed) % 1000) / 1000;

const computeRoutineDelta = (params: {
  careScore: number;
  careConsistency: number;
  requestFatigue: number;
  isDormant: boolean;
}): number => {
  const careScore = clamp(params.careScore, 0, 1);
  const careConsistency = clamp(params.careConsistency, 0, 1);
  const requestFatigue = clamp(params.requestFatigue, 0, 10);

  const careDrift = (careScore - 0.5) * 16;
  const consistencyDrift = (careConsistency - 0.5) * 12;
  const fatiguePenalty = requestFatigue * 1.4;
  const dormancyPenalty = params.isDormant ? 8 : 0;

  return careDrift + consistencyDrift - fatiguePenalty - dormancyPenalty;
};

const computeFatigueShift = (params: {
  careScore: number;
  careConsistency: number;
  requestFatigue: number;
  isDormant: boolean;
}): number => {
  const careScore = clamp(params.careScore, 0, 1);
  const careConsistency = clamp(params.careConsistency, 0, 1);
  const requestFatigue = clamp(params.requestFatigue, 0, 10);
  const recovery = careConsistency >= 0.75 ? 1.35 : careConsistency >= 0.55 ? 0.95 : 0.55;
  const routinePenalty = careScore < 0.35 ? 1.1 : careScore < 0.5 ? 0.5 : 0;
  const overloadPenalty = requestFatigue >= 6 ? 0.45 : 0;
  const dormancyPenalty = params.isDormant ? 0.9 : 0;

  return routinePenalty + overloadPenalty + dormancyPenalty - recovery;
};

const determineEmotionalArc = (params: {
  careScore: number;
  routineStabilityScore: number;
  requestFatigue: number;
  isDormant: boolean;
}): string => {
  const careScore = clamp(params.careScore, 0, 1);
  const routineStabilityScore = clamp(params.routineStabilityScore, 0, 100);
  const requestFatigue = clamp(params.requestFatigue, 0, 10);

  if (params.isDormant) return "dormant_recovery";
  if (requestFatigue >= 5 || routineStabilityScore < 30) return "repair_sequence";
  if (careScore < 0.4 || routineStabilityScore < 45) return "fragile_echo";
  if (careScore < 0.55 || routineStabilityScore < 58) return "routine_drift";
  if (careScore >= 0.75 && routineStabilityScore >= 75) return "resonant_growth";
  if (careScore >= 0.58 && routineStabilityScore >= 58) return "steady_bloom";
  return "forming";
};

const computeRitualTargetCount = (careScore: number, careConsistency: number): number => {
  const pressure = (1 - clamp(careScore, 0, 1)) + (1 - clamp(careConsistency, 0, 1)) * 0.55;
  if (pressure >= 1.1) return 5;
  if (pressure >= 0.72) return 4;
  return 3;
};

export const computeDayTick = (input: DayTickInput): DayTickResult => {
  const normalizedCare = clamp(input.careScore, 0, 1);
  const normalizedConsistency = clamp(input.careConsistency, 0, 1);
  const priorStability = clamp(input.routineStabilityScore, 0, 100);
  const fatigue = clamp(input.requestFatigue, 0, 10);
  const routineDelta = computeRoutineDelta({
    careScore: normalizedCare,
    careConsistency: normalizedConsistency,
    requestFatigue: fatigue,
    isDormant: input.isDormant,
  });
  const routineStabilityScore = clamp(Math.round((priorStability + routineDelta) * 100) / 100, 0, 100);
  const fatigueShift = computeFatigueShift({
    careScore: normalizedCare,
    careConsistency: normalizedConsistency,
    requestFatigue: fatigue,
    isDormant: input.isDormant,
  });
  const requestFatigue = clamp(Math.round((fatigue + fatigueShift) * 100) / 100, 0, 10);
  const emotionalArc = determineEmotionalArc({
    careScore: normalizedCare,
    routineStabilityScore,
    requestFatigue,
    isDormant: input.isDormant,
  });

  return {
    routineStabilityScore,
    requestFatigue,
    emotionalArc,
  };
};

export const generateRitualPlan = (input: RitualPlanInput): RitualType[] => {
  const careConsistency = clamp(Number(input.careConsistency ?? 0.5), 0, 1);
  const targetCount = computeRitualTargetCount(input.careScore, careConsistency);
  const startIndex = hashString(`${input.dateSeed}:ritual`) % RITUAL_ROTATION.length;

  return Array.from({ length: targetCount }).map((_, idx) => {
    const i = (startIndex + idx) % RITUAL_ROTATION.length;
    return RITUAL_ROTATION[i];
  });
};

export const pickRequestUrgency = (seed: string, careScore: number, requestFatigue: number, careConsistency = 0.5): RequestUrgency => {
  const pressure = (1 - clamp(careScore, 0, 1))
    + clamp(requestFatigue, 0, 10) * 0.065
    + (1 - clamp(careConsistency, 0, 1)) * 0.35;
  const roll = seededFloat(seed);

  if (pressure >= 1.1 || roll > 0.89) return "critical";
  if (pressure >= 0.68 || roll > 0.48) return "important";
  return "gentle";
};

export const generateRequestPlan = (input: RequestPlanInput): RequestUrgency[] => {
  const slots = Math.max(0, input.maxRequests - input.openRequests);
  if (slots === 0) return [];

  const careScore = clamp(input.careScore, 0, 1);
  const careConsistency = clamp(Number(input.careConsistency ?? 0.5), 0, 1);
  const requestFatigue = clamp(input.requestFatigue, 0, 10);
  const pressure = (1 - careScore) + requestFatigue * 0.07 + (1 - careConsistency) * 0.4;
  const desiredCount = pressure >= 1.15 ? 3 : pressure >= 0.7 ? 2 : 1;
  const count = Math.min(desiredCount, slots);

  return Array.from({ length: count }).map((_, index) =>
    pickRequestUrgency(`${input.dateSeed}:request:${index}`, careScore, requestFatigue, careConsistency),
  );
};
