import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { safeLocalStorage } from "@/utils/storage";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const getDismissedTabIntros = (onboardingData: unknown): Record<string, boolean> => {
  if (!isRecord(onboardingData) || !isRecord(onboardingData.tab_intros)) return {};
  return Object.fromEntries(
    Object.entries(onboardingData.tab_intros)
      .filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean"),
  );
};

type MarkTabIntroDismissedRpc = (
  functionName: "mark_profile_tab_intro_dismissed",
  args: { p_tab_name: string },
) => Promise<{ error: { message?: string } | null }>;

const markTabIntroDismissed = (tabName: string) =>
  (supabase.rpc as unknown as MarkTabIntroDismissedRpc)(
    "mark_profile_tab_intro_dismissed",
    { p_tab_name: tabName },
  );

/**
 * Hook to manage first-time modal display per tab/section
 * Shows modal only once per user per tab
 */
export function useFirstTimeModal(tabName: string) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const userId = user?.id;
  const onboardingData = useMemo(
    () => isRecord(profile?.onboarding_data) ? profile.onboarding_data : {},
    [profile?.onboarding_data],
  );
  const dismissedTabIntros = useMemo(
    () => getDismissedTabIntros(onboardingData),
    [onboardingData],
  );
  const hasSeenServerModal = dismissedTabIntros[tabName] === true;
  
  const [showModal, setShowModal] = useState(false);
  const hasCheckedRef = useRef(false);
  const hasSeenServerModalRef = useRef(hasSeenServerModal);

  useEffect(() => {
    hasSeenServerModalRef.current = hasSeenServerModal;
  }, [hasSeenServerModal]);

  useEffect(() => {
    // Reset the check flag when userId changes
    hasCheckedRef.current = false;
  }, [userId]);

  useEffect(() => {
    // Don't do anything until we have a userId
    if (!userId) return;
    
    // Prevent double-execution within same mount
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;
    
    const storageKey = `tab_intro_${tabName}_${userId}`;
    const hasSeenModal = safeLocalStorage.getItem(storageKey);
    if (!hasSeenModal && !hasSeenServerModal) {
      setShowModal(true);
      return;
    }

    if (hasSeenServerModal && !hasSeenModal) {
      safeLocalStorage.setItem(storageKey, "true");
    }
  }, [hasSeenServerModal, userId, tabName]);

  useEffect(() => {
    if (!userId || !hasSeenServerModal) return;
    const storageKey = `tab_intro_${tabName}_${userId}`;
    safeLocalStorage.setItem(storageKey, "true");
    setShowModal(false);
  }, [hasSeenServerModal, tabName, userId]);

  const dismissModal = useCallback(() => {
    setShowModal(false);
    if (userId) {
      const storageKey = `tab_intro_${tabName}_${userId}`;
      safeLocalStorage.setItem(storageKey, "true");
      if (hasSeenServerModal) return;

      void markTabIntroDismissed(tabName)
        .then(({ error }) => {
          if (error) throw error;
        })
        .catch((error: unknown) => {
          console.warn("Failed to persist tab intro dismissal", {
            tabName,
            error: error instanceof Error ? error.message : String(error),
          });
          if (hasSeenServerModalRef.current) {
            safeLocalStorage.setItem(storageKey, "true");
            return;
          }

          safeLocalStorage.removeItem(storageKey);
          setShowModal(true);
          toast.error("We couldn't save that tutorial dismissal. Please try again.");
        });
    }
  }, [hasSeenServerModal, userId, tabName]);

  const openModal = useCallback(() => {
    setShowModal(true);
  }, []);

  return { showModal, dismissModal, openModal };
}
