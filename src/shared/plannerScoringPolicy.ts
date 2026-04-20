import plannerScoringPolicy from "./plannerScoringPolicy.json" with {
  type: "json",
};

import type {
  PlannerDraftStatus,
  PlannerOptimizerPriority,
  PlannerSchedulingMode,
} from "./plannerOptimizer.ts";

export type PlannerScoringPolicy = typeof plannerScoringPolicy;

export const PLANNER_SCORING_POLICY =
  plannerScoringPolicy satisfies PlannerScoringPolicy;

export const clampPlannerOptimizerPriority = (
  value: number | null | undefined,
): PlannerOptimizerPriority => {
  const normalized = Math.round(value ?? 1);
  if (normalized >= 5) return 5;
  if (normalized <= 1) return 1;
  return normalized as PlannerOptimizerPriority;
};

export const normalizeBundlePriority = (
  index: number,
): PlannerOptimizerPriority => clampPlannerOptimizerPriority(5 - index);

export const normalizePlannerScorePriority = (
  rawScore: number | null | undefined,
): PlannerOptimizerPriority => {
  const clampedScore = Math.max(
    0,
    Math.min(100, Number.isFinite(rawScore) ? Number(rawScore) : 0),
  );
  return clampPlannerOptimizerPriority(Math.ceil((clampedScore + 0.001) / 20));
};

export const getTentativeThreshold = (
  schedulingMode: PlannerSchedulingMode,
): number =>
  schedulingMode === "aggressive"
    ? PLANNER_SCORING_POLICY.tentative_threshold_aggressive
    : PLANNER_SCORING_POLICY.tentative_threshold_default;

export const getDraftStatusForScore = (
  score: number,
  schedulingMode: PlannerSchedulingMode,
): PlannerDraftStatus => {
  if (score >= PLANNER_SCORING_POLICY.scheduled_threshold) {
    return "scheduled_draft";
  }

  return score >= getTentativeThreshold(schedulingMode)
    ? "tentative_time"
    : "needs_scheduling";
};

export const getEffectiveConfidence = (
  confidence: number,
  dayIndex: number,
): number =>
  Math.max(
    PLANNER_SCORING_POLICY.confidence_floor,
    confidence - (dayIndex * PLANNER_SCORING_POLICY.confidence_decay_per_day),
  );

export const getUnscheduledPenalty = (
  priority: PlannerOptimizerPriority,
  confidence: number,
  dayIndex = 0,
): number =>
  PLANNER_SCORING_POLICY.unscheduled_penalty_base *
  (1 + (priority * 0.5) + getEffectiveConfidence(confidence, dayIndex));
