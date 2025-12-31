import { useState, useEffect, useCallback, useRef } from "react";
import { safeLocalStorage } from "@/utils/storage";

const XP_PER_LEVEL = 500;

interface LevelUpState {
  showLevelUp: boolean;
  newLevel: number;
}

export function calculateLevel(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

export function calculateXPProgress(xp: number): { current: number; needed: number; percent: number } {
  const level = calculateLevel(xp);
  const xpForCurrentLevel = (level - 1) * XP_PER_LEVEL;
  const xpIntoLevel = xp - xpForCurrentLevel;
  
  return {
    current: xpIntoLevel,
    needed: XP_PER_LEVEL,
    percent: (xpIntoLevel / XP_PER_LEVEL) * 100,
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
  const xpProgress = currentXP !== undefined ? calculateXPProgress(currentXP) : { current: 0, needed: XP_PER_LEVEL, percent: 0 };

  return {
    showLevelUp: state.showLevelUp,
    newLevel: state.newLevel,
    currentLevel,
    xpProgress,
    dismissLevelUp,
  };
}
