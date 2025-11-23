/**
 * Companion Evolution Stage Configuration
 * Centralized stage names for consistency across the app
 */

export const STAGE_NAMES: Record<number, string> = {
  0: "Egg",
  1: "Hatchling",
  2: "Sproutling",
  3: "Cub",
  4: "Juvenile",
  5: "Apprentice",
  6: "Scout",
  7: "Fledgling",
  8: "Warrior",
  9: "Guardian",
  10: "Champion",
  11: "Ascended",
  12: "Vanguard",
  13: "Titan",
  14: "Mythic",
  15: "Prime",
  16: "Regal",
  17: "Eternal",
  18: "Transcendent",
  19: "Apex",
  20: "Ultimate",
};

export const getStageName = (stage: number): string => {
  return STAGE_NAMES[stage] || `Stage ${stage}`;
};
