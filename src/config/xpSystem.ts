import {
  PROGRESSION_LEVEL_CAP,
  PROGRESSION_XP_THRESHOLDS,
  getNextProgressionLevelXp,
  getProgressionThreshold,
} from "./progression";

/**
 * Unified companion progression system.
 *
 * This file keeps the older xpSystem import surface intact while the rest of the
 * app migrates from separate "level" and "evolution" concepts to one shared
 * Level 0-100 ladder.
 */

export const EVOLUTION_THRESHOLDS: Record<number, number> = { ...PROGRESSION_XP_THRESHOLDS };
export const LEVEL_THRESHOLDS: Record<number, number> = { ...PROGRESSION_XP_THRESHOLDS };
export const MAX_LEVEL = PROGRESSION_LEVEL_CAP;

export function getXPForLevel(level: number): number {
  return getProgressionThreshold(level) ?? (getProgressionThreshold(PROGRESSION_LEVEL_CAP) ?? 0);
}

export function getXPToNextLevel(currentLevel: number): number {
  const current = getXPForLevel(currentLevel);
  const next = getNextProgressionLevelXp(currentLevel) ?? current;
  return Math.max(0, next - current);
}

export const XP_SYSTEM_DOCS = {
  note: "See the unified progression helpers in @/config/progression.ts",
} as const;
