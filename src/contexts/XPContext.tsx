import { createContext, useContext, useState, ReactNode, useCallback, useMemo } from "react";
import { XPToast } from "@/components/XPToast";
import { playXPGain } from "@/utils/soundEffects";

interface XPContextType {
  showXPToast: (xp: number, reason: string) => void;
}

const XPContext = createContext<XPContextType | null>(null);

export const XPProvider = ({ children }: { children: ReactNode }) => {
  const [toastData, setToastData] = useState<{ xp: number; reason: string; show: boolean }>({
    xp: 0,
    reason: "",
    show: false,
  });

  const showXPToast = useCallback((xp: number, reason: string) => {
    setToastData({ xp, reason, show: true });
    playXPGain();
  }, []);

  const handleComplete = useCallback(() => {
    setToastData(prev => ({ ...prev, show: false }));
  }, []);

  const value = useMemo(() => ({ showXPToast }), [showXPToast]);

  return (
    <XPContext.Provider value={value}>
      {children}
      <XPToast
        xp={toastData.xp}
        reason={toastData.reason}
        show={toastData.show}
        onComplete={handleComplete}
      />
    </XPContext.Provider>
  );
};

export const useXPToast = () => {
  const context = useContext(XPContext);
  if (!context) {
    throw new Error("useXPToast must be used within XPProvider");
  }
  return context;
};
