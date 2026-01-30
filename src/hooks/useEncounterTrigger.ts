import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { TriggerType } from '@/types/astralEncounters';

export type ActivityType = 'quest' | 'epic_checkin' | 'daily_mission' | 'morning_checkin';

interface TriggerResult {
  shouldTrigger: boolean;
  triggerType?: TriggerType;
  sourceId?: string;
  epicProgress?: number;
  epicCategory?: string;
  activityInterval?: number; // Number of activities since last encounter (2-5)
  activityType?: ActivityType;
}

// Generate random interval between 4-6 activities
const getRandomInterval = () => Math.floor(Math.random() * 3) + 4;
const MIN_ACTIVITIES_BEFORE_ENCOUNTERS = 4;

export const useEncounterTrigger = () => {
  const { user } = useAuth();
  const activityCountRef = useRef<number | null>(null);
  const nextEncounterRef = useRef<number | null>(null);
  const encountersEnabledRef = useRef<boolean | null>(null);

  useEffect(() => {
    activityCountRef.current = null;
    nextEncounterRef.current = null;
    encountersEnabledRef.current = null;
  }, [user?.id]);

  const ensureEncountersEnabled = useCallback(async () => {
    if (!user?.id) return false;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('astral_encounters_enabled,onboarding_completed,total_quests_completed')
      .eq('id', user.id)
      .maybeSingle();

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

    // Require at least a couple of activities before unlocking encounters
    // We use total_quests_completed as the unified activity counter
    const totalActivities = profile?.total_quests_completed ?? 0;
    if (totalActivities < MIN_ACTIVITIES_BEFORE_ENCOUNTERS) {
      encountersEnabledRef.current = false;
      return false;
    }

    encountersEnabledRef.current = true;
    return encountersEnabledRef.current;
  }, [user?.id]);

  // Unified activity milestone check (quests AND epic check-ins use same counter)
  const checkActivityMilestone = useCallback(async (
    activityType: ActivityType,
    epicId?: string,
    epicProgress?: number
  ): Promise<TriggerResult> => {
    if (!user?.id) return { shouldTrigger: false };

    const encountersEnabled = await ensureEncountersEnabled();

    // Fetch current counts if not cached
    if (activityCountRef.current === null || nextEncounterRef.current === null) {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('total_quests_completed, next_encounter_quest_count, astral_encounters_enabled')
        .eq('id', user.id)
        .maybeSingle();

      if (error || !profile) {
        console.error('Failed to fetch activity count', error);
        return { shouldTrigger: false };
      }

      // Check if encounters are disabled
      encountersEnabledRef.current = profile.astral_encounters_enabled !== false;

      if (profile.astral_encounters_enabled === false) {
        // Still update activity count but don't trigger encounters
        activityCountRef.current = (profile.total_quests_completed || 0) + 1;
        await supabase
          .from('profiles')
          .update({ total_quests_completed: activityCountRef.current })
          .eq('id', user.id);
        return { shouldTrigger: false };
      }

      activityCountRef.current = profile.total_quests_completed || 0;
      // If no next encounter set, initialize with random 2-4
      nextEncounterRef.current = profile.next_encounter_quest_count ?? getRandomInterval();
    }

    if (!encountersEnabled) {
      activityCountRef.current += 1;
      await supabase
        .from('profiles')
        .update({ total_quests_completed: activityCountRef.current })
        .eq('id', user.id);
      return { shouldTrigger: false };
    }

    activityCountRef.current += 1;
    const newTotal = activityCountRef.current;

    // Check if we've reached the encounter threshold
    const shouldTrigger = newTotal >= (nextEncounterRef.current ?? 0);

    // Calculate next encounter threshold if triggering
    const nextEncounterValue = shouldTrigger 
      ? newTotal + getRandomInterval() 
      : nextEncounterRef.current;

    // Update database with new activity count and potentially new encounter threshold
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        total_quests_completed: newTotal,
        next_encounter_quest_count: nextEncounterValue
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to update activity count', updateError);
      activityCountRef.current -= 1;
      return { shouldTrigger: false };
    }

    // Update local ref if triggering
    if (shouldTrigger) {
      nextEncounterRef.current = nextEncounterValue;
    }

    if (shouldTrigger) {
      // Get epic category if this was an epic check-in
      let epicCategory: string | undefined;
      if (activityType === 'epic_checkin' && epicId) {
        const { data: epic } = await supabase
          .from('epics')
          .select('title, description')
          .eq('id', epicId)
          .maybeSingle();

        // Infer category from title/description
        const text = `${epic?.title || ''} ${epic?.description || ''}`.toLowerCase();
        if (text.includes('fitness') || text.includes('workout') || text.includes('exercise')) {
          epicCategory = 'fitness';
        } else if (text.includes('meditat') || text.includes('mindful') || text.includes('calm')) {
          epicCategory = 'mindfulness';
        } else if (text.includes('read') || text.includes('learn') || text.includes('study')) {
          epicCategory = 'learning';
        } else {
          epicCategory = 'general';
        }
      }

      return { 
        shouldTrigger: true, 
        triggerType: activityType === 'quest' ? 'quest_milestone' : 'epic_checkpoint',
        sourceId: epicId,
        epicProgress,
        epicCategory,
        activityInterval: getRandomInterval(), // Report the interval used
        activityType,
      };
    }

    return { shouldTrigger: false };
  }, [user?.id, ensureEncountersEnabled]);

  return {
    checkActivityMilestone
  };
};
