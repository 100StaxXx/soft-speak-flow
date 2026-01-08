import { createContext, useContext, useMemo, memo, ReactNode } from "react";
import { useCompanionCareSignals } from "@/hooks/useCompanionCareSignals";
import { useAuth } from "@/hooks/useAuth";

export type CompanionMood = 'joyful' | 'content' | 'neutral' | 'reserved' | 'quiet' | 'dormant';
export type ParticleEffect = 'sparkle' | 'gentle' | 'minimal' | 'none';

export interface CompanionPresenceState {
  mood: CompanionMood;
  auraHue: number;           // HSL hue based on evolution path
  auraOpacity: number;       // 0-1 intensity
  particleEffect: ParticleEffect;
  particleCount: number;     // Number of ambient particles
  pulseRate: number;         // Animation speed multiplier (0.5-2)
  isPresent: boolean;        // Whether companion is "with" the user
  evolutionPath: string | null;
  needsAttention: boolean;   // True if dormancy warning or low care
  overallCare: number;       // 0-1 care level
}

interface CompanionPresenceContextValue {
  presence: CompanionPresenceState;
  isLoading: boolean;
}

const defaultPresence: CompanionPresenceState = {
  mood: 'neutral',
  auraHue: 45,
  auraOpacity: 0,
  particleEffect: 'none',
  particleCount: 0,
  pulseRate: 1,
  isPresent: false,
  evolutionPath: null,
  needsAttention: false,
  overallCare: 0.5,
};

const CompanionPresenceContext = createContext<CompanionPresenceContextValue>({
  presence: defaultPresence,
  isLoading: true,
});

// Evolution path to hue mapping
const PATH_HUES: Record<string, number> = {
  steady_guardian: 45,       // Amber
  volatile_ascendant: 280,   // Purple
  neglected_wanderer: 210,   // Slate/cool blue
  balanced_architect: 180,   // Cyan
};

// Mood configurations
const MOOD_CONFIG: Record<CompanionMood, { particleEffect: ParticleEffect; particleCount: [number, number]; opacity: [number, number] }> = {
  joyful: { particleEffect: 'sparkle', particleCount: [6, 8], opacity: [0.04, 0.06] },
  content: { particleEffect: 'gentle', particleCount: [4, 6], opacity: [0.03, 0.05] },
  neutral: { particleEffect: 'gentle', particleCount: [3, 4], opacity: [0.02, 0.03] },
  reserved: { particleEffect: 'minimal', particleCount: [2, 3], opacity: [0.01, 0.02] },
  quiet: { particleEffect: 'minimal', particleCount: [1, 2], opacity: [0.005, 0.01] },
  dormant: { particleEffect: 'none', particleCount: [0, 0], opacity: [0, 0] },
};

export const CompanionPresenceProvider = memo(({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { care, isLoading } = useCompanionCareSignals();

  const presence = useMemo<CompanionPresenceState>(() => {
    if (!user || isLoading) {
      return defaultPresence;
    }

    const { overallCare, evolutionPath, dormancy, hasDormancyWarning, dialogueTone } = care;
    
    // Map dialogue tone to mood
    const mood: CompanionMood = dormancy.isDormant ? 'dormant' : dialogueTone as CompanionMood;
    
    // Get evolution path hue or default to neutral gold
    const auraHue = evolutionPath.path ? PATH_HUES[evolutionPath.path] ?? 45 : 45;
    
    // Get mood configuration
    const moodConfig = MOOD_CONFIG[mood];
    
    // Calculate opacity based on overall care within mood range
    const [minOpacity, maxOpacity] = moodConfig.opacity;
    const auraOpacity = minOpacity + (maxOpacity - minOpacity) * overallCare;
    
    // Calculate particle count based on care level within mood range
    const [minParticles, maxParticles] = moodConfig.particleCount;
    const particleCount = Math.round(minParticles + (maxParticles - minParticles) * overallCare);
    
    // Pulse rate: faster when joyful, slower when sad
    const pulseRate = 0.7 + overallCare * 0.6; // Range: 0.7 - 1.3
    
    return {
      mood,
      auraHue,
      auraOpacity,
      particleEffect: moodConfig.particleEffect,
      particleCount,
      pulseRate,
      isPresent: !dormancy.isDormant,
      evolutionPath: evolutionPath.path,
      needsAttention: hasDormancyWarning || overallCare < 0.3,
      overallCare,
    };
  }, [user, isLoading, care]);

  const value = useMemo(() => ({
    presence,
    isLoading,
  }), [presence, isLoading]);

  return (
    <CompanionPresenceContext.Provider value={value}>
      {children}
    </CompanionPresenceContext.Provider>
  );
});

CompanionPresenceProvider.displayName = 'CompanionPresenceProvider';

export const useCompanionPresence = () => {
  const context = useContext(CompanionPresenceContext);
  if (!context) {
    throw new Error('useCompanionPresence must be used within CompanionPresenceProvider');
  }
  return context;
};
