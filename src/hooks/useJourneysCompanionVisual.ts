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
import { useEvolution } from "@/contexts/EvolutionContext";
import { useCompanion } from "./useCompanion";
import { useCompanionCareSignals } from "./useCompanionCareSignals";
import { useCompanionHealth } from "./useCompanionHealth";

const COMPANION_PLACEHOLDER = "/placeholder-companion.svg";
const TRANSPARENT_LAUNCHER_IMAGE_FILE_KIND = "_launcher_transparent_stage";

const isRemoteImageUrl = (value?: string | null): value is string =>
  typeof value === "string" && /^https?:\/\//i.test(value.trim());

const isTransparentLauncherImageUrl = (value?: string | null): value is string =>
  typeof value === "string" && value.includes(TRANSPARENT_LAUNCHER_IMAGE_FILE_KIND);

export const useJourneysCompanionVisual = () => {
  const {
    companion,
    nextEvolutionXP,
    progressToNext,
    canEvolve,
  } = useCompanion();
  const { health } = useCompanionHealth();
  const { care } = useCompanionCareSignals();
  const { pendingEvolutionReveal } = useEvolution();

  const matchingPendingEvolutionReveal = useMemo(
    () => (
      companion &&
      pendingEvolutionReveal?.companionId === companion.id &&
      pendingEvolutionReveal.newStage === companion.current_stage
        ? pendingEvolutionReveal
        : null
    ),
    [companion, pendingEvolutionReveal],
  );
  const { displayCompanion } = useMemo(
    () =>
      deriveCompanionDisplayState({
        companion,
        nextEvolutionXP,
        progressToNext,
        canEvolve,
        pendingEvolutionReveal: matchingPendingEvolutionReveal,
      }),
    [canEvolve, companion, matchingPendingEvolutionReveal, nextEvolutionXP, progressToNext],
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
    const labelCompanion = displayCompanion ?? companion;
    const customName = getStoredCompanionCustomName(labelCompanion);
    if (customName) return customName;

    const cachedName = labelCompanion?.cached_creature_name?.trim();
    if (cachedName) return cachedName;

    const spiritAnimal = labelCompanion?.spirit_animal?.trim();
    if (spiritAnimal) return formatDisplayLabel(spiritAnimal);

    return "Companion";
  }, [companion, displayCompanion]);

  const presetId = displayCompanion?.preset_id ?? null;
  const element = displayCompanion?.core_element ?? null;
  const currentSceneImageUrl = displayCompanion?.current_image_url ?? null;
  const isGeneratedCompanion = isAiGeneratedCompanion(displayCompanion);
  const hasFreshLauncherImage = Boolean(
    isGeneratedCompanion
    && displayCompanion?.launcher_image_url
    && isTransparentLauncherImageUrl(displayCompanion.launcher_image_url)
    && displayCompanion.launcher_image_source_url === currentSceneImageUrl,
  );
  const generatedFallbackLauncherImageUrl = isGeneratedCompanion
    ? currentSceneImageUrl ?? imageUrl ?? null
    : null;
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
      return displayCompanion?.launcher_image_url ?? null;
    }

    return generatedFallbackLauncherImageUrl;
  }, [
    displayCompanion?.launcher_image_url,
    element,
    generatedFallbackLauncherImageUrl,
    hasFreshLauncherImage,
    presetId,
  ]);
  const launcherAwayUsesPortraitShell = useMemo(
    () => (
      getBundledCompanionImageAssetKey(launcherAwayImageUrl) !== null ||
      (isGeneratedCompanion && !hasFreshLauncherImage && Boolean(launcherAwayImageUrl))
    ),
    [hasFreshLauncherImage, isGeneratedCompanion, launcherAwayImageUrl],
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
    launcherAwayFocalX: hasFreshLauncherImage
      ? displayCompanion?.launcher_image_focal_x ?? 0.5
      : launcherAwayImageUrl && launcherAwayImageUrl === generatedFallbackLauncherImageUrl
        ? focalPoint.x ?? 0.5
        : null,
    launcherAwayFocalY: hasFreshLauncherImage
      ? displayCompanion?.launcher_image_focal_y ?? 0.5
      : launcherAwayImageUrl && launcherAwayImageUrl === generatedFallbackLauncherImageUrl
        ? focalPoint.y ?? 0.5
        : null,
    launcherAwayUsesPortraitShell,
    launcherAwayHasTransparentBackground: hasFreshLauncherImage,
    needsLauncherImage,
  };
};
