import { useEffect, useCallback, useState, useRef } from 'react';
import { useAstralEncounters } from '@/hooks/useAstralEncounters';
import { useEncounterTrigger, ActivityType } from '@/hooks/useEncounterTrigger';
import { useEncounterPasses } from '@/hooks/useEncounterPasses';
import { AstralEncounterModal } from './AstralEncounterModal';
import { AstralEncounterTriggerOverlay } from './AstralEncounterTriggerOverlay';
import { DisableEncountersDialog } from './DisableEncountersDialog';
import { AdversaryTier, TriggerType } from '@/types/astralEncounters';
import { useEvolution } from '@/contexts/EvolutionContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface QueuedEncounter {
  triggerType: TriggerType;
  sourceId?: string;
  epicProgress?: number;
  epicCategory?: string;
  activityInterval?: number;
}

interface AstralEncounterProviderProps {
  children: React.ReactNode;
}

interface EpicCheckinEventDetail {
  epicId: string;
  previousProgress?: number;  // Not used but included for compatibility
  currentProgress?: number;
}

export const AstralEncounterProvider = ({ children }: AstralEncounterProviderProps) => {
  const [showTriggerOverlay, setShowTriggerOverlay] = useState(false);
  const [pendingTier, setPendingTier] = useState<AdversaryTier>('common');
  const [queuedEncounter, setQueuedEncounter] = useState<QueuedEncounter | null>(null);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const isEvolutionActiveRef = useRef(false);

  const { user } = useAuth();
  const { isEvolvingLoading } = useEvolution();
  const { passCount, recordPass, shouldPromptDisable } = useEncounterPasses();

  const {
    activeEncounter,
    showEncounterModal,
    setShowEncounterModal,
    checkEncounterTrigger,
    completeEncounter,
    closeEncounter,
    passEncounter,
  } = useAstralEncounters();

  const { checkActivityMilestone, checkWeeklyTrigger } = useEncounterTrigger();

  // Track evolution state in ref for immediate access
  useEffect(() => {
    isEvolutionActiveRef.current = isEvolvingLoading;
    console.log('[AstralEncounterProvider] Evolution active:', isEvolvingLoading);
  }, [isEvolvingLoading]);

  // Use ref to access queued encounter in event handler without stale closure
  const queuedEncounterRef = useRef<QueuedEncounter | null>(null);
  useEffect(() => {
    queuedEncounterRef.current = queuedEncounter;
  }, [queuedEncounter]);

  // Process queued encounter when evolution modal closes
  useEffect(() => {
    const handleEvolutionClosed = () => {
      console.log('[AstralEncounterProvider] Evolution modal closed, checking queue');
      // Add small delay to ensure evolution cleanup is complete
      setTimeout(() => {
        const pending = queuedEncounterRef.current;
        if (pending) {
          console.log('[AstralEncounterProvider] Processing queued encounter:', pending.triggerType);
          const { triggerType, sourceId, epicProgress, epicCategory, activityInterval } = pending;
          setQueuedEncounter(null);
          checkEncounterTrigger(triggerType, sourceId, epicProgress, epicCategory, activityInterval);
        }
      }, 500);
    };

    window.addEventListener('evolution-modal-closed', handleEvolutionClosed);
    return () => window.removeEventListener('evolution-modal-closed', handleEvolutionClosed);
  }, [checkEncounterTrigger]);

  // Wrap checkEncounterTrigger to show overlay first (and queue if evolution active)
  const triggerEncounterWithOverlay = useCallback(async (
    triggerType: TriggerType,
    sourceId?: string,
    epicProgress?: number,
    epicCategory?: string,
    activityInterval?: number
  ) => {
    // If evolution is active, queue the encounter
    if (isEvolutionActiveRef.current) {
      console.log('[AstralEncounterProvider] Evolution in progress, queueing encounter:', triggerType);
      setQueuedEncounter({ triggerType, sourceId, epicProgress, epicCategory, activityInterval });
      return;
    }
    // Start by triggering the encounter logic (which generates the adversary)
    await checkEncounterTrigger(triggerType, sourceId, epicProgress, epicCategory, activityInterval);
  }, [checkEncounterTrigger]);

  // Watch for activeEncounter changes to show overlay
  useEffect(() => {
    if (activeEncounter?.adversary && !showEncounterModal) {
      // Set the tier for the overlay
      setPendingTier(activeEncounter.adversary.tier as AdversaryTier);
      // Show the trigger overlay
      setShowTriggerOverlay(true);
    }
  }, [activeEncounter, showEncounterModal]);

  const handleTriggerOverlayComplete = useCallback(() => {
    setShowTriggerOverlay(false);
    // Now show the actual encounter modal
    setShowEncounterModal(true);
  }, [setShowEncounterModal]);

  const handleModalOpenChange = useCallback((open: boolean) => {
    if (!open) {
      closeEncounter();
      return;
    }

    setShowEncounterModal(true);
  }, [closeEncounter, setShowEncounterModal]);

  // Unified handler for activity milestones (quests + epic check-ins)
  const handleActivityCompleted = useCallback(async (
    activityType: ActivityType,
    epicId?: string,
    epicProgress?: number
  ) => {
    console.log('[AstralEncounterProvider] Activity completed:', activityType, epicId);
    const result = await checkActivityMilestone(activityType, epicId, epicProgress);
    if (result.shouldTrigger && result.triggerType) {
      triggerEncounterWithOverlay(
        result.triggerType,
        result.sourceId,
        result.epicProgress,
        result.epicCategory,
        result.activityInterval
      );
    }
  }, [checkActivityMilestone, triggerEncounterWithOverlay]);

  // Listen for quest completion events
  const handleQuestCompleted = useCallback(async () => {
    await handleActivityCompleted('quest');
  }, [handleActivityCompleted]);

  // Listen for epic check-in events (any progress update counts as +1 activity)
  const handleEpicCheckin = useCallback(
    async (event: CustomEvent<EpicCheckinEventDetail>) => {
      if (!event.detail) return;
      const { epicId, currentProgress } = event.detail;
      await handleActivityCompleted('epic_checkin', epicId, currentProgress);
    },
    [handleActivityCompleted]
  );

  // Check for weekly trigger on mount
  useEffect(() => {
    const checkWeekly = async () => {
      const result = await checkWeeklyTrigger();
      if (result.shouldTrigger && result.triggerType) {
        // Delay slightly to avoid immediate popup on app load
        setTimeout(() => {
          triggerEncounterWithOverlay(result.triggerType!);
        }, 3000);
      }
    };
    checkWeekly();
  }, [checkWeeklyTrigger, triggerEncounterWithOverlay]);

  // Listen for quest-completed events
  useEffect(() => {
    window.addEventListener('quest-completed', handleQuestCompleted);
    return () => window.removeEventListener('quest-completed', handleQuestCompleted);
  }, [handleQuestCompleted]);

  // Listen for epic check-in events (replaces old epic-progress-checkpoint)
  useEffect(() => {
    const listener = (event: Event) =>
      handleEpicCheckin(event as CustomEvent<EpicCheckinEventDetail>);
    window.addEventListener('epic-progress-checkpoint', listener as EventListener);
    return () => window.removeEventListener('epic-progress-checkpoint', listener as EventListener);
  }, [handleEpicCheckin]);

  const handleComplete = useCallback((params: {
    encounterId: string;
    accuracy: number;
    phasesCompleted: number;
  }) => {
    completeEncounter(params);
  }, [completeEncounter]);

  // Handle passing on an encounter
  const handlePass = useCallback(async () => {
    const newCount = recordPass();
    await passEncounter();
    
    // After the 3rd pass, show the disable prompt
    if (newCount >= 3) {
      setShowDisableDialog(true);
    }
  }, [recordPass, passEncounter]);

  // Handle disabling encounters via profile setting
  const handleDisableEncounters = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      await supabase
        .from('profiles')
        .update({ astral_encounters_enabled: false })
        .eq('id', user.id);
      
      setShowDisableDialog(false);
      toast.success('Astral Encounters disabled. Re-enable in Profile settings.');
    } catch (error) {
      console.error('Failed to disable encounters:', error);
      toast.error('Failed to disable encounters');
    }
  }, [user?.id]);

  const handleKeepEncountersOn = useCallback(() => {
    setShowDisableDialog(false);
  }, []);

  return (
    <>
      {children}
      
      {/* Epic trigger animation overlay */}
      <AstralEncounterTriggerOverlay
        isVisible={showTriggerOverlay}
        tier={pendingTier}
        onComplete={handleTriggerOverlayComplete}
      />

      {/* Main encounter modal */}
      <AstralEncounterModal
        open={showEncounterModal}
        onOpenChange={handleModalOpenChange}
        encounter={activeEncounter?.encounter || null}
        adversary={activeEncounter?.adversary || null}
        questInterval={activeEncounter?.questInterval}
        onComplete={handleComplete}
        onPass={handlePass}
      />

      {/* Disable encounters prompt */}
      <DisableEncountersDialog
        open={showDisableDialog}
        onDisable={handleDisableEncounters}
        onKeepOn={handleKeepEncountersOn}
        passCount={passCount}
      />
    </>
  );
};
