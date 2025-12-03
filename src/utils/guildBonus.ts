import { supabase } from "@/integrations/supabase/client";

interface GuildBonusResult {
  bonusXP: number;
  toastReason: string;
}

/**
 * Calculate guild bonus XP for task completion
 * Returns 10% bonus if user is member of an active public epic
 */
export const calculateGuildBonus = async (
  userId: string | undefined, 
  baseXP: number
): Promise<GuildBonusResult> => {
  if (!userId) {
    return { bonusXP: 0, toastReason: 'Task Complete!' };
  }

  try {
    const { data: epicHabits, error: epicError } = await supabase
      .from('epic_habits')
      .select('epic_id, epics!inner(is_public, status)')
      .eq('epics.status', 'active')
      .eq('epics.is_public', true);

    if (epicError) {
      console.error('Failed to fetch epic habits:', epicError);
      return { bonusXP: 0, toastReason: 'Task Complete!' };
    }

    if (!epicHabits || epicHabits.length === 0) {
      return { bonusXP: 0, toastReason: 'Task Complete!' };
    }

    const { data: memberships, error: memberError } = await supabase
      .from('epic_members')
      .select('epic_id')
      .eq('user_id', userId)
      .in('epic_id', epicHabits.map((eh: { epic_id: string }) => eh.epic_id));

    if (memberError) {
      console.error('Failed to fetch memberships:', memberError);
      return { bonusXP: 0, toastReason: 'Task Complete!' };
    }

    if (memberships && memberships.length > 0) {
      const rawBonus = Math.round(baseXP * 0.1);
      const bonusXP = baseXP > 0 ? Math.max(1, rawBonus) : 0;
      return { bonusXP, toastReason: `Task Complete! +${bonusXP} Guild Bonus (10%) 🎯` };
    }
  } catch (error) {
    console.error('Unexpected error computing guild bonus:', error);
  }

  return { bonusXP: 0, toastReason: 'Task Complete!' };
};
