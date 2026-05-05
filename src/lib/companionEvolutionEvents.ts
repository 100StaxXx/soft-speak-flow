export const COMPANION_HATCH_STARTED_EVENT = "companion-hatch-started";
export const COMPANION_EVOLUTION_REVEAL_REQUESTED_EVENT =
  "companion-evolution-reveal-requested";

export interface CompanionHatchStartedDetail {
  companionId: string;
  previousStage: 0;
  newStage: 1;
  previousImageUrl: string;
  newImageUrl: string;
  presetId?: string | null;
  element: string | null;
}

export interface CompanionEvolutionRevealRequestedDetail {
  companionId: string;
  stage: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const isCompanionHatchStartedDetail = (
  value: unknown,
): value is CompanionHatchStartedDetail => {
  if (!isRecord(value)) return false;

  return (
    typeof value.companionId === "string"
    && value.previousStage === 0
    && value.newStage === 1
    && typeof value.previousImageUrl === "string"
    && typeof value.newImageUrl === "string"
    && (
      typeof value.presetId === "string"
      || value.presetId === null
      || typeof value.presetId === "undefined"
    )
    && (typeof value.element === "string" || value.element === null)
  );
};

export const isCompanionEvolutionRevealRequestedDetail = (
  value: unknown,
): value is CompanionEvolutionRevealRequestedDetail => {
  if (!isRecord(value)) return false;

  return (
    typeof value.companionId === "string"
    && typeof value.stage === "number"
    && Number.isInteger(value.stage)
    && value.stage > 0
  );
};
