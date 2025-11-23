/**
 * Companion Evolution Stage Configuration
 * Centralized stage names for consistency across the app
 */

export const STAGE_NAMES: Record<number, string> = {
  0: "Egg",
  1: "Hatchling",
  2: "Guardian",
  3: "Ascended",
  4: "Mythic",
  5: "Titan",
  6: "Stage 6",
  7: "Stage 7",
  8: "Stage 8",
  9: "Stage 9",
  10: "Stage 10",
  11: "Stage 11",
  12: "Stage 12",
  13: "Stage 13",
  14: "Stage 14",
  15: "Stage 15",
  16: "Stage 16",
  17: "Stage 17",
  18: "Stage 18",
  19: "Stage 19",
  20: "Ultimate",
};

export const getStageName = (stage: number): string => {
  return STAGE_NAMES[stage] || `Stage ${stage}`;
};
