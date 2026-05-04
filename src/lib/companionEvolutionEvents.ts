export const COMPANION_HATCH_STARTED_EVENT = "companion-hatch-started";

export interface CompanionHatchStartedDetail {
  companionId: string;
  previousStage: 0;
  newStage: 1;
  previousImageUrl: string;
  newImageUrl: string;
  presetId?: string | null;
  element: string | null;
  /**
   * Stage-1 evolution row id returned by hatch_companion_with_preset. Carries
   * through to GlobalEvolutionListener so the realtime subscription on
   * companion_evolutions.animation_video_url can hot-swap the Kling MP4 in
   * once the cron drainer finishes generating it.
   */
  evolutionId?: string | null;
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
    && (
      typeof value.evolutionId === "string"
      || value.evolutionId === null
      || typeof value.evolutionId === "undefined"
    )
  );
};
