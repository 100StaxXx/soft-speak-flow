import {
  PROGRESSION_THRESHOLDS,
  getProgressionThreshold,
  getProgressionTier,
  getProgressionTierLabelForLevel,
  resolveProgressionLevelFromXp,
} from "@/config/progression";

export interface EvolutionThreshold {
  stage: number;
  xp_required: number;
  stage_name: string;
  tier: string;
  evolves_at_boundary: boolean;
}

const THRESHOLDS: readonly EvolutionThreshold[] = PROGRESSION_THRESHOLDS.map((threshold) => ({
  stage: threshold.level,
  xp_required: threshold.xpRequired,
  stage_name: getProgressionTierLabelForLevel(threshold.level),
  tier: getProgressionTier(threshold.level),
  evolves_at_boundary: threshold.evolvesAtBoundary,
}));

const THRESHOLD_MAP = THRESHOLDS.reduce<Record<number, number>>((acc, threshold) => {
  acc[threshold.stage] = threshold.xp_required;
  return acc;
}, {});

export const useEvolutionThresholds = () => {
  const getThreshold = (stage: number): number | null => {
    return getProgressionThreshold(stage);
  };

  const shouldEvolve = (currentStage: number, currentXP: number): boolean => {
    return resolveProgressionLevelFromXp(currentXP) > currentStage;
  };

  const getStageName = (stage: number): string => {
    return getProgressionTierLabelForLevel(stage);
  };

  return {
    thresholds: THRESHOLDS,
    thresholdMap: THRESHOLD_MAP,
    isLoading: false,
    error: null,
    getThreshold,
    shouldEvolve,
    getStageName,
  };
};
