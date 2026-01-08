import { createContext, useContext, useCallback, memo, ReactNode } from "react";
import { useCompanionWhispers } from "@/hooks/useCompanionWhispers";

interface CompanionWhisperContextValue {
  triggerActivityWhisper: () => void;
  triggerEncouragement: () => void;
}

const CompanionWhisperContext = createContext<CompanionWhisperContextValue | null>(null);

/**
 * Provider that exposes whisper triggers to the entire app.
 * Components can call triggerActivityWhisper() after completing activities
 * to potentially show an encouraging companion message.
 */
export const CompanionWhisperProvider = memo(({ children }: { children: ReactNode }) => {
  const { triggerActivityWhisper } = useCompanionWhispers();

  // Wrapper for activity completion
  const handleActivityWhisper = useCallback(() => {
    // Small chance (25%) to show whisper on activity
    if (Math.random() < 0.25) {
      triggerActivityWhisper();
    }
  }, [triggerActivityWhisper]);

  // Wrapper for general encouragement
  const handleEncouragement = useCallback(() => {
    // Higher chance (40%) for explicit encouragement
    if (Math.random() < 0.4) {
      triggerActivityWhisper();
    }
  }, [triggerActivityWhisper]);

  return (
    <CompanionWhisperContext.Provider value={{
      triggerActivityWhisper: handleActivityWhisper,
      triggerEncouragement: handleEncouragement,
    }}>
      {children}
    </CompanionWhisperContext.Provider>
  );
});

CompanionWhisperProvider.displayName = 'CompanionWhisperProvider';

export const useCompanionWhisperTriggers = () => {
  const context = useContext(CompanionWhisperContext);
  if (!context) {
    // Return no-op functions if not within provider
    return {
      triggerActivityWhisper: () => {},
      triggerEncouragement: () => {},
    };
  }
  return context;
};
