import type { CompanionElementId, CompanionPresetId } from "./companionCatalog";
import { isPilotCompanionElement, isPilotCompanionPreset } from "./companionPilotAvailability";

const COMPANION_HATCH_VIDEO_DIR = "/companion-hatch-videos";

const HATCH_VIDEO_MAP = {
  fox: {
    fire: `${COMPANION_HATCH_VIDEO_DIR}/hatch__fox__fire__center-crop.mp4`,
    ice: `${COMPANION_HATCH_VIDEO_DIR}/hatch__fox__ice.mp4`,
    nature: `${COMPANION_HATCH_VIDEO_DIR}/hatch__fox__nature.mp4`,
  },
  phoenix: {
    fire: `${COMPANION_HATCH_VIDEO_DIR}/hatch__phoenix__fire.mp4`,
    ice: `${COMPANION_HATCH_VIDEO_DIR}/hatch__phoenix__ice.mp4`,
    nature: `${COMPANION_HATCH_VIDEO_DIR}/hatch__phoenix__nature.mp4`,
  },
  leviathan: {
    fire: `${COMPANION_HATCH_VIDEO_DIR}/hatch__leviathan__fire.mp4`,
    ice: `${COMPANION_HATCH_VIDEO_DIR}/hatch__leviathan__ice.mp4`,
    nature: `${COMPANION_HATCH_VIDEO_DIR}/hatch__leviathan__nature.mp4`,
  },
} as const satisfies Partial<Record<CompanionPresetId, Partial<Record<CompanionElementId, string>>>>;

// Retain the legacy clips for archival compatibility, but never select them:
// their encoded endpoints do not exactly match the current egg and infant art.
// Both Graceward and supported Cosmiq transitions use the generated two-image
// animation path instead.
export const LEGACY_STATIC_HATCH_VIDEOS_ENABLED = false;

export const getCompanionHatchVideoUrl = ({
  presetId,
  element,
}: {
  presetId: CompanionPresetId | string | null | undefined;
  element: CompanionElementId | string | null | undefined;
}): string | null => {
  if (!LEGACY_STATIC_HATCH_VIDEOS_ENABLED) return null;

  if (!isPilotCompanionPreset(presetId) || !isPilotCompanionElement(element)) {
    return null;
  }

  return HATCH_VIDEO_MAP[presetId]?.[element] ?? null;
};
