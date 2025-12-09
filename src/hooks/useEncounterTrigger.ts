import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { TriggerType } from '@/types/astralEncounters';

interface TriggerResult {
  shouldTrigger: boolean;
  triggerType?: TriggerType;
  sourceId?: string;
  epicProgress?: number;
  epicCategory?: string;
  questInterval?: number; // Number of quests since last encounter (2-4)
}

// Generate random interval between 2-4 quests
const getRandomInterval = () => Math.floor(Math.random() * 3) + 2;
const MIN_QUESTS_BEFORE_ENCOUNTERS = 2;

export const useEncounterTrigger = () => {
  const { user } = useAuth();
  const questCountRef = useRef<number | null>(null);
  const nextEncounterRef = useRef<number | null>(null);
  const encountersEnabledRef = useRef<boolean | null>(null);

  useEffect(() => {
    questCountRef.current = null;
    nextEncounterRef.current = null;
    encountersEnabledRef.current = null;
  }, [user?.id]);

  const ensureEncountersEnabled = useCallback(async () => {
    if (!user?.id) return false;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('astral_encounters_enabled,onboarding_completed,total_quests_completed')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Failed to fetch astral encounter setting', error);
      return false;
    }

    // Astral encounters can be manually disabled from profile settings
    if (profile?.astral_encounters_enabled === false) {
      encountersEnabledRef.current = false;
      return false;
    }

    // Require onboarding to be complete before any encounters unlock
    if (!profile?.onboarding_completed) {
      encountersEnabledRef.current = false;
      return false;
    }

    // Require at least a couple of quest completions before unlocking encounters
    const totalQuestsCompleted = profile?.total_quests_completed ?? 0;
    if (totalQuestsCompleted < MIN_QUESTS_BEFORE_ENCOUNTERS) {
      encountersEnabledRef.current = false;
      return false;
    }

    encountersEnabledRef.current = true;
    return encountersEnabledRef.current;
  }, [user?.id]);

  // Check for quest milestone trigger (random 2-4 quests)
  const checkQuestMilestone = useCallback(async (): Promise<TriggerResult> => {
    if (!user?.id) return { shouldTrigger: false };

    const encountersEnabled = await ensureEncountersEnabled();

    // Fetch current counts if not cached
    if (questCountRef.current === null || nextEncounterRef.current === null) {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('total_quests_completed, next_encounter_quest_count, astral_encounters_enabled')
        .eq('id', user.id)
        .single();

      if (error || !profile) {
        console.error('Failed to fetch quest count', error);
        return { shouldTrigger: false };
      }

      // Check if encounters are disabled
      encountersEnabledRef.current = profile.astral_encounters_enabled !== false;

      if (profile.astral_encounters_enabled === false) {
        // Still update quest count but don't trigger encounters
        questCountRef.current = (profile.total_quests_completed || 0) + 1;
        await supabase
          .from('profiles')
          .update({ total_quests_completed: questCountRef.current })
          .eq('id', user.id);
        return { shouldTrigger: false };
      }

      questCountRef.current = profile.total_quests_completed || 0;
      // If no next encounter set, initialize with random 2-4
      nextEncounterRef.current = profile.next_encounter_quest_count ?? getRandomInterval();
    }

    if (!encountersEnabled) {
      questCountRef.current += 1;
      await supabase
        .from('profiles')
        .update({ total_quests_completed: questCountRef.current })
        .eq('id', user.id);
      return { shouldTrigger: false };
    }

    questCountRef.current += 1;
    const newTotal = questCountRef.current;

    // Check if we've reached the encounter threshold
    const shouldTrigger = newTotal >= (nextEncounterRef.current ?? 0);

    // Calculate next encounter threshold if triggering
    const nextEncounterValue = shouldTrigger 
      ? newTotal + getRandomInterval() 
      : nextEncounterRef.current;

    // Update database with new quest count and potentially new encounter threshold
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        total_quests_completed: newTotal,
        next_encounter_quest_count: nextEncounterValue
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to update quest count', updateError);
      questCountRef.current -= 1;
      return { shouldTrigger: false };
    }

    // Update local ref if triggering
    if (shouldTrigger) {
      nextEncounterRef.current = nextEncounterValue;
    }

    if (shouldTrigger) {
      // Calculate how many quests since last encounter
      const questInterval = newTotal - ((nextEncounterRef.current ?? newTotal) - getRandomInterval());
      return { 
        shouldTrigger: true, 
        triggerType: 'quest_milestone',
        questInterval: Math.min(Math.max(questInterval, 2), 4), // Clamp to 2-4
      };
    }

    return { shouldTrigger: false };
  }, [user?.id, ensureEncountersEnabled]);

  // Check for epic checkpoint trigger (25%, 50%, 75%, 100%)
  const checkEpicCheckpoint = useCallback(async (
    epicId: string,
    previousProgress: number,
    currentProgress: number
  ): Promise<TriggerResult> => {
    if (!user?.id) return { shouldTrigger: false };

    const encountersEnabled = await ensureEncountersEnabled();
    if (!encountersEnabled) return { shouldTrigger: false };

    const milestones = [25, 50, 75, 100];
    
    // Find if we crossed a milestone
    const crossedMilestone = milestones.find(
      m => previousProgress < m && currentProgress >= m
    );

    if (crossedMilestone) {
      // Get epic category for themed adversary
      const { data: epic } = await supabase
        .from('epics')
        .select('title, description')
        .eq('id', epicId)
        .single();

      // Infer category from title/description
      const text = `${epic?.title || ''} ${epic?.description || ''}`.toLowerCase();
      let category = 'general';
      if (text.includes('fitness') || text.includes('workout') || text.includes('exercise')) {
        category = 'fitness';
      } else if (text.includes('meditat') || text.includes('mindful') || text.includes('calm')) {
        category = 'mindfulness';
      } else if (text.includes('read') || text.includes('learn') || text.includes('study')) {
        category = 'learning';
      }

      return {
        shouldTrigger: true,
        triggerType: 'epic_checkpoint',
        sourceId: epicId,
        epicProgress: crossedMilestone,
        epicCategory: category
      };
    }

    return { shouldTrigger: false };
  }, [user?.id, ensureEncountersEnabled]);

  // Check for weekly trigger (once per 7 days)
  const checkWeeklyTrigger = useCallback(async (): Promise<TriggerResult> => {
    if (!user?.id) return { shouldTrigger: false };

    const encountersEnabled = await ensureEncountersEnabled();
    if (!encountersEnabled) return { shouldTrigger: false };

    // Check last weekly encounter
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: recentWeekly } = await supabase
      .from('astral_encounters')
      .select('id')
      .eq('user_id', user.id)
      .eq('trigger_type', 'weekly')
      .gte('created_at', oneWeekAgo)
      .limit(1);

    if (!recentWeekly || recentWeekly.length === 0) {
      return {
        shouldTrigger: true,
        triggerType: 'weekly'
      };
    }

    return { shouldTrigger: false };
  }, [user?.id, ensureEncountersEnabled]);

  return {
    checkQuestMilestone,
    checkEpicCheckpoint,
    checkWeeklyTrigger
  };
};
