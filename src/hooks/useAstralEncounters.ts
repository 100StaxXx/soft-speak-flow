import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDocuments, getDocument, setDocument, updateDocument, timestampToISO } from '@/lib/firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { useCompanion } from '@/hooks/useCompanion';
import { useXPRewards } from '@/hooks/useXPRewards';
import { 
  Adversary, 
  AstralEncounter, 
  AdversaryEssence, 
  CosmicCodexEntry,
  TriggerType,
  AdversaryTheme,
  AdversaryTier,
  MiniGameType,
  THEME_STAT_MAP,
  TIER_CONFIG
} from '@/types/astralEncounters';
import { 
  generateAdversary, 
  calculateXPReward, 
  getResultFromAccuracy 
} from '@/utils/adversaryGenerator';
import { toast } from 'sonner';

export const useAstralEncounters = () => {
  const { user } = useAuth();
  const { companion } = useCompanion();
  const { awardCustomXP } = useXPRewards();
  const queryClient = useQueryClient();
  
  const [activeEncounter, setActiveEncounter] = useState<{
    encounter: AstralEncounter;
    adversary: Adversary;
    questInterval?: number;
  } | null>(null);
  const [showEncounterModal, setShowEncounterModal] = useState(false);

  // Fetch user's encounter history
  const { data: encounters, isLoading: encountersLoading } = useQuery({
    queryKey: ['astral-encounters', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      const data = await getDocuments<AstralEncounter>(
        'astral_encounters',
        [['user_id', '==', user.uid]],
        'created_at',
        'desc',
        50
      );
      
      return data.map(encounter => ({
        ...encounter,
        created_at: timestampToISO(encounter.created_at as any) || encounter.created_at || new Date().toISOString(),
        completed_at: timestampToISO(encounter.completed_at as any) || encounter.completed_at,
        retry_available_at: timestampToISO(encounter.retry_available_at as any) || encounter.retry_available_at,
      }));
    },
    enabled: !!user?.uid,
  });

  // Fetch collected essences
  const { data: essences, isLoading: essencesLoading } = useQuery({
    queryKey: ['adversary-essences', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      const data = await getDocuments<AdversaryEssence>(
        'adversary_essences',
        [['user_id', '==', user.uid]],
        'absorbed_at',
        'desc'
      );
      
      return data.map(essence => ({
        ...essence,
        absorbed_at: timestampToISO(essence.absorbed_at as any) || essence.absorbed_at || new Date().toISOString(),
      }));
    },
    enabled: !!user?.uid,
  });

  // Fetch cosmic codex entries
  const { data: codexEntries, isLoading: codexLoading } = useQuery({
    queryKey: ['cosmic-codex', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      const data = await getDocuments<CosmicCodexEntry>(
        'cosmic_codex_entries',
        [['user_id', '==', user.uid]],
        'times_defeated',
        'desc'
      );
      
      return data.map(entry => ({
        ...entry,
        last_defeated_at: timestampToISO(entry.last_defeated_at as any) || entry.last_defeated_at,
      }));
    },
    enabled: !!user?.uid,
  });

  // Calculate total stat boosts from essences
  const totalStatBoosts = essences?.reduce(
    (acc, essence) => {
      const statType = essence.stat_type as 'mind' | 'body' | 'soul';
      acc[statType] = (acc[statType] || 0) + essence.stat_boost;
      return acc;
    },
    { mind: 0, body: 0, soul: 0 }
  ) || { mind: 0, body: 0, soul: 0 };

  // Start a new encounter
  const startEncounterMutation = useMutation({
    mutationFn: async (params: {
      triggerType: TriggerType;
      triggerSourceId?: string;
      epicProgress?: number;
      epicCategory?: string;
      questInterval?: number;
    }) => {
      if (!user?.uid || !companion?.id) {
        throw new Error('User or companion not found');
      }

      const adversary = generateAdversary(
        params.triggerType,
        params.epicProgress,
        params.epicCategory
      );

      const encounterId = `${user.uid}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const encounterData = {
        id: encounterId,
        user_id: user.uid,
        companion_id: companion.id,
        adversary_name: adversary.name,
        adversary_theme: adversary.theme,
        adversary_tier: adversary.tier,
        adversary_lore: adversary.lore,
        mini_game_type: adversary.miniGameType,
        trigger_type: params.triggerType,
        trigger_source_id: params.triggerSourceId || null,
        total_phases: adversary.phases,
      };

      await setDocument('astral_encounters', encounterId, encounterData, false);
      return { encounter: encounterData as AstralEncounter, adversary, questInterval: params.questInterval };
    },
    onSuccess: ({ encounter, adversary, questInterval }) => {
      setActiveEncounter({ encounter, adversary, questInterval });
      setShowEncounterModal(true);
      queryClient.invalidateQueries({ queryKey: ['astral-encounters'] });
    },
    onError: (error) => {
      console.error('Failed to start encounter:', error);
      toast.error('Failed to start encounter');
    },
  });

  const startEncounterMutate = startEncounterMutation.mutate;

  // Complete an encounter
  const completeEncounter = useMutation({
    mutationFn: async (params: {
      encounterId: string;
      accuracy: number;
      phasesCompleted: number;
    }) => {
      if (!user?.uid || !companion?.id || !activeEncounter) {
        throw new Error('Missing required data');
      }

      const result = getResultFromAccuracy(params.accuracy);
      const xpEarned = calculateXPReward(
        activeEncounter.adversary.tier,
        params.accuracy
      );

      // Update encounter
      await updateDocument('astral_encounters', params.encounterId, {
        result,
        accuracy_score: params.accuracy,
        xp_earned: xpEarned,
        essence_earned: result !== 'fail' ? activeEncounter.adversary.essenceName : null,
        stat_boost_type: result !== 'fail' ? activeEncounter.adversary.statType : null,
        stat_boost_amount: result !== 'fail' ? activeEncounter.adversary.statBoost : 0,
        phases_completed: params.phasesCompleted,
        completed_at: new Date().toISOString(),
        retry_available_at: result === 'fail' 
          ? new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString() 
          : null,
      });

      // If successful, create essence and update codex
      if (result !== 'fail') {
        // Create essence
        const essenceId = `${user.uid}_${params.encounterId}_${Date.now()}`;
        await setDocument('adversary_essences', essenceId, {
          id: essenceId,
          user_id: user.uid,
          companion_id: companion.id,
          encounter_id: params.encounterId,
          essence_name: activeEncounter.adversary.essenceName,
          essence_description: activeEncounter.adversary.essenceDescription,
          stat_type: activeEncounter.adversary.statType,
          stat_boost: activeEncounter.adversary.statBoost,
          adversary_name: activeEncounter.adversary.name,
          adversary_theme: activeEncounter.adversary.theme,
          rarity: activeEncounter.adversary.tier,
          absorbed_at: new Date().toISOString(),
        }, false);

        // Update or insert codex entry
        const existingEntries = await getDocuments(
          'cosmic_codex_entries',
          [
            ['user_id', '==', user.uid],
            ['adversary_theme', '==', activeEncounter.adversary.theme],
          ]
        );

        if (existingEntries.length > 0) {
          const existingEntry = existingEntries[0];
          await updateDocument('cosmic_codex_entries', existingEntry.id, {
            times_defeated: (existingEntry.times_defeated || 0) + 1,
            last_defeated_at: new Date().toISOString(),
          });
        } else {
          const codexId = `${user.uid}_${activeEncounter.adversary.theme}`;
          await setDocument('cosmic_codex_entries', codexId, {
            id: codexId,
            user_id: user.uid,
            adversary_theme: activeEncounter.adversary.theme,
            adversary_name: activeEncounter.adversary.name,
            adversary_lore: activeEncounter.adversary.lore,
            times_defeated: 1,
            last_defeated_at: new Date().toISOString(),
          }, false);
        }

        // Update companion stats - validate statType is a valid field
        const statField = activeEncounter.adversary.statType as 'mind' | 'body' | 'soul';
        if (!['mind', 'body', 'soul'].includes(statField)) {
          console.error('Invalid stat type:', statField);
          return { result, xpEarned };
        }
        const currentStat = (companion as any)[statField] || 0;
        const newStat = Math.min(100, currentStat + activeEncounter.adversary.statBoost);

        await updateDocument('user_companion', companion.id, {
          [statField]: newStat,
        });

        // Award XP
        if (xpEarned > 0) {
          await awardCustomXP(xpEarned, 'astral_encounter', `Defeated ${activeEncounter.adversary.name}`);
        }
      }

      return { result, xpEarned };
    },
    onSuccess: ({ result, xpEarned }) => {
      queryClient.invalidateQueries({ queryKey: ['astral-encounters'] });
      queryClient.invalidateQueries({ queryKey: ['adversary-essences'] });
      queryClient.invalidateQueries({ queryKey: ['cosmic-codex'] });
      queryClient.invalidateQueries({ queryKey: ['companion'] });

      if (result !== 'fail') {
        toast.success(`Victory! +${xpEarned} XP`);
      }
    },
    onError: (error) => {
      console.error('Failed to complete encounter:', error);
      toast.error('Failed to complete encounter');
    },
  });

  // Check if encounter should trigger
  const checkEncounterTrigger = useCallback(async (
    triggerType: TriggerType,
    triggerSourceId?: string,
    epicProgress?: number,
    epicCategory?: string,
    questInterval?: number
  ) => {
    if (!user?.uid) return false;
    if (!companion?.id) {
      console.warn('Encounter trigger skipped: companion not ready');
      return false;
    }

    // Check for recent incomplete encounter
    const pendingEncounters = await getDocuments(
      'astral_encounters',
      [
        ['user_id', '==', user.uid],
      ]
    );

    const pendingEncounter = pendingEncounters.find(e => !e.completed_at);

    if (pendingEncounter) {
      // Resume pending encounter - reconstruct adversary from stored data
      const storedEncounter = pendingEncounter as AstralEncounter;
      const theme = storedEncounter.adversary_theme as AdversaryTheme;
      const tier = storedEncounter.adversary_tier as AdversaryTier;
      const adversary: Adversary = {
        name: storedEncounter.adversary_name,
        theme,
        tier,
        lore: storedEncounter.adversary_lore || '',
        miniGameType: storedEncounter.mini_game_type as MiniGameType,
        phases: storedEncounter.total_phases || 1,
        // Use theme-stat mapping for essence details
        essenceName: `Essence of ${storedEncounter.adversary_name}`,
        essenceDescription: `Power absorbed from defeating ${storedEncounter.adversary_name}`,
        statType: THEME_STAT_MAP[theme] || 'mind',
        statBoost: TIER_CONFIG[tier]?.statBoost || 1,
      };
      setActiveEncounter({ encounter: storedEncounter, adversary, questInterval: 3 }); // Default for resumed
      setShowEncounterModal(true);
      return true;
    }

    // Start new encounter
    startEncounterMutate({ 
      triggerType, 
      triggerSourceId, 
      epicProgress, 
      epicCategory,
      questInterval
    });
    return true;
  }, [user?.uid, companion?.id, startEncounterMutate]);

  const closeEncounter = useCallback(() => {
    setShowEncounterModal(false);
    setActiveEncounter(null);
  }, []);

  return {
    // State
    activeEncounter,
    showEncounterModal,
    
    // Data
    encounters,
    essences,
    codexEntries,
    totalStatBoosts,
    
    // Loading states
    isLoading: encountersLoading || essencesLoading || codexLoading,
    isStarting: startEncounterMutation.isPending,
    isCompleting: completeEncounter.isPending,
    
    // Actions
    startEncounter: startEncounterMutate,
    completeEncounter: completeEncounter.mutate,
    checkEncounterTrigger,
    closeEncounter,
    setShowEncounterModal,
  };
};
