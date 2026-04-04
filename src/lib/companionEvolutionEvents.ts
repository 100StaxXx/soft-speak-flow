export const COMPANION_HATCH_STARTED_EVENT = "companion-hatch-started";

export interface CompanionHatchStartedDetail {
  companionId: string;
  previousStage: 0;
  newStage: 1;
  previousImageUrl: string;
  newImageUrl: string;
  element: string | null;
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
    && (typeof value.element === "string" || value.element === null)
  );
};
