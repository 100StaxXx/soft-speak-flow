import { COMPANION_STAGE_NAMES, getCompanionStageName } from "./companionCatalog";

/**
 * Companion progression labels.
 * This preserves the older stage-oriented import surface while the app migrates
 * toward level + tier naming everywhere user-facing.
 */
export const STAGE_NAMES: Record<number, string> = { ...COMPANION_STAGE_NAMES };

export const getStageName = (stage: number): string => getCompanionStageName(stage);
