import { useMemo } from "react";
import { resolveCompanionVisualAssetUrl } from "@/lib/companionAssetResolver";
import { deriveCompanionDisplayState } from "@/lib/companionDisplayState";
import { isCompanionPresetImageSource } from "@/lib/companionImageFocal";
import { getStoredCompanionCustomName } from "@/lib/companionName";
import { formatDisplayLabel } from "@/lib/utils";
import { useCompanion } from "./useCompanion";
import { useCompanionCareSignals } from "./useCompanionCareSignals";
import { useCompanionHealth } from "./useCompanionHealth";

const COMPANION_PLACEHOLDER = "/placeholder-companion.svg";

export const useJourneysCompanionVisual = () => {
  const {
    companion,
    nextEvolutionXP,
    progressToNext,
    canEvolve,
  } = useCompanion();
  const { health } = useCompanionHealth();
  const { care } = useCompanionCareSignals();

  const { displayCompanion } = useMemo(
    () =>
      deriveCompanionDisplayState({
        companion,
        nextEvolutionXP,
        progressToNext,
        canEvolve,
      }),
    [canEvolve, companion, nextEvolutionXP, progressToNext],
  );

  const isDormant = care?.dormancy?.isDormant ?? false;

  const imageUrl = useMemo(() => {
    if (!displayCompanion) {
      return health.imageUrl ?? companion?.current_image_url ?? COMPANION_PLACEHOLDER;
    }

    if (isDormant) {
      return resolveCompanionVisualAssetUrl(displayCompanion, "dormant") ?? COMPANION_PLACEHOLDER;
    }
    if (health.isNeglected && health.neglectedImageUrl) {
      return health.neglectedImageUrl;
    }
    if (health.isNeglected) {
      return resolveCompanionVisualAssetUrl(displayCompanion, "neglected") ?? COMPANION_PLACEHOLDER;
    }

    return resolveCompanionVisualAssetUrl(displayCompanion, "normal") ?? COMPANION_PLACEHOLDER;
  }, [
    companion?.current_image_url,
    displayCompanion,
    health.imageUrl,
    health.isNeglected,
    health.neglectedImageUrl,
    isDormant,
  ]);

  const focalPoint = useMemo(() => {
    if (!displayCompanion) {
      return {
        x: health.imageFocalX ?? companion?.current_image_focal_x ?? null,
        y: health.imageFocalY ?? companion?.current_image_focal_y ?? null,
      };
    }

    if (isDormant) {
      return {
        x: displayCompanion.dormant_image_focal_x ?? displayCompanion.current_image_focal_x ?? null,
        y: displayCompanion.dormant_image_focal_y ?? displayCompanion.current_image_focal_y ?? null,
      };
    }

    if (health.isNeglected) {
      return {
        x:
          health.neglectedImageFocalX
          ?? displayCompanion.neglected_image_focal_x
          ?? displayCompanion.current_image_focal_x
          ?? null,
        y:
          health.neglectedImageFocalY
          ?? displayCompanion.neglected_image_focal_y
          ?? displayCompanion.current_image_focal_y
          ?? null,
      };
    }

    return {
      x: health.imageFocalX ?? displayCompanion.current_image_focal_x ?? null,
      y: health.imageFocalY ?? displayCompanion.current_image_focal_y ?? null,
    };
  }, [
    companion?.current_image_focal_x,
    companion?.current_image_focal_y,
    displayCompanion,
    health.imageFocalX,
    health.imageFocalY,
    health.isNeglected,
    health.neglectedImageFocalX,
    health.neglectedImageFocalY,
    isDormant,
  ]);

  const companionLabel = useMemo(() => {
    const customName = getStoredCompanionCustomName(companion);
    if (customName) return customName;

    const cachedName = companion?.cached_creature_name?.trim();
    if (cachedName) return cachedName;

    const spiritAnimal = companion?.spirit_animal?.trim();
    if (spiritAnimal) return formatDisplayLabel(spiritAnimal);

    return "Companion";
  }, [companion]);

  return {
    companionLabel,
    imageUrl,
    focalX: focalPoint.x,
    focalY: focalPoint.y,
    element: displayCompanion?.core_element ?? companion?.core_element ?? null,
    usesPortraitShell: isCompanionPresetImageSource(imageUrl),
  };
};
