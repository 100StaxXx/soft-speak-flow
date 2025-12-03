import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

interface MutedUser {
  id: string;
  user_id: string;
  muted_user_id: string;
  epic_id: string | null;
  muted_at: string;
}

export const useMutedUsers = (epicId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: mutedUsers, isLoading } = useQuery<MutedUser[]>({
    queryKey: ["muted-users", user?.id, epicId],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from("muted_guild_users")
        .select("*")
        .eq("user_id", user.id);

      // Include both epic-specific mutes and global mutes (epic_id is null)
      if (epicId) {
        query = query.or(`epic_id.eq.${epicId},epic_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as MutedUser[];
    },
    enabled: !!user?.id,
  });

  const muteUser = useMutation({
    mutationFn: async ({ mutedUserId, epicId: muteEpicId }: { mutedUserId: string; epicId?: string }) => {
      if (!user?.id) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("muted_guild_users")
        .insert({
          user_id: user.id,
          muted_user_id: mutedUserId,
          epic_id: muteEpicId || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["muted-users"] });
      toast.success("User muted");
    },
    onError: (error) => {
      console.error("Failed to mute user:", error);
      toast.error("Failed to mute user");
    },
  });

  const unmuteUser = useMutation({
    mutationFn: async ({ mutedUserId, epicId: muteEpicId }: { mutedUserId: string; epicId?: string }) => {
      if (!user?.id) throw new Error("Not authenticated");

      let query = supabase
        .from("muted_guild_users")
        .delete()
        .eq("user_id", user.id)
        .eq("muted_user_id", mutedUserId);

      if (muteEpicId) {
        query = query.eq("epic_id", muteEpicId);
      } else {
        query = query.is("epic_id", null);
      }

      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["muted-users"] });
      toast.success("User unmuted");
    },
    onError: (error) => {
      console.error("Failed to unmute user:", error);
      toast.error("Failed to unmute user");
    },
  });

  const isUserMuted = (userId: string) => {
    return mutedUsers?.some(m => m.muted_user_id === userId) || false;
  };

  return {
    mutedUsers,
    isLoading,
    muteUser,
    unmuteUser,
    isUserMuted,
  };
};
