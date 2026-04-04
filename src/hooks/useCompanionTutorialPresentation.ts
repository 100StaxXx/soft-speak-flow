import { useMemo } from "react";

import { useEvolution } from "@/contexts/EvolutionContext";
import { usePostOnboardingMentorGuidance } from "@/hooks/usePostOnboardingMentorGuidance";
import type { Companion } from "@/hooks/useCompanion";
import { getUniversalEggAssetUrl } from "@/lib/companionAssetResolver";
import {
  getProgressPercentToNextLevel,
  getProgressionThreshold,
  resolveProgressionLevelFromXp,
} from "@/config/progression";

interface UseCompanionTutorialPresentationOptions {
  companion: Companion | null;
  canEvolve: boolean;
  nextEvolutionXP: number | null;
  progressToNext: number;
  pathname?: string | null;
}

interface CompanionTutorialPresentation {
  isStageZeroOverrideActive: boolean;
  companion: Companion | null;
  canEvolve: boolean;
  nextEvolutionXP: number | null;
  progressToNext: number;
}

const getFallbackPathname = () =>
  typeof window === "undefined" ? null : window.location.pathname;

export const useCompanionTutorialPresentation = ({
  companion,
  canEvolve,
  nextEvolutionXP,
  progressToNext,
  pathname,
}: UseCompanionTutorialPresentationOptions): CompanionTutorialPresentation => {
  const { currentStep } = usePostOnboardingMentorGuidance();
  const { isEvolvingLoading } = useEvolution();

  return useMemo(() => {
    const resolvedPathname = pathname ?? getFallbackPathname();
    const isStageZeroOverrideActive = Boolean(
      companion &&
      currentStep === "evolve_companion" &&
      resolvedPathname === "/companion" &&
      !isEvolvingLoading,
    );

    if (!companion || !isStageZeroOverrideActive) {
      return {
        isStageZeroOverrideActive: false,
        companion,
        canEvolve,
        nextEvolutionXP,
        progressToNext,
      };
    }

    const currentImageUrl =
      companion.initial_image_url ??
      getUniversalEggAssetUrl(companion.core_element);
    const earnedLevel = resolveProgressionLevelFromXp(companion.current_xp);

    return {
      isStageZeroOverrideActive,
      companion: {
        ...companion,
        current_stage: 0,
        current_image_url: currentImageUrl,
        current_image_focal_x:
          companion.initial_image_focal_x ??
          companion.current_image_focal_x ??
          null,
        current_image_focal_y:
          companion.initial_image_focal_y ??
          companion.current_image_focal_y ??
          null,
        cached_creature_name: null,
      },
      canEvolve: earnedLevel > 0,
      nextEvolutionXP: getProgressionThreshold(1),
      progressToNext: getProgressPercentToNextLevel(0, companion.current_xp),
    };
  }, [
    canEvolve,
    companion,
    currentStep,
    isEvolvingLoading,
    nextEvolutionXP,
    pathname,
    progressToNext,
  ]);
};
