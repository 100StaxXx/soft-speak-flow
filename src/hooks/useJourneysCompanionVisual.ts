import { useMemo } from "react";
import { resolveCompanionVisualAssetUrl } from "@/lib/companionAssetResolver";
import { deriveCompanionDisplayState } from "@/lib/companionDisplayState";
import {
  getBundledCompanionImageAssetKey,
  isCompanionSceneImageSource,
} from "@/lib/companionImageFocal";
import { resolveJourneysCompanionLauncherAwayAssetUrl } from "@/lib/journeysCompanionLauncherArt";
import { getStoredCompanionCustomName } from "@/lib/companionName";
import { isAiGeneratedCompanion } from "@/lib/companionPredicates";
import { formatDisplayLabel } from "@/lib/utils";
import { useCompanion } from "./useCompanion";
import { useCompanionCareSignals } from "./useCompanionCareSignals";
import { useCompanionHealth } from "./useCompanionHealth";

const COMPANION_PLACEHOLDER = "/placeholder-companion.svg";

const isRemoteImageUrl = (value?: string | null): value is string =>
  typeof value === "string" && /^https?:\/\//i.test(value.trim());

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

  const presetId = displayCompanion?.preset_id ?? companion?.preset_id ?? null;
  const element = displayCompanion?.core_element ?? companion?.core_element ?? null;
  const currentSceneImageUrl = companion?.current_image_url ?? null;
  const isGeneratedCompanion = isAiGeneratedCompanion(companion);
  const hasFreshLauncherImage = Boolean(
    isGeneratedCompanion
    && companion?.launcher_image_url
    && companion.launcher_image_source_url === currentSceneImageUrl,
  );
  const launcherAwayImageUrl = useMemo(() => {
    const bundledLauncherUrl = resolveJourneysCompanionLauncherAwayAssetUrl({
      presetId,
      element,
      fallbackUrl: null,
    });

    if (bundledLauncherUrl) {
      return bundledLauncherUrl;
    }

    if (hasFreshLauncherImage) {
      return companion?.launcher_image_url ?? null;
    }

    return null;
  }, [companion?.launcher_image_url, element, hasFreshLauncherImage, presetId]);
  const launcherAwayUsesPortraitShell = useMemo(
    () => getBundledCompanionImageAssetKey(launcherAwayImageUrl) !== null,
    [launcherAwayImageUrl],
  );
  const needsLauncherImage = Boolean(
    isGeneratedCompanion
    && isRemoteImageUrl(currentSceneImageUrl)
    && !hasFreshLauncherImage,
  );

  return {
    companionId: companion?.id ?? null,
    companionLabel,
    presetId,
    imageUrl,
    focalX: focalPoint.x,
    focalY: focalPoint.y,
    element,
    usesPortraitShell: isCompanionSceneImageSource(imageUrl),
    isGeneratedCompanion,
    currentSceneImageUrl,
    launcherAwayImageUrl,
    launcherAwayFocalX: hasFreshLauncherImage ? companion?.launcher_image_focal_x ?? 0.5 : null,
    launcherAwayFocalY: hasFreshLauncherImage ? companion?.launcher_image_focal_y ?? 0.5 : null,
    launcherAwayUsesPortraitShell,
    needsLauncherImage,
  };
};
