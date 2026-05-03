import { useEffect, useMemo, useRef } from "react";
import { resolveCompanionVisualAssetUrl } from "@/lib/companionAssetResolver";
import { deriveCompanionDisplayState } from "@/lib/companionDisplayState";
import {
  getBundledCompanionImageAssetKey,
  isCompanionPresetImageSource,
} from "@/lib/companionImageFocal";
import { resolveJourneysCompanionLauncherAwayAssetUrl } from "@/lib/journeysCompanionLauncherArt";
import { getStoredCompanionCustomName } from "@/lib/companionName";
import { formatDisplayLabel } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
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

  const presetId = displayCompanion?.preset_id ?? companion?.preset_id ?? null;
  const element = displayCompanion?.core_element ?? companion?.core_element ?? null;
  const launcherAwayImageUrl = useMemo(() => resolveJourneysCompanionLauncherAwayAssetUrl({
    presetId,
    element,
    fallbackUrl: imageUrl,
  }), [element, imageUrl, presetId]);
  const launcherAwayUsesPortraitShell = useMemo(
    () => getBundledCompanionImageAssetKey(launcherAwayImageUrl) !== null,
    [launcherAwayImageUrl],
  );

  // Two-image pipeline: prefer the dedicated white-bg launcher icon for
  // small/icon surfaces, but fall back to the scenic page image until the
  // lazy backfill completes (existing companions pre-dating the migration).
  const launcherImageFresh = Boolean(
    companion?.launcher_image_url
      && (
        !companion?.launcher_image_source_url
        || companion?.launcher_image_source_url === companion?.current_image_url
      ),
  );
  const launcherImageUrl = launcherImageFresh
    ? (companion?.launcher_image_url ?? imageUrl)
    : imageUrl;
  const launcherImageFocalX = launcherImageFresh
    ? (companion?.launcher_image_focal_x ?? 0.5)
    : focalPoint.x;
  const launcherImageFocalY = launcherImageFresh
    ? (companion?.launcher_image_focal_y ?? 0.5)
    : focalPoint.y;

  // Lazy backfill: kick a single fire-and-forget request when the companion
  // has a current portrait but no launcher icon (or a stale one). Result is
  // dropped — the realtime subscription on user_companion will deliver the
  // new launcher_image_url on the next render.
  const launcherBackfillRef = useRef<string | null>(null);
  useEffect(() => {
    if (!companion?.id) return;
    if (!companion.current_image_url) return;
    if (launcherImageFresh) return;
    const key = `${companion.id}:${companion.current_image_url}`;
    if (launcherBackfillRef.current === key) return;
    launcherBackfillRef.current = key;
    void supabase.functions
      .invoke("generate-companion-launcher-image", {
        body: { companionId: companion.id },
      })
      .catch(() => undefined);
  }, [companion?.id, companion?.current_image_url, launcherImageFresh]);

  return {
    companionLabel,
    presetId,
    imageUrl,
    focalX: focalPoint.x,
    focalY: focalPoint.y,
    element,
    usesPortraitShell: isCompanionPresetImageSource(imageUrl),
    launcherAwayImageUrl,
    launcherAwayFocalX: null,
    launcherAwayFocalY: null,
    launcherAwayUsesPortraitShell,
    launcherImageUrl,
    launcherImageFocalX,
    launcherImageFocalY,
    launcherImageFresh,
  };
};
