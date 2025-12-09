import { useEffect, useCallback, useState } from 'react';
import { useAstralEncounters } from '@/hooks/useAstralEncounters';
import { useEncounterTrigger } from '@/hooks/useEncounterTrigger';
import { AstralEncounterModal } from './AstralEncounterModal';
import { AstralEncounterTriggerOverlay } from './AstralEncounterTriggerOverlay';
import { AdversaryTier, TriggerType } from '@/types/astralEncounters';

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

  const {
    activeEncounter,
    showEncounterModal,
    setShowEncounterModal,
    checkEncounterTrigger,
    completeEncounter,
  } = useAstralEncounters();

  const { checkQuestMilestone, checkWeeklyTrigger, checkEpicCheckpoint } = useEncounterTrigger();

  // Wrap checkEncounterTrigger to show overlay first
  const triggerEncounterWithOverlay = useCallback(async (
    triggerType: TriggerType,
    sourceId?: string,
    epicProgress?: number,
    epicCategory?: string,
    questInterval?: number
  ) => {
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
        onOpenChange={setShowEncounterModal}
        encounter={activeEncounter?.encounter || null}
        adversary={activeEncounter?.adversary || null}
        questInterval={activeEncounter?.questInterval}
        onComplete={handleComplete}
      />
    </>
  );
};
