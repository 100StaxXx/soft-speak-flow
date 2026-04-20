import {
  coerceCompanionElementId,
  coerceCompanionPresetId,
} from "@/config/companionCatalog";

const JOURNEYS_COMPANION_LAUNCHER_AWAY_DIR = "companion-launcher-away";
const BUNDLED_JOURNEYS_COMPANION_LAUNCHER_AWAY_PRESETS = new Set([
  "dragon",
  "wolf",
  "fox",
  "owl",
  "lion",
  "phoenix",
  "pegasus",
  "griffin",
  "sphinx",
  "leviathan",
  "mechanicaldragon",
  "tanuki",
  "buttercat",
]);

export const buildJourneysCompanionLauncherAwayAssetPath = ({
  presetId,
  element,
}: {
  presetId: string | null | undefined;
  element: string | null | undefined;
}) => {
  const normalizedPresetId = coerceCompanionPresetId(presetId);
  if (!normalizedPresetId) return null;
  if (!BUNDLED_JOURNEYS_COMPANION_LAUNCHER_AWAY_PRESETS.has(normalizedPresetId)) {
    return null;
  }

  const normalizedElement = coerceCompanionElementId(element);
  return `${JOURNEYS_COMPANION_LAUNCHER_AWAY_DIR}/${normalizedPresetId}/${normalizedPresetId}__launcher-away__${normalizedElement}.png`;
};

export const resolveJourneysCompanionLauncherAwayAssetUrl = ({
  presetId,
  element,
  fallbackUrl = null,
}: {
  presetId: string | null | undefined;
  element: string | null | undefined;
  fallbackUrl?: string | null;
}) => {
  const assetPath = buildJourneysCompanionLauncherAwayAssetPath({
    presetId,
    element,
  });

  return assetPath ? `/${assetPath}` : fallbackUrl;
};
