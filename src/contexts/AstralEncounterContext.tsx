import { createContext, useContext, ReactNode } from 'react';
import { useAstralEncounters } from '@/hooks/useAstralEncounters';

// Create context with the return type of the hook
type AstralEncounterContextType = ReturnType<typeof useAstralEncounters>;

const AstralEncounterContext = createContext<AstralEncounterContextType | null>(null);

interface AstralEncounterContextProviderProps {
  children: ReactNode;
}

export const AstralEncounterContextProvider = ({ children }: AstralEncounterContextProviderProps) => {
  const encounterState = useAstralEncounters();
  return (
    <AstralEncounterContext.Provider value={encounterState}>
      {children}
    </AstralEncounterContext.Provider>
  );
};

export const useAstralEncounterContext = () => {
  const context = useContext(AstralEncounterContext);
  if (!context) {
    throw new Error('useAstralEncounterContext must be used within AstralEncounterContextProvider');
  }
  return context;
};
