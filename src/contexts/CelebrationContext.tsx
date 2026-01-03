import { createContext, useContext, useState, useCallback, ReactNode, useMemo } from 'react';

type CelebrationType = 'evolution' | 'perfect-day' | 'level-up' | 'quest-clear';

interface CelebrationContextType {
  isEvolutionInProgress: boolean;
  setEvolutionInProgress: (value: boolean) => void;
  pendingCelebrations: CelebrationType[];
  addPendingCelebration: (type: CelebrationType) => void;
  consumePendingCelebration: (type: CelebrationType) => boolean;
  clearAllPending: () => void;
}

const CelebrationContext = createContext<CelebrationContextType | undefined>(undefined);

export const CelebrationProvider = ({ children }: { children: ReactNode }) => {
  const [isEvolutionInProgress, setEvolutionInProgress] = useState(false);
  const [pendingCelebrations, setPendingCelebrations] = useState<CelebrationType[]>([]);

  const addPendingCelebration = useCallback((type: CelebrationType) => {
    setPendingCelebrations(prev => {
      if (prev.includes(type)) return prev;
      return [...prev, type];
    });
  }, []);

  const consumePendingCelebration = useCallback((type: CelebrationType) => {
    let found = false;
    setPendingCelebrations(prev => {
      if (prev.includes(type)) {
        found = true;
        return prev.filter(t => t !== type);
      }
      return prev;
    });
    return found;
  }, []);

  const clearAllPending = useCallback(() => {
    setPendingCelebrations([]);
  }, []);

  const value = useMemo(() => ({
    isEvolutionInProgress,
    setEvolutionInProgress,
    pendingCelebrations,
    addPendingCelebration,
    consumePendingCelebration,
    clearAllPending,
  }), [isEvolutionInProgress, pendingCelebrations, addPendingCelebration, consumePendingCelebration, clearAllPending]);

  return (
    <CelebrationContext.Provider value={value}>
      {children}
    </CelebrationContext.Provider>
  );
};

export const useCelebration = () => {
  const context = useContext(CelebrationContext);
  if (context === undefined) {
    throw new Error('useCelebration must be used within a CelebrationProvider');
  }
  return context;
};
