import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDocuments, setDocument, deleteDocument, timestampToISO } from "@/lib/firebase/firestore";
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
    queryKey: ["muted-users", user?.uid, epicId],
    queryFn: async () => {
      if (!user?.uid) return [];

      // Get all mutes for this user
      const allMutes = await getDocuments<MutedUser>(
        "muted_guild_users",
        [["user_id", "==", user.uid]]
      );

      // Filter: include epic-specific mutes and global mutes (epic_id is null)
      const filtered = epicId
        ? allMutes.filter(m => m.epic_id === epicId || m.epic_id === null)
        : allMutes;

      return filtered.map(m => ({
        ...m,
        muted_at: timestampToISO(m.muted_at as any) || m.muted_at || new Date().toISOString(),
      }));
    },
    enabled: !!user?.uid,
  });

  const muteUser = useMutation({
    mutationFn: async ({ mutedUserId, epicId: muteEpicId }: { mutedUserId: string; epicId?: string }) => {
      if (!user?.uid) throw new Error("Not authenticated");

      const muteId = `${user.uid}_${mutedUserId}_${muteEpicId || 'global'}`;
      await setDocument("muted_guild_users", muteId, {
        id: muteId,
        user_id: user.uid,
        muted_user_id: mutedUserId,
        epic_id: muteEpicId || null,
        muted_at: new Date().toISOString(),
      }, false);
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
      if (!user?.uid) throw new Error("Not authenticated");

      // Find the mute record to delete
      const mutes = await getDocuments(
        "muted_guild_users",
        [
          ["user_id", "==", user.uid],
          ["muted_user_id", "==", mutedUserId],
        ]
      );

      // Filter by epic_id if provided
      const toDelete = muteEpicId
        ? mutes.find(m => m.epic_id === muteEpicId)
        : mutes.find(m => m.epic_id === null);

      if (toDelete) {
        await deleteDocument("muted_guild_users", toDelete.id);
      }
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
