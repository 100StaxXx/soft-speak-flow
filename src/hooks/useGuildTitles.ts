/**
 * useGuildTitles Hook
 * Manages guild titles and user earned titles
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export interface GuildTitle {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
  requirement_type: string;
  requirement_value: number;
  theme_color: string;
}

export interface MemberTitle {
  id: string;
  user_id: string;
  title_id: string;
  community_id: string | null;
  epic_id: string | null;
  is_active: boolean;
  earned_at: string;
  title?: GuildTitle;
}

interface UseGuildTitlesOptions {
  epicId?: string;
  communityId?: string;
}

export const useGuildTitles = ({ epicId, communityId }: UseGuildTitlesOptions) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all available titles
  const { data: allTitles, isLoading: isLoadingTitles } = useQuery({
    queryKey: ["guild-titles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guild_titles")
        .select("*")
        .order("requirement_value", { ascending: true });

      if (error) throw error;
      return data as GuildTitle[];
    },
  });

  // Fetch user's earned titles
  const { data: myTitles, isLoading: isLoadingMyTitles } = useQuery({
    queryKey: ["my-guild-titles", user?.id, epicId, communityId],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from("guild_member_titles")
        .select(`
          *,
          title:guild_titles(*)
        `)
        .eq("user_id", user.id);

      if (epicId) {
        query = query.eq("epic_id", epicId);
      } else if (communityId) {
        query = query.eq("community_id", communityId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as MemberTitle[];
    },
    enabled: !!user,
  });

  // Get active title
  const activeTitle = myTitles?.find(t => t.is_active)?.title || null;

  // Set active title
  const setActiveTitle = useMutation({
    mutationFn: async (titleId: string | null) => {
      if (!user) throw new Error("Not authenticated");

      // First, deactivate all titles
      let deactivateQuery = supabase
        .from("guild_member_titles")
        .update({ is_active: false })
        .eq("user_id", user.id);

      if (epicId) {
        deactivateQuery = deactivateQuery.eq("epic_id", epicId);
      } else if (communityId) {
        deactivateQuery = deactivateQuery.eq("community_id", communityId);
      }

      await deactivateQuery;

      // If titleId is null, just deactivate
      if (!titleId) return null;

      // Activate the selected title
      let activateQuery = supabase
        .from("guild_member_titles")
        .update({ is_active: true })
        .eq("user_id", user.id)
        .eq("title_id", titleId);

      if (epicId) {
        activateQuery = activateQuery.eq("epic_id", epicId);
      } else if (communityId) {
        activateQuery = activateQuery.eq("community_id", communityId);
      }

      const { data, error } = await activateQuery.select().single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Title updated! 👑",
        description: "Your new title is now displayed.",
      });
      queryClient.invalidateQueries({ queryKey: ["my-guild-titles"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update title",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Check if user has earned a title (but not yet claimed)
  const checkEarnedTitles = (stats: {
    blessingsSent?: number;
    bossKills?: number;
    streakDays?: number;
    ritualsAttended?: number;
    damageDealt?: number;
  }) => {
    if (!allTitles) return [];

    const earnedTitleIds = new Set(myTitles?.map(t => t.title_id) || []);
    const newlyEarned: GuildTitle[] = [];

    allTitles.forEach(title => {
      if (earnedTitleIds.has(title.id)) return;

      let earned = false;
      switch (title.requirement_type) {
        case 'blessings_sent':
          earned = (stats.blessingsSent ?? 0) >= title.requirement_value;
          break;
        case 'boss_kills':
          earned = (stats.bossKills ?? 0) >= title.requirement_value;
          break;
        case 'streak_days':
          earned = (stats.streakDays ?? 0) >= title.requirement_value;
          break;
        case 'rituals_attended':
          earned = (stats.ritualsAttended ?? 0) >= title.requirement_value;
          break;
        case 'damage_dealt':
          earned = (stats.damageDealt ?? 0) >= title.requirement_value;
          break;
      }

      if (earned) {
        newlyEarned.push(title);
      }
    });

    return newlyEarned;
  };

  // Get rarity color
  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common':
        return 'text-gray-400';
      case 'rare':
        return 'text-blue-400';
      case 'epic':
        return 'text-purple-400';
      case 'legendary':
        return 'text-yellow-400';
      default:
        return 'text-foreground';
    }
  };

  return {
    allTitles,
    myTitles,
    activeTitle,
    setActiveTitle,
    checkEarnedTitles,
    getRarityColor,
    isLoading: isLoadingTitles || isLoadingMyTitles,
  };
};
