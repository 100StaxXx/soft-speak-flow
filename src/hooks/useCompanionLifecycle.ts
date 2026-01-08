import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useState, useEffect } from 'react';

interface CompanionLifecycle {
  isAlive: boolean;
  deathDate: string | null;
  deathCause: string | null;
  careScore: number;
  recoveryProgress: number;
  scars: Array<{ date: string; context: string }>;
  hunger: number;
  happiness: number;
  isRecovering: boolean;
  isCritical: boolean;
}

interface CompanionMemorial {
  id: string;
  companion_name: string;
  spirit_animal: string;
  core_element: string | null;
  days_together: number;
  death_date: string;
  death_cause: string;
  final_evolution_stage: number;
  final_image_url: string | null;
  memorial_image_url: string | null;
}

/**
 * Hook to manage the Tamagotchi-style companion lifecycle
 * Handles death, recovery, scars, and care score
 */
export const useCompanionLifecycle = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showDeathNotification, setShowDeathNotification] = useState(false);
  const [deathNotificationDismissed, setDeathNotificationDismissed] = useState(false);

  // Fetch lifecycle data from user_companion
  const { data: lifecycleData, isLoading } = useQuery({
    queryKey: ['companion-lifecycle', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('user_companion')
        .select('is_alive, death_date, death_cause, care_score, recovery_progress, scars, hunger, happiness, inactive_days, spirit_animal, current_stage, current_image_url')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Failed to fetch companion lifecycle:', error);
        throw error;
      }

      return data;
    },
    enabled: !!user?.id,
    staleTime: 60000,
  });

  // Fetch memorial if companion is dead
  const { data: memorial } = useQuery({
    queryKey: ['companion-memorial', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('companion_memorials')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Failed to fetch companion memorial:', error);
        return null;
      }

      return data as CompanionMemorial | null;
    },
    enabled: !!user?.id && lifecycleData?.is_alive === false,
  });

  // Computed lifecycle state
  const lifecycle: CompanionLifecycle = {
    isAlive: lifecycleData?.is_alive ?? true,
    deathDate: lifecycleData?.death_date ?? null,
    deathCause: lifecycleData?.death_cause ?? null,
    careScore: lifecycleData?.care_score ?? 100,
    recoveryProgress: lifecycleData?.recovery_progress ?? 100,
    scars: (lifecycleData?.scars as Array<{ date: string; context: string }>) ?? [],
    hunger: lifecycleData?.hunger ?? 100,
    happiness: lifecycleData?.happiness ?? 100,
    isRecovering: (lifecycleData?.recovery_progress ?? 100) < 100,
    isCritical: (lifecycleData?.inactive_days ?? 0) >= 5,
  };

  // Show death notification when companion dies
  useEffect(() => {
    if (!lifecycle.isAlive && !deathNotificationDismissed && lifecycleData) {
      setShowDeathNotification(true);
    }
  }, [lifecycle.isAlive, deathNotificationDismissed, lifecycleData]);

  // Start fresh mutation (resets companion for new egg)
  const startFresh = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');

      // Delete the dead companion
      const { error: deleteError } = await supabase
        .from('user_companion')
        .delete()
        .eq('user_id', user.id)
        .eq('is_alive', false);

      if (deleteError) {
        console.error('Failed to delete dead companion:', deleteError);
        throw deleteError;
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companion'] });
      queryClient.invalidateQueries({ queryKey: ['companion-lifecycle'] });
      queryClient.invalidateQueries({ queryKey: ['companion-health'] });
    },
  });

  const dismissDeathNotification = () => {
    setShowDeathNotification(false);
    setDeathNotificationDismissed(true);
  };

  return {
    lifecycle,
    memorial,
    isLoading,
    showDeathNotification,
    dismissDeathNotification,
    startFresh: startFresh.mutateAsync,
    isStartingFresh: startFresh.isPending,
    companionData: lifecycleData ? {
      spiritAnimal: lifecycleData.spirit_animal,
      currentStage: lifecycleData.current_stage,
      currentImageUrl: lifecycleData.current_image_url,
    } : null,
  };
};
