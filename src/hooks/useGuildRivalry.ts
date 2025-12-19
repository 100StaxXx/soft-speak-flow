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

export const useGuildRivalry = (epicId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch user's rivalry in this epic
  const { data: rivalry, isLoading } = useQuery<GuildRivalry | null>({
    queryKey: ["guild-rivalry", epicId, user?.id],
    queryFn: async () => {
      if (!epicId || !user) return null;

      const { data, error } = await supabase
        .from("guild_rivalries")
        .select(`
          *,
          rival:profiles!guild_rivalries_rival_id_fkey(email)
        `)
        .eq("epic_id", epicId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data as GuildRivalry | null;
    },
    enabled: !!epicId && !!user,
  });

  // Set a rival
  const setRival = useMutation({
    mutationFn: async (rivalId: string) => {
      if (!user || !epicId) throw new Error("Not authenticated or no epic");

      // Prevent self-rivalry
      if (rivalId === user.id) {
        throw new Error("You cannot set yourself as a rival");
      }

      // Upsert rivalry (replace if exists)
      const { data, error } = await supabase
        .from("guild_rivalries")
        .upsert(
          {
            epic_id: epicId,
            user_id: user.id,
            rival_id: rivalId,
          },
          { onConflict: 'epic_id,user_id' }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Rival set! ⚔️ Let the competition begin!");
      queryClient.invalidateQueries({ queryKey: ["guild-rivalry", epicId] });
    },
    onError: (error) => {
      toast.error("Failed to set rival");
      console.error("Rivalry error:", error);
    },
  });

  // Remove rivalry
  const removeRival = useMutation({
    mutationFn: async () => {
      if (!user || !epicId) throw new Error("Not authenticated or no epic");

      const { error } = await supabase
        .from("guild_rivalries")
        .delete()
        .eq("epic_id", epicId)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rivalry ended");
      queryClient.invalidateQueries({ queryKey: ["guild-rivalry", epicId] });
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
