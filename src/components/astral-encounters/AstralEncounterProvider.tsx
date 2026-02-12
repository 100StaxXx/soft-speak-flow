import { useEffect, useCallback, useState, useRef } from 'react';
import { AstralEncounterContextProvider, useAstralEncounterContext } from '@/contexts/AstralEncounterContext';
import { useEncounterPasses } from '@/hooks/useEncounterPasses';
import { AstralEncounterModal } from './AstralEncounterModal';
import { AstralEncounterTriggerOverlay } from './AstralEncounterTriggerOverlay';
import { DisableEncountersDialog } from './DisableEncountersDialog';
import { AdversaryTier } from '@/types/astralEncounters';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface AstralEncounterProviderProps {
  children: React.ReactNode;
}

// Inner component that consumes the context
const AstralEncounterProviderInner = ({ children }: AstralEncounterProviderProps) => {
  const [showTriggerOverlay, setShowTriggerOverlay] = useState(false);
  const [pendingTier, setPendingTier] = useState<AdversaryTier>('common');
  const [showDisableDialog, setShowDisableDialog] = useState(false);

  // Prevent replaying overlay for the same encounter id.
  const lastOverlayEncounterIdRef = useRef<string | null>(null);

  const { user } = useAuth();
  const { passCount, recordPass } = useEncounterPasses();

  const {
    activeEncounter,
    showEncounterModal,
    setShowEncounterModal,
    completeEncounterAsync,
    closeEncounter,
    passEncounter,
  } = useAstralEncounterContext();

  // Watch for activeEncounter changes to show overlay before modal.
  useEffect(() => {
    const encounterId = activeEncounter?.encounter.id ?? null;

    if (!encounterId) {
      lastOverlayEncounterIdRef.current = null;
      setShowTriggerOverlay(false);
      return;
    }

    if (lastOverlayEncounterIdRef.current === encounterId) {
      return;
    }

    lastOverlayEncounterIdRef.current = encounterId;
    setPendingTier((activeEncounter?.adversary.tier as AdversaryTier) || 'common');
    setShowEncounterModal(false);
    setShowTriggerOverlay(true);
  }, [activeEncounter?.encounter.id, activeEncounter?.adversary.tier, setShowEncounterModal]);

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

  const handleComplete = useCallback(async (params: {
    encounterId: string;
    accuracy: number;
    phasesCompleted: number;
  }) => {
    try {
      await completeEncounterAsync(params);
      return true;
    } catch {
      return false;
    }
  }, [completeEncounterAsync]);

  // Handle passing on an encounter
  const handlePass = useCallback(async () => {
    const didPass = await passEncounter();
    if (!didPass) return;

    const newCount = recordPass();

    // After the 3rd pass, show the disable prompt
    if (newCount >= 3) {
      setShowDisableDialog(true);
    }
  }, [recordPass, passEncounter]);

  // Handle disabling encounters via profile setting
  const handleDisableEncounters = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ astral_encounters_enabled: false })
        .eq('id', user.id);

      if (error) throw error;

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

// Outer component that provides the context
export const AstralEncounterProvider = ({ children }: AstralEncounterProviderProps) => {
  return (
    <AstralEncounterContextProvider>
      <AstralEncounterProviderInner>
        {children}
      </AstralEncounterProviderInner>
    </AstralEncounterContextProvider>
  );
};
