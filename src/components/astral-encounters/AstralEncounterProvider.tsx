import { useEffect, useCallback, useState, useRef } from 'react';
import { AstralEncounterContextProvider, useAstralEncounterContext } from '@/contexts/AstralEncounterContext';
import { useEncounterPasses } from '@/hooks/useEncounterPasses';
import { AstralEncounterModal } from './AstralEncounterModal';
import { AstralEncounterTriggerOverlay } from './AstralEncounterTriggerOverlay';
import { DisableEncountersDialog } from './DisableEncountersDialog';
import { AdversaryTier } from '@/types/astralEncounters';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { isMacSession } from '@/utils/platformTargets';
import { toast } from 'sonner';

interface AstralEncounterProviderProps {
  children: React.ReactNode;
}

// Inner component that consumes the context
const AstralEncounterProviderInner = ({ children }: AstralEncounterProviderProps) => {
  const [showTriggerOverlay, setShowTriggerOverlay] = useState(false);
  const [pendingTier, setPendingTier] = useState<AdversaryTier>('common');
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const isMacBlockedSession = isMacSession();

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

  useEffect(() => {
    if (!isMacBlockedSession) {
      return;
    }

    if (!activeEncounter && !showEncounterModal && !showTriggerOverlay) {
      return;
    }

    setShowTriggerOverlay(false);
    closeEncounter();
  }, [activeEncounter, closeEncounter, isMacBlockedSession, showEncounterModal, showTriggerOverlay]);

  // Watch for activeEncounter changes to show overlay before modal.
  useEffect(() => {
    if (isMacBlockedSession) {
      lastOverlayEncounterIdRef.current = null;
      setShowTriggerOverlay(false);
      return;
    }

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
  }, [activeEncounter?.encounter.id, activeEncounter?.adversary.tier, isMacBlockedSession, setShowEncounterModal]);

  const handleTriggerOverlayComplete = useCallback(() => {
    if (isMacBlockedSession) {
      setShowTriggerOverlay(false);
      closeEncounter();
      return;
    }

    setShowTriggerOverlay(false);
    // Now show the actual encounter modal
    setShowEncounterModal(true);
  }, [closeEncounter, isMacBlockedSession, setShowEncounterModal]);

  const handleModalOpenChange = useCallback((open: boolean) => {
    if (isMacBlockedSession) {
      closeEncounter();
      return;
    }

    if (!open) {
      closeEncounter();
      return;
    }

    setShowEncounterModal(true);
  }, [closeEncounter, isMacBlockedSession, setShowEncounterModal]);

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
    if (!didPass) {
      // Always let users exit the modal even if remote pass/delete fails.
      closeEncounter();
      toast.error('Could not pass encounter. Exited battle and kept it pending.');
      return;
    }

    const newCount = recordPass();

    // After the 3rd pass, show the disable prompt
    if (newCount >= 3) {
      setShowDisableDialog(true);
    }
  }, [closeEncounter, recordPass, passEncounter]);

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
      {!isMacBlockedSession && (
        <AstralEncounterTriggerOverlay
          isVisible={showTriggerOverlay}
          tier={pendingTier}
          onComplete={handleTriggerOverlayComplete}
        />
      )}

      {/* Main encounter modal */}
      {!isMacBlockedSession && (
        <AstralEncounterModal
          open={showEncounterModal}
          onOpenChange={handleModalOpenChange}
          encounter={activeEncounter?.encounter || null}
          adversary={activeEncounter?.adversary || null}
          questInterval={activeEncounter?.questInterval}
          onComplete={handleComplete}
          onPass={handlePass}
        />
      )}

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
