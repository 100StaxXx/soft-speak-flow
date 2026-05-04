import { PROGRESSION_LEVEL_CAP } from "../config/progression.ts";

export interface CompanionPredicateShape {
  preset_id?: string | null;
  current_stage?: number | null;
  current_image_url?: string | null;
  initial_image_url?: string | null;
}

const hasStoredImage = (value: string | null | undefined): boolean =>
  typeof value === "string" && value.trim().length > 0;

export const hasCompanionStoredVisual = (
  companion: CompanionPredicateShape | null | undefined,
): boolean =>
  Boolean(
    companion
    && (
      hasStoredImage(companion.current_image_url)
      || hasStoredImage(companion.initial_image_url)
    ),
  );

export const isPresetBackedCompanion = (
  companion: CompanionPredicateShape | null | undefined,
): boolean =>
  Boolean(typeof companion?.preset_id === "string" && companion.preset_id.trim().length > 0);

export const isPresetEggCompanion = (
  companion: CompanionPredicateShape | null | undefined,
): boolean =>
  isPresetBackedCompanion(companion) && (companion?.current_stage ?? 0) === 0;

export const isAiGeneratedCompanion = (
  companion: CompanionPredicateShape | null | undefined,
): boolean =>
  Boolean(companion && !isPresetBackedCompanion(companion) && hasCompanionStoredVisual(companion));

export const hasValidCompanionStage = (
  companion: Pick<CompanionPredicateShape, "current_stage"> | null | undefined,
): boolean => {
  if (!companion) return false;

  const stage = companion.current_stage;
  return typeof stage === "number" && Number.isInteger(stage) && stage >= 0 && stage <= PROGRESSION_LEVEL_CAP;
};
