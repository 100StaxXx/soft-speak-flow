/**
 * useGuildBoss Hook
 * Manages guild boss encounters, damage dealing, and real-time HP updates
 */

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export interface BossEncounter {
  id: string;
  community_id: string | null;
  epic_id: string | null;
  boss_name: string;
  boss_title: string | null;
  boss_lore: string | null;
  boss_image_url: string | null;
  boss_tier: string;
  max_hp: number;
  current_hp: number;
  status: string;
  spawned_at: string;
  expires_at: string;
  defeated_at: string | null;
  xp_reward: number;
}

export interface DamageLogEntry {
  id: string;
  encounter_id: string;
  user_id: string;
  damage_amount: number;
  damage_source: string;
  source_id: string | null;
  is_killing_blow: boolean;
  created_at: string;
  profile?: {
    email: string | null;
    onboarding_data: unknown;
  };
}

interface UseGuildBossOptions {
  epicId?: string;
  communityId?: string;
}

export const useGuildBoss = ({ epicId, communityId }: UseGuildBossOptions) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [realtimeHp, setRealtimeHp] = useState<number | null>(null);

  // Fetch active boss encounter
  const { data: activeBoss, isLoading: isLoadingBoss } = useQuery({
    queryKey: ["guild-boss", epicId, communityId],
    queryFn: async () => {
      let query = supabase
        .from("guild_boss_encounters")
        .select("*")
        .eq("status", "active")
        .gte("expires_at", new Date().toISOString())
        .order("spawned_at", { ascending: false })
        .limit(1);

      if (epicId) {
        query = query.eq("epic_id", epicId);
      } else if (communityId) {
        query = query.eq("community_id", communityId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data?.[0] as BossEncounter | undefined;
    },
    enabled: !!(epicId || communityId),
    refetchInterval: 30000, // Refetch every 30 seconds for expiry check
  });

  // Real-time HP updates
  useEffect(() => {
    if (!activeBoss) {
      setRealtimeHp(null);
      return;
    }

    setRealtimeHp(activeBoss.current_hp);

    const channel = supabase
      .channel(`boss-hp-${activeBoss.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'guild_boss_encounters',
          filter: `id=eq.${activeBoss.id}`,
        },
        (payload) => {
          const updated = payload.new as BossEncounter;
          setRealtimeHp(updated.current_hp);
          
          if (updated.status === 'defeated') {
            toast({
              title: "🎉 Boss Defeated!",
              description: `${updated.boss_name} has been vanquished!`,
            });
            queryClient.invalidateQueries({ queryKey: ["guild-boss"] });
            queryClient.invalidateQueries({ queryKey: ["guild-legends"] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeBoss?.id, queryClient]);

  // Fetch damage log
  const { data: damageLog } = useQuery({
    queryKey: ["boss-damage-log", activeBoss?.id],
    queryFn: async () => {
      if (!activeBoss) return [];

      const { data, error } = await supabase
        .from("guild_boss_damage_log")
        .select(`
          *,
          profile:profiles!guild_boss_damage_log_user_id_fkey(email, onboarding_data)
        `)
        .eq("encounter_id", activeBoss.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as DamageLogEntry[];
    },
    enabled: !!activeBoss,
  });

  // Calculate user's total damage to current boss
  const myTotalDamage = damageLog
    ?.filter(entry => entry.user_id === user?.id)
    .reduce((sum, entry) => sum + entry.damage_amount, 0) ?? 0;

  // Calculate damage leaderboard
  const damageLeaderboard = damageLog
    ? Object.values(
        damageLog.reduce((acc, entry) => {
          if (!acc[entry.user_id]) {
            acc[entry.user_id] = {
              userId: entry.user_id,
              totalDamage: 0,
              profile: entry.profile,
              isKillingBlow: false,
            };
          }
          acc[entry.user_id].totalDamage += entry.damage_amount;
          if (entry.is_killing_blow) {
            acc[entry.user_id].isKillingBlow = true;
          }
          return acc;
        }, {} as Record<string, { userId: string; totalDamage: number; profile?: DamageLogEntry['profile']; isKillingBlow: boolean }>)
      ).sort((a, b) => b.totalDamage - a.totalDamage)
    : [];

  // Deal damage to boss (called when completing habits/quests)
  const dealDamage = useMutation({
    mutationFn: async ({
      damageAmount,
      damageSource,
      sourceId,
    }: {
      damageAmount: number;
      damageSource: string;
      sourceId?: string;
    }) => {
      if (!user || !activeBoss) throw new Error("No active boss to damage");

      const newHp = Math.max(0, activeBoss.current_hp - damageAmount);
      const isKillingBlow = newHp === 0;

      // Log the damage
      const { data: logEntry, error: logError } = await supabase
        .from("guild_boss_damage_log")
        .insert({
          encounter_id: activeBoss.id,
          user_id: user.id,
          damage_amount: damageAmount,
          damage_source: damageSource,
          source_id: sourceId,
          is_killing_blow: isKillingBlow,
        })
        .select()
        .single();

      if (logError) throw logError;

      // Update boss HP (service role needed for this, so use edge function in production)
      // For now, we'll log the damage and let a trigger/function handle HP update

      return { logEntry, isKillingBlow };
    },
    onSuccess: ({ isKillingBlow }) => {
      if (isKillingBlow) {
        toast({
          title: "⚔️ KILLING BLOW!",
          description: "You struck the final blow!",
        });
      } else {
        toast({
          title: "💥 Damage dealt!",
          description: "Your contribution weakens the boss!",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["boss-damage-log"] });
    },
    onError: (error: Error) => {
      console.error("Failed to deal damage:", error);
    },
  });

  // Get boss HP percentage
  const hpPercentage = activeBoss 
    ? Math.max(0, ((realtimeHp ?? activeBoss.current_hp) / activeBoss.max_hp) * 100)
    : 0;

  // Get time remaining
  const getTimeRemaining = () => {
    if (!activeBoss) return null;
    
    const expiresAt = new Date(activeBoss.expires_at);
    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();
    
    if (diff <= 0) return "Expired";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  return {
    activeBoss,
    currentHp: realtimeHp ?? activeBoss?.current_hp ?? 0,
    hpPercentage,
    damageLog,
    damageLeaderboard,
    myTotalDamage,
    dealDamage,
    getTimeRemaining,
    isLoading: isLoadingBoss,
    hasBoss: !!activeBoss,
  };
};
