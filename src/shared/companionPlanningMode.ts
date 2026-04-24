export type CompanionPlanningMode = "lock_in" | "balanced" | "recovery";

export const DEFAULT_COMPANION_PLANNING_MODE: CompanionPlanningMode =
  "balanced";

export const COMPANION_PLANNING_MODE_OPTIONS: Array<{
  id: CompanionPlanningMode;
  label: string;
  description: string;
}> = [
  {
    id: "lock_in",
    label: "Lock In",
    description: "Bias toward more intensity and tighter momentum.",
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Keep the day realistic without going too soft or too hard.",
  },
  {
    id: "recovery",
    label: "Recovery",
    description: "Bias toward lighter load and lower friction decisions.",
  },
];

export const mapPlanningModeToWorkloadTolerance = (
  mode: CompanionPlanningMode,
): "heavy" | "normal" | "light" => {
  if (mode === "lock_in") return "heavy";
  if (mode === "recovery") return "light";
  return "normal";
};

export const mapWorkloadToleranceToPlanningMode = (
  workloadTolerance: "heavy" | "normal" | "light" | null | undefined,
): CompanionPlanningMode => {
  if (workloadTolerance === "heavy") return "lock_in";
  if (workloadTolerance === "light") return "recovery";
  return "balanced";
};
