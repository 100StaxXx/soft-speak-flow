import type { CompanionElementId, CompanionPresetId } from "./companionCatalog";

export const COMPANION_FUTURE_STATE_LABEL = "Coming Soon" as const;

export const PILOT_COMPANION_PRESET_IDS = [
  "fox",
  "phoenix",
  "leviathan",
] as const satisfies readonly CompanionPresetId[];

export const PILOT_COMPANION_ELEMENT_IDS = [
  "fire",
  "ice",
  "nature",
] as const satisfies readonly CompanionElementId[];

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

export const getDefaultPilotCompanionPresetId = (): CompanionPresetId =>
  PILOT_COMPANION_PRESET_IDS[0];

export const getDefaultPilotCompanionElementId = (): CompanionElementId =>
  PILOT_COMPANION_ELEMENT_IDS[0];
