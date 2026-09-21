import { useMemo } from "react";
import {
  getUniversalEggCutoutAssetUrl,
  resolveCompanionVisualAssetUrl,
} from "@/lib/companionAssetResolver";
import { deriveCompanionDisplayState } from "@/lib/companionDisplayState";
import {
  getBundledCompanionImageAssetKey,
  isCompanionSceneImageSource,
} from "@/lib/companionImageFocal";
import { resolveJourneysCompanionLauncherAwayAssetUrl } from "@/lib/journeysCompanionLauncherArt";
import { resolveCompanionDisplayLabel } from "@/lib/companionDisplayLabel";
import { isAiGeneratedCompanion } from "@/lib/companionPredicates";
import { useEvolution } from "@/contexts/EvolutionContext";
import { useCompanion } from "./useCompanion";
import { useCompanionHealth } from "./useCompanionHealth";

const COMPANION_PLACEHOLDER = "/placeholder-companion.svg";
const TRANSPARENT_LAUNCHER_IMAGE_MARKER = "_launcher_validated_transparent_stage";

const isTransparentLauncherImageUrl = (value?: string | null): value is string =>
  typeof value === "string" && value.includes(TRANSPARENT_LAUNCHER_IMAGE_MARKER);

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

  const imageUrl = useMemo(() => {
    if (!displayCompanion) {
      return health.imageUrl ?? companion?.current_image_url ?? COMPANION_PLACEHOLDER;
    }

    return resolveCompanionVisualAssetUrl(displayCompanion, "normal") ?? COMPANION_PLACEHOLDER;
  }, [
    companion?.current_image_url,
    displayCompanion,
    health.imageUrl,
  ]);

  const focalPoint = useMemo(() => {
    if (!displayCompanion) {
      return {
        x: health.imageFocalX ?? companion?.current_image_focal_x ?? null,
        y: health.imageFocalY ?? companion?.current_image_focal_y ?? null,
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
  ]);

  const companionLabel = useMemo(() => {
    const labelCompanion = displayCompanion ?? companion;
    return resolveCompanionDisplayLabel(labelCompanion);
  }, [companion, displayCompanion]);

  const presetId = displayCompanion?.preset_id ?? null;
  const element = displayCompanion?.core_element ?? null;
  const currentStage = displayCompanion?.current_stage ?? companion?.current_stage ?? null;
  const currentSceneImageUrl = displayCompanion?.current_image_url ?? null;
  const isGeneratedCompanion = isAiGeneratedCompanion(displayCompanion);
  const isStageZeroCompanion = typeof currentStage === "number" && currentStage <= 0;
  const stageZeroEggLauncherImageUrl =
    isStageZeroCompanion
      ? getUniversalEggCutoutAssetUrl(element ?? "fire")
      : null;
  const hasRemoteCurrentSceneImage = isRemoteImageUrl(currentSceneImageUrl);
  const storedLauncherImageUrl = displayCompanion?.launcher_image_url ?? null;
  const storedLauncherImageSourceUrl = displayCompanion?.launcher_image_source_url ?? null;
  const generatedLauncherImageUrl = !isStageZeroCompanion
    && hasRemoteCurrentSceneImage
    && isTransparentLauncherImageUrl(storedLauncherImageUrl)
    && storedLauncherImageSourceUrl === currentSceneImageUrl
    ? storedLauncherImageUrl
    : null;
  const launcherAwayImageUrl = useMemo(() => {
    if (stageZeroEggLauncherImageUrl) {
      return stageZeroEggLauncherImageUrl;
    }

    if (generatedLauncherImageUrl) {
      return generatedLauncherImageUrl;
    }

    const bundledLauncherUrl = resolveJourneysCompanionLauncherAwayAssetUrl({
      presetId,
      element,
      fallbackUrl: null,
    });

    if (bundledLauncherUrl) {
      return bundledLauncherUrl;
    }
    return null;
  }, [element, generatedLauncherImageUrl, presetId, stageZeroEggLauncherImageUrl]);
  const launcherAwayUsesPortraitShell = useMemo(
    () => (
      getBundledCompanionImageAssetKey(launcherAwayImageUrl) !== null
    ),
    [launcherAwayImageUrl],
  );
  const launcherAwayHasTransparentBackground = Boolean(
    (stageZeroEggLauncherImageUrl && launcherAwayImageUrl === stageZeroEggLauncherImageUrl)
    || (generatedLauncherImageUrl && launcherAwayImageUrl === generatedLauncherImageUrl),
  );

  return {
    companionId: companion?.id ?? null,
    companionLabel,
    favoriteColor: displayCompanion?.favorite_color ?? companion?.favorite_color ?? null,
    currentStage,
    presetId,
    imageUrl,
    focalX: focalPoint.x,
    focalY: focalPoint.y,
    element,
    usesPortraitShell: isCompanionSceneImageSource(imageUrl),
    isGeneratedCompanion,
    currentSceneImageUrl,
    launcherAwayImageUrl,
    launcherAwayFocalX:
      launcherAwayImageUrl && launcherAwayImageUrl === generatedLauncherImageUrl
        ? displayCompanion?.launcher_image_focal_x ?? 0.5
        : null,
    launcherAwayFocalY:
      launcherAwayImageUrl && launcherAwayImageUrl === generatedLauncherImageUrl
        ? displayCompanion?.launcher_image_focal_y ?? 0.5
        : null,
    launcherAwayUsesPortraitShell,
    launcherAwayHasTransparentBackground,
    needsLauncherImage:
      !isStageZeroCompanion
      && hasRemoteCurrentSceneImage
      && !launcherAwayHasTransparentBackground
      && Boolean(currentSceneImageUrl),
  };
};
