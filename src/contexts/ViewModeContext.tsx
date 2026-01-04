import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import { safeLocalStorage } from "@/utils/storage";

export type ViewMode = "focus" | "quest";

interface ViewModeContextType {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  toggleViewMode: () => void;
}

const ViewModeContext = createContext<ViewModeContextType | undefined>(undefined);

const VIEW_MODE_KEY = "cosmiq_view_mode";

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    const stored = safeLocalStorage.getItem(VIEW_MODE_KEY);
    return (stored === "focus" || stored === "quest") ? stored : "quest";
  });

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    safeLocalStorage.setItem(VIEW_MODE_KEY, mode);
  }, []);

  const toggleViewMode = useCallback(() => {
    setViewModeState(prev => {
      const next = prev === "focus" ? "quest" : "focus";
      safeLocalStorage.setItem(VIEW_MODE_KEY, next);
      return next;
    });
  }, []);

  useEffect(() => {
    safeLocalStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  const value = useMemo(() => ({
    viewMode,
    setViewMode,
    toggleViewMode,
  }), [viewMode, setViewMode, toggleViewMode]);

  return (
    <ViewModeContext.Provider value={value}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const context = useContext(ViewModeContext);
  if (context === undefined) {
    throw new Error("useViewMode must be used within a ViewModeProvider");
  }
  return context;
}
