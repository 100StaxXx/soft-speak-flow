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
}

export const useEncounterTrigger = () => {
  const { user } = useAuth();
  const questCountRef = useRef<number | null>(null);

  useEffect(() => {
    questCountRef.current = null;
  }, [user?.id]);

  // Check for quest milestone trigger (every 20 quests)
  const checkQuestMilestone = useCallback(async (): Promise<TriggerResult> => {
    if (!user?.id) return { shouldTrigger: false };

    if (questCountRef.current === null) {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('total_quests_completed')
        .eq('id', user.id)
        .single();

      if (error || !profile) {
        console.error('Failed to fetch quest count', error);
        return { shouldTrigger: false };
      }

      questCountRef.current = profile.total_quests_completed || 0;
    }

    questCountRef.current += 1;
    const newTotal = questCountRef.current;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ total_quests_completed: newTotal })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to update quest count', updateError);
      questCountRef.current -= 1;
      return { shouldTrigger: false };
    }

    if (newTotal > 0 && newTotal % 20 === 0) {
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
  }, [user?.id]);

  // Check for weekly trigger (once per 7 days)
  const checkWeeklyTrigger = useCallback(async (): Promise<TriggerResult> => {
    if (!user?.id) return { shouldTrigger: false };

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
  }, [user?.id]);

  return {
    checkQuestMilestone,
    checkEpicCheckpoint,
    checkWeeklyTrigger
  };
};
