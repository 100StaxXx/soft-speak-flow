import { useState, useEffect, useRef } from "react";
import { safeLocalStorage } from "@/utils/storage";
import { useAuth } from "@/hooks/useAuth";

/**
 * Hook to manage first-time modal display per tab/section
 * Shows modal only once per user per tab
 */
export function useFirstTimeModal(tabName: string) {
  const { user } = useAuth();
  const hasCheckedRef = useRef(false);
  
  const userId = user?.id;
  const storageKey = userId ? `tab_intro_${tabName}_${userId}` : null;
  
  const [showModal, setShowModal] = useState(() => {
    if (!userId) return false;
    const hasSeenModal = safeLocalStorage.getItem(`tab_intro_${tabName}_${userId}`);
    return !hasSeenModal;
  });

  useEffect(() => {
    // Skip if no user or already checked this mount cycle
    if (!userId || hasCheckedRef.current) return;
    
    hasCheckedRef.current = true;
    
    const key = `tab_intro_${tabName}_${userId}`;
    const hasSeenModal = safeLocalStorage.getItem(key);
    if (!hasSeenModal) {
      setShowModal(true);
    }
  }, [userId, tabName]);

  // Reset check flag when component unmounts
  useEffect(() => {
    return () => {
      hasCheckedRef.current = false;
    };
  }, []);

  const dismissModal = () => {
    setShowModal(false);
    if (storageKey) {
      safeLocalStorage.setItem(storageKey, 'true');
    }
  };

  return { showModal, dismissModal };
}
