import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { TriggerType } from '@/types/astralEncounters';

interface TriggerResult {
  shouldTrigger: boolean;
  triggerType?: TriggerType;
  sourceId?: string;
  epicProgress?: number;
  epicCategory?: string;
}

// Generate random interval between 2-4
const getRandomInterval = () => Math.floor(Math.random() * 3) + 2;

export const useEncounterTrigger = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const questCountRef = useRef<number | null>(null);
  const nextEncounterRef = useRef<number | null>(null);
  const encountersEnabledRef = useRef<boolean | null>(null);

  useEffect(() => {
    questCountRef.current = null;
    nextEncounterRef.current = null;
    encountersEnabledRef.current = null;
  }, [user?.id]);

  useEffect(() => {
    questCountRef.current = null;
    nextEncounterRef.current = null;
    if (profile?.astral_encounters_enabled !== undefined && profile?.astral_encounters_enabled !== null) {
      encountersEnabledRef.current = profile.astral_encounters_enabled !== false;
    }
  }, [profile?.astral_encounters_enabled]);

  const ensureEncountersEnabled = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false;

    if (profile?.astral_encounters_enabled !== undefined && profile?.astral_encounters_enabled !== null) {
      const isEnabled = profile.astral_encounters_enabled !== false;
      encountersEnabledRef.current = isEnabled;
      return isEnabled;
    }

    if (encountersEnabledRef.current !== null) {
      return encountersEnabledRef.current;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('astral_encounters_enabled')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Failed to verify astral encounters setting', error);
      encountersEnabledRef.current = true;
      return true;
    }

    const isEnabled = data?.astral_encounters_enabled !== false;
    encountersEnabledRef.current = isEnabled;
    return isEnabled;
  }, [profile?.astral_encounters_enabled, user?.id]);

  // Check for quest milestone trigger (random 2-4 quests)
  const checkQuestMilestone = useCallback(async (): Promise<TriggerResult> => {
    if (!user?.id) return { shouldTrigger: false };

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

      encountersEnabledRef.current = profile.astral_encounters_enabled !== false;

      // Check if encounters are disabled
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

    if (!encountersEnabledRef.current) {
      return { shouldTrigger: false };
    }

    if (shouldTrigger) {
      return { 
        shouldTrigger: true, 
        triggerType: 'quest_milestone',
      };
    }

    return { shouldTrigger: false };
  }, [user?.id]);

  // Check for epic checkpoint trigger (25%, 50%, 75%, 100%)
  const checkEpicCheckpoint = useCallback(async (
    epicId: string,
    previousProgress: number,
    currentProgress: number
  ): Promise<TriggerResult> => {
    if (!user?.id) return { shouldTrigger: false };

    if (!(await ensureEncountersEnabled())) {
      return { shouldTrigger: false };
    }

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
  }, [ensureEncountersEnabled, user?.id]);

  // Check for weekly trigger (once per 7 days)
  const checkWeeklyTrigger = useCallback(async (): Promise<TriggerResult> => {
    if (!user?.id) return { shouldTrigger: false };

    if (!(await ensureEncountersEnabled())) {
      return { shouldTrigger: false };
    }

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
  }, [ensureEncountersEnabled, user?.id]);

  return {
    checkQuestMilestone,
    checkEpicCheckpoint,
    checkWeeklyTrigger
  };
};
