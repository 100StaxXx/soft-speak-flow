import { useCallback, useEffect, useRef } from 'react';
import { getDocument, getDocuments, updateDocument, timestampToISO } from '@/lib/firebase/firestore';
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
  }, [user?.uid]);

  const ensureEncountersEnabled = useCallback(async () => {
    if (!user?.uid) return false;

    const profile = await getDocument<{
      astral_encounters_enabled: boolean | null;
      onboarding_completed: boolean | null;
      total_quests_completed: number;
    }>('profiles', user.uid);

    if (!profile) {
      console.error('Failed to fetch astral encounter setting');
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
  }, [user?.uid]);

  // Check for quest milestone trigger (random 2-4 quests)
  const checkQuestMilestone = useCallback(async (): Promise<TriggerResult> => {
    if (!user?.uid) return { shouldTrigger: false };

    const encountersEnabled = await ensureEncountersEnabled();

    // Fetch current counts if not cached
    if (questCountRef.current === null || nextEncounterRef.current === null) {
      const profile = await getDocument<{
        total_quests_completed: number;
        next_encounter_quest_count: number | null;
        astral_encounters_enabled: boolean | null;
      }>('profiles', user.uid);

      if (!profile) {
        console.error('Failed to fetch quest count');
        return { shouldTrigger: false };
      }

      // Check if encounters are disabled
      encountersEnabledRef.current = profile.astral_encounters_enabled !== false;

      if (profile.astral_encounters_enabled === false) {
        // Still update quest count but don't trigger encounters
        questCountRef.current = (profile.total_quests_completed || 0) + 1;
        await updateDocument('profiles', user.uid, {
          total_quests_completed: questCountRef.current,
        });
        return { shouldTrigger: false };
      }

      questCountRef.current = profile.total_quests_completed || 0;
      // If no next encounter set, initialize to current count + random interval
      const nextEncounter = profile.next_encounter_quest_count;
      if (nextEncounter === null || nextEncounter === undefined) {
        nextEncounterRef.current = questCountRef.current + getRandomInterval();
      } else {
        nextEncounterRef.current = nextEncounter;
      }
    }

    if (!encountersEnabled) {
      questCountRef.current += 1;
      await updateDocument('profiles', user.uid, {
        total_quests_completed: questCountRef.current,
      });
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
    // NOTE: This is not atomic - if multiple quests complete simultaneously, counts could be lost.
    // Consider using Firestore transactions or incrementField() for atomic updates in the future.
    try {
      await updateDocument('profiles', user.uid, {
        total_quests_completed: newTotal,
        next_encounter_quest_count: nextEncounterValue,
      });
    } catch (updateError) {
      console.error('Failed to update quest count', updateError);
      questCountRef.current -= 1;
      return { shouldTrigger: false };
    }

    if (shouldTrigger) {
      // Calculate interval BEFORE updating ref
      const previousThreshold = nextEncounterRef.current ?? (newTotal - getRandomInterval());
      const questInterval = newTotal - previousThreshold;
      
      // Update ref for next time
      nextEncounterRef.current = nextEncounterValue;
      
      return { 
        shouldTrigger: true, 
        triggerType: 'quest_milestone',
        questInterval: Math.min(Math.max(questInterval, 2), 4), // Clamp to 2-4
      };
    }

    return { shouldTrigger: false };
  }, [user?.uid, ensureEncountersEnabled]);

  // Check for epic checkpoint trigger (25%, 50%, 75%, 100%)
  const checkEpicCheckpoint = useCallback(async (
    epicId: string,
    previousProgress: number,
    currentProgress: number
  ): Promise<TriggerResult> => {
    if (!user?.uid) return { shouldTrigger: false };

    const encountersEnabled = await ensureEncountersEnabled();
    if (!encountersEnabled) return { shouldTrigger: false };

    const milestones = [25, 50, 75, 100];
    
    // Find if we crossed a milestone
    const crossedMilestone = milestones.find(
      m => previousProgress < m && currentProgress >= m
    );

    if (crossedMilestone) {
      // Get epic category for themed adversary
      const epic = await getDocument<{ title: string; description: string }>('epics', epicId);
      
      if (!epic) {
        console.warn(`Epic ${epicId} not found, using default category`);
      }

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
  }, [user?.uid, ensureEncountersEnabled]);

  // Check for weekly trigger (once per 7 days)
  const checkWeeklyTrigger = useCallback(async (): Promise<TriggerResult> => {
    if (!user?.uid) return { shouldTrigger: false };

    const encountersEnabled = await ensureEncountersEnabled();
    if (!encountersEnabled) return { shouldTrigger: false };

    // Check last weekly encounter
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const recentWeekly = await getDocuments(
      'astral_encounters',
      [
        ['user_id', '==', user.uid],
        ['trigger_type', '==', 'weekly'],
      ],
      'created_at',
      'desc',
      1
    );

    // Check if any encounter was created within the last week
    const hasRecentWeekly = recentWeekly.some(encounter => {
      const createdAt = timestampToISO(encounter.created_at as any) || encounter.created_at;
      return createdAt && new Date(createdAt) >= oneWeekAgo;
    });

    if (!hasRecentWeekly) {
      return {
        shouldTrigger: true,
        triggerType: 'weekly'
      };
    }

    return { shouldTrigger: false };
  }, [user?.uid, ensureEncountersEnabled]);

  return {
    checkQuestMilestone,
    checkEpicCheckpoint,
    checkWeeklyTrigger
  };
};
