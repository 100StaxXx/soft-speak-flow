import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompanion } from './useCompanion';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

// Scar types that can be earned
export type ScarType = 
  | 'dormancy_survivor'      // Recovered from dormancy
  | 'neglect_survivor'       // Recovered from neglect
  | 'near_death'             // Recovered from critical health
  | 'first_evolution'        // First evolution milestone
  | 'bond_trial'             // Survived a bond trial
  | 'resilience'             // General resilience scar
  | 'abandonment_healed';    // Long inactive period recovered

export interface Scar {
  id: string;
  type: ScarType;
  earnedAt: string;
  context: string;
  description: string;
  imageUrl?: string;
}

interface ScarHistory {
  scars: Scar[];
  totalScars: number;
  latestScar: Scar | null;
}

// Scar type descriptions for UI display
export const SCAR_TYPE_INFO: Record<ScarType, { name: string; description: string; icon: string }> = {
  dormancy_survivor: {
    name: "Awakening Mark",
    description: "A faded symbol of the deep sleep from which they returned",
    icon: "Moon",
  },
  neglect_survivor: {
    name: "Resilience Scar",
    description: "A mark from days when care grew thin, but hope remained",
    icon: "Heart",
  },
  near_death: {
    name: "Phoenix Mark",
    description: "A testament to survival against all odds",
    icon: "Flame",
  },
  first_evolution: {
    name: "Growth Ring",
    description: "A subtle mark celebrating their first transformation",
    icon: "Sparkles",
  },
  bond_trial: {
    name: "Trust Scar",
    description: "Earned when the bond was tested but held true",
    icon: "Shield",
  },
  resilience: {
    name: "Endurance Mark",
    description: "A reminder of challenges overcome together",
    icon: "Mountain",
  },
  abandonment_healed: {
    name: "Return Mark",
    description: "A symbol of the journey back from being forgotten",
    icon: "Compass",
  },
};

export function useCompanionScars() {
  const { companion } = useCompanion();
  const queryClient = useQueryClient();

  // Fetch scar history from companion data
  const { data: scarHistory, isLoading } = useQuery({
    queryKey: ['companion-scars', companion?.id],
    queryFn: async (): Promise<ScarHistory> => {
      if (!companion?.id) {
        return { scars: [], totalScars: 0, latestScar: null };
      }

      const { data, error } = await supabase
        .from('user_companion')
        .select('scars, scar_history, scarred_image_url')
        .eq('id', companion.id)
        .single();

      if (error) {
        console.error('Failed to fetch scar history:', error);
        return { scars: [], totalScars: 0, latestScar: null };
      }

      // Parse scars from JSON - use unknown first for type safety
      const scarsArray = (data.scar_history as unknown as Scar[]) || [];
      
      return {
        scars: scarsArray,
        totalScars: scarsArray.length,
        latestScar: scarsArray.length > 0 ? scarsArray[scarsArray.length - 1] : null,
      };
    },
    enabled: !!companion?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Mutation to add a new scar
  const addScar = useMutation({
    mutationFn: async ({ 
      type, 
      context,
      generateImage = true 
    }: { 
      type: ScarType; 
      context: string;
      generateImage?: boolean;
    }) => {
      if (!companion?.id) throw new Error('No companion found');

      const scarInfo = SCAR_TYPE_INFO[type];
      
      // Create the scar object
      const newScar: Scar = {
        id: crypto.randomUUID(),
        type,
        earnedAt: new Date().toISOString(),
        context,
        description: scarInfo.description,
      };

      // Get current scar history
      const currentData = await supabase
        .from('user_companion')
        .select('scar_history')
        .eq('id', companion.id)
        .single();

      const currentScars = (currentData.data?.scar_history as unknown as Scar[]) || [];
      
      // Check if same type scar already exists (prevent duplicates within same day)
      const today = new Date().toDateString();
      const hasSameScarToday = currentScars.some(
        s => s.type === type && new Date(s.earnedAt).toDateString() === today
      );
      
      if (hasSameScarToday) {
        console.log(`[Scars] Skipping duplicate ${type} scar for today`);
        return null;
      }

      const updatedScars = [...currentScars, newScar];

      // Update database with new scar - cast to Json for Supabase
      const { error: updateError } = await supabase
        .from('user_companion')
        .update({ 
          scar_history: JSON.parse(JSON.stringify(updatedScars)) as Json,
          scars: JSON.parse(JSON.stringify(updatedScars)) as Json,
        })
        .eq('id', companion.id);

      if (updateError) throw updateError;

      // Generate scarred image in background if requested
      if (generateImage) {
        console.log(`[Scars] Triggering scar image generation for ${type}`);
        supabase.functions.invoke('generate-companion-scar', {
          body: {
            companionId: companion.id,
            scarContext: `${scarInfo.name}: ${context}`,
          },
        }).then(({ error }) => {
          if (error) {
            console.error('[Scars] Failed to generate scar image:', error);
          } else {
            // Invalidate companion query to show new image
            queryClient.invalidateQueries({ queryKey: ['companion'] });
          }
        });
      }

      return newScar;
    },
    onSuccess: (scar) => {
      if (scar) {
        queryClient.invalidateQueries({ queryKey: ['companion-scars'] });
        const scarInfo = SCAR_TYPE_INFO[scar.type];
        toast.info(`Your companion earned a ${scarInfo.name}`, {
          description: "A mark of their journey with you",
          duration: 5000,
        });
      }
    },
    onError: (error) => {
      console.error('[Scars] Failed to add scar:', error);
    },
  });

  // Check if companion should earn a scar based on current state
  const checkScarTriggers = async (triggers: {
    recoveredFromDormancy?: boolean;
    recoveredFromNeglect?: boolean;
    nearDeathRecovery?: boolean;
    firstEvolution?: boolean;
    bondTrialPassed?: boolean;
    longAbsenceRecovery?: boolean;
  }) => {
    if (!companion?.id) return;

    const scarPromises: Promise<any>[] = [];

    if (triggers.recoveredFromDormancy) {
      scarPromises.push(
        addScar.mutateAsync({
          type: 'dormancy_survivor',
          context: 'Awakened from the deep sleep through consistent care',
        })
      );
    }

    if (triggers.recoveredFromNeglect) {
      scarPromises.push(
        addScar.mutateAsync({
          type: 'neglect_survivor',
          context: 'Recovered from a period of diminished care',
        })
      );
    }

    if (triggers.nearDeathRecovery) {
      scarPromises.push(
        addScar.mutateAsync({
          type: 'near_death',
          context: 'Survived when vitality was critically low',
        })
      );
    }

    if (triggers.firstEvolution) {
      scarPromises.push(
        addScar.mutateAsync({
          type: 'first_evolution',
          context: 'Marked their first transformation into a new stage',
          generateImage: false, // Don't modify the new evolution image
        })
      );
    }

    if (triggers.bondTrialPassed) {
      scarPromises.push(
        addScar.mutateAsync({
          type: 'bond_trial',
          context: 'The bond was tested through adversity',
        })
      );
    }

    if (triggers.longAbsenceRecovery) {
      scarPromises.push(
        addScar.mutateAsync({
          type: 'abandonment_healed',
          context: 'Returned from a long period of absence',
        })
      );
    }

    await Promise.allSettled(scarPromises);
  };

  return {
    scars: scarHistory?.scars || [],
    totalScars: scarHistory?.totalScars || 0,
    latestScar: scarHistory?.latestScar || null,
    isLoading,
    addScar: addScar.mutate,
    addScarAsync: addScar.mutateAsync,
    isAddingScar: addScar.isPending,
    checkScarTriggers,
  };
}
