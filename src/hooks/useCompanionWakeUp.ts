import { useState, useEffect, useRef, useCallback } from 'react';
import { useCompanionCareSignals } from './useCompanionCareSignals';
import { useCompanion } from './useCompanion';

const WAKE_UP_SEEN_KEY = 'companion_wake_up_seen';

interface WakeUpState {
  showCelebration: boolean;
  dismissCelebration: () => void;
  companionName: string;
  companionImageUrl: string;
  dormantImageUrl: string | null;
  bondLevel: number;
}

/**
 * Detects when a companion transitions out of dormancy and triggers a celebration.
 * Tracks the transition state to avoid showing celebration on page reload.
 */
export function useCompanionWakeUp(): WakeUpState {
  const { companion } = useCompanion();
  const { care, isLoading } = useCompanionCareSignals();
  
  const [showCelebration, setShowCelebration] = useState(false);
  const previousDormantRef = useRef<boolean | null>(null);
  const hasInitialized = useRef(false);

  // Check if we've already shown this celebration
  const getSeenKey = useCallback(() => {
    if (!companion?.id) return null;
    return `${WAKE_UP_SEEN_KEY}_${companion.id}`;
  }, [companion?.id]);

  const markAsSeen = useCallback(() => {
    const key = getSeenKey();
    if (key) {
      // Store timestamp to allow future dormancy cycles
      localStorage.setItem(key, Date.now().toString());
    }
  }, [getSeenKey]);

  const hasBeenSeen = useCallback(() => {
    const key = getSeenKey();
    if (!key) return false;
    
    const seenTimestamp = localStorage.getItem(key);
    if (!seenTimestamp) return false;
    
    // If seen within last 24 hours, don't show again
    const seenTime = parseInt(seenTimestamp, 10);
    const hoursSinceSeen = (Date.now() - seenTime) / (1000 * 60 * 60);
    return hoursSinceSeen < 24;
  }, [getSeenKey]);

  // Detect dormancy state changes
  useEffect(() => {
    if (isLoading || !care) return;
    
    const isDormant = care.dormancy.isDormant;
    
    // Skip first render to establish baseline
    if (!hasInitialized.current) {
      previousDormantRef.current = isDormant;
      hasInitialized.current = true;
      return;
    }

    // Check for transition: was dormant, now not dormant
    if (previousDormantRef.current === true && isDormant === false) {
      // Companion just woke up!
      if (!hasBeenSeen()) {
        setShowCelebration(true);
        markAsSeen();
      }
    }

    previousDormantRef.current = isDormant;
  }, [care, isLoading, hasBeenSeen, markAsSeen]);

  const dismissCelebration = useCallback(() => {
    setShowCelebration(false);
  }, []);

  return {
    showCelebration,
    dismissCelebration,
    companionName: companion?.spirit_animal || 'companion',
    companionImageUrl: companion?.current_image_url || '',
    dormantImageUrl: (companion as any)?.dormant_image_url || null,
    bondLevel: care?.bond?.level || 1,
  };
}
