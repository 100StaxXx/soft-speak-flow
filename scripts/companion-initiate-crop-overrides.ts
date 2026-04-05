import type { CompanionElementId, CompanionPresetId } from "@/config/companionCatalog";

export interface InitiateSourceBoundsOverride {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type InitiateCropOverrideKey = `${CompanionPresetId}:${CompanionElementId}`;

export function buildInitiateCropOverrideKey(
  presetId: CompanionPresetId,
  elementId: CompanionElementId,
): InitiateCropOverrideKey {
  return `${presetId}:${elementId}`;
}

// These are intentionally sparse. Most panels should be handled automatically by
// the initiate crop detector; only crowded edge cases need manual bounds.
export const INITIATE_SOURCE_BOUNDS_OVERRIDES: Partial<
  Record<InitiateCropOverrideKey, InitiateSourceBoundsOverride>
> = {
  "sphinx:void": {
    left: 690,
    top: 1040,
    width: 610,
    height: 700,
  },
  "sphinx:light": {
    left: 1360,
    top: 1040,
    width: 620,
    height: 920,
  },
};
