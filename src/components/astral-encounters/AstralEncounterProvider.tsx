import { useEffect, useCallback } from 'react';
import { useAstralEncounters } from '@/hooks/useAstralEncounters';
import { useEncounterTrigger } from '@/hooks/useEncounterTrigger';
import { AstralEncounterModal } from './AstralEncounterModal';

interface AstralEncounterProviderProps {
  children: React.ReactNode;
}

export const AstralEncounterProvider = ({ children }: AstralEncounterProviderProps) => {
  const {
    activeEncounter,
    showEncounterModal,
    setShowEncounterModal,
    checkEncounterTrigger,
    completeEncounter,
  } = useAstralEncounters();

  const { checkQuestMilestone, checkWeeklyTrigger } = useEncounterTrigger();

  // Listen for quest completion events
  const handleQuestCompleted = useCallback(async () => {
    const result = await checkQuestMilestone();
    if (result.shouldTrigger && result.triggerType) {
      checkEncounterTrigger(
        result.triggerType,
        result.sourceId,
        result.epicProgress,
        result.epicCategory
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
        onComplete={handleComplete}
      />
    </>
  );
};
