import { useState, useEffect, useCallback, useRef } from "react";
import { safeLocalStorage } from "@/utils/storage";
import { useAuth } from "@/hooks/useAuth";

/**
 * Hook to manage first-time modal display per tab/section
 * Shows modal only once per user per tab
 */
export function useFirstTimeModal(tabName: string) {
  const { user } = useAuth();
  const userId = user?.id;
  
  const [showModal, setShowModal] = useState(false);
  const hasCheckedRef = useRef(false);

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
    
    if (!hasSeenModal) {
      setShowModal(true);
    }
  }, [userId, tabName]);

  const dismissModal = useCallback(() => {
    setShowModal(false);
    if (userId) {
      const storageKey = `tab_intro_${tabName}_${userId}`;
      safeLocalStorage.setItem(storageKey, 'true');
    }
  }, [userId, tabName]);

  return { showModal, dismissModal };
}
