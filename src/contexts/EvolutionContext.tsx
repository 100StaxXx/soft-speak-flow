import { createContext, useContext, useState, ReactNode, useMemo } from 'react';

interface EvolutionContextType {
  isEvolvingLoading: boolean;
  setIsEvolvingLoading: (value: boolean) => void;
  onEvolutionComplete: (() => void) | null;
  setOnEvolutionComplete: (callback: (() => void) | null) => void;
}

const EvolutionContext = createContext<EvolutionContextType | undefined>(undefined);

export const EvolutionProvider = ({ children }: { children: ReactNode }) => {
  const [isEvolvingLoading, setIsEvolvingLoading] = useState(false);
  // Use null as initial value, not a function returning null
  const [onEvolutionComplete, setOnEvolutionComplete] = useState<(() => void) | null>(null);

  const value = useMemo(() => ({ 
    isEvolvingLoading, 
    setIsEvolvingLoading,
    onEvolutionComplete,
    setOnEvolutionComplete
  }), [isEvolvingLoading, onEvolutionComplete]);

  return (
    <EvolutionContext.Provider value={value}>
      {children}
    </EvolutionContext.Provider>
  );
};

export const useEvolution = () => {
  const context = useContext(EvolutionContext);
  if (context === undefined) {
    throw new Error('useEvolution must be used within an EvolutionProvider');
  }
  return context;
};
