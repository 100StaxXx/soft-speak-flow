import type { CompanionElementId, CompanionPresetId } from "./companionCatalog";
import type { ChristianCompanionForm } from "./christianCompanionForms";
import {
  COSMIQ_CANONICAL_ELEMENTS,
  COSMIQ_CANONICAL_SPECIES,
} from "./cosmiqCanonicalCompanionAssets";

export const COMPANION_FUTURE_STATE_LABEL = "Coming Soon" as const;
export const COMPANION_LEGACY_STATE_LABEL = "Legacy" as const;

// Graceward's complete Level 1-5 premade motion library covers every symbolic
// species and elemental treatment shown by its companion picker.
export const PILOT_CHRISTIAN_COMPANION_FORM_IDS = [
  "lamb",
  "lion",
  "stag",
  "dove",
  "eagle",
  "wolf",
] as const satisfies readonly ChristianCompanionForm["id"][];

export const PILOT_CHRISTIAN_COMPANION_ELEMENT_IDS = [
  "fire",
  "ice",
  "storm",
  "nature",
  "void",
  "light",
] as const satisfies readonly CompanionElementId[];

// Cosmiq's wider catalog remains installed for existing accounts, but only the
// fully built 3x3 matrix may be chosen on a Cosmiq selection surface.
export const PILOT_COMPANION_PRESET_IDS = COSMIQ_CANONICAL_SPECIES satisfies readonly CompanionPresetId[];
export const PILOT_COMPANION_ELEMENT_IDS = COSMIQ_CANONICAL_ELEMENTS satisfies readonly CompanionElementId[];

export const isPilotChristianCompanionForm = (
  formId: ChristianCompanionForm["id"] | string | null | undefined,
): formId is ChristianCompanionForm["id"] => (
  typeof formId === "string"
  && (PILOT_CHRISTIAN_COMPANION_FORM_IDS as readonly string[]).includes(formId)
);

export const isPilotChristianCompanionElement = (
  elementId: CompanionElementId | string | null | undefined,
): elementId is CompanionElementId => (
  typeof elementId === "string"
  && (PILOT_CHRISTIAN_COMPANION_ELEMENT_IDS as readonly string[]).includes(elementId)
);

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

export const getDefaultGracewardCompanionElementId = (): CompanionElementId => "light";
