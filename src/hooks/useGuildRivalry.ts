import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface GuildRivalry {
  id: string;
  epic_id: string;
  community_id: string | null;
  user_id: string;
  rival_id: string;
  created_at: string;
  rival?: {
    email: string | null;
  };
}

interface UseGuildRivalryOptions {
  epicId?: string;
  communityId?: string;
}

export const useGuildRivalry = (options: UseGuildRivalryOptions | string = {}) => {
  // Support both old signature (epicId string) and new options object
  const { epicId, communityId } = typeof options === 'string' 
    ? { epicId: options, communityId: undefined } 
    : options;

  const { user } = useAuth();
  const queryClient = useQueryClient();

  const queryKeyId = communityId || epicId;
  const queryKeyType = communityId ? 'community' : 'epic';

  // Fetch user's rivalry in this epic or community
  const { data: rivalry, isLoading } = useQuery<GuildRivalry | null>({
    queryKey: ["guild-rivalry", queryKeyType, queryKeyId, user?.id],
    queryFn: async () => {
      if ((!epicId && !communityId) || !user) return null;

      let query = supabase
        .from("guild_rivalries")
        .select(`
          *,
          rival:profiles!guild_rivalries_rival_id_fkey(email)
        `)
        .eq("user_id", user.id);

      if (communityId) {
        query = query.eq("community_id", communityId);
      } else if (epicId) {
        query = query.eq("epic_id", epicId);
      }

      const { data, error } = await query.maybeSingle();

      if (error) throw error;
      return data as GuildRivalry | null;
    },
    enabled: !!(epicId || communityId) && !!user,
  });

  // Set a rival
  const setRival = useMutation({
    mutationFn: async (rivalId: string) => {
      if (!user) throw new Error("Not authenticated");
      if (!epicId && !communityId) throw new Error("No epic or community specified");

      // Prevent self-rivalry
      if (rivalId === user.id) {
        throw new Error("You cannot set yourself as a rival");
      }

      const insertData = {
        epic_id: epicId || null,
        community_id: communityId || null,
        user_id: user.id,
        rival_id: rivalId,
      };

      // Determine conflict columns based on context
      const onConflict = communityId ? 'community_id,user_id' : 'epic_id,user_id';

      // Upsert rivalry (replace if exists)
      const { data, error } = await supabase
        .from("guild_rivalries")
        .upsert(insertData, { onConflict })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Rival set! ⚔️ Let the competition begin!");
      queryClient.invalidateQueries({ queryKey: ["guild-rivalry", queryKeyType, queryKeyId] });
    },
    onError: (error) => {
      toast.error("Failed to set rival");
      console.error("Rivalry error:", error);
    },
  });

  // Remove rivalry
  const removeRival = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      if (!epicId && !communityId) throw new Error("No epic or community specified");

      let query = supabase
        .from("guild_rivalries")
        .delete()
        .eq("user_id", user.id);

      if (communityId) {
        query = query.eq("community_id", communityId);
      } else if (epicId) {
        query = query.eq("epic_id", epicId);
      }

      const { error } = await query;

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rivalry ended");
      queryClient.invalidateQueries({ queryKey: ["guild-rivalry", queryKeyType, queryKeyId] });
    },
    onError: (error) => {
      toast.error("Failed to remove rival");
      console.error("Remove rivalry error:", error);
    },
  });

  return {
    rivalry,
    rivalId: rivalry?.rival_id || null,
    isLoading,
    setRival,
    removeRival,
    isSettingRival: setRival.isPending,
  };
};
