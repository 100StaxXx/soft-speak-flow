import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useMemo,
  type Dispatch,
  type SetStateAction,
} from 'react';

export type PendingEvolutionRevealStatus = "preparing" | "ready";

export interface PendingEvolutionReveal {
  status: PendingEvolutionRevealStatus;
  companionId: string;
  evolutionId?: string | null;
  previousStage: number;
  newStage: number;
  previousImageUrl: string;
  newImageUrl: string;
  animationVideoUrl?: string | null;
  presetId?: string | null;
  element?: string | null;
}

interface EvolutionContextType {
  isEvolvingLoading: boolean;
  setIsEvolvingLoading: (value: boolean) => void;
  pendingEvolutionReveal: PendingEvolutionReveal | null;
  setPendingEvolutionReveal: Dispatch<SetStateAction<PendingEvolutionReveal | null>>;
  onEvolutionComplete: (() => void) | null;
  setOnEvolutionComplete: (callback: (() => void) | null) => void;
}

const EvolutionContext = createContext<EvolutionContextType | undefined>(undefined);

export const EvolutionProvider = ({ children }: { children: ReactNode }) => {
  const [isEvolvingLoading, setIsEvolvingLoading] = useState(false);
  const [pendingEvolutionReveal, setPendingEvolutionReveal] = useState<PendingEvolutionReveal | null>(null);
  // Use null as initial value, not a function returning null
  const [onEvolutionComplete, setOnEvolutionComplete] = useState<(() => void) | null>(null);

  const value = useMemo(() => ({ 
    isEvolvingLoading, 
    setIsEvolvingLoading,
    pendingEvolutionReveal,
    setPendingEvolutionReveal,
    onEvolutionComplete,
    setOnEvolutionComplete
  }), [isEvolvingLoading, onEvolutionComplete, pendingEvolutionReveal]);

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
