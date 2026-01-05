import { useState, useEffect, useCallback, useRef } from "react";
import { safeLocalStorage } from "@/utils/storage";
import { LEVEL_THRESHOLDS, getXPForLevel, getXPToNextLevel } from "@/config/xpSystem";

interface LevelUpState {
  showLevelUp: boolean;
  newLevel: number;
}

/**
 * Calculate user level from total XP using threshold-based lookup.
 * Uses exponentially scaling thresholds for progression.
 */
export function calculateLevel(xp: number): number {
  let level = 1;
  const levels = Object.keys(LEVEL_THRESHOLDS)
    .map(Number)
    .sort((a, b) => a - b);
  
  for (const lvl of levels) {
    if (xp >= LEVEL_THRESHOLDS[lvl]) {
      level = lvl;
    } else {
      break;
    }
  }
  return level;
}

/**
 * Calculate XP progress within current level.
 * Returns current XP into level, XP needed for next level, and percentage.
 */
export function calculateXPProgress(xp: number): { current: number; needed: number; percent: number } {
  const level = calculateLevel(xp);
  const currentThreshold = getXPForLevel(level);
  const xpNeeded = getXPToNextLevel(level);
  
  const xpIntoLevel = xp - currentThreshold;
  const percent = xpNeeded > 0 ? (xpIntoLevel / xpNeeded) * 100 : 100;
  
  return {
    current: xpIntoLevel,
    needed: xpNeeded,
    percent: Math.min(percent, 100),
  };
}

export function useLevelUpTracker(currentXP: number | undefined) {
  const [state, setState] = useState<LevelUpState>({
    showLevelUp: false,
    newLevel: 1,
  });
  
  const previousXPRef = useRef<number | undefined>(undefined);
  const lastShownLevelRef = useRef<number>(1);
  
  // Initialize from localStorage
  useEffect(() => {
    const storedLevel = safeLocalStorage.getItem("last_shown_level");
    if (storedLevel) {
      lastShownLevelRef.current = parseInt(storedLevel, 10);
    }
  }, []);

  useEffect(() => {
    if (currentXP === undefined) return;
    
    const currentLevel = calculateLevel(currentXP);
    
    // On first load, just set the reference
    if (previousXPRef.current === undefined) {
      previousXPRef.current = currentXP;
      lastShownLevelRef.current = currentLevel;
      safeLocalStorage.setItem("last_shown_level", currentLevel.toString());
      return;
    }
    
    const previousLevel = calculateLevel(previousXPRef.current);
    
    // Check if level increased
    if (currentLevel > previousLevel && currentLevel > lastShownLevelRef.current) {
      setState({
        showLevelUp: true,
        newLevel: currentLevel,
      });
      
      lastShownLevelRef.current = currentLevel;
      safeLocalStorage.setItem("last_shown_level", currentLevel.toString());
    }
    
    previousXPRef.current = currentXP;
  }, [currentXP]);

  const dismissLevelUp = useCallback(() => {
    setState(prev => ({ ...prev, showLevelUp: false }));
  }, []);

  const currentLevel = currentXP !== undefined ? calculateLevel(currentXP) : 1;
  const xpProgress = currentXP !== undefined ? calculateXPProgress(currentXP) : { current: 0, needed: getXPToNextLevel(1), percent: 0 };

  return {
    showLevelUp: state.showLevelUp,
    newLevel: state.newLevel,
    currentLevel,
    xpProgress,
    dismissLevelUp,
  };
}
