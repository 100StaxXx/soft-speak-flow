// Hook to manage battle history

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BattleRewards, TurnResult, BattleResult, OpponentType } from '@/types/cardBattle';

interface SaveBattleParams {
  opponentType: OpponentType;
  opponentId?: string;
  result: BattleResult;
  cardsUsed: string[];
  turnsTaken: number;
  damageDealt: number;
  damageReceived: number;
  xpEarned: number;
  rewards: BattleRewards;
  battleLog: TurnResult[];
}

export function useBattleHistory() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const saveBattle = useMutation({
    mutationFn: async (params: SaveBattleParams) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('battle_history')
        .insert([{
          user_id: user.id,
          opponent_type: params.opponentType,
          opponent_id: params.opponentId || null,
          result: params.result,
          cards_used: params.cardsUsed,
          turns_taken: params.turnsTaken,
          damage_dealt: params.damageDealt,
          damage_received: params.damageReceived,
          xp_earned: params.xpEarned,
          rewards_claimed: JSON.parse(JSON.stringify(params.rewards)),
          battle_log: JSON.parse(JSON.stringify(params.battleLog)),
          completed_at: new Date().toISOString(),
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['battle-history'] });
      queryClient.invalidateQueries({ queryKey: ['battle-stats'] });
    },
  });
  
  const battleHistory = useQuery({
    queryKey: ['battle-history', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('battle_history')
        .select('*')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
  
  const battleStats = useQuery({
    queryKey: ['battle-stats', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('battle_history')
        .select('result, xp_earned, turns_taken')
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      const stats = {
        totalBattles: data.length,
        wins: data.filter(b => b.result === 'win').length,
        losses: data.filter(b => b.result === 'lose' || b.result === 'forfeit').length,
        totalXP: data.reduce((sum, b) => sum + (b.xp_earned || 0), 0),
        avgTurns: data.length > 0 
          ? Math.round(data.reduce((sum, b) => sum + (b.turns_taken || 0), 0) / data.length)
          : 0,
        winRate: data.length > 0
          ? Math.round((data.filter(b => b.result === 'win').length / data.length) * 100)
          : 0,
      };
      
      return stats;
    },
    enabled: !!user?.id,
  });
  
  return {
    saveBattle: saveBattle.mutateAsync,
    isSaving: saveBattle.isPending,
    battleHistory: battleHistory.data || [],
    isLoadingHistory: battleHistory.isLoading,
    battleStats: battleStats.data,
    isLoadingStats: battleStats.isLoading,
  };
}
