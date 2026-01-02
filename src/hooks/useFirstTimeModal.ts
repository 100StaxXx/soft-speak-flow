import { useState, useEffect } from "react";
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
  const storageKey = userId ? `tab_intro_${tabName}_${userId}` : null;
  
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!userId) return;
    
    const cacheKey = `${tabName}_${userId}`;
    
    // Skip if already checked this session
    if (checkedModals.has(cacheKey)) return;
    
    checkedModals.add(cacheKey);
    
    const hasSeenModal = safeLocalStorage.getItem(`tab_intro_${tabName}_${userId}`);
    if (!hasSeenModal) {
      setShowModal(true);
    }
  }, [userId, tabName]);

  const dismissModal = () => {
    setShowModal(false);
    if (storageKey) {
      safeLocalStorage.setItem(storageKey, 'true');
    }
  };

  return { showModal, dismissModal };
}
