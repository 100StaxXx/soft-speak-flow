import { createContext, useContext, useState, ReactNode } from "react";
import { XPToast } from "@/components/XPToast";

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

  const showXPToast = (xp: number, reason: string) => {
    setToastData({ xp, reason, show: true });
  };

  return (
    <XPContext.Provider value={{ showXPToast }}>
      {children}
      <XPToast
        xp={toastData.xp}
        reason={toastData.reason}
        show={toastData.show}
        onComplete={() => setToastData(prev => ({ ...prev, show: false }))}
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
