/**
 * useGuildProphecies Hook
 * Manages guild prophecies and predictions
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { addDays } from "date-fns";

export interface GuildProphecy {
  id: string;
  community_id: string | null;
  epic_id: string | null;
  prophet_id: string;
  subject_id: string;
  prophecy_type: string;
  prophecy_text: string;
  target_value: number | null;
  expires_at: string;
  is_fulfilled: boolean;
  fulfilled_at: string | null;
  xp_reward: number;
  created_at: string;
  prophet?: {
    email: string | null;
    onboarding_data: unknown;
  };
  subject?: {
    email: string | null;
    onboarding_data: unknown;
  };
}

interface UseGuildPropheciesOptions {
  epicId?: string;
  communityId?: string;
}

export const useGuildProphecies = ({ epicId, communityId }: UseGuildPropheciesOptions) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch prophecies
  const { data: prophecies, isLoading } = useQuery({
    queryKey: ["guild-prophecies", epicId, communityId],
    queryFn: async () => {
      let query = supabase
        .from("guild_prophecies")
        .select(`
          *,
          prophet:profiles!guild_prophecies_prophet_id_fkey(email, onboarding_data),
          subject:profiles!guild_prophecies_subject_id_fkey(email, onboarding_data)
        `)
        .order("created_at", { ascending: false });

      if (epicId) {
        query = query.eq("epic_id", epicId);
      } else if (communityId) {
        query = query.eq("community_id", communityId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as GuildProphecy[];
    },
    enabled: !!(epicId || communityId),
  });

  // Check if user can create prophecy (limit 1 per day)
  const { data: canCreate } = useQuery({
    queryKey: ["can-create-prophecy", user?.id, epicId, communityId],
    queryFn: async () => {
      if (!user) return false;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let query = supabase
        .from("guild_prophecies")
        .select("id", { count: "exact" })
        .eq("prophet_id", user.id)
        .gte("created_at", today.toISOString());

      if (epicId) {
        query = query.eq("epic_id", epicId);
      } else if (communityId) {
        query = query.eq("community_id", communityId);
      }

      const { count, error } = await query;

      if (error) throw error;
      return (count || 0) < 1;
    },
    enabled: !!user,
  });

  // Create prophecy
  const createProphecy = useMutation({
    mutationFn: async ({
      subjectId,
      prophecyType,
      prophecyText,
      targetValue,
    }: {
      subjectId: string;
      prophecyType: string;
      prophecyText: string;
      targetValue?: number;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const expiresAt = addDays(new Date(), 7); // 7 day expiry

      const { data, error } = await supabase
        .from("guild_prophecies")
        .insert({
          community_id: communityId || null,
          epic_id: epicId || null,
          prophet_id: user.id,
          subject_id: subjectId,
          prophecy_type: prophecyType,
          prophecy_text: prophecyText,
          target_value: targetValue || null,
          expires_at: expiresAt.toISOString(),
          xp_reward: 50, // Base XP reward
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Prophecy spoken! 🔮",
        description: "Your vision has been recorded in the stars.",
      });
      queryClient.invalidateQueries({ queryKey: ["guild-prophecies"] });
      queryClient.invalidateQueries({ queryKey: ["can-create-prophecy"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create prophecy",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Get prophecy type config
  const getProphecyConfig = (type: string) => {
    switch (type) {
      case 'streak_milestone':
        return {
          color: 'text-orange-400',
          bgColor: 'bg-orange-500/10',
          label: 'Streak',
        };
      case 'boss_defeat':
        return {
          color: 'text-red-400',
          bgColor: 'bg-red-500/10',
          label: 'Boss',
        };
      case 'blessing_chain':
        return {
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-500/10',
          label: 'Blessing',
        };
      case 'habit_mastery':
        return {
          color: 'text-purple-400',
          bgColor: 'bg-purple-500/10',
          label: 'Mastery',
        };
      default:
        return {
          color: 'text-primary',
          bgColor: 'bg-primary/10',
          label: 'Prophecy',
        };
    }
  };

  return {
    prophecies,
    createProphecy,
    canCreate: canCreate ?? false,
    getProphecyConfig,
    isLoading,
    isCreating: createProphecy.isPending,
  };
};