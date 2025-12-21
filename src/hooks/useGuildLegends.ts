/**
 * useGuildLegends Hook
 * Manages the Hall of Legends - permanent guild achievements
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GuildLegend {
  id: string;
  community_id: string | null;
  epic_id: string | null;
  legend_type: string;
  title: string;
  description: string;
  icon: string;
  hero_ids: string[];
  metadata: Record<string, unknown> | null;
  recorded_at: string;
  heroes?: Array<{
    id: string;
    email: string | null;
    onboarding_data: unknown;
  }>;
}

interface UseGuildLegendsOptions {
  epicId?: string;
  communityId?: string;
}

export const useGuildLegends = ({ epicId, communityId }: UseGuildLegendsOptions) => {
  // Fetch legends
  const { data: legends, isLoading } = useQuery({
    queryKey: ["guild-legends", epicId, communityId],
    queryFn: async () => {
      let query = supabase
        .from("guild_legends")
        .select("*")
        .order("recorded_at", { ascending: false });

      if (epicId) {
        query = query.eq("epic_id", epicId);
      } else if (communityId) {
        query = query.eq("community_id", communityId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch hero profiles
      const allHeroIds = [...new Set(data.flatMap(l => l.hero_ids || []))];
      
      if (allHeroIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email, onboarding_data")
          .in("id", allHeroIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        return data.map(legend => ({
          ...legend,
          heroes: (legend.hero_ids || []).map((id: string) => profileMap.get(id)).filter(Boolean),
        })) as GuildLegend[];
      }

      return data as GuildLegend[];
    },
    enabled: !!(epicId || communityId),
  });

  // Get legend type config
  const getLegendConfig = (type: string) => {
    switch (type) {
      case 'boss_defeated':
        return { 
          color: 'text-red-400', 
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/30',
          label: 'Boss Defeated' 
        };
      case 'milestone_reached':
        return { 
          color: 'text-blue-400', 
          bgColor: 'bg-blue-500/10',
          borderColor: 'border-blue-500/30',
          label: 'Milestone' 
        };
      case 'streak_record':
        return { 
          color: 'text-orange-400', 
          bgColor: 'bg-orange-500/10',
          borderColor: 'border-orange-500/30',
          label: 'Streak Record' 
        };
      case 'first_blood':
        return { 
          color: 'text-purple-400', 
          bgColor: 'bg-purple-500/10',
          borderColor: 'border-purple-500/30',
          label: 'First Blood' 
        };
      case 'perfect_week':
        return { 
          color: 'text-yellow-400', 
          bgColor: 'bg-yellow-500/10',
          borderColor: 'border-yellow-500/30',
          label: 'Perfect Week' 
        };
      default:
        return { 
          color: 'text-primary', 
          bgColor: 'bg-primary/10',
          borderColor: 'border-primary/30',
          label: 'Achievement' 
        };
    }
  };

  // Group legends by month
  const legendsByMonth = legends?.reduce((acc, legend) => {
    const date = new Date(legend.recorded_at);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    if (!acc[monthKey]) {
      acc[monthKey] = { label: monthLabel, legends: [] };
    }
    acc[monthKey].legends.push(legend);
    return acc;
  }, {} as Record<string, { label: string; legends: GuildLegend[] }>);

  return {
    legends,
    legendsByMonth,
    getLegendConfig,
    isLoading,
    hasLegends: (legends?.length ?? 0) > 0,
  };
};
