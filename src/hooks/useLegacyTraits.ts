import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface LegacyTrait {
  trait: string;
  description: string;
  bonus: string;
  source_companion?: string;
  source_element?: string;
  passed_at?: string;
}

/**
 * Hook to manage legacy traits that pass from deceased companions to new ones
 */
export const useLegacyTraits = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch current companion's legacy traits
  const { data: legacyTraits = [], isLoading } = useQuery({
    queryKey: ['legacy-traits', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('user_companion')
        .select('legacy_traits')
        .eq('user_id', user.id)
        .eq('is_alive', true)
        .maybeSingle();

      if (error) {
        console.error('Failed to fetch legacy traits:', error);
        return [];
      }

      return (data?.legacy_traits as unknown as LegacyTrait[]) || [];
    },
    enabled: !!user?.id,
  });

  // Pass legacy traits from deceased companion to memorial
  // Pass legacy traits from deceased companion to memorial
  const passLegacyTraits = useMutation({
    mutationFn: async ({ 
      memorialId, 
      traits 
    }: { 
      memorialId: string;
      traits: LegacyTrait[];
    }) => {
      // Update the memorial with passed traits
      const { error } = await supabase
        .from('companion_memorials')
        .update({ legacy_traits_passed: JSON.parse(JSON.stringify(traits)) })
        .eq('id', memorialId);

      if (error) throw error;

      return traits;
    },
    onError: (error) => {
      console.error('Failed to pass legacy traits:', error);
    },
  });

  // Apply legacy traits to a new companion
  const applyLegacyTraits = useMutation({
    mutationFn: async ({ 
      companionId, 
      traits 
    }: { 
      companionId: string; 
      traits: LegacyTrait[];
    }) => {
      // Get existing traits
      const { data: existing } = await supabase
        .from('user_companion')
        .select('legacy_traits')
        .eq('id', companionId)
        .maybeSingle();

      const existingTraits = (existing?.legacy_traits as unknown as LegacyTrait[]) || [];
      const combinedTraits = [...existingTraits, ...traits];

      // Update companion with new traits
      const { error } = await supabase
        .from('user_companion')
        .update({ legacy_traits: JSON.parse(JSON.stringify(combinedTraits)) })
        .eq('id', companionId);

      if (error) throw error;

      toast.success('Legacy traits inherited!', {
        description: `Your new companion carries ${traits.length} trait${traits.length > 1 ? 's' : ''} from the past.`,
      });

      return combinedTraits;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legacy-traits'] });
      queryClient.invalidateQueries({ queryKey: ['companion'] });
    },
  });

  // Fetch most recent deceased companion's legacy traits for inheritance
  const { data: inheritableTraits = [] } = useQuery({
    queryKey: ['inheritable-legacy-traits', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('companion_memorials')
        .select('legacy_traits_passed, companion_name, core_element')
        .eq('user_id', user.id)
        .order('death_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return [];

      const traits = (data.legacy_traits_passed as unknown as LegacyTrait[]) || [];
      
      // Enhance traits with source info
      return traits.map(trait => ({
        ...trait,
        source_companion: data.companion_name,
        source_element: data.core_element,
      }));
    },
    enabled: !!user?.id,
  });

  // Check if user has legacy traits to inherit (for new companions)
  const hasInheritableTraits = inheritableTraits.length > 0;

  // Apply XP bonus from legacy traits
  const calculateLegacyXPBonus = (baseXP: number): number => {
    let bonus = 0;
    
    for (const trait of legacyTraits) {
      if (trait.bonus.includes('+5% XP')) {
        bonus += Math.floor(baseXP * 0.05);
      }
      if (trait.bonus.includes('+10 starting XP')) {
        // This is applied once at creation, not ongoing
      }
    }
    
    return bonus;
  };

  // Get starting XP bonus for new companions
  const getStartingXPBonus = (): number => {
    let bonus = 0;
    
    for (const trait of inheritableTraits) {
      if (trait.bonus.includes('+10 starting XP')) {
        bonus += 10;
      }
    }
    
    return bonus;
  };

  return {
    legacyTraits,
    inheritableTraits,
    hasInheritableTraits,
    isLoading,
    passLegacyTraits: passLegacyTraits.mutateAsync,
    applyLegacyTraits: applyLegacyTraits.mutateAsync,
    calculateLegacyXPBonus,
    getStartingXPBonus,
    isPassing: passLegacyTraits.isPending,
    isApplying: applyLegacyTraits.isPending,
  };
};
