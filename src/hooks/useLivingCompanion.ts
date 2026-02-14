 /**
  * useLivingCompanion - Central orchestration for companion reactions
  * Ties together budget checking, reaction selection, and popup display
  */
 
 import { useCallback } from "react";
 import { useAuth } from "@/hooks/useAuth";
 import { useReactionBudget } from "@/hooks/useReactionBudget";
 import { useReactionSelector } from "@/hooks/useReactionSelector";
import { useTalkPopupContext, useTalkPopupContextSafe } from "@/contexts/TalkPopupContext";
 import { 
   type SourceSystem, 
   type MomentType, 
   type ContextTag,
   DEFAULT_MOMENT_TYPE 
 } from "@/config/reactionPools";
 
 interface TriggerOptions {
   momentType?: MomentType;
   contextTags?: ContextTag[];
   // Force show even if budget exceeded (for testing)
   force?: boolean;
 }
 
 export const useLivingCompanion = () => {
   const { user } = useAuth();
   const { checkBudget, incrementBudget } = useReactionBudget();
   const { selectReaction, recordReaction } = useReactionSelector();
   const { show } = useTalkPopupContext();
 
   /**
    * Trigger a companion reaction for a specific source/event
    * 
    * @param source - The feature that triggered the reaction (quest, ritual, etc.)
    * @param options - Optional moment type and context tags
    * @returns Whether a reaction was shown
    */
   const triggerReaction = useCallback(async (
     source: SourceSystem,
     options: TriggerOptions = {}
   ): Promise<boolean> => {
     if (!user?.id) return false;
 
     const { 
       momentType = DEFAULT_MOMENT_TYPE, 
       contextTags = [],
       force = false 
     } = options;
 
     // 1. Check budget (unless forced)
     if (!force) {
       const budget = await checkBudget(source);
       if (!budget.canShow) {
         console.log(`[LivingCompanion] Budget exceeded for ${source}`);
         return false;
       }
     }
 
     // 2. Select a reaction
     const { reaction, reason } = await selectReaction(source, momentType, contextTags);
 
     if (!reaction) {
       console.log(`[LivingCompanion] No reaction available: ${reason}`);
       return false;
     }
 
     // 3. Show the popup
     await show({ message: reaction.text });
 
     // 4. Record to history and increment budget
     await Promise.all([
       recordReaction(reaction, source, momentType),
       incrementBudget(source),
     ]);
 
     console.log(`[LivingCompanion] Showed reaction: "${reaction.text}" (${reaction.tone_tag})`);
     return true;
   }, [user?.id, checkBudget, selectReaction, show, recordReaction, incrementBudget]);
 
   /**
    * Helper to check if late night (11pm-4am local time)
    */
   const isLateNight = useCallback((): boolean => {
     const hour = new Date().getHours();
     return hour >= 23 || hour < 4;
   }, []);
 
   /**
    * Trigger resist victory reaction with automatic late night detection
    */
   const triggerResistVictory = useCallback(async (): Promise<boolean> => {
     const contextTags: ContextTag[] = isLateNight() ? ['late_night'] : [];
     return triggerReaction('resist', { 
       momentType: 'urge_defeated',
       contextTags 
     });
   }, [triggerReaction, isLateNight]);
 
   /**
    * Trigger quest completion reaction
    */
   const triggerQuestComplete = useCallback(async (
     isFirstToday: boolean = false
   ): Promise<boolean> => {
     // Only trigger if first quest today (per budget rules)
     if (!isFirstToday) return false;
     return triggerReaction('quest', { momentType: 'momentum_gain' });
   }, [triggerReaction]);
 
   /**
    * Trigger ritual completion reaction
    */
   const triggerRitualComplete = useCallback(async (
     isFirstToday: boolean = false,
     completedAllRituals: boolean = false
   ): Promise<boolean> => {
     if (!isFirstToday && !completedAllRituals) return false;
     
     const momentType: MomentType = completedAllRituals ? 'breakthrough' : 'discipline_win';
     return triggerReaction('ritual', { momentType });
   }, [triggerReaction]);
 
   /**
    * Trigger pomodoro completion reaction
    */
   const triggerPomodoroComplete = useCallback(async (
     durationMinutes: number
   ): Promise<boolean> => {
     // Only trigger for sessions >= 15 minutes
     if (durationMinutes < 15) return false;
     return triggerReaction('pomodoro', { momentType: 'focus_proof' });
   }, [triggerReaction]);
 
   /**
    * Trigger comeback reaction (first action after lapse)
    */
   const triggerComeback = useCallback(async (): Promise<boolean> => {
     return triggerReaction('quest', { momentType: 'comeback' });
   }, [triggerReaction]);
 
   return {
     triggerReaction,
     triggerResistVictory,
     triggerQuestComplete,
     triggerRitualComplete,
     triggerPomodoroComplete,
     triggerComeback,
     isLateNight,
   };
 };

/**
 * Safe version of useLivingCompanion that returns no-op functions
 * when used outside TalkPopupProvider. This allows hooks to be called
 * unconditionally without try/catch blocks.
 */
export const useLivingCompanionSafe = () => {
  const { user } = useAuth();
  const talkPopup = useTalkPopupContextSafe();
  const { checkBudget, incrementBudget } = useReactionBudget();
  const { selectReaction, recordReaction } = useReactionSelector();

  const triggerReaction = useCallback(async (
    source: SourceSystem,
    options: {
      momentType?: MomentType;
      contextTags?: ContextTag[];
      force?: boolean;
    } = {}
  ): Promise<boolean> => {
    if (!user?.id) return false;

    const { 
      momentType = DEFAULT_MOMENT_TYPE, 
      contextTags = [],
      force = false 
    } = options;

    if (!force) {
      const budget = await checkBudget(source);
      if (!budget.canShow) {
        console.log(`[LivingCompanion] Budget exceeded for ${source}`);
        return false;
      }
    }

    const { reaction, reason } = await selectReaction(source, momentType, contextTags);

    if (!reaction) {
      console.log(`[LivingCompanion] No reaction available: ${reason}`);
      return false;
    }

    await talkPopup.show({ message: reaction.text });

    await Promise.all([
      recordReaction(reaction, source, momentType),
      incrementBudget(source),
    ]);

    console.log(`[LivingCompanion] Showed reaction: "${reaction.text}" (${reaction.tone_tag})`);
    return true;
  }, [user?.id, checkBudget, selectReaction, talkPopup, recordReaction, incrementBudget]);

  const isLateNight = useCallback((): boolean => {
    const hour = new Date().getHours();
    return hour >= 23 || hour < 4;
  }, []);

  const triggerResistVictory = useCallback(async (): Promise<boolean> => {
    const contextTags: ContextTag[] = isLateNight() ? ['late_night'] : [];
    return triggerReaction('resist', { 
      momentType: 'urge_defeated',
      contextTags 
    });
  }, [triggerReaction, isLateNight]);

  const triggerQuestComplete = useCallback(async (
    isFirstToday: boolean = false
  ): Promise<boolean> => {
    if (!isFirstToday) return false;
    return triggerReaction('quest', { momentType: 'momentum_gain' });
  }, [triggerReaction]);

  const triggerRitualComplete = useCallback(async (
    isFirstToday: boolean = false,
    completedAllRituals: boolean = false
  ): Promise<boolean> => {
    if (!isFirstToday && !completedAllRituals) return false;
    
    const momentType: MomentType = completedAllRituals ? 'breakthrough' : 'discipline_win';
    return triggerReaction('ritual', { momentType });
  }, [triggerReaction]);

  const triggerPomodoroComplete = useCallback(async (
    durationMinutes: number
  ): Promise<boolean> => {
    if (durationMinutes < 15) return false;
    return triggerReaction('pomodoro', { momentType: 'focus_proof' });
  }, [triggerReaction]);

  const triggerComeback = useCallback(async (): Promise<boolean> => {
    return triggerReaction('quest', { momentType: 'comeback' });
  }, [triggerReaction]);

  return {
    triggerReaction,
    triggerResistVictory,
    triggerQuestComplete,
    triggerRitualComplete,
    triggerPomodoroComplete,
    triggerComeback,
    isLateNight,
  };
};
