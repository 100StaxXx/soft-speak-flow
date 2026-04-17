import { useState, useEffect, useRef, useCallback } from 'react';
import { useCompanionCareSignals } from './useCompanionCareSignals';
import { useCompanion } from './useCompanion';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { resolveCompanionName } from '@/lib/companionName';
import { resolveCompanionVisualAssetUrl } from '@/lib/companionAssetResolver';
import { useCompanionMotionSafe } from '@/contexts/CompanionMotionContext';

const WAKE_UP_SEEN_KEY = 'companion_wake_up_seen';

interface WakeUpState {
  showCelebration: boolean;
  dismissCelebration: () => void;
  companionName: string;
  companionImageUrl: string;
  companionImageFocalX: number | null;
  companionImageFocalY: number | null;
  dormantImageUrl: string | null;
  dormantImageFocalX: number | null;
  dormantImageFocalY: number | null;
  bondLevel: number;
}

/**
 * Detects when a companion transitions out of dormancy and triggers a celebration.
 * Tracks the transition state to avoid showing celebration on page reload.
 * Also creates a recovery memory when the companion wakes up.
 */
export function useCompanionWakeUp(): WakeUpState {
  const { user } = useAuth();
  const { companion } = useCompanion();
  const { care, isLoading } = useCompanionCareSignals();
  const { triggerEvent } = useCompanionMotionSafe();
  
  const [showCelebration, setShowCelebration] = useState(false);
  const [companionName, setCompanionName] = useState('Companion');
  const previousDormantRef = useRef<boolean | null>(null);
  const hasInitialized = useRef(false);
  const memoryTriggered = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const hydrateCompanionName = async () => {
      if (!companion) {
        if (!cancelled) setCompanionName('Companion');
        return;
      }

      const name = await resolveCompanionName({
        companion,
        fallback: 'companion',
      });

      if (!cancelled) {
        setCompanionName(name);
      }
    };

    void hydrateCompanionName();

    return () => {
      cancelled = true;
    };
  }, [companion?.id, companion?.current_stage, companion?.cached_creature_name, companion?.spirit_animal]);

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
        triggerEvent({
          type: 'wake',
          intensity: 'heroic',
          element: companion?.core_element ?? null,
          stage: companion?.current_stage ?? null,
        });
        
        // Create recovery memory (only once per wake-up)
        if (!memoryTriggered.current && user?.id && companion?.id) {
          memoryTriggered.current = true;
          const today = new Date().toISOString().split('T')[0];
          supabase.from('companion_memories').insert({
            user_id: user.id,
            companion_id: companion.id,
            memory_type: 'recovery',
            memory_date: today,
            memory_context: {
              title: 'Awakening',
              description: 'You came back and brought me out of the darkness. I will never forget.',
              emotion: 'relief',
            },
            referenced_count: 0,
          }).then(({ error }) => {
            if (error) console.error('[WakeUp] Failed to create recovery memory:', error);
          });
        }
      }
    }

    previousDormantRef.current = isDormant;
  }, [
    care,
    isLoading,
    hasBeenSeen,
    markAsSeen,
    user?.id,
    companion?.id,
    companion?.core_element,
    companion?.current_stage,
    triggerEvent,
  ]);

  const dismissCelebration = useCallback(() => {
    setShowCelebration(false);
    // Reset trigger for next dormancy cycle
    memoryTriggered.current = false;
  }, []);

  const resolvedCompanionImageUrl =
    resolveCompanionVisualAssetUrl(companion, 'normal') ?? companion?.current_image_url ?? '';
  const resolvedDormantImageUrl =
    resolveCompanionVisualAssetUrl(companion, 'dormant') ?? companion?.dormant_image_url ?? null;
  const usesStoredCurrentFocal =
    resolvedCompanionImageUrl === (companion?.current_image_url ?? null);
  const usesStoredDormantFocal =
    resolvedDormantImageUrl === (companion?.dormant_image_url ?? null);

  return {
    showCelebration,
    dismissCelebration,
    companionName,
    companionImageUrl: resolvedCompanionImageUrl,
    companionImageFocalX: usesStoredCurrentFocal ? companion?.current_image_focal_x ?? null : null,
    companionImageFocalY: usesStoredCurrentFocal ? companion?.current_image_focal_y ?? null : null,
    dormantImageUrl: resolvedDormantImageUrl,
    dormantImageFocalX: usesStoredDormantFocal ? companion?.dormant_image_focal_x ?? null : null,
    dormantImageFocalY: usesStoredDormantFocal ? companion?.dormant_image_focal_y ?? null : null,
    bondLevel: care?.bond?.level || 1,
  };
}
