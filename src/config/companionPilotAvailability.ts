import {
  COMPANION_ELEMENTS,
  COMPANION_PRESETS,
  type CompanionElementId,
  type CompanionPresetId,
} from "./companionCatalog";

export const COMPANION_FUTURE_STATE_LABEL = "Coming Soon" as const;

export const PILOT_COMPANION_PRESET_IDS = COMPANION_PRESETS.map(
  (preset) => preset.id,
) as readonly CompanionPresetId[];

export const PILOT_COMPANION_ELEMENT_IDS = COMPANION_ELEMENTS.map(
  (element) => element.id,
) as readonly CompanionElementId[];

export const isPilotCompanionPreset = (
  presetId: CompanionPresetId | string | null | undefined,
): presetId is CompanionPresetId => (
  typeof presetId === "string"
  && (PILOT_COMPANION_PRESET_IDS as readonly string[]).includes(presetId)
);

export const isPilotCompanionElement = (
  elementId: CompanionElementId | string | null | undefined,
): elementId is CompanionElementId => (
  typeof elementId === "string"
  && (PILOT_COMPANION_ELEMENT_IDS as readonly string[]).includes(elementId)
);

export const getDefaultPilotCompanionPresetId = (): CompanionPresetId => "fox";

export const getDefaultPilotCompanionElementId = (): CompanionElementId => "fire";
