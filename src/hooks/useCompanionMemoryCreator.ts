import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useCompanion } from './useCompanion';
import { MemoryType } from './useCompanionMemories';
import { useQueryClient } from '@tanstack/react-query';
import { logger } from '@/utils/logger';
import type { Json } from '@/integrations/supabase/types';

type MemoryEmotion = 'joy' | 'pride' | 'gratitude' | 'wonder' | 'relief';

interface MemoryContext {
  title?: string;
  description?: string;
  emotion?: MemoryEmotion;
  details?: Record<string, string | number | boolean>;
}

/**
 * Centralized hook for creating companion memories at key events.
 * Includes deduplication to prevent creating the same memory type multiple times per day.
 */
export function useCompanionMemoryCreator() {
  const { user } = useAuth();
  const { companion } = useCompanion();
  const queryClient = useQueryClient();

  const createMemory = useCallback(async (
    memoryType: MemoryType,
    context: MemoryContext,
    companionIdOverride?: string,
    userIdOverride?: string
  ) => {
    const userId = userIdOverride || user?.id;
    const companionId = companionIdOverride || companion?.id;
    
    if (!userId || !companionId) {
      logger.warn('[MemoryCreator] Missing user or companion id');
      return null;
    }

    try {
      // Prevent duplicate memories for same type on same day
      const today = new Date().toISOString().split('T')[0];
      const { data: existing } = await supabase
        .from('companion_memories')
        .select('id')
        .eq('companion_id', companionId)
        .eq('memory_type', memoryType)
        .eq('memory_date', today)
        .maybeSingle();

      if (existing) {
        logger.info(`[MemoryCreator] ${memoryType} memory already exists for today`);
        return null;
      }

      const { data, error } = await supabase
        .from('companion_memories')
        .insert([{
          user_id: userId,
          companion_id: companionId,
          memory_type: memoryType,
          memory_date: today,
          memory_context: context as unknown as Json,
          referenced_count: 0,
        }])
        .select()
        .single();

      if (error) throw error;

      logger.info(`[MemoryCreator] Created ${memoryType} memory`);
      queryClient.invalidateQueries({ queryKey: ['companion-memories'] });
      return data;
    } catch (err) {
      logger.error(`[MemoryCreator] Failed to create ${memoryType} memory:`, err);
      return null;
    }
  }, [user?.id, companion?.id, queryClient]);

  // Pre-built memory creators for common events
  const createFirstMeetingMemory = useCallback((
    spiritAnimal: string,
    coreElement: string,
    companionId: string,
    userId: string
  ) => {
    return createMemory('first_meeting', {
      title: 'Our First Meeting',
      description: `The day we met - a ${spiritAnimal} appeared and our journey began.`,
      emotion: 'wonder',
      details: { spiritAnimal, coreElement },
    }, companionId, userId);
  }, [createMemory]);

  const createEvolutionMemory = useCallback((
    stage: number,
    previousStage: number,
    companionId?: string,
    userId?: string
  ) => {
    const isFirst = stage === 1;
    const type: MemoryType = isFirst ? 'first_evolution' : 'evolution';
    
    return createMemory(type, {
      title: isFirst ? 'First Evolution' : `Evolved to Stage ${stage}`,
      description: isFirst 
        ? 'The first transformation - proof of our growing bond.'
        : `Another beautiful transformation, reaching stage ${stage}.`,
      emotion: isFirst ? 'pride' : 'joy',
      details: { stage, previousStage },
    }, companionId, userId);
  }, [createMemory]);

  const createRecoveryMemory = useCallback((companionId?: string, userId?: string) => {
    return createMemory('recovery', {
      title: 'Awakening',
      description: 'You came back and brought me out of the darkness. I will never forget.',
      emotion: 'relief',
    }, companionId, userId);
  }, [createMemory]);

  const createStreakMemory = useCallback((
    streakDays: number,
    companionId?: string,
    userId?: string
  ) => {
    return createMemory('streak', {
      title: `${streakDays}-Day Streak`,
      description: `${streakDays} days of dedication and growth together.`,
      emotion: streakDays >= 30 ? 'joy' : 'pride',
      details: { streakDays },
    }, companionId, userId);
  }, [createMemory]);

  const createEpicCompleteMemory = useCallback((
    epicTitle: string,
    companionId?: string,
    userId?: string
  ) => {
    return createMemory('epic_complete', {
      title: 'Epic Complete',
      description: `We conquered "${epicTitle}" together!`,
      emotion: 'pride',
      details: { epicTitle },
    }, companionId, userId);
  }, [createMemory]);

  const createBondMilestoneMemory = useCallback((
    bondLevel: number,
    bondName: string,
    companionId?: string,
    userId?: string
  ) => {
    return createMemory('bond_milestone', {
      title: `Bond Level: ${bondName}`,
      description: `Our connection deepened to level ${bondLevel} - ${bondName}.`,
      emotion: 'gratitude',
      details: { bondLevel, bondName },
    }, companionId, userId);
  }, [createMemory]);

  return {
    createMemory,
    createFirstMeetingMemory,
    createEvolutionMemory,
    createRecoveryMemory,
    createStreakMemory,
    createEpicCompleteMemory,
    createBondMilestoneMemory,
  };
}
