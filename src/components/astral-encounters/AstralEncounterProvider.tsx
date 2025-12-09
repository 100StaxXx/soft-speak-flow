import { useEffect, useCallback } from 'react';
import { useAstralEncounters } from '@/hooks/useAstralEncounters';
import { useEncounterTrigger } from '@/hooks/useEncounterTrigger';
import { AstralEncounterModal } from './AstralEncounterModal';

interface AstralEncounterProviderProps {
  children: React.ReactNode;
}

interface EpicCheckpointEventDetail {
  epicId: string;
  previousProgress: number;
  currentProgress: number;
}

export const AstralEncounterProvider = ({ children }: AstralEncounterProviderProps) => {
  const {
    activeEncounter,
    showEncounterModal,
    setShowEncounterModal,
    checkEncounterTrigger,
    completeEncounter,
  } = useAstralEncounters();

  const { checkQuestMilestone, checkWeeklyTrigger, checkEpicCheckpoint } = useEncounterTrigger();

  // Listen for quest completion events
  const handleQuestCompleted = useCallback(async () => {
    const result = await checkQuestMilestone();
    if (result.shouldTrigger && result.triggerType) {
      checkEncounterTrigger(
        result.triggerType,
        result.sourceId,
        result.epicProgress,
        result.epicCategory,
        result.questInterval
      );
    }
  }, [checkQuestMilestone, checkEncounterTrigger]);

  // Check for weekly trigger on mount
  useEffect(() => {
    const checkWeekly = async () => {
      const result = await checkWeeklyTrigger();
      if (result.shouldTrigger && result.triggerType) {
        // Delay slightly to avoid immediate popup on app load
        setTimeout(() => {
          checkEncounterTrigger(result.triggerType!);
        }, 3000);
      }
    };
    checkWeekly();
  }, [checkWeeklyTrigger, checkEncounterTrigger]);

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
        checkEncounterTrigger(
          result.triggerType,
          result.sourceId,
          result.epicProgress,
          result.epicCategory
        );
      }
    },
    [checkEpicCheckpoint, checkEncounterTrigger]
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
