import {
  getProgressionThreshold,
  resolveProgressionLevelFromXp,
} from "@/config/progression";
import type { PendingEvolutionReveal } from "@/contexts/EvolutionContext";
import type { Companion } from "@/hooks/useCompanion";
import { getUniversalEggAssetUrl } from "@/lib/companionAssetResolver";
import {
  getBundledCompanionImageFocalPoint,
  isCompanionEggImageSource,
} from "@/lib/companionImageFocal";

export interface CompanionDisplayStateInput {
  companion: Companion | null | undefined;
  nextEvolutionXP: number | null;
  progressToNext: number;
  canEvolve: boolean;
  forcePreHatchDisplay?: boolean;
  pendingEvolutionReveal?: PendingEvolutionReveal | null;
}

export interface CompanionDisplayState {
  displayCompanion: Companion | null;
  displayNextEvolutionXP: number;
  displayProgressToNext: number;
  displayCanEvolve: boolean;
  isPreHatchDisplay: boolean;
  isPendingRevealDisplay: boolean;
}

const STAGE_ZERO = 0;
const LEVEL_ONE_THRESHOLD = getProgressionThreshold(1) ?? 10;

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const resolvePreHatchEggImageUrl = (companion: Companion): string => {
  const storedInitialImageUrl = companion.initial_image_url?.trim();

  if (storedInitialImageUrl && !isCompanionEggImageSource(storedInitialImageUrl)) {
    return storedInitialImageUrl;
  }

  return getUniversalEggAssetUrl(companion.core_element || "fire");
};

const buildPreHatchCompanionSnapshot = (companion: Companion): Companion => {
  const eggImageUrl = resolvePreHatchEggImageUrl(companion);
  const eggImageFocal = getBundledCompanionImageFocalPoint(eggImageUrl);

  return {
    ...companion,
    current_stage: STAGE_ZERO,
    current_image_url: eggImageUrl,
    current_image_focal_x:
      companion.initial_image_focal_x ??
      eggImageFocal?.x ??
      companion.current_image_focal_x ??
      null,
    current_image_focal_y:
      companion.initial_image_focal_y ??
      eggImageFocal?.y ??
      companion.current_image_focal_y ??
      null,
    cached_creature_name: null,
  };
};

const buildPendingRevealCompanionSnapshot = (
  companion: Companion,
  pendingEvolutionReveal: PendingEvolutionReveal,
): Companion => ({
  ...companion,
  current_stage: pendingEvolutionReveal.previousStage,
  current_image_url: pendingEvolutionReveal.previousImageUrl,
  cached_creature_name: null,
});

export const deriveCompanionDisplayState = ({
  companion,
  nextEvolutionXP,
  progressToNext,
  canEvolve,
  forcePreHatchDisplay = false,
  pendingEvolutionReveal = null,
}: CompanionDisplayStateInput): CompanionDisplayState => {
  if (
    companion &&
    pendingEvolutionReveal &&
    pendingEvolutionReveal.companionId === companion.id &&
    pendingEvolutionReveal.newStage === companion.current_stage
  ) {
    const displayCompanion = buildPendingRevealCompanionSnapshot(companion, pendingEvolutionReveal);
    const displayNextEvolutionXP =
      getProgressionThreshold(pendingEvolutionReveal.newStage) ?? nextEvolutionXP ?? 0;
    const currentStageThreshold = getProgressionThreshold(pendingEvolutionReveal.previousStage) ?? 0;
    const stageProgressRange = Math.max(displayNextEvolutionXP - currentStageThreshold, 1);
    const displayProgressToNext = clampPercent(
      ((Math.max(displayCompanion.current_xp, 0) - currentStageThreshold) / stageProgressRange) * 100,
    );

    return {
      displayCompanion,
      displayNextEvolutionXP,
      displayProgressToNext,
      displayCanEvolve: true,
      isPreHatchDisplay: pendingEvolutionReveal.previousStage === STAGE_ZERO,
      isPendingRevealDisplay: true,
    };
  }

  if (!companion || !forcePreHatchDisplay) {
    return {
      displayCompanion: companion ?? null,
      displayNextEvolutionXP: nextEvolutionXP ?? 0,
      displayProgressToNext: progressToNext,
      displayCanEvolve: canEvolve,
      isPreHatchDisplay: false,
      isPendingRevealDisplay: false,
    };
  }

  const displayCompanion = buildPreHatchCompanionSnapshot(companion);
  const stageProgressRange = Math.max(LEVEL_ONE_THRESHOLD, 1);
  const displayProgressToNext = clampPercent(
    (Math.max(displayCompanion.current_xp, 0) / stageProgressRange) * 100,
  );

  return {
    displayCompanion,
    displayNextEvolutionXP: LEVEL_ONE_THRESHOLD,
    displayProgressToNext,
    displayCanEvolve: resolveProgressionLevelFromXp(displayCompanion.current_xp) > STAGE_ZERO,
    isPreHatchDisplay: true,
    isPendingRevealDisplay: false,
  };
};
