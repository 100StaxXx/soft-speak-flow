import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from "react";
import { WeeklyRecap } from "@/hooks/useWeeklyRecap";

interface WeeklyRecapContextType {
  isModalOpen: boolean;
  selectedRecap: WeeklyRecap | null;
  openRecap: (recap: WeeklyRecap) => void;
  closeRecap: () => void;
}

const WeeklyRecapContext = createContext<WeeklyRecapContextType | null>(null);

export const WeeklyRecapProvider = ({ children }: { children: ReactNode }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecap, setSelectedRecap] = useState<WeeklyRecap | null>(null);

  const openRecap = useCallback((recap: WeeklyRecap) => {
    setSelectedRecap(recap);
    setIsModalOpen(true);
  }, []);

  const closeRecap = useCallback(() => {
    setIsModalOpen(false);
    setSelectedRecap(null);
  }, []);

  const value = useMemo(() => ({
    isModalOpen,
    selectedRecap,
    openRecap,
    closeRecap,
  }), [isModalOpen, selectedRecap, openRecap, closeRecap]);

  return (
    <WeeklyRecapContext.Provider value={value}>
      {children}
    </WeeklyRecapContext.Provider>
  );
};

export const useWeeklyRecapContext = () => {
  const context = useContext(WeeklyRecapContext);
  if (!context) {
    throw new Error("useWeeklyRecapContext must be used within a WeeklyRecapProvider");
  }
  return context;
};
