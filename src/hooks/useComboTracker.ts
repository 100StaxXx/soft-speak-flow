import { useState, useCallback, useRef, useEffect } from "react";
import { playXPGain } from "@/utils/soundEffects";
import { haptics } from "@/utils/haptics";

interface ComboState {
  count: number;
  show: boolean;
  bonusXP: number;
  maxCombo: number;
}

type ComboTier = "normal" | "ultra" | "legendary";

const COMBO_WINDOW_MS = 60000; // 60 seconds to maintain combo
const COMBO_BONUS_BASE = 5; // Base bonus XP per combo level
const ULTRA_MULTIPLIER = 1.5; // Ultra combo XP multiplier (5x+)
const LEGENDARY_MULTIPLIER = 2; // Legendary combo XP multiplier (10x+)

function getComboTier(count: number): ComboTier {
  if (count >= 10) return "legendary";
  if (count >= 5) return "ultra";
  return "normal";
}

function calculateBonusXP(count: number): number {
  if (count < 2) return 0;
  
  const tier = getComboTier(count);
  const baseBonus = (count - 1) * COMBO_BONUS_BASE;
  
  if (tier === "legendary") {
    return Math.round(baseBonus * LEGENDARY_MULTIPLIER);
  }
  if (tier === "ultra") {
    return Math.round(baseBonus * ULTRA_MULTIPLIER);
  }
  return baseBonus;
}

export function useComboTracker() {
  const [combo, setCombo] = useState<ComboState>({ 
    count: 0, 
    show: false, 
    bonusXP: 0,
    maxCombo: 0
  });
  const lastCompletionRef = useRef<number>(0);
  const comboTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (comboTimeoutRef.current) clearTimeout(comboTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  const recordCompletion = useCallback(() => {
    const now = Date.now();
    const timeSinceLastCompletion = now - lastCompletionRef.current;
    
    // Clear any existing timeouts
    if (comboTimeoutRef.current) clearTimeout(comboTimeoutRef.current);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    
    let newCount = 1;
    
    // Check if within combo window
    if (timeSinceLastCompletion <= COMBO_WINDOW_MS && lastCompletionRef.current > 0) {
      newCount = combo.count + 1;
      
      // Play combo sound and haptic for combos 2+
      if (newCount >= 2) {
        playXPGain();
        haptics.success();
      }
    }
    
    lastCompletionRef.current = now;
    
    const bonusXP = calculateBonusXP(newCount);
    const tier = getComboTier(newCount);
    
    // Longer display time for higher tiers
    const displayDuration = tier === "legendary" ? 4000 : tier === "ultra" ? 3500 : 2500;
    
    setCombo(prev => ({
      count: newCount,
      show: newCount >= 2,
      bonusXP,
      maxCombo: Math.max(prev.maxCombo, newCount),
    }));
    
    // Auto-hide combo display
    hideTimeoutRef.current = setTimeout(() => {
      setCombo(prev => ({ ...prev, show: false }));
    }, displayDuration);
    
    // Reset combo if no completion within window
    comboTimeoutRef.current = setTimeout(() => {
      setCombo(prev => ({ 
        count: 0, 
        show: false, 
        bonusXP: 0,
        maxCombo: prev.maxCombo // Keep max combo for session
      }));
    }, COMBO_WINDOW_MS);
    
    return bonusXP;
  }, [combo.count]);

  const resetCombo = useCallback(() => {
    if (comboTimeoutRef.current) clearTimeout(comboTimeoutRef.current);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    setCombo({ count: 0, show: false, bonusXP: 0, maxCombo: 0 });
    lastCompletionRef.current = 0;
  }, []);

  const comboTier = getComboTier(combo.count);

  return {
    comboCount: combo.count,
    showCombo: combo.show,
    bonusXP: combo.bonusXP,
    maxCombo: combo.maxCombo,
    comboTier,
    recordCompletion,
    resetCombo,
  };
}
