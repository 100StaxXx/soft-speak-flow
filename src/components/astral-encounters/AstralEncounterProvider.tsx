import { useEffect, useCallback, useState, useRef } from 'react';
import { useAstralEncounters } from '@/hooks/useAstralEncounters';
import { useEncounterTrigger } from '@/hooks/useEncounterTrigger';
import { AstralEncounterModal } from './AstralEncounterModal';
import { AstralEncounterTriggerOverlay } from './AstralEncounterTriggerOverlay';
import { AdversaryTier, TriggerType } from '@/types/astralEncounters';
import { useEvolution } from '@/contexts/EvolutionContext';

interface QueuedEncounter {
  triggerType: TriggerType;
  sourceId?: string;
  epicProgress?: number;
  epicCategory?: string;
  questInterval?: number;
}

interface AstralEncounterProviderProps {
  children: React.ReactNode;
}

interface EpicCheckpointEventDetail {
  epicId: string;
  previousProgress: number;
  currentProgress: number;
}

export const AstralEncounterProvider = ({ children }: AstralEncounterProviderProps) => {
  const [showTriggerOverlay, setShowTriggerOverlay] = useState(false);
  const [pendingTier, setPendingTier] = useState<AdversaryTier>('common');
  const [queuedEncounter, setQueuedEncounter] = useState<QueuedEncounter | null>(null);
  const isEvolutionActiveRef = useRef(false);

  const { isEvolvingLoading } = useEvolution();

  const {
    activeEncounter,
    showEncounterModal,
    setShowEncounterModal,
    checkEncounterTrigger,
    completeEncounter,
    closeEncounter,
  } = useAstralEncounters();

  const { checkQuestMilestone, checkWeeklyTrigger, checkEpicCheckpoint } = useEncounterTrigger();

  // Track evolution state in ref for immediate access
  useEffect(() => {
    isEvolutionActiveRef.current = isEvolvingLoading;
    console.log('[AstralEncounterProvider] Evolution active:', isEvolvingLoading);
  }, [isEvolvingLoading]);

  // Process queued encounter when evolution modal closes
  useEffect(() => {
    const handleEvolutionClosed = () => {
      console.log('[AstralEncounterProvider] Evolution modal closed, checking queue');
      // Add small delay to ensure evolution cleanup is complete
      setTimeout(() => {
        if (queuedEncounter) {
          console.log('[AstralEncounterProvider] Processing queued encounter:', queuedEncounter.triggerType);
          const { triggerType, sourceId, epicProgress, epicCategory, questInterval } = queuedEncounter;
          setQueuedEncounter(null);
          checkEncounterTrigger(triggerType, sourceId, epicProgress, epicCategory, questInterval);
        }
      }, 500);
    };

    window.addEventListener('evolution-modal-closed', handleEvolutionClosed);
    return () => window.removeEventListener('evolution-modal-closed', handleEvolutionClosed);
  }, [queuedEncounter, checkEncounterTrigger]);

  // Wrap checkEncounterTrigger to show overlay first (and queue if evolution active)
  const triggerEncounterWithOverlay = useCallback(async (
    triggerType: TriggerType,
    sourceId?: string,
    epicProgress?: number,
    epicCategory?: string,
    questInterval?: number
  ) => {
    // If evolution is active, queue the encounter
    if (isEvolutionActiveRef.current) {
      console.log('[AstralEncounterProvider] Evolution in progress, queueing encounter:', triggerType);
      setQueuedEncounter({ triggerType, sourceId, epicProgress, epicCategory, questInterval });
      return;
    }
    // Start by triggering the encounter logic (which generates the adversary)
    await checkEncounterTrigger(triggerType, sourceId, epicProgress, epicCategory, questInterval);
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

  // Listen for quest completion events
  const handleQuestCompleted = useCallback(async () => {
    const result = await checkQuestMilestone();
    if (result.shouldTrigger && result.triggerType) {
      triggerEncounterWithOverlay(
        result.triggerType,
        result.sourceId,
        result.epicProgress,
        result.epicCategory,
        result.questInterval
      );
    }
  }, [checkQuestMilestone, triggerEncounterWithOverlay]);

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

  const handleEpicCheckpointEvent = useCallback(
    async (event: CustomEvent<EpicCheckpointEventDetail>) => {
      if (!event.detail) return;
      const { epicId, previousProgress, currentProgress } = event.detail;
      const result = await checkEpicCheckpoint(epicId, previousProgress, currentProgress);
      if (result.shouldTrigger && result.triggerType) {
        triggerEncounterWithOverlay(
          result.triggerType,
          result.sourceId,
          result.epicProgress,
          result.epicCategory
        );
      }
    },
    [checkEpicCheckpoint, triggerEncounterWithOverlay]
  );

  useEffect(() => {
    const listener = (event: Event) =>
      handleEpicCheckpointEvent(event as CustomEvent<EpicCheckpointEventDetail>);
    window.addEventListener('epic-progress-checkpoint', listener as EventListener);
    return () => window.removeEventListener('epic-progress-checkpoint', listener as EventListener);
  }, [handleEpicCheckpointEvent]);

  const handleComplete = useCallback((params: {
    encounterId: string;
    accuracy: number;
    phasesCompleted: number;
  }) => {
    completeEncounter(params);
  }, [completeEncounter]);

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
      />
    </>
  );
};
