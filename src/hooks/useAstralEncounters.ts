import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCompanion } from '@/hooks/useCompanion';
import { useXPRewards } from '@/hooks/useXPRewards';
import { useAchievements } from '@/hooks/useAchievements';
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
 import { useLivingCompanion } from '@/hooks/useLivingCompanion';

export const useAstralEncounters = () => {
  const { user } = useAuth();
  const { companion } = useCompanion();
  const { awardCustomXP } = useXPRewards();
  const { checkAdversaryDefeatAchievements } = useAchievements();
  const queryClient = useQueryClient();
   
   // Living companion reaction system
   let triggerResistVictory: (() => Promise<boolean>) | null = null;
   try {
     const livingCompanion = useLivingCompanion();
     triggerResistVictory = livingCompanion.triggerResistVictory;
   } catch {
     // Context not available (e.g., outside provider) - reactions disabled
   }
  
  const [activeEncounter, setActiveEncounter] = useState<{
    encounter: AstralEncounter;
    adversary: Adversary;
    questInterval?: number;
  } | null>(null);
  const [showEncounterModal, setShowEncounterModal] = useState(false);

  // Fetch user's encounter history
  const { data: encounters, isLoading: encountersLoading } = useQuery({
    queryKey: ['astral-encounters', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('astral_encounters')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as AstralEncounter[];
    },
    enabled: !!user?.id,
  });

  // Fetch collected essences
  const { data: essences, isLoading: essencesLoading } = useQuery({
    queryKey: ['adversary-essences', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('adversary_essences')
        .select('*')
        .eq('user_id', user.id)
        .order('absorbed_at', { ascending: false });
      
      if (error) throw error;
      return data as AdversaryEssence[];
    },
    enabled: !!user?.id,
  });

  // Fetch cosmic codex entries
  const { data: codexEntries, isLoading: codexLoading } = useQuery({
    queryKey: ['cosmic-codex', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('cosmic_codex_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('times_defeated', { ascending: false });
      
      if (error) throw error;
      return data as CosmicCodexEntry[];
    },
    enabled: !!user?.id,
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
      if (!user?.id || !companion?.id) {
        throw new Error('User or companion not found');
      }

      const adversary = generateAdversary(
        params.triggerType,
        params.epicProgress,
        params.epicCategory
      );

      const { data, error } = await supabase
        .from('astral_encounters')
        .insert({
          user_id: user.id,
          companion_id: companion.id,
          adversary_name: adversary.name,
          adversary_theme: adversary.theme,
          adversary_tier: adversary.tier,
          adversary_lore: adversary.lore,
          mini_game_type: adversary.miniGameType,
          trigger_type: params.triggerType,
          trigger_source_id: params.triggerSourceId || null,
          total_phases: adversary.phases,
        })
        .select()
        .single();

      if (error) throw error;
      return { encounter: data as AstralEncounter, adversary, questInterval: params.questInterval };
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
      if (!user?.id || !companion?.id || !activeEncounter) {
        throw new Error('Missing required data');
      }

      const result = getResultFromAccuracy(params.accuracy);
      const xpEarned = calculateXPReward(
        activeEncounter.adversary.tier,
        params.accuracy
      );

      // Update encounter
      const { error: updateError } = await supabase
        .from('astral_encounters')
        .update({
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
        })
        .eq('id', params.encounterId);

      if (updateError) throw updateError;

      // If successful, create essence and update codex
      if (result !== 'fail') {
        // Create essence
        await supabase.from('adversary_essences').insert({
          user_id: user.id,
          companion_id: companion.id,
          encounter_id: params.encounterId,
          essence_name: activeEncounter.adversary.essenceName,
          essence_description: activeEncounter.adversary.essenceDescription,
          stat_type: activeEncounter.adversary.statType,
          stat_boost: activeEncounter.adversary.statBoost,
          adversary_name: activeEncounter.adversary.name,
          adversary_theme: activeEncounter.adversary.theme,
          rarity: activeEncounter.adversary.tier,
        });

        // Update or insert codex entry and check for achievements
        const { data: existingEntry } = await supabase
          .from('cosmic_codex_entries')
          .select('id, times_defeated')
          .eq('user_id', user.id)
          .eq('adversary_theme', activeEncounter.adversary.theme)
          .maybeSingle();

        let newTimesDefeated = 1;
        if (existingEntry) {
          newTimesDefeated = existingEntry.times_defeated + 1;
          await supabase
            .from('cosmic_codex_entries')
            .update({
              times_defeated: newTimesDefeated,
              last_defeated_at: new Date().toISOString(),
            })
            .eq('id', existingEntry.id);
        } else {
          await supabase.from('cosmic_codex_entries').insert({
            user_id: user.id,
            adversary_theme: activeEncounter.adversary.theme,
            adversary_name: activeEncounter.adversary.name,
            adversary_lore: activeEncounter.adversary.lore,
          });
        }

        // Check for theme mastery achievements and potential loot rolls
        const theme = activeEncounter.adversary.theme as AdversaryTheme;
        const { shouldRollLoot, lootTier } = await checkAdversaryDefeatAchievements(theme, newTimesDefeated);

        // Roll for theme-specific loot at milestones
        if (shouldRollLoot && lootTier) {
          // Build rarity filter based on loot tier
          const allowedRarities = lootTier === 'legendary' 
            ? ['rare', 'epic', 'legendary'] 
            : lootTier === 'epic' 
              ? ['rare', 'epic'] 
              : ['rare'];
          
          const { data: themeLoot } = await supabase
            .from('epic_rewards')
            .select('*')
            .eq('adversary_theme', theme)
            .in('rarity', allowedRarities);

          if (themeLoot && themeLoot.length > 0) {
            // Pick a random reward based on weight
            const totalWeight = themeLoot.reduce((sum, r) => sum + (r.drop_weight || 100), 0);
            let random = Math.random() * totalWeight;
            let selectedReward = themeLoot[0];
            
            for (const reward of themeLoot) {
              random -= (reward.drop_weight || 100);
              if (random <= 0) {
                selectedReward = reward;
                break;
              }
            }

            // Check if user already has this reward
            const { data: existing } = await supabase
              .from('user_epic_rewards')
              .select('id')
              .eq('user_id', user.id)
              .eq('reward_id', selectedReward.id)
              .maybeSingle();

            if (!existing) {
              // Award the loot
              await supabase.from('user_epic_rewards').insert({
                user_id: user.id,
                reward_id: selectedReward.id,
              });
              
              toast.success(`🎁 New Loot: ${selectedReward.name}!`, {
                description: selectedReward.description,
              });
            }
          }
        }

        // Update companion stats - validate statType is a valid field
        const statField = activeEncounter.adversary.statType as 'mind' | 'body' | 'soul';
        if (!['mind', 'body', 'soul'].includes(statField)) {
          console.error('Invalid stat type:', statField);
          return { result, xpEarned };
        }
        // Type-safe stat access using object lookup
        const companionStats = {
          mind: companion?.mind ?? 0,
          body: companion?.body ?? 0,
          soul: companion?.soul ?? 0,
        };
        const currentStat = companionStats[statField];
        const newStat = Math.min(100, currentStat + activeEncounter.adversary.statBoost);

        await supabase
          .from('user_companion')
          .update({ [statField]: newStat })
          .eq('id', companion.id);

        // Award XP
        if (xpEarned > 0) {
          await awardCustomXP(xpEarned, 'astral_encounter', `Defeated ${activeEncounter.adversary.name}`);
        }
      }

      // If this was an urge_resist encounter, update habit stats
      if (activeEncounter.encounter.trigger_type === 'urge_resist') {
        const habitId = activeEncounter.encounter.trigger_source_id;
        if (habitId) {
          // Fetch the habit
          const { data: habit } = await supabase
            .from('user_bad_habits')
            .select('*')
            .eq('id', habitId)
            .maybeSingle();

          if (habit) {
            const isSuccess = result !== 'fail';
            const careBoost = isSuccess ? 0.05 : 0;

            // Log the resist attempt
            await supabase.from('resist_log').insert({
              user_id: user.id,
              habit_id: habitId,
              encounter_id: params.encounterId,
              result,
              xp_earned: xpEarned,
              care_boost: careBoost,
            });

            // Calculate streak logic
            const now = new Date();
            const lastResisted = habit.last_resisted_at ? new Date(habit.last_resisted_at) : null;
            const isToday = lastResisted?.toDateString() === now.toDateString();
            const wasYesterday = lastResisted?.toDateString() === new Date(Date.now() - 86400000).toDateString();

            let newStreak = habit.current_streak;
            if (isSuccess) {
              newStreak = wasYesterday ? habit.current_streak + 1 : (isToday ? habit.current_streak : 1);
            } else {
              newStreak = 0;
            }

            // Update habit stats
            await supabase
              .from('user_bad_habits')
              .update({
                times_resisted: habit.times_resisted + (isSuccess ? 1 : 0),
                current_streak: newStreak,
                longest_streak: Math.max(habit.longest_streak, newStreak),
                last_resisted_at: now.toISOString(),
              })
              .eq('id', habitId);

            // Boost companion care_recovery if successful
            if (isSuccess && companion) {
              const currentRecovery = (companion as any).care_recovery ?? 0;
              await supabase
                .from('user_companion')
                .update({
                  care_recovery: Math.min(1, currentRecovery + careBoost),
                })
                .eq('id', companion.id);
            }

            if (isSuccess) {
              toast.success('You resisted! Your companion grows stronger.', {
                description: `+${xpEarned} XP • Streak: ${newStreak}`,
              });
            }
          }
        }
      }

      return { result, xpEarned };
    },
    onSuccess: ({ result, xpEarned }) => {
      queryClient.invalidateQueries({ queryKey: ['astral-encounters'] });
      queryClient.invalidateQueries({ queryKey: ['adversary-essences'] });
      queryClient.invalidateQueries({ queryKey: ['cosmic-codex'] });
      queryClient.invalidateQueries({ queryKey: ['companion'] });
      queryClient.invalidateQueries({ queryKey: ['bad-habits'] });
      queryClient.invalidateQueries({ queryKey: ['resist-log'] });

      // Only show generic victory toast if not urge_resist (resist has its own toast)
      if (result !== 'fail' && activeEncounter?.encounter.trigger_type !== 'urge_resist') {
        toast.success(`Victory! +${xpEarned} XP`);
      }
       
       // Trigger companion reaction on resist victory
       if (result !== 'fail' && activeEncounter?.encounter.trigger_type === 'urge_resist' && triggerResistVictory) {
         triggerResistVictory().catch(err => console.log('[LivingCompanion] Resist trigger failed:', err));
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
    if (!user?.id) return false;
    if (!companion?.id) {
      console.warn('Encounter trigger skipped: companion not ready');
      return false;
    }

    // Check for recent incomplete encounter
    const { data: pendingEncounter } = await supabase
      .from('astral_encounters')
      .select('*')
      .eq('user_id', user.id)
      .is('completed_at', null)
      .maybeSingle();

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
  }, [user?.id, companion?.id, startEncounterMutate]);

  const closeEncounter = useCallback(() => {
    setShowEncounterModal(false);
    setActiveEncounter(null);
  }, []);

  // Pass on an encounter (delete without completing)
  const passEncounter = useCallback(async () => {
    if (!activeEncounter) return;

    try {
      // Delete the incomplete encounter from DB
      await supabase
        .from('astral_encounters')
        .delete()
        .eq('id', activeEncounter.encounter.id);

      // Close modal and clear state
      setActiveEncounter(null);
      setShowEncounterModal(false);
      
      queryClient.invalidateQueries({ queryKey: ['astral-encounters'] });
    } catch (error) {
      console.error('Failed to pass encounter:', error);
    }
  }, [activeEncounter, queryClient]);

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
    passEncounter,
    setShowEncounterModal,
  };
};
