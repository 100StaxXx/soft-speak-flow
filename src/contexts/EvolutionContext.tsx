import { createContext, useContext, useState, ReactNode } from 'react';

interface EvolutionContextType {
  isEvolvingLoading: boolean;
  setIsEvolvingLoading: (value: boolean) => void;
  onEvolutionComplete: (() => void) | null;
  setOnEvolutionComplete: (callback: (() => void) | null) => void;
}

const EvolutionContext = createContext<EvolutionContextType | undefined>(undefined);

export const EvolutionProvider = ({ children }: { children: ReactNode }) => {
  const [isEvolvingLoading, setIsEvolvingLoading] = useState(false);
  const [onEvolutionComplete, setOnEvolutionComplete] = useState<(() => void) | null>(null);

  return (
    <EvolutionContext.Provider value={{ 
      isEvolvingLoading, 
      setIsEvolvingLoading,
      onEvolutionComplete,
      setOnEvolutionComplete
    }}>
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
