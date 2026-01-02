import { useState, useEffect, useCallback } from "react";
import { safeLocalStorage } from "@/utils/storage";
import { useAuth } from "@/hooks/useAuth";

// Module-level cache to track which modals have been checked this session
const checkedModals = new Set<string>();

/**
 * Hook to manage first-time modal display per tab/section
 * Shows modal only once per user per tab
 */
export function useFirstTimeModal(tabName: string) {
  const { user } = useAuth();
  const userId = user?.id;
  
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Don't do anything until we have a userId
    if (!userId) return;
    
    const cacheKey = `${tabName}_${userId}`;
    const storageKey = `tab_intro_${tabName}_${userId}`;
    
    // Skip if already checked this session
    if (checkedModals.has(cacheKey)) return;
    
    checkedModals.add(cacheKey);
    
    const hasSeenModal = safeLocalStorage.getItem(storageKey);
    if (!hasSeenModal) {
      setShowModal(true);
    }
  }, [userId, tabName]);

  // Use useCallback to ensure we always get the current userId
  const dismissModal = useCallback(() => {
    setShowModal(false);
    
    // Recalculate storage key with current userId to avoid stale closure
    if (userId) {
      const storageKey = `tab_intro_${tabName}_${userId}`;
      safeLocalStorage.setItem(storageKey, 'true');
    }
  }, [userId, tabName]);

  return { showModal, dismissModal };
}
