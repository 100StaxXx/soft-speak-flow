import { createContext, useContext, useState, ReactNode } from 'react';

interface EvolutionContextType {
  isEvolvingLoading: boolean;
  setIsEvolvingLoading: (value: boolean) => void;
}

const EvolutionContext = createContext<EvolutionContextType | undefined>(undefined);

export const EvolutionProvider = ({ children }: { children: ReactNode }) => {
  const [isEvolvingLoading, setIsEvolvingLoading] = useState(false);

  return (
    <EvolutionContext.Provider value={{ isEvolvingLoading, setIsEvolvingLoading }}>
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
