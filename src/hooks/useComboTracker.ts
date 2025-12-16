import { useState, useCallback, useRef, useEffect } from "react";
import { playXPGain } from "@/utils/soundEffects";
import { haptics } from "@/utils/haptics";

interface ComboState {
  count: number;
  show: boolean;
  bonusXP: number;
}

const COMBO_WINDOW_MS = 60000; // 60 seconds to maintain combo
const COMBO_BONUS_BASE = 5; // Base bonus XP per combo level

export function useComboTracker() {
  const [combo, setCombo] = useState<ComboState>({ count: 0, show: false, bonusXP: 0 });
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
    
    const bonusXP = newCount >= 2 ? (newCount - 1) * COMBO_BONUS_BASE : 0;
    
    setCombo({
      count: newCount,
      show: newCount >= 2,
      bonusXP,
    });
    
    // Auto-hide combo display after 2.5 seconds
    hideTimeoutRef.current = setTimeout(() => {
      setCombo(prev => ({ ...prev, show: false }));
    }, 2500);
    
    // Reset combo if no completion within window
    comboTimeoutRef.current = setTimeout(() => {
      setCombo({ count: 0, show: false, bonusXP: 0 });
    }, COMBO_WINDOW_MS);
    
    return bonusXP;
  }, [combo.count]);

  const resetCombo = useCallback(() => {
    if (comboTimeoutRef.current) clearTimeout(comboTimeoutRef.current);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    setCombo({ count: 0, show: false, bonusXP: 0 });
    lastCompletionRef.current = 0;
  }, []);

  return {
    comboCount: combo.count,
    showCombo: combo.show,
    bonusXP: combo.bonusXP,
    recordCompletion,
    resetCombo,
  };
}
