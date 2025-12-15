import { useState, useEffect } from "react";
import { safeLocalStorage } from "@/utils/storage";
import { useAuth } from "@/hooks/useAuth";

/**
 * Hook to manage first-time modal display per tab/section
 * Shows modal only once per user per tab
 */
export function useFirstTimeModal(tabName: string) {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);

  const storageKey = `tab_intro_${tabName}_${user?.id || 'anonymous'}`;

  useEffect(() => {
    if (!user?.id) return;
    
    const hasSeenModal = safeLocalStorage.getItem(storageKey);
    if (!hasSeenModal) {
      setShowModal(true);
    }
  }, [user?.id, storageKey]);

  const dismissModal = () => {
    setShowModal(false);
    safeLocalStorage.setItem(storageKey, 'true');
  };

  return { showModal, dismissModal };
}
