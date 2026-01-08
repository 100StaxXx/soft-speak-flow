import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useMemo } from "react";

/**
 * INTERNAL hook for hidden care signals - these values drive behavior
 * but are NEVER displayed directly to users as numbers/percentages.
 * Users only see the EFFECTS (visual changes, dialogue, animations).
 */

export interface CareSignals {
  consistency: number;    // 0-1: How steady is their engagement pattern
  responsiveness: number; // 0-1: How quickly they respond (morning vs late night)
  balance: number;        // 0-1: Balanced effort vs binge/neglect cycles
  intent: number;         // 0-1: Thoughtful vs rushed completions
  recovery: number;       // 0-1: How well they bounce back after misses
}

export interface EvolutionPath {
  path: 'steady_guardian' | 'volatile_ascendant' | 'neglected_wanderer' | 'balanced_architect' | null;
  isLocked: boolean;
  determinedAt: string | null;
}

export interface DormancyState {
  isDormant: boolean;
  dormantSince: string | null;
  dormancyCount: number;
  recoveryDays: number;
  daysUntilWake: number;
  inactiveDays: number;
  daysUntilDormancy: number | null; // null if not approaching dormancy
}

export interface BondState {
  level: number;
  totalInteractions: number;
  lastInteractionAt: string | null;
}

interface CompanionCareData {
  careSignals: CareSignals;
  overallCare: number;          // 0-1: Weighted average of all signals
  evolutionPath: EvolutionPath;
  dormancy: DormancyState;
  bond: BondState;
  hasDormancyWarning: boolean;
  dialogueTone: 'joyful' | 'content' | 'neutral' | 'reserved' | 'quiet' | 'silent';
}

const DORMANCY_RECOVERY_DAYS_REQUIRED = 5;

/**
 * Hook to fetch hidden care signals from the backend.
 * These are calculated daily by process-daily-decay and stored in user_companion.
 * This data drives visual/behavioral changes but is never shown as numbers.
 */
export const useCompanionCareSignals = () => {
  const { user } = useAuth();

  const { data: careData, isLoading } = useQuery({
    queryKey: ['companion-care-signals', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('user_companion')
        .select(`
          care_consistency,
          care_responsiveness,
          care_balance,
          care_intent,
          care_recovery,
          care_pattern,
          evolution_path,
          evolution_path_locked,
          path_determination_date,
          dormant_since,
          dormancy_count,
          dormancy_recovery_days,
          inactive_days,
          bond_level,
          total_interactions,
          last_interaction_at
        `)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Failed to fetch care signals:', error);
        throw error;
      }
      
      return data;
    },
    enabled: !!user?.id,
    staleTime: 60000, // 1 minute
  });

  // Compute derived care state
  const care: CompanionCareData = useMemo(() => {
    const careSignals: CareSignals = {
      consistency: careData?.care_consistency ?? 0.5,
      responsiveness: careData?.care_responsiveness ?? 0.5,
      balance: careData?.care_balance ?? 0.5,
      intent: careData?.care_intent ?? 0.5,
      recovery: careData?.care_recovery ?? 0.5,
    };

    // Weighted average for overall care
    const overallCare = (
      careSignals.consistency * 0.3 +
      careSignals.responsiveness * 0.15 +
      careSignals.balance * 0.2 +
      careSignals.intent * 0.2 +
      careSignals.recovery * 0.15
    );

    // Evolution path
    const evolutionPath: EvolutionPath = {
      path: (careData?.evolution_path as EvolutionPath['path']) ?? null,
      isLocked: careData?.evolution_path_locked ?? false,
      determinedAt: careData?.path_determination_date ?? null,
    };

    // Dormancy state
    const dormantSince = careData?.dormant_since;
    const isDormant = !!dormantSince;
    const recoveryDays = careData?.dormancy_recovery_days ?? 0;
    const inactiveDays = careData?.inactive_days ?? 0;
    
    // Calculate days until dormancy (warning shows at 5-6 inactive days, dormancy at 7)
    const DORMANCY_THRESHOLD = 7;
    const WARNING_THRESHOLD = 5;
    const daysUntilDormancy = !isDormant && inactiveDays >= WARNING_THRESHOLD 
      ? Math.max(1, DORMANCY_THRESHOLD - inactiveDays) 
      : null;
    
    const dormancy: DormancyState = {
      isDormant,
      dormantSince: dormantSince ?? null,
      dormancyCount: careData?.dormancy_count ?? 0,
      recoveryDays,
      daysUntilWake: isDormant ? Math.max(0, DORMANCY_RECOVERY_DAYS_REQUIRED - recoveryDays) : 0,
      inactiveDays,
      daysUntilDormancy,
    };

    // Bond state
    const bond: BondState = {
      level: careData?.bond_level ?? 0,
      totalInteractions: careData?.total_interactions ?? 0,
      lastInteractionAt: careData?.last_interaction_at ?? null,
    };

    // Check for dormancy warning in care_pattern
    const carePattern = careData?.care_pattern as Record<string, any> | null;
    const hasDormancyWarning = carePattern?.dormancy_warning === true;

    // Determine dialogue tone based on overall care
    let dialogueTone: CompanionCareData['dialogueTone'] = 'content';
    if (isDormant) {
      dialogueTone = 'silent';
    } else if (overallCare > 0.8) {
      dialogueTone = 'joyful';
    } else if (overallCare > 0.6) {
      dialogueTone = 'content';
    } else if (overallCare > 0.4) {
      dialogueTone = 'neutral';
    } else if (overallCare > 0.2) {
      dialogueTone = 'reserved';
    } else {
      dialogueTone = 'quiet';
    }

    return {
      careSignals,
      overallCare,
      evolutionPath,
      dormancy,
      bond,
      hasDormancyWarning,
      dialogueTone,
    };
  }, [careData]);

  return {
    care,
    isLoading,
  };
};

// Export path display info (this IS shown to users)
export const getEvolutionPathInfo = (path: EvolutionPath['path']) => {
  switch (path) {
    case 'steady_guardian':
      return {
        name: 'Steady Guardian',
        description: 'Your consistent care has shaped a calm, protective companion.',
        icon: '🛡️',
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/10',
        borderColor: 'border-amber-500/30',
      };
    case 'volatile_ascendant':
      return {
        name: 'Volatile Ascendant',
        description: 'Your intense but erratic energy has forged a powerful, passionate companion.',
        icon: '⚡',
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/10',
        borderColor: 'border-purple-500/30',
      };
    case 'neglected_wanderer':
      return {
        name: 'Neglected Wanderer',
        description: 'Time apart has made your companion independent but distant.',
        icon: '🌙',
        color: 'text-slate-400',
        bgColor: 'bg-slate-500/10',
        borderColor: 'border-slate-500/30',
      };
    case 'balanced_architect':
      return {
        name: 'Balanced Architect',
        description: 'Perfect harmony in your care has awakened a rare, transcendent form.',
        icon: '✨',
        color: 'text-cyan-400',
        bgColor: 'bg-cyan-500/10',
        borderColor: 'border-cyan-500/30',
      };
    default:
      return {
        name: 'Forming',
        description: 'Your care patterns are still being observed...',
        icon: '🌀',
        color: 'text-muted-foreground',
        bgColor: 'bg-muted/10',
        borderColor: 'border-muted/30',
      };
  }
};
