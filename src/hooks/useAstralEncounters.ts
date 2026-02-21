import { useState, useCallback, useRef } from 'react';
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
import { useLivingCompanionSafe } from '@/hooks/useLivingCompanion';

export type EncounterTriggerReason =
  | 'not_authenticated'
  | 'companion_not_ready'
  | 'trigger_in_progress'
  | 'pending_lookup_failed'
  | 'start_failed';

export interface EncounterTriggerResult {
  ok: boolean;
  started: boolean;
  resumed: boolean;
  reason?: EncounterTriggerReason;
}

const RECENT_ADVERSARY_HISTORY_LIMIT = 10;

export const useAstralEncounters = () => {
  const { user } = useAuth();
  const { companion } = useCompanion();
  const { awardCustomXP } = useXPRewards();
  const { checkAdversaryDefeatAchievements } = useAchievements();
  const queryClient = useQueryClient();

  // Living companion reaction system - safe hook returns no-op when outside provider
  const { triggerResistVictory } = useLivingCompanionSafe();

  const throwIfSupabaseError = useCallback((error: { message: string } | null, context: string) => {
    if (error) {
      throw new Error(`${context}: ${error.message}`);
    }
  }, []);

  const isDuplicateActiveEncounterError = useCallback((error: unknown) => {
    if (!error || typeof error !== 'object') return false;

    const maybeError = error as { code?: string; message?: string };
    const code = maybeError.code ?? '';
    const message = maybeError.message ?? '';

    return code === '23505' || message.includes('idx_astral_encounters_one_active_per_user');
  }, []);
  
  const [activeEncounter, setActiveEncounter] = useState<{
    encounter: AstralEncounter;
    adversary: Adversary;
    questInterval?: number;
  } | null>(null);
  const [showEncounterModal, setShowEncounterModal] = useState(false);
  const [isTriggeringEncounter, setIsTriggeringEncounter] = useState(false);
  const triggerInProgressRef = useRef(false);

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

      const recentAdversaryNames = Array.from(
        new Set(
          (encounters ?? [])
            .slice(0, RECENT_ADVERSARY_HISTORY_LIMIT)
            .map((encounter) => encounter.adversary_name?.trim())
            .filter((name): name is string => Boolean(name)),
        ),
      );

      const adversary = generateAdversary(
        params.triggerType,
        params.epicProgress,
        params.epicCategory,
        undefined,
        { avoidNames: recentAdversaryNames },
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
      setShowEncounterModal(false);
      queryClient.invalidateQueries({ queryKey: ['astral-encounters'] });
    },
    onError: (error) => {
      console.error('Failed to start encounter:', error);
      if (!isDuplicateActiveEncounterError(error)) {
        toast.error('Failed to start encounter');
      }
    },
  });

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
        const { error: essenceInsertError } = await supabase.from('adversary_essences').insert({
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
        throwIfSupabaseError(essenceInsertError, 'Failed to insert adversary essence');

        // Update or insert codex entry and check for achievements
        const { data: existingEntry, error: existingEntryError } = await supabase
          .from('cosmic_codex_entries')
          .select('id, times_defeated')
          .eq('user_id', user.id)
          .eq('adversary_theme', activeEncounter.adversary.theme)
          .maybeSingle();
        throwIfSupabaseError(existingEntryError, 'Failed to query cosmic codex entry');

        let newTimesDefeated = 1;
        if (existingEntry) {
          newTimesDefeated = existingEntry.times_defeated + 1;
          const { error: codexUpdateError } = await supabase
            .from('cosmic_codex_entries')
            .update({
              times_defeated: newTimesDefeated,
              last_defeated_at: new Date().toISOString(),
            })
            .eq('id', existingEntry.id);
          throwIfSupabaseError(codexUpdateError, 'Failed to update cosmic codex entry');
        } else {
          const { error: codexInsertError } = await supabase.from('cosmic_codex_entries').insert({
            user_id: user.id,
            adversary_theme: activeEncounter.adversary.theme,
            adversary_name: activeEncounter.adversary.name,
            adversary_lore: activeEncounter.adversary.lore,
          });
          throwIfSupabaseError(codexInsertError, 'Failed to insert cosmic codex entry');
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
          
          const { data: themeLoot, error: themeLootError } = await supabase
            .from('epic_rewards')
            .select('*')
            .eq('adversary_theme', theme)
            .in('rarity', allowedRarities);
          throwIfSupabaseError(themeLootError, 'Failed to fetch theme loot');

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
            const { data: existing, error: existingRewardError } = await supabase
              .from('user_epic_rewards')
              .select('id')
              .eq('user_id', user.id)
              .eq('reward_id', selectedReward.id)
              .maybeSingle();
            throwIfSupabaseError(existingRewardError, 'Failed to check existing epic reward');

            if (!existing) {
              // Award the loot
              const { error: rewardInsertError } = await supabase.from('user_epic_rewards').insert({
                user_id: user.id,
                reward_id: selectedReward.id,
              });
              throwIfSupabaseError(rewardInsertError, 'Failed to award epic reward');
              
              toast.success(`🎁 New Loot: ${selectedReward.name}!`, {
                description: selectedReward.description,
              });
            }
          }
        }

        // Update companion stats - validate statType is a valid field
        // Map old stat types to new 6-stat system
        const statTypeMapping: Record<'mind' | 'body' | 'soul', 'wisdom' | 'vitality' | 'resolve'> = {
          'mind': 'wisdom',
          'body': 'vitality', 
          'soul': 'resolve',
        };
        const oldStatField = activeEncounter.adversary.statType as 'mind' | 'body' | 'soul';
        const newStatField = statTypeMapping[oldStatField];
        if (!newStatField) {
          console.error('Invalid stat type:', oldStatField);
          return { result, xpEarned };
        }
        // Type-safe stat access using new 6-stat system
        const companionStatsNew = {
          vitality: companion?.vitality ?? 300,
          wisdom: companion?.wisdom ?? 300,
          discipline: companion?.discipline ?? 300,
          resolve: companion?.resolve ?? 300,
          creativity: companion?.creativity ?? 300,
          alignment: companion?.alignment ?? 300,
        };
        const currentStat = companionStatsNew[newStatField];
        const newStat = Math.min(1000, currentStat + activeEncounter.adversary.statBoost * 3);

        const { error: companionUpdateError } = await supabase
          .from('user_companion')
          .update({ [newStatField]: newStat })
          .eq('id', companion.id);
        throwIfSupabaseError(companionUpdateError, 'Failed to update companion stats');

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
          const { data: habit, error: habitQueryError } = await supabase
            .from('user_bad_habits')
            .select('*')
            .eq('id', habitId)
            .maybeSingle();
          throwIfSupabaseError(habitQueryError, 'Failed to fetch bad habit');

          if (habit) {
            const isSuccess = result !== 'fail';
            const careBoost = isSuccess ? 0.05 : 0;

            // Log the resist attempt
            const { error: resistLogInsertError } = await supabase.from('resist_log').insert({
              user_id: user.id,
              habit_id: habitId,
              encounter_id: params.encounterId,
              result,
              xp_earned: xpEarned,
              care_boost: careBoost,
            });
            throwIfSupabaseError(resistLogInsertError, 'Failed to write resist log');

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
            const { error: habitUpdateError } = await supabase
              .from('user_bad_habits')
              .update({
                times_resisted: habit.times_resisted + (isSuccess ? 1 : 0),
                current_streak: newStreak,
                longest_streak: Math.max(habit.longest_streak, newStreak),
                last_resisted_at: now.toISOString(),
              })
              .eq('id', habitId);
            throwIfSupabaseError(habitUpdateError, 'Failed to update bad habit stats');

            // Boost companion care_recovery if successful
            if (isSuccess && companion) {
              const currentRecovery = (companion as any).care_recovery ?? 0;
              const { error: recoveryUpdateError } = await supabase
                .from('user_companion')
                .update({
                  care_recovery: Math.min(1, currentRecovery + careBoost),
                })
                .eq('id', companion.id);
              throwIfSupabaseError(recoveryUpdateError, 'Failed to update companion care recovery');
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
       if (result !== 'fail' && activeEncounter?.encounter.trigger_type === 'urge_resist') {
         triggerResistVictory().catch(err => console.log('[LivingCompanion] Resist trigger failed:', err));
       }
    },
    onError: (error) => {
      console.error('Failed to complete encounter:', error);
      toast.error('Failed to complete encounter');
    },
  });

  const buildAdversaryFromEncounter = useCallback((storedEncounter: AstralEncounter): Adversary => {
    const theme = storedEncounter.adversary_theme as AdversaryTheme;
    const tier = storedEncounter.adversary_tier as AdversaryTier;

    return {
      name: storedEncounter.adversary_name,
      theme,
      tier,
      lore: storedEncounter.adversary_lore || '',
      miniGameType: storedEncounter.mini_game_type as MiniGameType,
      phases: storedEncounter.total_phases || 1,
      essenceName: `Essence of ${storedEncounter.adversary_name}`,
      essenceDescription: `Power absorbed from defeating ${storedEncounter.adversary_name}`,
      statType: THEME_STAT_MAP[theme] || 'mind',
      statBoost: TIER_CONFIG[tier]?.statBoost || 1,
    };
  }, []);

  // Check if encounter should trigger
  const checkEncounterTrigger = useCallback(async (
    triggerType: TriggerType,
    triggerSourceId?: string,
    epicProgress?: number,
    epicCategory?: string,
    questInterval?: number
  ): Promise<EncounterTriggerResult> => {
    if (!user?.id) {
      return { ok: false, started: false, resumed: false, reason: 'not_authenticated' };
    }

    if (!companion?.id) {
      console.warn('Encounter trigger skipped: companion not ready');
      return { ok: false, started: false, resumed: false, reason: 'companion_not_ready' };
    }

    if (triggerInProgressRef.current) {
      return { ok: false, started: false, resumed: false, reason: 'trigger_in_progress' };
    }

    triggerInProgressRef.current = true;
    setIsTriggeringEncounter(true);

    try {
      // Find unfinished encounters (keep newest, close stale duplicates)
      const { data: pendingEncounters, error: pendingLookupError } = await supabase
        .from('astral_encounters')
        .select('*')
        .eq('user_id', user.id)
        .is('completed_at', null)
        .order('created_at', { ascending: false })
        .limit(20);

      if (pendingLookupError) {
        console.error('Failed to lookup pending encounters:', pendingLookupError);
        return { ok: false, started: false, resumed: false, reason: 'pending_lookup_failed' };
      }

      const pendingList = (pendingEncounters as AstralEncounter[] | null) ?? [];
      const newestPending = pendingList[0] ?? null;
      const stalePendingIds = pendingList.slice(1).map((encounter) => encounter.id);

      if (stalePendingIds.length > 0) {
        const { error: staleCloseError } = await supabase
          .from('astral_encounters')
          .update({ completed_at: new Date().toISOString() })
          .in('id', stalePendingIds)
          .is('completed_at', null);

        if (staleCloseError) {
          console.error('Failed to close stale pending encounters:', staleCloseError);
        }
      }

      if (newestPending) {
        const adversary = buildAdversaryFromEncounter(newestPending);
        setActiveEncounter({ encounter: newestPending, adversary, questInterval: questInterval ?? 3 });
        setShowEncounterModal(false);
        return { ok: true, started: false, resumed: true };
      }

      // Start a new encounter and wait for state write before unlocking UI.
      await startEncounterMutation.mutateAsync({
        triggerType,
        triggerSourceId,
        epicProgress,
        epicCategory,
        questInterval,
      });

      return { ok: true, started: true, resumed: false };
    } catch (error) {
      if (isDuplicateActiveEncounterError(error)) {
        const { data: conflictPending, error: conflictLookupError } = await supabase
          .from('astral_encounters')
          .select('*')
          .eq('user_id', user.id)
          .is('completed_at', null)
          .order('created_at', { ascending: false })
          .limit(1);

        if (conflictLookupError) {
          console.error('Failed to recover pending encounter after duplicate create:', conflictLookupError);
          return { ok: false, started: false, resumed: false, reason: 'pending_lookup_failed' };
        }

        const recoveredEncounter = (conflictPending as AstralEncounter[] | null)?.[0];
        if (recoveredEncounter) {
          const adversary = buildAdversaryFromEncounter(recoveredEncounter);
          setActiveEncounter({ encounter: recoveredEncounter, adversary, questInterval: questInterval ?? 3 });
          setShowEncounterModal(false);
          return { ok: true, started: false, resumed: true };
        }
      }

      console.error('Failed to trigger encounter:', error);
      return { ok: false, started: false, resumed: false, reason: 'start_failed' };
    } finally {
      triggerInProgressRef.current = false;
      setIsTriggeringEncounter(false);
    }
  }, [
    user?.id,
    companion?.id,
    buildAdversaryFromEncounter,
    isDuplicateActiveEncounterError,
    startEncounterMutation,
  ]);

  const closeEncounter = useCallback(() => {
    setShowEncounterModal(false);
    setActiveEncounter(null);
  }, []);

  // Pass on an encounter (delete without completing)
  const passEncounter = useCallback(async () => {
    if (!activeEncounter) return false;

    try {
      // Delete the incomplete encounter from DB
      const { error: deleteError } = await supabase
        .from('astral_encounters')
        .delete()
        .eq('id', activeEncounter.encounter.id);
      throwIfSupabaseError(deleteError, 'Failed to delete encounter');

      // Close modal and clear state
      setActiveEncounter(null);
      setShowEncounterModal(false);
      
      queryClient.invalidateQueries({ queryKey: ['astral-encounters'] });
      return true;
    } catch (error) {
      console.error('Failed to pass encounter:', error);
      toast.error('Failed to pass encounter');
      return false;
    }
  }, [activeEncounter, queryClient, throwIfSupabaseError]);

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
    isTriggeringEncounter,
    isCompleting: completeEncounter.isPending,
    
    // Actions
    startEncounter: startEncounterMutation.mutate,
    startEncounterAsync: startEncounterMutation.mutateAsync,
    completeEncounter: completeEncounter.mutate,
    completeEncounterAsync: completeEncounter.mutateAsync,
    checkEncounterTrigger,
    closeEncounter,
    passEncounter,
    setShowEncounterModal,
  };
};
